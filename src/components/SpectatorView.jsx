// SpectatorView.jsx
// Watch a live challenge in real time.
// Shows both runners as moving markers on a map (OpenStreetMap iframe fallback,
// Google Maps when key is available), plus a live scoreboard overlay.
//
// Props:
//   challengeId  — ID of the live_challenges row to watch
//   onClose      — called when user exits spectator mode
//   hasGoogleMapsKey — boolean
//   googleMapRef     — ref to the existing Google Map instance (if shared)

import { useEffect, useMemo, useRef } from "react";
import useSpectator from "../hooks/useSpectator";
import { buildCenteredRouteBbox } from "../utils/routeGeometry";
import { loadGoogleMapsApi } from "../utils/googleMapsLoader";
import "./SpectatorView.css";

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeSince(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

export default function SpectatorView({ challengeId, onClose }) {
  const { challenge, challengerPosition, challengedPosition, spectatorCount, loading } =
    useSpectator({ challengeId, enabled: Boolean(challengeId) });

  const hasGoogleKey = Boolean(process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
  const mapNodeRef = useRef(null);
  const googleMapRef = useRef(null);
  const challengerMarkerRef = useRef(null);
  const challengedMarkerRef = useRef(null);

  // Center map on midpoint of both runners (or challenger if only one)
  const mapCenter = useMemo(() => {
    if (challengerPosition && challengedPosition) {
      return {
        lat: (challengerPosition.lat + challengedPosition.lat) / 2,
        lng: (challengerPosition.lng + challengedPosition.lng) / 2,
      };
    }
    return challengerPosition || challengedPosition || { lat: 53.3498, lng: -6.2603 };
  }, [challengerPosition, challengedPosition]);

  const fallbackMapSrc = useMemo(() => {
    const bbox = buildCenteredRouteBbox(mapCenter.lat, mapCenter.lng);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mapCenter.lat},${mapCenter.lng}`;
  }, [mapCenter]);

  // Init Google Map
  useEffect(() => {
    if (!hasGoogleKey || !mapNodeRef.current || googleMapRef.current) return;
    loadGoogleMapsApi()
      .then((maps) => {
        if (!mapNodeRef.current) return;
        googleMapRef.current = new maps.Map(mapNodeRef.current, {
          center: mapCenter,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGoogleKey]);

  // Update challenger marker
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;
    const pos = challengerPosition;
    if (!pos) {
      if (challengerMarkerRef.current) { challengerMarkerRef.current.setMap(null); challengerMarkerRef.current = null; }
      return;
    }
    const maps = window.google.maps;
    if (challengerMarkerRef.current) {
      challengerMarkerRef.current.setPosition(pos);
    } else {
      challengerMarkerRef.current = new maps.Marker({
        position: pos,
        map: googleMapRef.current,
        title: challenge?.challenger_name || "Challenger",
        icon: { path: maps.SymbolPath.CIRCLE, scale: 12, fillColor: "#f97316", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2.5 },
        label: { text: String(challenge?.challenger_name || "A").charAt(0).toUpperCase(), color: "#fff", fontSize: "11px", fontWeight: "700" },
      });
    }
    // Re-center map to midpoint
    if (googleMapRef.current) googleMapRef.current.panTo(mapCenter);
  }, [challengerPosition, mapCenter, challenge?.challenger_name]);

  // Update challenged marker
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;
    const pos = challengedPosition;
    if (!pos) {
      if (challengedMarkerRef.current) { challengedMarkerRef.current.setMap(null); challengedMarkerRef.current = null; }
      return;
    }
    const maps = window.google.maps;
    if (challengedMarkerRef.current) {
      challengedMarkerRef.current.setPosition(pos);
    } else {
      challengedMarkerRef.current = new maps.Marker({
        position: pos,
        map: googleMapRef.current,
        title: challenge?.challenged_name || "Challenged",
        icon: { path: maps.SymbolPath.CIRCLE, scale: 12, fillColor: "#22c55e", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2.5 },
        label: { text: String(challenge?.challenged_name || "B").charAt(0).toUpperCase(), color: "#fff", fontSize: "11px", fontWeight: "700" },
      });
    }
  }, [challengedPosition, challenge?.challenged_name]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (challengerMarkerRef.current) { challengerMarkerRef.current.setMap(null); challengerMarkerRef.current = null; }
      if (challengedMarkerRef.current) { challengedMarkerRef.current.setMap(null); challengedMarkerRef.current = null; }
    };
  }, []);

  if (!challengeId) return null;

  const isCompleted = challenge?.status === "completed";
  const winnerId = challenge?.winner_id;

  return (
    <div className="sv-shell" role="region" aria-label="Live challenge spectator view">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sv-header">
        <div className="sv-header-left">
          <span className="sv-live-badge" aria-live="polite">
            {isCompleted ? "FINISHED" : "LIVE"}
          </span>
          <span className="sv-distance">{challenge?.distance_label || "—"}</span>
          <span className="sv-wager">{challenge?.xp_wager || 0} XP</span>
        </div>
        <div className="sv-header-right">
          {spectatorCount > 0 ? (
            <span className="sv-spectators" aria-label={`${spectatorCount} watching`}>
              👁 {spectatorCount}
            </span>
          ) : null}
          <button type="button" className="sv-close" onClick={onClose} aria-label="Exit spectator mode">
            ✕
          </button>
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div className="sv-map-wrap">
        {hasGoogleKey
          ? <div ref={mapNodeRef} className="sv-map" aria-label="Live runner positions" />
          : <iframe
              title="Spectator map"
              src={fallbackMapSrc}
              className="sv-map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />}
        {loading ? <div className="sv-map-loading">Loading positions...</div> : null}
      </div>

      {/* ── Scoreboard ─────────────────────────────────────────────────────── */}
      <div className="sv-scoreboard">
        {/* Challenger */}
        <div className={`sv-runner-card ${winnerId && Number(winnerId) === Number(challenge?.challenger_id) ? "winner" : ""}`}>
          <div className="sv-runner-avatar challenger" aria-hidden="true">
            {String(challenge?.challenger_name || "A").charAt(0).toUpperCase()}
          </div>
          <div className="sv-runner-info">
            <div className="sv-runner-name">
              {challenge?.challenger_name || "Challenger"}
              {winnerId && Number(winnerId) === Number(challenge?.challenger_id)
                ? <span className="sv-winner-crown" aria-label="Winner">🏆</span>
                : null}
            </div>
            <div className="sv-runner-time">
              {challenge?.challenger_time_seconds
                ? formatTime(challenge.challenger_time_seconds)
                : challengerPosition
                  ? <span className="sv-running-dot" aria-hidden="true" />
                  : "—"}
            </div>
            {challengerPosition
              ? <div className="sv-runner-last">Updated {timeSince(challengerPosition.last_seen)}</div>
              : null}
          </div>
        </div>

        {/* VS divider */}
        <div className="sv-vs" aria-hidden="true">VS</div>

        {/* Challenged */}
        <div className={`sv-runner-card ${winnerId && Number(winnerId) === Number(challenge?.challenged_id) ? "winner" : ""}`}>
          <div className="sv-runner-avatar challenged" aria-hidden="true">
            {String(challenge?.challenged_name || "B").charAt(0).toUpperCase()}
          </div>
          <div className="sv-runner-info">
            <div className="sv-runner-name">
              {challenge?.challenged_name || "Challenged"}
              {winnerId && Number(winnerId) === Number(challenge?.challenged_id)
                ? <span className="sv-winner-crown" aria-label="Winner">🏆</span>
                : null}
            </div>
            <div className="sv-runner-time">
              {challenge?.challenged_time_seconds
                ? formatTime(challenge.challenged_time_seconds)
                : challengedPosition
                  ? <span className="sv-running-dot" aria-hidden="true" />
                  : "—"}
            </div>
            {challengedPosition
              ? <div className="sv-runner-last">Updated {timeSince(challengedPosition.last_seen)}</div>
              : null}
          </div>
        </div>
      </div>

      {isCompleted && winnerId ? (
        <div className="sv-result-banner">
          {challenge?.challenger_id === winnerId
            ? challenge?.challenger_name
            : challenge?.challenged_name}{" "}
          wins by{" "}
          {formatTime(Math.abs(
            (challenge?.challenger_time_seconds || 0) - (challenge?.challenged_time_seconds || 0)
          ))}!
        </div>
      ) : null}
    </div>
  );
}
