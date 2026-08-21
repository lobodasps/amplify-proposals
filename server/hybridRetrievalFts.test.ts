import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { fetchFtsScores, validDocumentUuids } from "./hybridRetrieval";

const FIRST_UUID = "c874f379-2a3f-4612-bb84-2eb72c600758";
const SECOND_UUID = "edc200b1-2547-4dab-a56d-1d26458c80c7";

describe("hybrid full-text retrieval UUID binding", () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.getDb.mockReset();
    mocks.getDb.mockResolvedValue({ execute: mocks.execute });
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps valid UUIDs, removes duplicates, and rejects malformed document IDs", () => {
    expect(validDocumentUuids([FIRST_UUID, "not-a-uuid", FIRST_UUID, SECOND_UUID])).toEqual([
      FIRST_UUID,
      SECOND_UUID,
    ]);
  });

  it("returns an empty score map rather than propagating a chunk-query failure", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("invalid input syntax for type uuid[]"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await fetchFtsScores([FIRST_UUID, SECOND_UUID], "professional engineering");

    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(result).toEqual(new Map());
    expect(warning).toHaveBeenCalledWith(
      "[Hybrid retrieval] Full-text chunk search unavailable:",
      expect.any(Error),
    );
  });
});
