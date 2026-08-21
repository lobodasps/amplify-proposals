// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaunchRecoveryControls } from "./LaunchRecoveryControls";

afterEach(() => cleanup());

const baseProps = {
  hasSession: true,
  canRun: true,
  isScoring: false,
  hasSavedResult: false,
  isCurrentResult: false,
  isStaleResult: false,
  onStartOver: vi.fn(),
  onRunGoNoGo: vi.fn(),
  onReextract: vi.fn(),
};

describe("LaunchRecoveryControls", () => {
  it("renders the stale-score retry state and runs only Go/No-Go", async () => {
    const user = userEvent.setup();
    const onRunGoNoGo = vi.fn();
    render(<LaunchRecoveryControls {...baseProps} hasSavedResult isStaleResult onRunGoNoGo={onRunGoNoGo} />);
    expect(screen.getByRole("alert").textContent).toContain("Saved Go/No-Go result is out of date");
    await user.click(screen.getByRole("button", { name: "Re-run Go/No-Go" }));
    expect(onRunGoNoGo).toHaveBeenCalledOnce();
  });

  it("opens a confirmation before explicitly re-extracting the saved package", async () => {
    const user = userEvent.setup();
    const onReextract = vi.fn();
    render(<LaunchRecoveryControls {...baseProps} onReextract={onReextract} />);
    await user.click(screen.getAllByRole("button", { name: "Re-extract package" })[0]);
    expect(screen.getByText("Re-extract the saved RFP package?")).toBeTruthy();
    const reextractButtons = screen.getAllByRole("button", { name: "Re-extract package" });
    await user.click(reextractButtons[reextractButtons.length - 1]);
    expect(onReextract).toHaveBeenCalledOnce();
  });

  it("opens a saved result without initiating a scoring retry when its input is current", () => {
    render(<LaunchRecoveryControls {...baseProps} hasSavedResult isCurrentResult />);
    expect(screen.getByRole("button", { name: "Open Saved Go/No-Go" })).toBeTruthy();
  });
});
