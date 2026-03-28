import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loadGoogleMapsApi } from "../utils/googleMapsLoader";
import { supabase } from "../supabaseClient";
import { grantXpEventSafe } from "../services/xpEvents";
import { trackDailyActivity } from "../services/activityTracker";
import { emitToast } from "../utils/toast";
import { publishRunStatus } from "../utils/activityStatusFeed";
import { recalcUserState } from "../services/stateEngine";
import { getAthleteWorldMeta, normalizeAthleteSport } from "../utils/athleteWorlds";

const STORAGE_KEY = "exervia_run_map_lab_v1";
const RUN_HISTORY_KEY = "exervia_run_history_v1";

const DISTANCE_OPTIONS = ["1K", "2K", "5K", "10K"];
const VISIBILITY_OPTIONS = ["Private", "Nearby", "Regional"];
const CHALLENGE_OPTIONS = ["Solo", "Ghost", "Challenge"];
const DISCIPLINE_OPTIONS = ["Running", "Cycling", "Trail"];
const RADIUS_OPTIONS = ["2 km", "5 km", "10 km"];

const ROUTE_PRESETS = [
  {
    id: "docklands-tempo",
    name: "Docklands Tempo Loop",
    city: "Dublin",
    distance: "5K",
    vibe: "Flat tempo route with clean turns and strong shareability.",
    lat: 53.3478,
    lng: -6.2419,
  },
  {
    id: "ucc-river-loop",
    name: "River Lee Builder",
    city: "Cork",
    distance: "2K",
    vibe: "Short challenge loop for live 1K and 2K battles.",
    lat: 51.8985,
    lng: -8.4756,
  },
  {
    id: "clapham-5k",
    name: "City Ladder 5K",
    city: "London",
    distance: "5K",
    vibe: "Built for recurring leaderboard pushes and weekly rivalry.",
    lat: 51.4613,
    lng: -0.1387,
  },
];

