import { useMemo } from "react";

function normalizePoints(points) {
  return Array.isArray(points)
    ? points
        .map((point) => ({
          lat: Number(point?.lat),
          lng: Number(point?.lng),
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    : [];
}

function buildMiniRoutePath(points) {
  const validPoints = normalizePoints(points);
  if (validPoints.length < 2) return "";
  const lats = validPoints.map((point) => point.lat);
  const lngs = validPoints.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);

  return validPoints
    .map((point, index) => {
      const x = 14 + ((point.lng - minLng) / lngSpan) * 172;
      const y = 86 - ((point.lat - minLat) / latSpan) * 72;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function RoutePreviewVisual({
  points,
  className = "",
  fallbackLabel = "Route ready",
  gradientId = "route-preview",
}) {
  const path = useMemo(() => buildMiniRoutePath(points), [points]);

  return (
    <div className={`route-preview-visual ${className}`.trim()}>
      {path ? (
        <svg viewBox="0 0 200 100" className="route-preview-svg" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>
          <path
            d={path}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <div className="route-preview-fallback">
          <div className="route-preview-fallback-grid" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="route-preview-fallback-marker" aria-hidden="true" />
          <div className="route-preview-fallback-label">{fallbackLabel}</div>
        </div>
      )}
    </div>
  );
}
