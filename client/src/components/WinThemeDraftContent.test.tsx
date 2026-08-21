// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WinThemeDraftContent } from "./WinThemeDraftContent";

afterEach(() => cleanup());

describe("WinThemeDraftContent", () => {
  it("renders valid saved JSON as readable theme cards", () => {
    render(<WinThemeDraftContent content={JSON.stringify({ winThemes: [{ title: "Low-risk delivery", statement: "Proven approach.", rationale: "Relevant experience.", proof: "12 similar projects." }] })} />);
    expect(screen.getByText("Low-risk delivery")).toBeTruthy();
    expect(screen.getByText("Proven approach.")).toBeTruthy();
  });

  it("hides malformed legacy JSON and shows a readable recovery message", () => {
    const malformed = '{"winThemes": invalid}';
    render(<WinThemeDraftContent content={malformed} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Win Themes formatting needs review");
    expect(screen.queryByText(malformed)).toBeNull();
  });
});
