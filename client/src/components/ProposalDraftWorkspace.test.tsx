// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const sections = [
  {
    sectionType: "technical_approach",
    title: "Technical Approach",
    pageLimit: 3,
    wordLimit: 1350,
    order: 1,
    content: "Draft content",
    editedContent: null,
    wordCount: 12,
    status: "complete",
    generatedAt: null,
    score: 75,
    scoredAt: null,
    scorerOutput: null,
    editedAt: null,
    errorMessage: null,
  },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    rfpSessions: {
      getSections: { useQuery: () => ({ data: { sections, structureSource: "rfp_evaluation_criteria" }, refetch: vi.fn() }) },
      generateSection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      generateFullProposal: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateSectionContent: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import ProposalDraftWorkspace from "./ProposalDraftWorkspace";

afterEach(() => cleanup());

describe("ProposalDraftWorkspace layout", () => {
  it("wraps the compliance header instead of overlaying metrics and actions", () => {
    const { container } = render(
      <ProposalDraftWorkspace sessionId="11111111-1111-4111-8111-111111111111" proposalId="22222222-2222-4222-8222-222222222222" pursuitTitle="A deliberately long RFP title that must not overlap compliance actions" />,
    );
    const header = screen.getAllByText("Generate Full Proposal")[0].closest(".border-b");
    expect(header?.className).toContain("flex-wrap");
    expect(header?.className).toContain("gap-y-2");
    expect(container.textContent).toContain("75% compliant");
  });

  it("uses one outer workspace scroll owner with a minimum-width panel row regardless of scorecard visibility", () => {
    const { container } = render(
      <ProposalDraftWorkspace sessionId="11111111-1111-4111-8111-111111111111" proposalId="22222222-2222-4222-8222-222222222222" />,
    );
    const scrollOwner = container.querySelector(".overflow-auto");
    expect(scrollOwner?.className).toContain("min-h-0");
    expect(scrollOwner?.className).toContain("min-w-0");
    expect(Array.from(container.querySelectorAll("div")).some((node) => node.className.includes("min-w-[880px]"))).toBe(true);

    fireEvent.click(screen.getByTitle("Hide scorecard"));
    expect(container.querySelector(".overflow-auto")).toBeTruthy();
    expect(Array.from(container.querySelectorAll("div")).some((node) => node.className.includes("min-w-[880px]"))).toBe(true);
  });
});
