import { describe, expect, it } from "vitest";
import { parseJsonArray } from "./staffDirectory";

describe("staff directory legacy metadata compatibility", () => {
  it("retains arrays already returned by the proposal extension", () => {
    expect(parseJsonArray(["Traffic Engineering", "Special Inspections"])).toEqual([
      "Traffic Engineering",
      "Special Inspections",
    ]);
  });

  it("parses legacy JSON arrays without treating malformed values as staff metadata", () => {
    expect(parseJsonArray('["bridge", "inspection"]')).toEqual(["bridge", "inspection"]);
    expect(parseJsonArray("not-json")).toEqual([]);
    expect(parseJsonArray({ tags: ["bridge"] })).toEqual([]);
  });
});
