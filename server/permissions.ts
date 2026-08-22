import { eq } from "drizzle-orm";
import { permissionRoles, profiles, userPermissions, userRoleAssignments } from "../drizzle/schema";
import {
  EMPTY_PROPOSAL_PERMISSIONS,
  PROPOSAL_PERMISSION_KEYS,
  type ProposalPermissionKey,
  type ProposalPermissions,
} from "../shared/proposalPermissions";
import { getDb } from "./db";

type PermissionRow = Partial<ProposalPermissions>;

export function mergeSharedPermissionRows(rows: PermissionRow[]): ProposalPermissions {
  const resolved = { ...EMPTY_PROPOSAL_PERMISSIONS };
  for (const key of PROPOSAL_PERMISSION_KEYS) {
    resolved[key] = rows.some((row) => row[key] === true);
  }
  return resolved;
}

export function applySharedProfileScope(
  permissions: ProposalPermissions,
  profile: { role: string | null; permissionScope: string | null } | undefined,
): ProposalPermissions {
  // Timekeeping/V0 owns this all-access scope. It preserves the current access
  // model while that app remains the sole authority for permissions.
  if (profile?.permissionScope === "all" || profile?.role === "admin") {
    return Object.fromEntries(PROPOSAL_PERMISSION_KEYS.map((key) => [key, true])) as ProposalPermissions;
  }
  return permissions;
}

export async function getSharedProposalPermissions(userId: string): Promise<ProposalPermissions> {
  const db = await getDb();
  if (!db) return { ...EMPTY_PROPOSAL_PERMISSIONS };

  const [directRows, roleRows, profileRows] = await Promise.all([
    db.select({
      proposalsSettingsAdmin: userPermissions.proposalsSettingsAdmin,
      qbSyncAdmin: userPermissions.qbSyncAdmin,
      proposalsReportsView: userPermissions.proposalsReportsView,
      complianceView: userPermissions.complianceView,
      contractAnalyzerView: userPermissions.contractAnalyzerView,
      pursuitsProposalsView: userPermissions.pursuitsProposalsView,
      bdView: userPermissions.bdView,
      rfpIntelligenceView: userPermissions.rfpIntelligenceView,
      firmRecordView: userPermissions.firmRecordView,
      firmRecordEdit: userPermissions.firmRecordEdit,
      contractsView: userPermissions.contractsView,
      contractsEdit: userPermissions.contractsEdit,
    }).from(userPermissions).where(eq(userPermissions.userId, userId)),
    db.select({
      proposalsSettingsAdmin: permissionRoles.proposalsSettingsAdmin,
      qbSyncAdmin: permissionRoles.qbSyncAdmin,
      proposalsReportsView: permissionRoles.proposalsReportsView,
      complianceView: permissionRoles.complianceView,
      contractAnalyzerView: permissionRoles.contractAnalyzerView,
      pursuitsProposalsView: permissionRoles.pursuitsProposalsView,
      bdView: permissionRoles.bdView,
      rfpIntelligenceView: permissionRoles.rfpIntelligenceView,
      firmRecordView: permissionRoles.firmRecordView,
      firmRecordEdit: permissionRoles.firmRecordEdit,
      contractsView: permissionRoles.contractsView,
      contractsEdit: permissionRoles.contractsEdit,
    })
      .from(userRoleAssignments)
      .innerJoin(permissionRoles, eq(userRoleAssignments.roleId, permissionRoles.id))
      .where(eq(userRoleAssignments.userId, userId)),
    db.select({ role: profiles.role, permissionScope: profiles.permissionScope })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1),
  ]);

  return applySharedProfileScope(mergeSharedPermissionRows([...directRows, ...roleRows]), profileRows[0]);
}

export async function hasSharedProposalPermission(userId: string, permission: ProposalPermissionKey): Promise<boolean> {
  return (await getSharedProposalPermissions(userId))[permission];
}
