const ERROR_MESSAGE_PATTERN =
  /(could not|error|failed|not found|cannot|can't|invalid|missing|offline|try again|permission|sign in|join group first|thread not found)/i;

export function isErrorBanner(message) {
  return ERROR_MESSAGE_PATTERN.test(String(message || ""));
}

