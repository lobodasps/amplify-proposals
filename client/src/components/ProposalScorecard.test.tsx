// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProposalScorecard } from "./SkillOutputRenderer";

afterEach(() => cleanup());

describe("ProposalScorecard", () => {
  it("renders malformed legacy gaps without crashing", () => {
    render(<ProposalScorecard data={{ overallScore: 70, topGaps: "- Missing examples\n- Missing evidence" } as any} />);
    expect(screen.getByText("Missing examples")).toBeTruthy();
    expect(screen.getByText("Missing evidence")).toBeTruthy();
  });
});
