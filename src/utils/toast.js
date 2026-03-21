export function emitToast(message, type = "info", duration = 3200) {
  const text = String(message || "").trim();
  if (!text) return;
  const normalizedType = String(type || "info");
  const requestedDuration = Number(duration) || 3200;
  const minDuration =
    normalizedType === "error" ? 5200 :
    normalizedType === "warn" ? 4200 :
    2200;
  window.dispatchEvent(
    new CustomEvent("exervia:toast", {
      detail: {
        message: text,
        type: normalizedType,
        duration: Math.max(minDuration, requestedDuration),
      },
    })
  );
}
