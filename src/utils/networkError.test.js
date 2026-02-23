import { toUserFacingNetworkMessage } from "./networkError";

test("maps failed fetch errors to connectivity guidance", () => {
  const msg = toUserFacingNetworkMessage(new Error("Failed to fetch"));
  expect(msg).toMatch(/network issue/i);
});

test("maps timeout errors to retry guidance", () => {
  const msg = toUserFacingNetworkMessage(new Error("Request timeout"));
  expect(msg).toMatch(/timed out/i);
});

test("maps permission errors to auth guidance", () => {
  const msg = toUserFacingNetworkMessage(new Error("permission denied for table"));
  expect(msg).toMatch(/permission issue/i);
});

test("falls back when error is unknown", () => {
  const msg = toUserFacingNetworkMessage(new Error("weird server bug"), "Custom fallback");
  expect(msg).toBe("Custom fallback");
});

