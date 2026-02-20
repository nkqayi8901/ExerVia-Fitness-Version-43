import { normalizeBlockedIds, parseBlockedIds, toggleBlockedId } from "./moderation";

describe("moderation utils", () => {
  test("normalizeBlockedIds keeps only unique positive numeric ids", () => {
    expect(normalizeBlockedIds([1, "2", 2, 0, -4, "x", 5])).toEqual([1, 2, 5]);
  });

  test("toggleBlockedId adds then removes id", () => {
    const added = toggleBlockedId([2, 3], 5);
    expect(added).toEqual([2, 3, 5]);
    const removed = toggleBlockedId(added, 3);
    expect(removed).toEqual([2, 5]);
  });

  test("parseBlockedIds safely handles bad json", () => {
    expect(parseBlockedIds("not-json")).toEqual([]);
    expect(parseBlockedIds(JSON.stringify([7, "8", 8]))).toEqual([7, 8]);
  });
});
