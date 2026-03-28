const DISTANCE_UNIT_STORAGE_KEY = "exervia_distance_unit";
const MILES_PER_KM = 0.621371;

export const ATHLETE_DEFAULT_MAP_CENTER = { lat: 53.3498, lng: -6.2603 };

export function normalizeDistanceUnit(value) {
  return String(value || "").trim().toLowerCase() === "mi" ? "mi" : "km";
}

export function getDistanceUnitPreference() {
  try {
    return normalizeDistanceUnit(localStorage.getItem(DISTANCE_UNIT_STORAGE_KEY));
  } catch {
    return "km";
  }
}

export function setDistanceUnitPreference(unit) {
  const normalized = normalizeDistanceUnit(unit);
  try {
    localStorage.setItem(DISTANCE_UNIT_STORAGE_KEY, normalized);
  } catch {
    // best-effort persistence only
  }
  return normalized;
}

export function convertDistanceKm(distanceKm, unit = "km") {
  const normalizedUnit = normalizeDistanceUnit(unit);
  const safeDistance = Number(distanceKm || 0);
  if (!Number.isFinite(safeDistance)) return 0;
  return normalizedUnit === "mi" ? safeDistance * MILES_PER_KM : safeDistance;
}

export function formatElapsed(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function formatDistance(distanceKm, options = {}) {
  const { unit = "km", decimals = 2, includeUnit = false } = options;
  const normalizedUnit = normalizeDistanceUnit(unit);
  const converted = convertDistanceKm(distanceKm, normalizedUnit);
  const label = `${converted.toFixed(decimals)} ${normalizedUnit}`;
  return includeUnit ? label : converted.toFixed(decimals);
}

export function formatPaceFromSecondsPerKm(secondsPerKm, options = {}) {
  const { unit = "km", includeUnit = true } = options;
  const normalizedUnit = normalizeDistanceUnit(unit);
  const total = Number(secondsPerKm || 0);
  if (!Number.isFinite(total) || total <= 0) {
    return includeUnit ? `--:--/${normalizedUnit}` : "--:--";
  }
  const secondsPerUnit = normalizedUnit === "mi" ? total / MILES_PER_KM : total;
  const rounded = Math.round(secondsPerUnit);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  const body = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return includeUnit ? `${body}/${normalizedUnit}` : body;
}

export function formatPace(distanceKm, elapsedSeconds, options = {}) {
  const distance = Number(distanceKm || 0);
  const seconds = Number(elapsedSeconds || 0);
  if (!Number.isFinite(distance) || !Number.isFinite(seconds) || distance <= 0 || seconds <= 0) {
    const normalizedUnit = normalizeDistanceUnit(options.unit);
    return options.includeUnit === false ? "--:--" : `--:--/${normalizedUnit}`;
  }
  return formatPaceFromSecondsPerKm(seconds / distance, options);
}

export function formatDistanceOptionLabel(distanceKm, unit = "km", decimals = 0) {
  return formatDistance(distanceKm, { unit, decimals, includeUnit: true });
}
