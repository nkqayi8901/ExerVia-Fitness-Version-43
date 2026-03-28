function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibratePattern(pattern) {
  if (!canVibrate()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function vibrateSuccess() {
  return vibratePattern([40, 30, 70]);
}

export function vibrateStart() {
  return vibratePattern(35);
}

export function vibrateStop() {
  return vibratePattern([25, 20, 25]);
}

export function vibratePr() {
  return vibratePattern([50, 30, 50, 30, 90]);
}
