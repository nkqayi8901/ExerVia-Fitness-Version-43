import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useDistanceUnitPreference from "../hooks/useDistanceUnitPreference";
import RoutePreviewVisual from "./RoutePreviewVisual";
import { supabase } from "../supabaseClient";
import { loadGoogleMapsApi } from "../utils/googleMapsLoader";
import { buildRunStory } from "../utils/runHighlights";
import {
  ATHLETE_DEFAULT_MAP_CENTER,
  formatDistance,
  formatElapsed,
  formatPaceFromSecondsPerKm,
} from "../utils/athleteMetrics";
import { getAthleteWorldMeta, normalizeAthleteSport } from "../utils/athleteWorlds";

function normalizePoints(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => ({
      lat: Number(point?.lat),
      lng: Number(point?.lng),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function buildBbox(points, fallback) {
  const source = points.length
    ? points
    : fallback?.lat && fallback?.lng
      ? [fallback]
      : [ATHLETE_DEFAULT_MAP_CENTER];
  const lats = source.map((point) => point.lat);
  const lngs = source.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 0.012;
  return `${minLng - pad},${minLat - pad},${maxLng + pad},${maxLat + pad}`;
}

export default function AthleteRunDetailPage({ viewerId }) {
  const navigate = useNavigate();
  const { id, runId } = useParams();
  const mapNodeRef = useRef(null);
  const googleMapRef = useRef(null);
  const routeRef = useRef(null);
  const hasGoogleMapsKey = Boolean(process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");
  const [run, setRun] = useState(null);
  const [ownerName, setOwnerName] = useState("");
  const [mapsReady, setMapsReady] = useState(false);
  const [distanceUnit, setDistanceUnit] = useDistanceUnitPreference();
  const resolvedViewerId = Number(viewerId || id);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!runId) return;
      setLoading(true);
      setBanner("");
      try {
        const { data, error } = await supabase
          .from("athlete_runs")
          .select("id,user_id,title,discipline,distance_km,elapsed_seconds,pace_per_km_seconds,visibility,challenge_mode,route_note,route_points,start_lat,start_lng,end_lat,end_lng,created_at")
          .eq("id", Number(runId))
          .maybeSingle();
        if (!active) return;
        if (error || !data) {
          setBanner("Could not load this run.");
          setRun(null);
          setLoading(false);
          return;
        }
        setRun({
          ...data,
          route_points: normalizePoints(data.route_points),
        });
        const profileRes = await supabase
          .from("user_profiles")
          .select("full_name")
          .eq("id", Number(data.user_id))
          .maybeSingle();
        if (active) {
          setOwnerName(String(profileRes?.data?.full_name || "").trim());
        }
      } catch {
        if (active) {
          setBanner("Could not load this run.");
          setRun(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [runId]);

  const points = useMemo(() => normalizePoints(run?.route_points), [run]);
  const center = useMemo(() => {
    if (points.length) return points[Math.floor(points.length / 2)];
    if (run?.start_lat && run?.start_lng) {
      return { lat: Number(run.start_lat), lng: Number(run.start_lng) };
    }
    return ATHLETE_DEFAULT_MAP_CENTER;
  }, [points, run]);

  const mapSrc = useMemo(() => {
    const bbox = buildBbox(points, center);
    const marker = `${center.lat},${center.lng}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  }, [center, points]);
  const runStory = useMemo(() => (run ? buildRunStory(run) : null), [run]);
  const worldMeta = useMemo(() => getAthleteWorldMeta(run?.discipline), [run]);

  useEffect(() => {
    let active = true;
    if (!hasGoogleMapsKey || !run || !mapNodeRef.current || googleMapRef.current) return undefined;
    loadGoogleMapsApi()
      .then((maps) => {
        if (!active || !mapNodeRef.current) return;
        const map = new maps.Map(mapNodeRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          mapId: process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || undefined,
        });
        googleMapRef.current = map;
        if (points.length) {
          routeRef.current = new maps.Polyline({
            map,
            path: points,
            geodesic: true,
            strokeColor: "#f97316",
            strokeOpacity: 0.92,
            strokeWeight: 4,
          });
          const bounds = new maps.LatLngBounds();
          points.forEach((point) => bounds.extend(point));
          if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
        } else {
          new maps.Marker({ map, position: center, title: run.title || "Run" });
        }
        setMapsReady(true);
      })
      .catch(() => setMapsReady(false));
    return () => {
      active = false;
    };
  }, [center, hasGoogleMapsKey, points, run]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="hud-card">Loading run...</div>
      </div>
    );
  }

  const backToCommunity = `/athlete/${resolvedViewerId}/community`;
  const backToRoutes = `/athlete/${resolvedViewerId}/routes`;
  const isOwnRun = Number(run?.user_id) === resolvedViewerId;
  const openWorld = () => {
    navigate(`/athlete/${resolvedViewerId}/training?world=${normalizeAthleteSport(run?.discipline)}`);
  };

  return (
    <div className="page-shell athlete-run-detail-page">
      <div className="page-header athlete-run-detail-header">
        <div className="athlete-run-detail-copy">
          <button className="studio-back" type="button" onClick={() => navigate(backToCommunity)}>
            Back
          </button>
          <div className="route-lab-kicker">Run Detail</div>
          <h2 className="page-title">{run?.title || "Route effort"}</h2>
          <p className="page-subtitle">
            {ownerName
              ? `${ownerName} logged this ${String(run?.discipline || "run").toLowerCase()} effort.`
              : "Route effort from the ExerVia athlete network."}
          </p>
        </div>
        <div className="route-lab-status">
          <div className="route-lab-status-pill">
            {formatDistance(run?.distance_km, { unit: distanceUnit, includeUnit: true })}
          </div>
          <div className="route-lab-status-pill">{formatElapsed(run?.elapsed_seconds)}</div>
          <div className="route-lab-status-pill">
            {formatPaceFromSecondsPerKm(run?.pace_per_km_seconds, { unit: distanceUnit, includeUnit: true })}
          </div>
          <div className="studio-toggle" aria-label="Distance unit preference">
            <button
              className={`studio-toggle-btn ${distanceUnit === "km" ? "active" : ""}`}
              type="button"
              onClick={() => setDistanceUnit("km")}
            >
              km
            </button>
            <button
              className={`studio-toggle-btn ${distanceUnit === "mi" ? "active" : ""}`}
              type="button"
              onClick={() => setDistanceUnit("mi")}
            >
              mi
            </button>
          </div>
        </div>
      </div>

      {banner ? <div className="exervia-banner error">{banner}</div> : null}

      {!run ? null : (
        <>
          <div className="athlete-run-detail-grid">
            <div className="hud-card athlete-run-map-card">
              <div className="athlete-run-cover">
                <RoutePreviewVisual
                  points={run.route_points}
                  className="athlete-run-cover-visual"
                  fallbackLabel="Route cover"
                  gradientId={`run-detail-gradient-${run.id}`}
                />
                <div className="athlete-run-cover-overlay">
                  <div className="athlete-run-cover-kicker">{worldMeta.title}</div>
                  <div className="athlete-run-cover-title">{run.title || "Route effort"}</div>
                  <div className="athlete-run-cover-sub">
                    {formatDistance(run.distance_km, { unit: distanceUnit, includeUnit: true })} · {formatElapsed(run.elapsed_seconds)} ·{" "}
                    {formatPaceFromSecondsPerKm(run.pace_per_km_seconds, { unit: distanceUnit, includeUnit: true })}
                  </div>
                </div>
              </div>
              <div className="hud-card-title">ROUTE SURFACE</div>
              <div className="athlete-run-map-wrap">
                {hasGoogleMapsKey && points.length > 0 ? (
                  <div ref={mapNodeRef} className="route-lab-map-frame route-lab-google-map" />
                ) : (
                  <iframe
                    title="Saved athlete run map"
                    src={mapSrc}
                    className="route-lab-map-frame"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )}
              </div>
              <div className="route-lab-map-meta">
                <span>{String(run.discipline || "running").toUpperCase()}</span>
                <span>{String(run.visibility || "private").toUpperCase()}</span>
                <span>{String(run.challenge_mode || "solo").toUpperCase()}</span>
                <span>{points.length > 0 && mapsReady ? "Live map" : "Route view"}</span>
              </div>
              {!points.length ? (
                <div className="athlete-run-map-note">
                  No route trace yet. Start the run and move with GPS active to draw the route line.
                </div>
              ) : null}
            </div>

            <div className="hud-card athlete-run-summary-card">
              <div className="hud-card-title">RUN SIGNAL</div>
              <div className="athlete-run-summary-copy">
                <strong>{ownerName || "Athlete"} moved with intent.</strong>
                <p>
                  {run.route_note ||
                    "Saved route, tracked distance, and live effort now sit inside the athlete profile instead of disappearing after the session closes."}
                </p>
              </div>
              {runStory?.highlights?.length ? (
                <div className="athlete-run-highlight-row">
                  {runStory.highlights.map((highlight) => (
                    <span key={`${run.id}-${highlight}`} className="athlete-run-highlight">
                      {highlight}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="athlete-run-stat-grid">
                <div className="athlete-run-stat">
                  <span className="athlete-run-stat-label">Distance</span>
                  <strong>{formatDistance(run.distance_km, { unit: distanceUnit, includeUnit: true })}</strong>
                </div>
                <div className="athlete-run-stat">
                  <span className="athlete-run-stat-label">Time</span>
                  <strong>{formatElapsed(run.elapsed_seconds)}</strong>
                </div>
                <div className="athlete-run-stat">
                  <span className="athlete-run-stat-label">Pace</span>
                  <strong>{formatPaceFromSecondsPerKm(run.pace_per_km_seconds, { unit: distanceUnit, includeUnit: true })}</strong>
                </div>
                <div className="athlete-run-stat">
                  <span className="athlete-run-stat-label">Logged</span>
                  <strong>{new Date(run.created_at).toLocaleDateString()}</strong>
                </div>
              </div>
              <div className="route-lab-action-row">
                <button className="studio-back" type="button" onClick={openWorld}>
                  {worldMeta.ctaLabel}
                </button>
                {isOwnRun ? (
                  <button className="studio-primary-btn" type="button" onClick={() => navigate(backToRoutes)}>
                    Open route lab
                  </button>
                ) : (
                  <button
                    className="studio-primary-btn"
                    type="button"
                    onClick={() => navigate(`/athlete/${resolvedViewerId}/profile/${run.user_id}`)}
                  >
                    Open athlete
                  </button>
                )}
                <button className="studio-back" type="button" onClick={() => navigate(backToCommunity)}>
                  Back to feed
                </button>
              </div>
            </div>
          </div>

          <div className="hud-card athlete-run-story-card">
            <div className="hud-card-title">RUN STORY</div>
            <div className="athlete-run-story-grid">
              <div>
                <div className="athlete-run-story-label">Route note</div>
                <p className="athlete-run-story-body">{run.route_note || "No route note was added for this effort."}</p>
              </div>
              <div>
                <div className="athlete-run-story-label">{worldMeta.title}</div>
                <p className="athlete-run-story-body">
                  {runStory?.summary ||
                    "ExerVia turns run logging into visible athlete identity: route, pace, and effort move straight into feed, profile, and progression."}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