function clampCoord(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildBbox(lat, lng, zoomSpread = 0.028) {
  const minLat = clampCoord(lat - zoomSpread, -85, 85);
  const maxLat = clampCoord(lat + zoomSpread, -85, 85);
  const minLng = clampCoord(lng - zoomSpread, -180, 180);
  const maxLng = clampCoord(lng + zoomSpread, -180, 180);
  return `${minLng},${minLat},${maxLng},${maxLat}`;
}

function readStoredLab() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readRunHistory() {
  try {
    const raw = localStorage.getItem(RUN_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceKmBetween(a, b) {
  if (!a || !b) return 0;
  const earthRadiusKm = 6371;
  const dLat = toRad((b.lat || 0) - (a.lat || 0));
  const dLng = toRad((b.lng || 0) - (a.lng || 0));
  const lat1 = toRad(a.lat || 0);
  const lat2 = toRad(b.lat || 0);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function formatElapsed(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDistance(distanceKm) {
  return Number(distanceKm || 0).toFixed(2);
}

function formatPace(distanceKm, elapsedSeconds) {
  const distance = Number(distanceKm || 0);
  const seconds = Number(elapsedSeconds || 0);
  if (distance <= 0 || seconds <= 0) return "--:--";
  const paceSeconds = Math.round(seconds / distance);
  const mins = Math.floor(paceSeconds / 60);
  const secs = paceSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function normalizeDiscipline(value) {
  const raw = String(value || "running").trim().toLowerCase();
  if (raw.includes("cycle")) return "cycling";
  if (raw.includes("trail")) return "trail";
  return "running";
}

export default function AthleteRunMapLab({ userId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const mapNodeRef = useRef(null);
  const googleMapRef = useRef(null);
  const googleMarkerRef = useRef(null);
  const googleCircleRef = useRef(null);
  const googleRouteRef = useRef(null);
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const hasGoogleMapsKey = Boolean(process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
  const stored = readStoredLab();
  const [discipline, setDiscipline] = useState(stored?.discipline || "Running");
  const [selectedDistance, setSelectedDistance] = useState(stored?.selectedDistance || "5K");
  const [visibility, setVisibility] = useState(stored?.visibility || "Nearby");
  const [challengeMode, setChallengeMode] = useState(stored?.challengeMode || "Challenge");
  const [battleRadius, setBattleRadius] = useState(stored?.battleRadius || "10 km");
  const [routeName, setRouteName] = useState(stored?.routeName || "ExerVia Run Prototype");
  const [routeNote, setRouteNote] = useState(stored?.routeNote || "Route-ready for live challenge matchmaking.");
  const [mapCenter, setMapCenter] = useState(stored?.mapCenter || { lat: 53.3498, lng: -6.2603 });
  const [savedPlans, setSavedPlans] = useState(Array.isArray(stored?.savedPlans) ? stored.savedPlans : []);
  const [runHistory, setRunHistory] = useState(readRunHistory());
  const [activePresetId, setActivePresetId] = useState(stored?.activePresetId || ROUTE_PRESETS[0].id);
  const [geoState, setGeoState] = useState({ loading: false, error: "" });
  const [runState, setRunState] = useState(stored?.runState || "idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(Number(stored?.elapsedSeconds || 0));
  const [distanceKm, setDistanceKm] = useState(Number(stored?.distanceKm || 0));
  const [routePoints, setRoutePoints] = useState(Array.isArray(stored?.routePoints) ? stored.routePoints : []);
  const [runSummary, setRunSummary] = useState(stored?.runSummary || null);
  const [postingRun, setPostingRun] = useState(false);
  const [routeSavedMessage, setRouteSavedMessage] = useState("");
  const [runsLoading, setRunsLoading] = useState(false);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [mapsState, setMapsState] = useState({
    ready: false,
    usingGoogle: false,
    error: "",
  });
  const routeParams = useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
  const linkedWorld = normalizeAthleteSport(routeParams.get("world") || "");
  const linkedPlan = String(routeParams.get("plan") || "").trim();
  const linkedWeek = String(routeParams.get("week") || "").trim();
  const linkedFocus = String(routeParams.get("focus") || "").trim();
  const linkedObjective = String(routeParams.get("objective") || "").trim();
  const linkedContext = useMemo(
    () => ({
      world: linkedWorld,
      plan: linkedPlan,
      week: linkedWeek,
      focus: linkedFocus,
      objective: linkedObjective,
    }),
    [linkedFocus, linkedObjective, linkedPlan, linkedWeek, linkedWorld]
  );
  const linkedTrainingMode = Boolean(linkedWorld || linkedPlan || linkedWeek || linkedFocus || linkedObjective);
  const routeWorld = linkedWorld || normalizeDiscipline(discipline);
  const worldMeta = getAthleteWorldMeta(routeWorld);
  const initialMapConfigRef = useRef({
    center: stored?.mapCenter || { lat: 53.3498, lng: -6.2603 },
    routeName: stored?.routeName || "ExerVia Run Prototype",
    visibility: stored?.visibility || "Nearby",
    challengeMode: stored?.challengeMode || "Challenge",
  });
  const detectRunPrs = ({ priorRuns, disciplineValue, distanceKmValue, elapsedSecondsValue }) => {
    const normalizedDiscipline = normalizeDiscipline(disciplineValue);
    const comparableRuns = priorRuns.filter(
      (run) =>
        normalizeDiscipline(run?.discipline) === normalizedDiscipline &&
        Number(run?.distanceKm || run?.distance_km || 0) > 0 &&
        Number(run?.elapsedSeconds || run?.elapsed_seconds || 0) > 0
    );
    const prs = [];
    const maxDistance = comparableRuns.reduce(
      (best, run) => Math.max(best, Number(run?.distanceKm || run?.distance_km || 0)),
      0
    );
    const currentDistance = Number(distanceKmValue || 0);
    const currentElapsed = Number(elapsedSecondsValue || 0);
    if (currentDistance > 0 && currentDistance > maxDistance) {
      prs.push({ label: "Longest route", value: `${currentDistance.toFixed(1)} km` });
    }
    const similarDistanceRuns = comparableRuns.filter((run) => {
      const previousDistance = Number(run?.distanceKm || run?.distance_km || 0);
      return Math.abs(previousDistance - currentDistance) <= 0.25;
    });
    const bestElapsedForDistance = similarDistanceRuns.reduce(
      (best, run) => {
        const value = Number(run?.elapsedSeconds || run?.elapsed_seconds || 0);
        return value > 0 && (best === 0 || value < best) ? value : best;
      },
      0
    );
    if (currentDistance > 0 && currentElapsed > 0 && bestElapsedForDistance > 0 && currentElapsed < bestElapsedForDistance) {
      prs.push({ label: "Fastest matched effort", value: formatElapsed(currentElapsed) });
    }
    return prs;
  };

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        discipline,
        selectedDistance,
        visibility,
        challengeMode,
        battleRadius,
        routeName,
        routeNote,
        mapCenter,
        savedPlans,
        activePresetId,
        runState,
        elapsedSeconds,
        distanceKm,
        routePoints,
        runSummary,
      })
    );
  }, [discipline, selectedDistance, visibility, challengeMode, battleRadius, routeName, routeNote, mapCenter, savedPlans, activePresetId, runState, elapsedSeconds, distanceKm, routePoints, runSummary]);

  useEffect(() => {
    const world = linkedWorld;
    if (world === "cycling") setDiscipline("Cycling");
    else if (world === "trail") setDiscipline("Trail");
    else if (world === "running") setDiscipline("Running");
  }, [linkedWorld]);

  useEffect(() => {
    if (!linkedPlan && !linkedWeek && !linkedFocus) return;
    const worldLabel =
      linkedWorld === "cycling" ? "Cycling" : linkedWorld === "trail" ? "Trail" : linkedWorld === "running" ? "Running" : "";
    if (worldLabel && discipline !== worldLabel) {
      setDiscipline(worldLabel);
    }
    if (linkedPlan && (!stored?.routeName || stored.routeName === "ExerVia Run Prototype")) {
      setRouteName(linkedWeek ? `${linkedPlan} - ${linkedWeek}` : linkedPlan);
    }
    if (linkedFocus && (!stored?.routeNote || stored.routeNote === "Route-ready for live challenge matchmaking.")) {
      const objectiveLine = linkedObjective ? ` Lead objective: ${linkedObjective}.` : "";
      setRouteNote(`${linkedFocus} route block linked to Training Ritual.${objectiveLine}`);
    }
  }, [discipline, linkedFocus, linkedObjective, linkedPlan, linkedWeek, linkedWorld, stored?.routeName, stored?.routeNote]);

  useEffect(() => {
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(runHistory));
  }, [runHistory]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setRunsLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("athlete_runs")
          .select("id,title,discipline,distance_km,elapsed_seconds,pace_per_km_seconds,visibility,challenge_mode,route_note,route_points,created_at")
          .eq("user_id", Number(userId))
          .order("created_at", { ascending: false })
          .limit(10);
        if (!active || error || !Array.isArray(data)) return;
        const normalized = data.map((row) => ({
          id: row.id,
          name: row.title,
          discipline: String(row.discipline || "running"),
          distanceKm: Number(row.distance_km || 0),
          elapsedSeconds: Number(row.elapsed_seconds || 0),
          pace: row.pace_per_km_seconds ? formatPace(1, Number(row.pace_per_km_seconds)) : formatPace(Number(row.distance_km || 0), Number(row.elapsed_seconds || 0)),
          visibility: row.visibility,
          challengeMode: row.challenge_mode,
          routePoints: Array.isArray(row.route_points) ? row.route_points : [],
          createdAt: row.created_at,
        }));
        setRunHistory(normalized);
      } catch {
        // keep local fallback
      } finally {
        if (active) setRunsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const activePreset = useMemo(
    () => ROUTE_PRESETS.find((preset) => preset.id === activePresetId) || ROUTE_PRESETS[0],
    [activePresetId]
  );
  const pageTitle = linkedTrainingMode
    ? `${worldMeta.title} Route Layer`
    : "Challenge-ready route planning";
  const pageSubtitle = linkedTrainingMode
    ? "Built into Training Ritual so mapped efforts follow your selected world, plan, and week."
    : "Part of Training Ritual: map planning, route identity, and live effort setup for running, cycling, and trail.";
  const backToTrainingUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (linkedWorld) params.set("world", linkedWorld);
    return `/athlete/${userId}/training${params.toString() ? `?${params.toString()}` : ""}`;
  }, [linkedWorld, userId]);
  const routeModeSummary = `${visibility} visibility · ${challengeMode} mode`;
  const availableRunModes = linkedTrainingMode ? CHALLENGE_OPTIONS.filter((option) => option !== "Challenge") : CHALLENGE_OPTIONS;

  useEffect(() => {
    setShowAdvancedSetup(!linkedTrainingMode);
  }, [linkedTrainingMode]);

  useEffect(() => {
    if (linkedTrainingMode && challengeMode === "Challenge") {
      setChallengeMode("Solo");
    }
  }, [challengeMode, linkedTrainingMode]);

  const mapSrc = useMemo(() => {
    const bbox = buildBbox(mapCenter.lat, mapCenter.lng);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mapCenter.lat},${mapCenter.lng}`;
  }, [mapCenter]);

  useEffect(() => {
    let active = true;
    const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;
    if (!hasGoogleMapsKey) {
      setMapsState({
        ready: true,
        usingGoogle: false,
        error: "Add REACT_APP_GOOGLE_MAPS_API_KEY to enable Google Maps.",
      });
      return undefined;
    }

    if (!mapNodeRef.current || googleMapRef.current) return undefined;

    loadGoogleMapsApi()
      .then((maps) => {
        if (!active || !mapNodeRef.current) return;
        const initialConfig = initialMapConfigRef.current;
        const map = new maps.Map(mapNodeRef.current, {
          center: initialConfig.center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapId: mapId || undefined,
        });
        googleMapRef.current = map;
        googleMarkerRef.current = new maps.Marker({
          position: initialConfig.center,
          map,
          title: initialConfig.routeName || "ExerVia route point",
        });
        googleCircleRef.current = new maps.Circle({
          map,
          center: initialConfig.center,
          radius: initialConfig.visibility === "Nearby" ? 1500 : initialConfig.visibility === "Regional" ? 5000 : 600,
          fillColor: "#38bdf8",
          fillOpacity: initialConfig.challengeMode === "Challenge" ? 0.14 : 0.08,
          strokeColor: "#38bdf8",
          strokeOpacity: 0.38,
          strokeWeight: 1.2,
        });
        setMapsState({ ready: true, usingGoogle: true, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        setMapsState({
          ready: true,
          usingGoogle: false,
          error: error?.message || "Google Maps unavailable. Using fallback map.",
        });
      });

    return () => {
      active = false;
    };
  }, [hasGoogleMapsKey]);

  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;
    googleMapRef.current.panTo(mapCenter);
    googleMarkerRef.current?.setPosition(mapCenter);
    googleCircleRef.current?.setCenter(mapCenter);
  }, [mapCenter]);

  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps) return;
    if (!googleRouteRef.current) {
      googleRouteRef.current = new window.google.maps.Polyline({
        map: googleMapRef.current,
        path: routePoints,
        geodesic: true,
        strokeColor: "#f97316",
        strokeOpacity: 0.95,
        strokeWeight: 4,
      });
      return;
    }
    googleRouteRef.current.setPath(routePoints);
  }, [routePoints]);

  useEffect(() => {
    if (!googleCircleRef.current) return;
    googleCircleRef.current.setRadius(visibility === "Nearby" ? 1500 : visibility === "Regional" ? 5000 : 600);
    googleCircleRef.current.setOptions({
      fillOpacity: challengeMode === "Challenge" ? 0.14 : 0.08,
    });
  }, [visibility, challengeMode]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoState({ loading: false, error: "Geolocation is not supported on this device." });
      return;
    }
    setGeoState({ loading: true, error: "" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter({
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        });
        setGeoState({ loading: false, error: "" });
      },
      () => {
        setGeoState({ loading: false, error: "Could not access location. Check browser permission." });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const applyPreset = (preset) => {
    setActivePresetId(preset.id);
    setMapCenter({ lat: preset.lat, lng: preset.lng });
    setSelectedDistance(preset.distance);
    setRouteName(preset.name);
    setRouteNote(preset.vibe);
  };

  const savePlan = () => {
    const nextPlan = {
      id: `${Date.now()}`,
      name: routeName.trim() || "Untitled route",
      discipline,
      distance: selectedDistance,
      visibility,
      challengeMode,
      note: routeNote.trim() || "Route-ready for ExerVia challenges.",
      center: mapCenter,
    };
    setSavedPlans((prev) => [nextPlan, ...prev].slice(0, 6));
    setRouteSavedMessage("Route plan saved.");
    window.setTimeout(() => setRouteSavedMessage(""), 2200);
  };

  useEffect(() => () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const beginRun = () => {
    if (!navigator.geolocation) {
      setGeoState({ loading: false, error: "Live tracking is not supported on this device." });
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (timerRef.current) clearInterval(timerRef.current);

    setRunState("tracking");
    setElapsedSeconds(0);
    setDistanceKm(0);
    setRoutePoints([]);
    setRunSummary(null);
    setGeoState({ loading: true, error: "" });

    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextPoint = {
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
        };
        setMapCenter(nextPoint);
        setGeoState({ loading: false, error: "" });
        setRoutePoints((prev) => {
          if (!prev.length) return [nextPoint];
          const last = prev[prev.length - 1];
          const delta = distanceKmBetween(last, nextPoint);
          if (delta < 0.01) return prev;
          setDistanceKm((current) => Number((current + delta).toFixed(2)));
          return [...prev, nextPoint];
        });
      },
      () => {
        setGeoState({ loading: false, error: "GPS lost. Check permission or signal." });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1500 }
    );
  };

  const stopRun = async () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const runPrs = detectRunPrs({
      priorRuns: runHistory,
      disciplineValue: discipline,
      distanceKmValue: distanceKm,
      elapsedSecondsValue: elapsedSeconds,
    });
    const summary = {
      id: null,
      name: routeName.trim() || `${discipline} session`,
      discipline,
      distanceKm: Number(distanceKm.toFixed(2)),
      elapsedSeconds,
      pace: formatPace(distanceKm, elapsedSeconds),
      visibility,
      challengeMode,
      routePoints,
      prs: runPrs,
      createdAt: new Date().toISOString(),
    };
    setRunSummary(summary);
    setRunHistory((prev) => [summary, ...prev].slice(0, 10));
    setRunState("completed");

    let savedRunId = null;
    if (userId) {
      try {
        const normalizedDiscipline = normalizeDiscipline(summary.discipline);
        const startPoint = summary.routePoints[0] || mapCenter;
        const endPoint = summary.routePoints[summary.routePoints.length - 1] || mapCenter;
        const pacePerKmSeconds =
          summary.distanceKm > 0 && summary.elapsedSeconds > 0
            ? Math.round(summary.elapsedSeconds / summary.distanceKm)
            : null;
        const { data, error } = await supabase
          .from("athlete_runs")
          .insert([
            {
              user_id: Number(userId),
              title: summary.name,
              discipline: normalizedDiscipline,
              distance_km: summary.distanceKm,
              elapsed_seconds: summary.elapsedSeconds,
              pace_per_km_seconds: pacePerKmSeconds,
              visibility: String(summary.visibility || "Private").toLowerCase(),
              challenge_mode: String(summary.challengeMode || "Solo").toLowerCase(),
              route_note: routeNote.trim() || null,
              route_points: summary.routePoints,
              start_lat: Number(startPoint?.lat || 0) || null,
              start_lng: Number(startPoint?.lng || 0) || null,
              end_lat: Number(endPoint?.lat || 0) || null,
              end_lng: Number(endPoint?.lng || 0) || null,
              source: "route_lab",
            },
          ])
          .select("id,created_at")
          .single();
        if (!error && data?.id) {
          savedRunId = data.id;
          setRunSummary((prev) => (prev ? { ...prev, id: data.id, createdAt: data.created_at || prev.createdAt } : prev));
          setRunHistory((prev) =>
            prev.map((item, index) =>
              index === 0 && item.createdAt === summary.createdAt
                ? { ...item, id: data.id, createdAt: data.created_at || item.createdAt }
                : item
            )
          );
          emitToast("Run saved.", "success", 2200);
        }
      } catch (error) {
        console.error("Run save failed:", error);
      }
    }

    if (userId && linkedTrainingMode) {
      try {
        const trainingSessionData = {
          user_id: Number(userId),
          sport: normalizeDiscipline(summary.discipline),
          level: "advanced",
          duration_minutes: Math.max(1, Math.round(Number(summary.elapsedSeconds || 0) / 60)),
          effort_level: null,
          mood_emoji: "Focused",
          notes: [routeNote.trim(), linkedObjective ? `Objective: ${linkedObjective}` : ""].filter(Boolean).join("\n"),
          metrics: {
            distance: summary.distanceKm > 0 ? Number(summary.distanceKm) : null,
            heart_rate: null,
            efficiency_factor: null,
            focus: linkedFocus || null,
            plan_id: null,
            plan_name: linkedPlan || null,
            plan_week: linkedWeek || null,
            plan_sessions: linkedObjective ? [linkedObjective] : [],
            mapped_effort: true,
            route_run_id: savedRunId,
            world: routeWorld,
            source: "route_lab",
          },
          efficiency_factor: null,
        };
        const { data: trainingData, error: trainingError } = await supabase
          .from("training_sessions")
          .insert([trainingSessionData])
          .select("id")
          .single();
        if (!trainingError && trainingData?.id) {
          setRunSummary((prev) =>
            prev ? { ...prev, trainingSessionId: trainingData.id, trainingLinked: true } : prev
          );
        }
      } catch (error) {
        console.error("Mapped effort sync failed:", error);
      }
    }

    if (userId) {
      const baseXp = Math.max(15, Math.round(summary.distanceKm * 8) + Math.round(summary.elapsedSeconds / 180));
      try {
        const xpResult = await grantXpEventSafe({
          userId,
          eventType: "training_session",
          baseXp,
          idempotencyKey: `route_run_${userId}_${summary.createdAt}`,
          meta: {
            discipline: summary.discipline,
            distance_km: summary.distanceKm,
            elapsed_seconds: summary.elapsedSeconds,
            source: "route_lab",
          },
        });
        await trackDailyActivity(userId, "training_session");
        await recalcUserState(userId);
        window.dispatchEvent(new Event("user_state_updated"));
        if (Number(xpResult.awardedXp || 0) > 0) {
          emitToast(`Run complete. +${xpResult.awardedXp} XP earned.`, "success", 2800);
        }
        if (runPrs.length) {
          emitToast(`Run PR: ${runPrs[0].label}.`, "success", 3200);
        }
      } catch (error) {
        console.error("Run XP/state update failed:", error);
      }
    }
  };

  const resetRun = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRunState("idle");
    setElapsedSeconds(0);
    setDistanceKm(0);
    setRoutePoints([]);
    setRunSummary(null);
  };

  const postRunToCommunity = async () => {
    if (!runSummary || !userId) return;
    setPostingRun(true);
    try {
      await publishRunStatus(userId, {
        runId: runSummary.id,
        discipline: runSummary.discipline,
        name: runSummary.name,
        distanceLabel: `${formatDistance(runSummary.distanceKm)} km`,
        elapsedLabel: formatElapsed(runSummary.elapsedSeconds),
        paceLabel: `${runSummary.pace}/km`,
      });

      await trackDailyActivity(userId, "community_post");
      await grantXpEventSafe({
        userId,
        eventType: "community_post",
        baseXp: 12,
        idempotencyKey: `run_post_${userId}_${runSummary.createdAt}`,
        meta: {
          distance_km: runSummary.distanceKm,
          elapsed_seconds: runSummary.elapsedSeconds,
          discipline: runSummary.discipline,
        },
      });

      emitToast("Run posted to community.", "success", 2800);
    } catch (error) {
      emitToast(error?.message || "Could not post run.", "error", 3200);
    } finally {
      setPostingRun(false);
    }
  };

  const livePace = formatPace(distanceKm, elapsedSeconds);

  return (
    <div className="page-shell route-lab-shell" data-world={routeWorld}>
      <div className="page-header route-lab-header">
        <div className="route-lab-head-copy">
          <button className="studio-back" type="button" onClick={() => navigate(backToTrainingUrl)}>
            Back to Training
          </button>
          <div className="route-lab-kicker">Run Map Lab</div>
          <h2 className="page-title">{pageTitle}</h2>
          <p className="page-subtitle">{pageSubtitle}</p>
          {(linkedContext.world || linkedContext.plan || linkedContext.week) ? (
            <div className="route-lab-context">
              <div className="route-lab-context-top">
                <strong>Linked from Training Ritual</strong>
                <span>{worldMeta.title}</span>
              </div>
              <div className="route-lab-context-line">
                {linkedContext.plan || "Mapped effort"}{linkedContext.week ? ` - ${linkedContext.week}` : ""}
              </div>
              {linkedContext.focus || linkedContext.objective ? (
                <div className="route-lab-context-sub">
                  {linkedContext.focus ? `${linkedContext.focus} focus` : "Training focus"}
                  {linkedContext.objective ? ` · ${linkedContext.objective}` : ""}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="route-lab-status">
          <div className="route-lab-status-pill">{worldMeta.title}</div>
          <div className="route-lab-status-pill">Distance {selectedDistance}</div>
          {!linkedTrainingMode ? <div className="route-lab-status-pill">{visibility} visibility</div> : null}
          {!linkedTrainingMode ? <div className="route-lab-status-pill">{challengeMode} mode</div> : null}
        </div>
      </div>

      <div className="route-lab-grid">
        <div className="hud-card route-lab-map-card">
          <div className="hud-card-title">LIVE MAP SURFACE</div>
          <div className="route-lab-map-wrap">
            {hasGoogleMapsKey ? (
              <div ref={mapNodeRef} className="route-lab-map-frame route-lab-google-map" />
            ) : (
              <iframe
                title="ExerVia route map"
                src={mapSrc}
                className="route-lab-map-frame"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
          <div className="route-lab-map-meta">
            <span>Lat {mapCenter.lat}</span>
            <span>Lng {mapCenter.lng}</span>
            <span>{activePreset.city}</span>
            <span>{mapsState.usingGoogle ? "Google Maps live" : "Fallback map"}</span>
          </div>
          <div className="route-lab-map-actions">
            <button className="studio-back" type="button" onClick={handleUseMyLocation}>
              {geoState.loading ? "Finding location..." : "Use my location"}
            </button>
            <button className="studio-back" type="button" onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${mapCenter.lat}&mlon=${mapCenter.lng}#map=14/${mapCenter.lat}/${mapCenter.lng}`, "_blank", "noopener,noreferrer")}>
              Open full map
            </button>
          </div>
          {geoState.error ? <div className="route-lab-error">{geoState.error}</div> : null}
          {mapsState.error ? <div className="route-lab-error">{mapsState.error}</div> : null}

          <div className="route-lab-live-card">
            <div className="route-lab-live-state">
              <span className={`route-lab-live-badge ${runState}`}>{runState === "tracking" ? "GPS Acquired" : runState === "completed" ? "Run complete" : "Ready to run"}</span>
              <span className="route-lab-expand-btn route-lab-map-lock">Map locked</span>
            </div>
            <div className="route-lab-live-metrics">
              <div className="route-lab-live-metric">
                <strong>{formatElapsed(elapsedSeconds)}</strong>
                <span>Time</span>
              </div>
              <div className="route-lab-live-metric">
                <strong>{livePace}</strong>
                <span>Avg. pace /km</span>
              </div>
              <div className="route-lab-live-metric">
                <strong>{formatDistance(distanceKm)}</strong>
                <span>Distance (km)</span>
              </div>
            </div>
            <div className="route-lab-live-actions">
              <button
                className={`route-lab-live-start ${runState === "tracking" ? "live" : ""}`}
                type="button"
                onClick={runState === "tracking" ? stopRun : beginRun}
              >
                {runState === "tracking" ? "Stop run" : runState === "completed" ? "Start again" : "Start run"}
              </button>
              <div className="route-lab-live-hint">
                {runState === "tracking"
                  ? "Tracking live. Stop the run when the effort is complete."
                  : "Choose your route setup, allow location access, then press Start run."}
              </div>
            </div>
          </div>
        </div>

        <div className="hud-card route-lab-control-card">
          <div className="hud-card-title">ROUTE SETUP</div>
          {!linkedTrainingMode ? (
            <div className="route-lab-option-block">
              <div className="route-lab-label">Discipline</div>
              <div className="route-lab-chip-row">
                {DISCIPLINE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`studio-chip ${discipline === option ? "active" : ""}`}
                    onClick={() => setDiscipline(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="route-lab-option-block">
            <div className="route-lab-label">Challenge distance</div>
            <div className="route-lab-chip-row">
              {DISTANCE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`studio-chip ${selectedDistance === option ? "active" : ""}`}
                  onClick={() => setSelectedDistance(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="route-lab-option-block">
            <div className="route-lab-label">Presence visibility</div>
            <div className="route-lab-chip-row">
              {VISIBILITY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`studio-chip ${visibility === option ? "active" : ""}`}
                  onClick={() => setVisibility(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="route-lab-option-block">
            <div className="route-lab-label">Run mode</div>
            <div className="route-lab-chip-row">
              {availableRunModes.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`studio-chip ${challengeMode === option ? "active" : ""}`}
                  onClick={() => setChallengeMode(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          {linkedTrainingMode ? (
            <div className="route-lab-mode-note">
              Live challenges unlock after matchmaking is ready. For now, keep mapped efforts focused on solo or ghost sessions.
            </div>
          ) : null}

          {linkedTrainingMode ? (
            <button
              className="route-lab-advanced-toggle"
              type="button"
              onClick={() => setShowAdvancedSetup((prev) => !prev)}
            >
              {showAdvancedSetup ? "Hide advanced setup" : "Show advanced setup"}
            </button>
          ) : null}

          {linkedTrainingMode && !showAdvancedSetup ? (
            <div className="route-lab-linked-note">
              {routeModeSummary}. {routeNote || "Mapped effort linked to this training block."}
            </div>
          ) : null}

          {!linkedTrainingMode || showAdvancedSetup ? (
            <>
              <label className="route-lab-field">
                <span className="route-lab-label">Route name</span>
                <input
                  className="studio-form-input"
                  value={routeName}
                  onChange={(event) => setRouteName(event.target.value)}
                  placeholder="ExerVia challenge route"
                />
              </label>
              {!linkedTrainingMode ? (
                <label className="route-lab-field">
                  <span className="route-lab-label">Route note</span>
                  <textarea
                    className="studio-textarea route-lab-note"
                    value={routeNote}
                    onChange={(event) => setRouteNote(event.target.value)}
                    placeholder="Why this route matters for pace, rivalry, or challenge format."
                  />
                </label>
              ) : (
                <div className="route-lab-linked-note">
                  {routeNote || "Mapped effort linked to this training block."}
                </div>
              )}
            </>
          ) : null}

          {challengeMode === "Challenge" && (!linkedTrainingMode || showAdvancedSetup) ? (
            <>
              <div className="route-lab-option-block">
                <div className="route-lab-label">Challenge radius</div>
                <div className="route-lab-chip-row">
                  {RADIUS_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`studio-chip ${battleRadius === option ? "active" : ""}`}
                      onClick={() => setBattleRadius(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="route-lab-battle-card">
                <div className="route-lab-battle-head">
                  <strong>Live battle protocol</strong>
                  <span>60s ready window</span>
                </div>
                <div className="route-lab-battle-copy">
                  Challenge athletes inside your chosen radius, lock the distance, and go live only after both sides accept.
                </div>
                <div className="route-lab-battle-meta">
                  <span>{selectedDistance}</span>
                  <span>{battleRadius}</span>
                  <span>{challengeMode}</span>
                </div>
              </div>
            </>
          ) : null}

          <div className="route-lab-action-row">
            {!linkedTrainingMode ? (
              <button className="studio-primary-btn" type="button" onClick={savePlan}>
                Save route plan
              </button>
            ) : null}
            <button className="studio-back" type="button" onClick={() => applyPreset(activePreset)}>
              {linkedTrainingMode ? "Use preset" : "Recenter preset"}
            </button>
          </div>
          {routeSavedMessage ? <div className="route-lab-saved-feedback">{routeSavedMessage}</div> : null}
        </div>
      </div>

      <div className="route-lab-lower-grid">
        {!linkedTrainingMode ? (
          <div className="hud-card">
            <div className="hud-card-title">INVESTOR DEMO PRESETS</div>
            <div className="route-lab-preset-list">
              {ROUTE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`route-lab-preset ${activePresetId === preset.id ? "active" : ""}`}
                  onClick={() => applyPreset(preset)}
                >
                  <div className="route-lab-preset-top">
                    <strong>{preset.name}</strong>
                    <span>{preset.distance}</span>
                  </div>
                  <div className="route-lab-preset-sub">{preset.city}</div>
                  <div className="route-lab-preset-note">{preset.vibe}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="hud-card">
          <div className="hud-card-title">RUN OUTPUT</div>
          {runSummary ? (
            <div className="route-lab-run-summary">
              <div className="route-lab-saved-top">
                <strong>{runSummary.name}</strong>
                <span>{formatDistance(runSummary.distanceKm)} km</span>
              </div>
              <div className="route-lab-saved-meta">
                <span>{runSummary.discipline}</span>
                <span>{formatElapsed(runSummary.elapsedSeconds)}</span>
                <span>{runSummary.pace}/km</span>
              </div>
              <div className="route-lab-preset-note">
                {runSummary.trainingLinked && linkedTrainingMode
                  ? "Mapped effort logged back into Training Ritual. Share it or move straight back into your plan."
                  : "Ready to share. Post this run into community and turn route effort into social proof."}
              </div>
              {runSummary.prs?.length ? (
                <div className="route-lab-pr-list">
                  {runSummary.prs.map((pr) => (
                    <div className="route-lab-pr-chip" key={`${pr.label}-${pr.value}`}>
                      <span>{pr.label}</span>
                      <strong>{pr.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="route-lab-action-row">
                <button className="studio-primary-btn" type="button" onClick={postRunToCommunity} disabled={postingRun}>
                  {postingRun ? "Posting..." : "Post run"}
                </button>
                {linkedTrainingMode ? (
                  <button
                    className="studio-back"
                    type="button"
                    onClick={() => navigate(backToTrainingUrl)}
                  >
                    Back to plan
                  </button>
                ) : null}
                {runSummary.id ? (
                  <button
                    className="studio-back"
                    type="button"
                    onClick={() => navigate(`/athlete/${userId}/routes/${runSummary.id}`)}
                  >
                    View run
                  </button>
                ) : null}
                <button className="studio-back" type="button" onClick={resetRun}>
                  Reset
                </button>
              </div>
            </div>
          ) : null}
          {(!linkedTrainingMode || runSummary) ? (
            <>
              <div className="hud-card-title">RECENT RUNS</div>
              <div className="route-lab-saved-list">
                {runsLoading ? (
                  <div className="route-lab-skeleton-list" aria-hidden="true">
                    {[...Array(linkedTrainingMode ? 2 : 3)].map((_, index) => (
                      <div className="route-lab-skeleton-card" key={`run-skeleton-${index}`}>
                        <div className="route-lab-skeleton-line short" />
                        <div className="route-lab-skeleton-line long" />
                        <div className="route-lab-skeleton-row" />
                      </div>
                    ))}
                  </div>
                ) : runHistory.length ? (
                  runHistory.slice(0, linkedTrainingMode ? 2 : 4).map((run) => (
                    <button
                      key={run.id || run.createdAt}
                      type="button"
                      className="route-lab-saved-card route-lab-run-card"
                      onClick={() => run.id && navigate(`/athlete/${userId}/routes/${run.id}`)}
                      disabled={!run.id}
                    >
                      <div className="route-lab-saved-top">
                        <strong>{run.name}</strong>
                        <span>{formatDistance(run.distanceKm)} km</span>
                      </div>
                      <div className="route-lab-saved-meta">
                        <span>{run.discipline}</span>
                        <span>{formatElapsed(run.elapsedSeconds)}</span>
                        <span>{run.pace}/km</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="route-lab-empty">No runs yet. Finish your first mapped effort and it will land here ready for profile and community.</div>
                )}
              </div>
            </>
          ) : null}
          {!linkedTrainingMode ? (
            <>
              <div className="hud-card-title">SAVED ROUTE PLANS</div>
              <div className="route-lab-saved-list">
                {savedPlans.length ? (
                  savedPlans.map((plan) => (
                    <div key={plan.id} className="route-lab-saved-card">
                      <div className="route-lab-saved-top">
                        <strong>{plan.name}</strong>
                        <span>{plan.distance}</span>
                      </div>
                      <div className="route-lab-saved-meta">
                        <span>{plan.discipline || "Running"}</span>
                        <span>{plan.visibility}</span>
                        <span>{plan.challengeMode}</span>
                      </div>
                      <div className="route-lab-saved-note">{plan.note}</div>
                    </div>
                  ))
                ) : (
                  <div className="route-lab-empty">
                    Save one route plan and you have a concrete running demo surface for investors and cofounders.
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="route-lab-mobile-dock">
        {!linkedTrainingMode ? (
          <button type="button" className={`route-lab-dock-option ${discipline === "Running" ? "active" : ""}`} onClick={() => setDiscipline("Running")}>
            Run
          </button>
        ) : (
          <button type="button" className="route-lab-dock-option" onClick={() => navigate(backToTrainingUrl)}>
            Ritual
          </button>
        )}
        <button
          type="button"
          className={`route-lab-dock-start ${runState === "tracking" ? "live" : ""}`}
          onClick={runState === "tracking" ? stopRun : beginRun}
        >
          {runState === "tracking" ? "Stop" : runState === "completed" ? "Restart" : "Start"}
        </button>
        <button
          type="button"
          className="route-lab-dock-option"
          onClick={linkedTrainingMode ? () => setShowAdvancedSetup((prev) => !prev) : savePlan}
        >
          {linkedTrainingMode ? "Setup" : "Add route"}
        </button>
      </div>
    </div>
  );
}
