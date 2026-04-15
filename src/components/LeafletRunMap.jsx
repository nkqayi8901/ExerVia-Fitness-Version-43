// LeafletRunMap.jsx
// Free, zero-API-key interactive run map using Leaflet + OpenStreetMap tiles.
// Tracks live position, draws the route polyline, and updates the marker in real time.
// Used as the primary map when REACT_APP_GOOGLE_MAPS_API_KEY is not set.

import { useEffect, useRef } from "react";

// Dynamically inject Leaflet CSS once
let cssInjected = false;
function ensureLeafletCss() {
  if (cssInjected) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
  cssInjected = true;
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function LeafletRunMap({
  center,          // { lat, lng }
  routePoints,     // [{ lat, lng }, ...]
  isTracking,      // bool — when true, auto-pan to center
  challengeMode,   // "Challenge" | "Solo" | "Ghost"
  visibility,      // "Nearby" | "Regional" | "Private"
}) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);
  const polylineRef  = useRef(null);
  const circleRef    = useRef(null);

  // Init map once
  useEffect(() => {
    ensureLeafletCss();
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTR,
        maxZoom: 19,
      }).addTo(map);

      // Custom marker — runner dot
      const dotIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:16px;height:16px;
          background:#38bdf8;
          border:3px solid #fff;
          border-radius:50%;
          box-shadow:0 0 0 3px rgba(56,189,248,0.4);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      markerRef.current = L.marker([center.lat, center.lng], { icon: dotIcon }).addTo(map);

      // Visibility radius circle
      const radiusM = visibility === "Nearby" ? 1500 : visibility === "Regional" ? 5000 : 600;
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusM,
        color: "#38bdf8",
        fillColor: "#38bdf8",
        fillOpacity: challengeMode === "Challenge" ? 0.1 : 0.06,
        weight: 1,
      }).addTo(map);

      // Route polyline (starts empty)
      polylineRef.current = L.polyline([], {
        color: "#f97316",
        weight: 4,
        opacity: 0.85,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        polylineRef.current = null;
        circleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker + pan when center changes
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const latlng = [center.lat, center.lng];
    markerRef.current.setLatLng(latlng);
    if (circleRef.current) circleRef.current.setLatLng(latlng);
    if (isTracking) {
      mapRef.current.setView(latlng, mapRef.current.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [center, isTracking]);

  // Draw route polyline from routePoints
  useEffect(() => {
    if (!polylineRef.current || !routePoints?.length) return;
    const latlngs = routePoints.map((p) => [p.lat, p.lng]);
    polylineRef.current.setLatLngs(latlngs);
  }, [routePoints]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: 280, borderRadius: "inherit" }}
    />
  );
}
