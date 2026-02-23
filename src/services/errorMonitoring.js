let initialized = false;

function shouldEnableMonitoring() {
  const dsn = String(process.env.REACT_APP_SENTRY_DSN || "").trim();
  return Boolean(dsn);
}

export async function initErrorMonitoring() {
  if (initialized) return;
  initialized = true;
  if (!shouldEnableMonitoring()) return;

  try {
    if (window?.Sentry?.init) {
      window.Sentry.init({
        dsn: process.env.REACT_APP_SENTRY_DSN,
        environment: process.env.REACT_APP_ENV || process.env.NODE_ENV || "development",
        tracesSampleRate: 0.1,
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[monitoring] Failed to initialize Sentry:", error);
  }
}

export function captureAppError(error, context = {}) {
  if (window?.Sentry?.captureException) {
    window.Sentry.captureException(error, { extra: context });
    return;
  }
  // eslint-disable-next-line no-console
  console.error("[monitoring]", error, context);
}
