import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface AuthUser {
  id: string;
  openId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapSupabaseUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    openId: user.id,
    name: meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "User",
    email: user.email ?? "",
    avatarUrl: meta.avatar_url ?? null,
    role: meta.role ?? "user",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s }, error: e }) => {
      if (e) {
        setError(e);
      }
      setSession(s);
      setUser(s?.user ? mapSupabaseUser(s.user) : null);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ? mapSupabaseUser(s.user) : null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const { data, error: e } = await supabase.auth.refreshSession();
    if (e) setError(e);
    if (data.session) {
      setSession(data.session);
      setUser(data.session.user ? mapSupabaseUser(data.session.user) : null);
    }
  }, []);

  // Store user info for runtime debugging
  useEffect(() => {
    localStorage.setItem("manus-runtime-user-info", JSON.stringify(user));
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated: Boolean(session),
        error,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
