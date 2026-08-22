// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ saveAssetSelections: vi.fn(), getByIdData: null as unknown }));

const projectResults = Array.from({ length: 10 }, (_, index) => ({
  id: `project-${index}`,
  title: `Project Sheet ${index + 1}`,
  clientName: "Test Agency",
  ownerName: null,
  contractValue: null,
  tags: "Civil",
  staffName: null,
  projectName: `Project ${index + 1}`,
  extractedMeta: {},
  autoMatched: index !== 9,
  compositeScore: index !== 9 ? 0.82 : undefined,
  matchReasons: index !== 9 ? ["Service-line overlap: 100%"] : [],
}));

const resumeResults = [
  { id: "resume-suggested", title: "Suggested Resume", staffName: "Suggested Staff", tags: "Civil", extractedMeta: {}, autoMatched: true, compositeScore: 0.8, matchReasons: ["Service-line overlap: 100%"] },
  { id: "resume-other", title: "Other Resume", staffName: "Other Staff", tags: "General", extractedMeta: {}, autoMatched: false, matchReasons: [] },
];
const proposalResults = [
  { id: "proposal-suggested", title: "Suggested Past Proposal", clientName: null, contractValue: null, tags: "Civil", extractedMeta: {}, autoMatched: true, compositeScore: 0.8, matchReasons: ["Service-line overlap: 100%"] },
  { id: "proposal-other", title: "Other Past Proposal", clientName: null, contractValue: null, tags: "General", extractedMeta: {}, autoMatched: false, matchReasons: [] },
];
const feeResults = [
  { id: "fee-suggested", title: "Suggested Fee Schedule", docType: "rate_sheet", tags: "Civil", contractValue: null, autoMatched: true, compositeScore: 0.8, matchReasons: ["Pricing evidence"] },
  { id: "fee-other", title: "Other Fee Artifact", docType: "spreadsheet", tags: "General", contractValue: null, autoMatched: false, matchReasons: [] },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    dam: {
      matchProjectSheets: { useQuery: () => ({ data: { results: projectResults, matchQuality: "hybrid", corpusSize: 10 }, isLoading: false }) },
      matchResumes: { useQuery: () => ({ data: { results: resumeResults, matchQuality: "hybrid", corpusSize: 2 }, isLoading: false }) },
      matchPastProposals: { useQuery: () => ({ data: { results: proposalResults, matchQuality: "hybrid", corpusSize: 2 }, isLoading: false }) },
      matchFeeEvidence: { useQuery: () => ({ data: { results: feeResults, matchQuality: "hybrid", corpusSize: 2 }, isLoading: false }) },
      searchForAssetMatching: { useQuery: () => ({ data: [] }) },
    },
    pursuits: {
      getById: { useQuery: () => ({ data: mocks.getByIdData }) },
      saveAssetSelections: { useMutation: () => ({ mutate: mocks.saveAssetSelections, isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AssetMatchingPanel from "./AssetMatchingPanel";

afterEach(() => {
  cleanup();
  mocks.saveAssetSelections.mockClear();
  mocks.getByIdData = null;
});

describe("AssetMatchingPanel", () => {
  it("renders ten project matches in normal flow without an inner vertical scroll container", async () => {
    const { container } = render(
      <AssetMatchingPanel pursuitId="pursuit-1" serviceLines={["Civil"]} onComplete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText("Project 10")).toBeTruthy());
    expect(screen.getAllByText(/Project \d+/)).toHaveLength(10);
    expect(container.querySelectorAll('[style*="overflow-y"], [style*="overflowY"]').length).toBe(0);
  });

  it("keeps nonsuggested eligible assets visible alongside writer-reviewed suggestions", async () => {
    render(<AssetMatchingPanel pursuitId="pursuit-1" serviceLines={["Civil"]} onComplete={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Project 10")).toBeTruthy());
    expect(screen.getByText("Project 10")).toBeTruthy();
    expect(screen.getAllByText("Suggested · approval required")).toHaveLength(12);
    expect(screen.getByText("Other Staff")).toBeTruthy();
    expect(screen.getByText("Other Past Proposal")).toBeTruthy();
    expect(screen.getByText("Other Fee Artifact")).toBeTruthy();
  });

  it("records writer-approved suggestion provenance when a suggested asset is confirmed", async () => {
    render(<AssetMatchingPanel pursuitId="pursuit-1" serviceLines={["Civil"]} onComplete={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Project 1")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Confirm Selections and Open Workspace/i }));

    expect(mocks.saveAssetSelections).toHaveBeenCalledWith(expect.objectContaining({
      selectedProjectIds: ["project-0"],
      assetSelectionProvenance: expect.objectContaining({
        "project-0": expect.objectContaining({
          source: "suggested_approved",
          score: 0.82,
          reasons: ["Service-line overlap: 100%"],
          approvedAt: expect.any(String),
        }),
      }),
    }));
  });

  it("restores persisted approved-suggestion selections when Asset Matching is reopened", async () => {
    mocks.getByIdData = {
      selectedProjectIds: ["project-0"],
      selectedPastProposalIds: [],
      selectedFeeEvidenceIds: [],
      selectedPersonnel: [],
      assetSelectionProvenance: {
        "project-0": {
          source: "suggested_approved",
          score: 0.82,
          reasons: ["Service-line overlap: 100%"],
          approvedAt: "2026-08-22T17:00:00.000Z",
        },
      },
    };
    render(<AssetMatchingPanel pursuitId="pursuit-1" serviceLines={["Civil"]} onComplete={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Approved suggestion")).toBeTruthy());
    expect(screen.getAllByRole("checkbox")[0].getAttribute("data-state")).toBe("checked");
  });
});
