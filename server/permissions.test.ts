import { describe, expect, it } from "vitest";
import { applySharedProfileScope, mergeSharedPermissionRows } from "./permissions";

describe("shared Timekeeping proposal permissions", () => {
  it("merges direct grants and assigned-role grants without using legacy user roles", () => {
    const permissions = mergeSharedPermissionRows([
      { pursuitsProposalsView: true, firmRecordView: true },
      { proposalsSettingsAdmin: true, contractsEdit: true },
    ]);

    expect(permissions.pursuitsProposalsView).toBe(true);
    expect(permissions.firmRecordView).toBe(true);
    expect(permissions.proposalsSettingsAdmin).toBe(true);
    expect(permissions.contractsEdit).toBe(true);
    expect(permissions.contractAnalyzerView).toBe(false);
  });

  it("honors the Timekeeping-owned all-access profile scope without consulting amp_users", () => {
    const permissions = applySharedProfileScope(
      mergeSharedPermissionRows([]),
      { role: "admin", permissionScope: "all" },
    );
    expect(permissions.proposalsSettingsAdmin).toBe(true);
    expect(permissions.pursuitsProposalsView).toBe(true);
  });
});
