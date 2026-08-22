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
  autoMatched: true,
  compositeScore: 0.82,
  matchReasons: ["Service-line overlap: 100%"],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    dam: {
      matchProjectSheets: { useQuery: () => ({ data: { results: projectResults, matchQuality: "hybrid", corpusSize: 10 }, isLoading: false }) },
      matchResumes: { useQuery: () => ({ data: { results: [], matchQuality: "fallback", corpusSize: 0 }, isLoading: false }) },
      matchPastProposals: { useQuery: () => ({ data: { results: [], matchQuality: "fallback", corpusSize: 0 }, isLoading: false }) },
      matchFeeEvidence: { useQuery: () => ({ data: { results: [], matchQuality: "fallback", corpusSize: 0 }, isLoading: false }) },
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
