// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    dam: {
      matchProjectSheets: { useQuery: () => ({ data: { results: projectResults, matchQuality: "hybrid", corpusSize: 10 }, isLoading: false }) },
      matchResumes: { useQuery: () => ({ data: { results: [], matchQuality: "fallback", corpusSize: 0 }, isLoading: false }) },
      matchPastProposals: { useQuery: () => ({ data: { results: [], matchQuality: "fallback", corpusSize: 0 }, isLoading: false }) },
      searchForAssetMatching: { useQuery: () => ({ data: [] }) },
    },
    pursuits: { saveAssetSelections: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AssetMatchingPanel from "./AssetMatchingPanel";

afterEach(() => cleanup());

describe("AssetMatchingPanel", () => {
  it("renders ten project matches in normal flow without an inner vertical scroll container", async () => {
    const { container } = render(
      <AssetMatchingPanel pursuitId="pursuit-1" serviceLines={["Civil"]} onComplete={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText("Project 10")).toBeTruthy());
    expect(screen.getAllByText(/Project \d+/)).toHaveLength(10);
    expect(container.querySelectorAll('[style*="overflow-y"], [style*="overflowY"]').length).toBe(0);
  });
});
