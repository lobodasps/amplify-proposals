import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { EntityProvider } from "./contexts/EntityContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache results for 60 seconds — prevents re-fetching on every navigation
      staleTime: 60 * 1000,
      // Don't refetch when the user switches browser tabs
      refetchOnWindowFocus: false,
      // Retry once on failure, not 3 times (reduces timeout pile-ups)
      retry: 1,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized =
    error.message === "UNAUTHORIZED" ||
    error.data?.code === "UNAUTHORIZED";

  if (!isUnauthorized) return;

  // Redirect to login page
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        // Get the current Supabase session and pass the JWT as Bearer token
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          return {
            Authorization: `Bearer ${session.access_token}`,
          };
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EntityProvider>
            <App />
        </EntityProvider>
      </AuthProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
