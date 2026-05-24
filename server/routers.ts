import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { pursuitsRouter } from "./routers/pursuits";
import { proposalsRouter } from "./routers/proposals";
import { assetsRouter } from "./routers/assets";
import { opportunitiesRouter } from "./routers/opportunities";
import { personnelRouter, projectsRouter, contractsRouter } from "./routers/personnel";
import { analyticsRouter } from "./routers/analytics";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  pursuits: pursuitsRouter,
  proposals: proposalsRouter,
  assets: assetsRouter,
  opportunities: opportunitiesRouter,
  personnel: personnelRouter,
  projects: projectsRouter,
  contracts: contractsRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
