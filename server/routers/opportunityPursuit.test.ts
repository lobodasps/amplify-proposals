import { describe, expect, it } from "vitest";
import { buildPursuitFromOpportunity } from "../../shared/opportunityPursuit";

describe("opportunity-to-pursuit mapping", () => {
  it("preserves the canonical opportunity link and key pursuit metadata", () => {
    const dueDate = new Date("2026-10-15T00:00:00.000Z");
    const pursuit = buildPursuitFromOpportunity({
      id: "11111111-1111-4111-8111-111111111111",
      title: "West Branch Auxiliary Dam Slope Stabilization",
      rfpNumber: "RFP-2026-10",
      clientId: null,
      clientName: "County of Test",
      serviceLines: ["Civil Engineering"],
      estimatedValue: "500000",
      dueDate,
      assignedTo: null,
    });
    expect(pursuit).toMatchObject({
      opportunityId: "11111111-1111-4111-8111-111111111111",
      title: "West Branch Auxiliary Dam Slope Stabilization",
      status: "identify",
      serviceLines: ["Civil Engineering"],
    });
    expect(pursuit.dueDate).toBe(dueDate);
  });
});
