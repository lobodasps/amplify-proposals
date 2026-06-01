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
import {
  entitiesRouter, orderTypesRouter, departmentsRouter, serviceTypesRouter,
  form254CodesRouter, organizationsRouter, peopleRouter, glossaryRouter,
  appSettingsRouter, seedEntitiesRouter, firmSettingsRouter,
} from "./routers/settings";
import { complianceRouter, activityLogRouter, billingEntriesRouter } from "./routers/compliance";
import { contractAnalyzerRouter } from "./routers/contractAnalyzer";
import { aiSkillsRouter } from "./routers/aiSkills";
import { xmlShredderRouter } from "./routers/xmlShredder";
import { rfpWikiRouter } from "./routers/rfpWiki";
import { agentGuidelinesRouter } from "./routers/agentGuidelines";
import { rfpConflictsRouter } from "./routers/rfpConflicts";
import { bulkImportRouter } from "./routers/bulkImport";
import { rfpSessionsRouter } from "./routers/rfpSessions";
import { damRouter } from "./routers/dam";
import { userManagementRouter } from "./routers/userManagement";

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
  entities: entitiesRouter,
  orderTypes: orderTypesRouter,
  departments: departmentsRouter,
  serviceTypes: serviceTypesRouter,
  form254Codes: form254CodesRouter,
  organizations: organizationsRouter,
  people: peopleRouter,
  glossary: glossaryRouter,
  appSettings: appSettingsRouter,
  seed: seedEntitiesRouter,
  compliance: complianceRouter,
  activityLog: activityLogRouter,
  billingEntries: billingEntriesRouter,
  contractAnalyzer: contractAnalyzerRouter,
  aiSkills: aiSkillsRouter,
  xmlShredder: xmlShredderRouter,
  rfpWiki: rfpWikiRouter,
  agentGuidelines: agentGuidelinesRouter,
  rfpConflicts: rfpConflictsRouter,
  bulkImport: bulkImportRouter,
  rfpSessions: rfpSessionsRouter,
  dam: damRouter,
  userManagement: userManagementRouter,
  firmSettings: firmSettingsRouter,
});

export type AppRouter = typeof appRouter;
