/**
 * Keep short skill calls on the active request so the next Draft Mode skill can
 * start immediately. Long calls still continue in the background to protect
 * gateway limits and preserve the existing resumable workflow.
 */
export const INLINE_SKILL_WAIT_MS = 25_000;

export async function waitForCompletionOrTimeout<T>(
  completion: Promise<T>,
  timeoutMs = INLINE_SKILL_WAIT_MS,
): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      completion,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
