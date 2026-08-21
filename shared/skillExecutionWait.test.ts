import { describe, expect, it, vi } from "vitest";
import { waitForCompletionOrTimeout } from "./skillExecutionWait";

describe("waitForCompletionOrTimeout", () => {
  it("returns a completion that arrives before the bounded wait expires", async () => {
    await expect(waitForCompletionOrTimeout(Promise.resolve("complete"), 100)).resolves.toBe("complete");
  });

  it("returns null when a background skill exceeds the bounded wait", async () => {
    vi.useFakeTimers();
    const pending = new Promise<string>(() => undefined);
    const result = waitForCompletionOrTimeout(pending, 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBeNull();
    vi.useRealTimers();
  });
});
