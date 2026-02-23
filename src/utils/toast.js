export function emitToast(message, type = "info", duration = 3200) {
  const text = String(message || "").trim();
  if (!text) return;
  window.dispatchEvent(
    new CustomEvent("exervia:toast", {
      detail: {
        message: text,
        type: String(type || "info"),
        duration: Math.max(1200, Number(duration) || 3200),
      },
    })
  );
}

