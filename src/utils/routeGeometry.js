import { ATHLETE_DEFAULT_MAP_CENTER } from "./athleteMetrics";

export function normalizeRoutePoints(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => ({
      lat: Number(point?.lat),
      lng: Number(point?.lng),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

export function buildCenteredRouteBbox(lat, lng, zoomSpread = 0.028) {
  const safeLat = Number.isFinite(Number(lat)) ? Number(lat) : ATHLETE_DEFAULT_MAP_CENTER.lat;
  const safeLng = Number.isFinite(Number(lng)) ? Number(lng) : ATHLETE_DEFAULT_MAP_CENTER.lng;
  const clampCoord = (value, min, max) => Math.min(max, Math.max(min, value));
  const minLat = clampCoord(safeLat - zoomSpread, -85, 85);
  const maxLat = clampCoord(safeLat + zoomSpread, -85, 85);
  const minLng = clampCoord(safeLng - zoomSpread, -180, 180);
  const maxLng = clampCoord(safeLng + zoomSpread, -180, 180);
  return `${minLng},${minLat},${maxLng},${maxLat}`;
}

export function buildPointsRouteBbox(points, fallback, pad = 0.012) {
  const normalizedPoints = normalizeRoutePoints(points);
  const fallbackPoint =
    fallback?.lat && fallback?.lng
      ? [{ lat: Number(fallback.lat), lng: Number(fallback.lng) }]
      : [ATHLETE_DEFAULT_MAP_CENTER];
  const source = normalizedPoints.length ? normalizedPoints : fallbackPoint;
  const lats = source.map((point) => point.lat);
  const lngs = source.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return `${minLng - pad},${minLat - pad},${maxLng + pad},${maxLat + pad}`;
}
