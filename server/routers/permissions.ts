import { router, protectedProcedure } from "../_core/trpc";
import { getSharedProposalPermissions } from "../permissions";

/** Read-only mirror of Timekeeping/V0 permissions for client-side visibility gates. */
export const permissionsRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => getSharedProposalPermissions(ctx.user.id)),
});
