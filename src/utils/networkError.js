export function toUserFacingNetworkMessage(error, fallback = "Request failed. Please try again.") {
  const message = String(error?.message || "").toLowerCase();
  if (!message) return fallback;

  if (message.includes("failed to fetch") || message.includes("networkerror")) {
    return "Network issue detected. Check your internet connection and retry.";
  }
  if (message.includes("timeout") || message.includes("abort")) {
    return "Request timed out. Please retry.";
  }
  if (message.includes("offline")) {
    return "You appear to be offline. Reconnect and try again.";
  }
  if (message.includes("permission denied") || message.includes("rls")) {
    return "Permission issue while loading data. Please sign in again.";
  }

  return fallback;
}

