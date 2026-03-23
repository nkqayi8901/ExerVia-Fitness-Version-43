import { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { queueLogsTrainingPrefill } from "../services/logsStorage";
import { supabase } from "../supabaseClient";
import { grantXpEventSafe } from "../services/xpEvents";
import { emitToast } from "../utils/toast";
import exerciseGuideDefaults from "../data/exerciseGuides.json";
// Component: WorkoutProgram - UI layout and interactions.
// This component renders the workoutprogram experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

const programs = [
  {
    id: "strength-foundation",
    name: "Strength Foundation",
    focus: "Compound strength + control",
    duration: "45 min",
    exercises: [
      { id: "deadlift", name: "Deadlift", sets: 3, reps: "6-8", rest: "90s", focus: "Brace, drive through the floor." },
      { id: "row", name: "Bent-Over Row", sets: 3, reps: "8-10", rest: "75s", focus: "Hinge, pull to lower ribs." },
      { id: "lunge", name: "Reverse Lunge", sets: 2, reps: "10-12", rest: "60s", focus: "Knee tracks, controlled tempo." }
    ]
  },
  {
    id: "engine-builder",
    name: "Engine Builder",
    focus: "Work capacity + tempo",
    duration: "35 min",
    exercises: [
      { id: "squat", name: "Front Squat", sets: 3, reps: "5-7", rest: "90s", focus: "Elbows high, smooth descent." },
      { id: "press", name: "Push Press", sets: 3, reps: "6-8", rest: "75s", focus: "Drive, lockout, reset." },
      { id: "carry", name: "Farmer Carry", sets: 2, reps: "40-60m", rest: "60s", focus: "Tall posture, steady steps." }
    ]
  }
];

const REP_RANGE_OPTIONS = ["1-3", "4-6", "7-9", "10-12", "13-15", "Failure"];
const MAX_SETS = 10;
const WEIGHT_PICKER_OPTIONS = Array.from({ length: 121 }, (_, index) => {
  const value = Number((index * 2.5).toFixed(1));
  return Number.isInteger(value) ? String(value) : String(value);
});
const EMPTY_OBJECT = Object.freeze({});
const PROGRAM_HISTORY_LIMIT = 40;
const DEFAULT_GUIDE_STEPS = [
  "Set your stance and brace core.",
  "Move with control through full range.",
  "Keep form tight and breathe steadily."
];
const isCardioExercise = (exercise) => String(exercise?.type || "").toLowerCase() === "cardio";
const formatExercisePrescription = (exercise) => {
  if (!exercise) return "";
  if (isCardioExercise(exercise)) return String(exercise.reps || "12 min");
  const sets = Math.max(Number(exercise.sets) || 1, 1);
  const reps = normalizeRepTarget(exercise.reps);
  const weight = Number(exercise.weight || 0);
  return `${sets} sets · ${reps} rep range${weight > 0 ? ` · ${weight}kg` : ""}`;
};
const formatExerciseRestLabel = (exercise) => {
  const rest = String(exercise?.rest || "0s");
  return isCardioExercise(exercise) ? `Recovery ${rest}` : `Rest ${rest}`;
};
const renderCardioBadge = (exercise) =>
  isCardioExercise(exercise) ? <span className="exervia-cardio-badge">Cardio</span> : null;

const getExerciseGuideDefaults = (name) => {
  const key = String(name || "").trim();
  return key ? exerciseGuideDefaults[key] || [] : [];
};

const getProgramHistoryStorageKey = (userId) =>
  userId ? `exervia_program_history_${String(userId).trim()}` : "";

const getActiveProgramSessionStorageKey = (userId, mode, programId) =>
  userId && programId ? `exervia_active_program_session_${String(mode || "gym").trim()}_${String(userId).trim()}_${String(programId).trim()}` : "";

const readProgramHistory = (userId) => {
  const key = getProgramHistoryStorageKey(userId);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const pushProgramHistoryEntry = (userId, programKey, entry) => {
  const key = getProgramHistoryStorageKey(userId);
  if (!key || !programKey) return;
  const current = readProgramHistory(userId);
  const existing = Array.isArray(current[programKey]) ? current[programKey] : [];
  const next = [entry, ...existing].slice(0, PROGRAM_HISTORY_LIMIT);
  const updated = {
    ...current,
    [programKey]: next,
  };
  localStorage.setItem(key, JSON.stringify(updated));
};

const readActiveProgramSession = (userId, mode, programId) => {
  const key = getActiveProgramSessionStorageKey(userId, mode, programId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const writeActiveProgramSession = (userId, mode, programId, payload) => {
  const key = getActiveProgramSessionStorageKey(userId, mode, programId);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(payload));
};

const clearActiveProgramSession = (userId, mode, programId) => {
  const key = getActiveProgramSessionStorageKey(userId, mode, programId);
  if (!key) return;
  localStorage.removeItem(key);
};

const buildInitialProgramPerformance = (list) =>
  (list || []).reduce((acc, exercise) => {
    const id = String(exercise?.id || "");
    if (!id) return acc;
    acc[id] = {
      targetSets: Math.max(Number(exercise?.sets) || 1, 1),
      completedSets: 0,
      completedAt: [],
    };
    return acc;
  }, {});

const hydratePersistedProgramSession = (snapshot) => {
  if (!snapshot || typeof snapshot !== "object") return null;
  const now = Date.now();
  const savedAt = Number(snapshot.savedAt || now);
  const elapsedSeconds = Math.max(0, Math.floor((now - savedAt) / 1000));
  let countdownOpen = Boolean(snapshot.countdownOpen);
  let countdown = Math.max(Number(snapshot.countdown || 0), 0);
  let timerRunning = Boolean(snapshot.timerRunning);
  let timerSeconds = Math.max(Number(snapshot.timerSeconds || 0), 0);
  let restOpen = Boolean(snapshot.restOpen);
  let restSeconds = Math.max(Number(snapshot.restSeconds || 0), 0);

  if (countdownOpen) {
    if (elapsedSeconds >= countdown) {
      const remainingElapsed = Math.max(elapsedSeconds - countdown, 0);
      countdownOpen = false;
      countdown = 0;
      timerRunning = true;
      timerSeconds += remainingElapsed;
    } else {
      countdown -= elapsedSeconds;
    }
  } else if (timerRunning) {
    timerSeconds += elapsedSeconds;
  }

  if (restOpen) {
    restSeconds = Math.max(restSeconds - elapsedSeconds, 0);
    if (restSeconds <= 0) {
      restOpen = false;
      restSeconds = 0;
    }
  }

  return {
    ...snapshot,
    countdownOpen,
    countdown,
    timerRunning,
    timerSeconds,
    restOpen,
    restSeconds,
  };
};

const estimateRepCount = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return 0;
  if (raw === "failure") return 0;
  const rangeMatch = raw.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const low = Number(rangeMatch[1] || 0);
    const high = Number(rangeMatch[2] || 0);
    if (low > 0 && high > 0) return Math.round((low + high) / 2);
  }
  const single = Number.parseInt(raw, 10);
  return Number.isNaN(single) ? 0 : single;
};

const normalizeRepTarget = (value) => {
  if (value === null || value === undefined) return "10-12";
  const raw = String(value).trim();
  if (!raw) return "10-12";
  if (/failure/i.test(raw)) return "Failure";
  if (REP_RANGE_OPTIONS.includes(raw)) return raw;
  if (/[a-zA-Z]/.test(raw)) return raw;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isNaN(parsed)) {
    if (parsed <= 3) return "1-3";
    if (parsed <= 6) return "4-6";
    if (parsed <= 9) return "7-9";
    if (parsed <= 12) return "10-12";
    return "13-15";
  }

  const firstSegment = raw.split("-")[0];
  const firstValue = Number.parseInt(firstSegment, 10);
  if (!Number.isNaN(firstValue)) {
    if (firstValue <= 3) return "1-3";
    if (firstValue <= 6) return "4-6";
    if (firstValue <= 9) return "7-9";
    if (firstValue <= 12) return "10-12";
    return "13-15";
  }
  return "10-12";
};

// formatTime manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
const formatTime = (value) => {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const parseRestSeconds = (restValue) => {
  const raw = String(restValue || "").trim().toLowerCase();
  if (!raw) return 0;
  if (raw.includes(":")) {
    const [mins, secs] = raw.split(":").map((part) => Number(part || 0));
    if (Number.isFinite(mins) && Number.isFinite(secs)) return Math.max((mins * 60) + secs, 0);
  }
  const minuteMatch = raw.match(/(\d+)\s*m/);
  const secondMatch = raw.match(/(\d+)\s*s/);
  if (minuteMatch || secondMatch) {
    const mins = Number(minuteMatch?.[1] || 0);
    const secs = Number(secondMatch?.[1] || 0);
    return Math.max((mins * 60) + secs, 0);
  }
  const numeric = Number(raw.replace(/[^\d]/g, ""));
  if (Number.isFinite(numeric)) return Math.max(numeric, 0);
  return 0;
};

const formatCompletionDateTime = (value) => {
  if (!value) return "Unknown time";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown time";
  }
};

const formatMinuteDelta = (value) => {
  const rounded = Math.round(Number(value || 0));
  if (!Number.isFinite(rounded) || rounded === 0) return "No time change vs previous";
  if (rounded < 0) return `${Math.abs(rounded)} min faster vs previous`;
  return `${rounded} min slower vs previous`;
};

// findProgram manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
const findProgram = (programId) => programs.find((program) => program.id === programId);

// ProgramList manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function ProgramList({ backPath, backLabel }) {
  const navigate = useNavigate();


  // Render
  return (
    <div className="page-shell program-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Workout Programs</h2>
          <p className="page-subtitle">Pick a plan and lock in.</p>
        </div>
        <button className="studio-back program-back-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
      </div>

      <div className="program-list">
        {programs.map((program) => (
          <button
            key={program.id}
            className="hud-card program-list-card"
            onClick={() => navigate(`./${program.id}`)}
          >
            <div className="program-list-title">{program.name}</div>
            <div className="program-list-sub">{program.focus}</div>
            <div className="program-list-meta">{program.exercises.length} exercises</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ProgramPreview manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function ProgramPreview({ backPath, backLabel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams();
  const resolvedUserId = String(localStorage.getItem("exervia_user_id") || "").trim();
  const exerciseWeightsStorageKey = resolvedUserId ? `exervia_exercise_weights_${resolvedUserId}` : "";
  const injectedProgram = location.state?.program;
  const program =
    findProgram(programId) ||
    (String(injectedProgram?.id || "") === String(programId || "") ? injectedProgram : null);
  const [editedExercises, setEditedExercises] = useState([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideExercise, setGuideExercise] = useState(null);
  const [guideDetails, setGuideDetails] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [completionHistory, setCompletionHistory] = useState([]);
  const guideCacheRef = useRef({});
  const guideRequestRef = useRef(0);

  const withTimeout = async (promise, timeoutMs, label = "Request timed out") => {
    let timeoutHandle = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };


  const handleExerciseGuide = async (exercise) => {
    if (!exercise?.name) return;
    const cacheKey = String(exercise.name || "").trim().toLowerCase();
    const fallbackSteps = getExerciseGuideDefaults(exercise.name);
    const fallbackGuide = {
      description: "",
      steps: fallbackSteps.length ? fallbackSteps : DEFAULT_GUIDE_STEPS,
    };
    setGuideExercise(exercise);
    setGuideOpen(true);
    setGuideLoading(true);
    setGuideDetails(fallbackGuide);
    setGuideError("");
    if (guideCacheRef.current[cacheKey]) {
      setGuideDetails(guideCacheRef.current[cacheKey]);
      setGuideLoading(false);
      return;
    }
    const requestId = guideRequestRef.current + 1;
    guideRequestRef.current = requestId;
    try {
      const response = await withTimeout(
        fetch(
          `https://wger.de/api/v2/exerciseinfo/?language=2&limit=1&name=${encodeURIComponent(exercise.name)}`
        ),
        6000,
        "Guide request timed out"
      );
      if (guideRequestRef.current !== requestId) return;
      if (!response.ok) {
        throw new Error(`Guide request failed with status ${response.status}`);
      }
      const data = await withTimeout(response.json(), 2000, "Guide decode timed out");
      const result = data?.results?.[0];
      const description = result?.description
        ? result.description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        : '';
      const apiSteps = description
        ? description.split('.').map((part) => part.trim()).filter(Boolean).slice(0, 4)
        : [];
      const nextGuide = {
        description,
        steps: apiSteps.length ? apiSteps : fallbackGuide.steps,
      };
      guideCacheRef.current[cacheKey] = nextGuide;
      setGuideDetails(nextGuide);
    } catch (error) {
      console.error('Guide fetch failed:', error);
      guideCacheRef.current[cacheKey] = fallbackGuide;
      setGuideDetails(fallbackGuide);
      setGuideError("");
    } finally {
      if (guideRequestRef.current === requestId) {
        setGuideLoading(false);
      }
    }
  };

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (!program) {
      setEditedExercises([]);
      return;
    }
    let weightMemory = {};
    if (exerciseWeightsStorageKey) {
      try {
        const raw = localStorage.getItem(exerciseWeightsStorageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === "object") weightMemory = parsed;
      } catch {
        weightMemory = {};
      }
    }
    const getRememberedWeight = (exerciseName) => {
      const key = String(exerciseName || "").trim().toLowerCase();
      const remembered = Number(weightMemory[key] || 0);
      return remembered > 0 ? remembered : "";
    };
    setEditedExercises(
      program.exercises.map((exercise, index) => ({
        ...exercise,
        id: exercise.id || `${program.id}-${index}`,
        sets: isCardioExercise(exercise) ? 1 : (Number(exercise.sets) || 1),
        reps: normalizeRepTarget(exercise.reps),
        weight:
          isCardioExercise(exercise)
            ? ""
            : Number(exercise.weight || 0) > 0
            ? Number(exercise.weight)
            : getRememberedWeight(exercise.name),
      }))
    );
  }, [program, exerciseWeightsStorageKey]);

  useEffect(() => {
    const programKey = String(program?.id || "").trim();
    if (!resolvedUserId || !programKey) {
      setCompletionHistory([]);
      return;
    }
    const allHistory = readProgramHistory(resolvedUserId);
    const historyRows = Array.isArray(allHistory[programKey]) ? allHistory[programKey] : [];
    setCompletionHistory(historyRows);
  }, [program?.id, resolvedUserId]);

  const recentCompletionRows = useMemo(
    () =>
      completionHistory
        .filter((row) => row && row.completedAt)
        .slice(0, 3),
    [completionHistory]
  );

  const lastCompletion = recentCompletionRows[0] || null;
  const previousCompletion = recentCompletionRows[1] || null;

  const completionDeltaLabel = useMemo(() => {
    const lastMinutes = Number(lastCompletion?.minutes || 0);
    const previousMinutes = Number(previousCompletion?.minutes || 0);
    if (!(lastMinutes > 0) || !(previousMinutes > 0)) return "Need two timed completions for comparison";
    return formatMinuteDelta(lastMinutes - previousMinutes);
  }, [lastCompletion, previousCompletion]);

  const bestMinutes = useMemo(() => {
    const timed = completionHistory
      .map((row) => Number(row?.minutes || 0))
      .filter((value) => value > 0);
    if (!timed.length) return 0;
    return Math.min(...timed);
  }, [completionHistory]);

  const weeklyCompletionCount = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return completionHistory.filter((row) => {
      const createdAtMs = new Date(row?.completedAt || 0).getTime();
      return Number.isFinite(createdAtMs) && now - createdAtMs <= weekMs;
    }).length;
  }, [completionHistory]);

  const isLatestBest = useMemo(() => {
    const latest = Number(lastCompletion?.minutes || 0);
    return latest > 0 && bestMinutes > 0 && latest === bestMinutes;
  }, [lastCompletion, bestMinutes]);

  useEffect(() => {
    if (!guideOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setGuideOpen(false);
        setGuideDetails(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [guideOpen]);

  if (!program) {
    return (
      <div className="page-shell program-shell">
        <div className="page-header">
          <div>
            <h2 className="page-title">Program not found</h2>
          </div>
          <button className="studio-back program-back-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell program-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">{program.name}</h2>
          <p className="page-subtitle">{program.focus}</p>
        </div>
        <button className="studio-back program-back-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
      </div>

      <div className="hud-card program-preview">
        <div className="hud-card-title">Program Overview</div>
        <div className="program-preview-meta">{program.exercises.length} exercises</div>
        {false ? (
          <div className="logs-inline-card" style={{ marginBottom: 10, display: "none" }}>
            <div className="logs-list-title">Latest Attempt</div>
            <div className="logs-list-sub">
              {new Date(completionHistory[0]?.completedAt || Date.now()).toLocaleString()}
              {Number(completionHistory[0]?.minutes || 0) > 0 ? ` · ${completionHistory[0].minutes} min` : ""}
            </div>
          </div>
        ) : (
          <div className="logs-inline-card" style={{ marginBottom: 10, display: "none" }}>
            <div className="logs-list-title">Latest Attempt</div>
            <div className="logs-list-sub">No previous completion found for this program yet.</div>
          </div>
        )}
        {completionHistory.length ? (
          <div className="logs-inline-card" style={{ marginBottom: 10 }}>
            <div className="logs-list-title">Performance Snapshot </div>
            <div className="program-strava-metrics">
              <div className="program-strava-metric">
                <span className="program-strava-label">Latest</span>
                <strong>{Number(lastCompletion?.minutes || 0) > 0 ? `${lastCompletion.minutes} min` : "Untimed"}</strong>
              </div>
              <div className="program-strava-metric">
                <span className="program-strava-label">Best</span>
                <strong>{bestMinutes > 0 ? `${bestMinutes} min` : "Untimed"}</strong>
              </div>
              <div className="program-strava-metric">
                <span className="program-strava-label">Last 7 Days</span>
                <strong>{weeklyCompletionCount} sessions</strong>
              </div>
            </div>
            {isLatestBest ? (
              <div className="logs-list-sub" style={{ marginTop: 4 }}>PR: fastest completion so far</div>
            ) : null}
            <div className="logs-list-sub">
              Latest: {formatCompletionDateTime(lastCompletion?.completedAt)}
              {Number(lastCompletion?.minutes || 0) > 0 ? ` · ${lastCompletion.minutes} min` : ""}
            </div>
            <div className="logs-list-sub">{completionDeltaLabel}</div>
            {bestMinutes > 0 ? (
              <div className="logs-list-sub" style={{ marginTop: 4 }}>Best time: {bestMinutes} min</div>
            ) : null}
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {recentCompletionRows.map((row, index) => (
                <div key={`recent-completion-${index}`} className="logs-list-sub">
                  {index + 1}. {formatCompletionDateTime(row.completedAt)}
                  {Number(row?.minutes || 0) > 0 ? ` · ${row.minutes} min` : ""}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="logs-inline-card" style={{ marginBottom: 10 }}>
            <div className="logs-list-title">Performance Snapshot </div>
            <div className="logs-list-sub">No previous completion found for this program yet.</div>
          </div>
        )}
        <div className="program-preview-head">
          <span />
          <span className="program-preview-head-label">Sets</span>
          <span className="program-preview-head-label">Prescription</span>
          <span className="program-preview-head-label">Load</span>
        </div>
        <div className="program-preview-list">
          {editedExercises.map((exercise, index) => (
            <div key={exercise.id} className="program-preview-row">
              <button
                className="program-exercise-link"
                onClick={() => handleExerciseGuide(exercise)}
                type="button"
              >
                {exercise.name}
              </button>
              {renderCardioBadge(exercise)}
              <input
                type="number"
                min="1"
                max={MAX_SETS}
                className="program-preview-input"
                disabled={isCardioExercise(exercise)}
                value={exercise.sets}
                onChange={(event) => {
                  const rawValue = Number(event.target.value);
                  const normalizedSets = Number.isNaN(rawValue)
                    ? 1
                    : Math.min(MAX_SETS, Math.max(1, rawValue));
                  const next = [...editedExercises];
                  next[index] = { ...next[index], sets: normalizedSets };
                  setEditedExercises(next);
                }}
              />
              {isCardioExercise(exercise) ? (
                <>
                  <input
                    className="program-preview-input"
                    value={exercise.reps}
                    onChange={(event) => {
                      const next = [...editedExercises];
                      next[index] = { ...next[index], reps: event.target.value };
                      setEditedExercises(next);
                    }}
                  />
                  <input className="program-preview-input" value="Timed" disabled readOnly />
                </>
              ) : (
                <>
                  <select
                    className="program-preview-input"
                    value={exercise.reps}
                    onChange={(event) => {
                      const next = [...editedExercises];
                      next[index] = { ...next[index], reps: event.target.value };
                      setEditedExercises(next);
                    }}
                  >
                    {REP_RANGE_OPTIONS.map((rangeOption) => (
                      <option key={rangeOption} value={rangeOption}>
                        {rangeOption}
                      </option>
                    ))}
                    {!REP_RANGE_OPTIONS.includes(exercise.reps) && (
                      <option value={exercise.reps}>{exercise.reps}</option>
                    )}
                  </select>
                  <select
                    className="program-preview-input"
                    value={exercise.weight === "" || exercise.weight === null || exercise.weight === undefined ? "" : String(exercise.weight)}
                    onChange={(event) => {
                      const next = [...editedExercises];
                      const value = event.target.value === "" ? "" : Number(event.target.value);
                      next[index] = { ...next[index], weight: value };
                      setEditedExercises(next);
                    }}
                  >
                    <option value="">-</option>
                    {WEIGHT_PICKER_OPTIONS.map((weightOption) => (
                      <option key={`weight-${exercise.id}-${weightOption}`} value={weightOption}>
                        {weightOption}
                      </option>
                    ))}
                    {exercise.weight !== "" &&
                      exercise.weight !== null &&
                      exercise.weight !== undefined &&
                      !WEIGHT_PICKER_OPTIONS.includes(String(exercise.weight)) && (
                        <option value={String(exercise.weight)}>{String(exercise.weight)}</option>
                      )}
                  </select>
                </>
              )}
            </div>
          ))}
        </div>
        <button
          className="studio-back program-action-btn"
          onClick={() => {
            if (exerciseWeightsStorageKey) {
              try {
                const raw = localStorage.getItem(exerciseWeightsStorageKey);
                const existing = raw ? JSON.parse(raw) : {};
                const next = { ...(existing && typeof existing === "object" ? existing : {}) };
                editedExercises.forEach((exercise) => {
                  const key = String(exercise?.name || "").trim().toLowerCase();
                  const weight = isCardioExercise(exercise) ? 0 : Number(exercise?.weight || 0);
                  if (!key || weight <= 0) return;
                  next[key] = weight;
                });
                localStorage.setItem(exerciseWeightsStorageKey, JSON.stringify(next));
              } catch {
                // best effort only
              }
            }
            navigate("./session", {
              state: { program: { ...program, exercises: editedExercises } }
            });
          }}
        >
          Start program
        </button>
      </div>

      {guideOpen && (
        <div
          className="studio-swap-backdrop"
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            setGuideOpen(false);
            setGuideDetails(null);
          }}
        >
          <div className="studio-swap-panel" onClick={(event) => event.stopPropagation()}>
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Exercise Guide</div>
                <div className="studio-swap-sub">Quick overview before you start.</div>
              </div>
              <button
                className="studio-swap-close"
                onClick={() => {
                  setGuideOpen(false);
                  setGuideDetails(null);
                }}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="studio-swap-body">
              {guideExercise ? (
                <div className="studio-guide-content">
                  <div className="studio-guide-title">{guideExercise.name}</div>
                  <div className="studio-guide-meta">{formatExercisePrescription(guideExercise)}</div>
                  {guideLoading ? (
                    <div className="studio-empty">Loading guide...</div>
                  ) : (
                    <>
                      {guideError ? (
                        <div className="exervia-banner info">
                          {guideError}
                          <div className="exervia-banner-actions">
                            <button
                              type="button"
                              className="studio-back exervia-banner-btn"
                              onClick={() => handleExerciseGuide(guideExercise)}
                            >
                              Retry
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="studio-guide-text">
                        {guideDetails?.description || 'Standard movement reminders are ready. Focus on control and form.'}
                      </div>
                      <div className="studio-guide-section">
                        <div className="studio-guide-label">Step by step</div>
                        <ol className="studio-guide-steps">
                          {(guideDetails?.steps?.length
                            ? guideDetails.steps
                            : DEFAULT_GUIDE_STEPS
                          ).map((item, idx) => (
                            <li key={`preview-step-${idx}`}>{item}</li>
                          ))}
                        </ol>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="studio-empty">No exercise selected.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ProgramSession manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function ProgramSession({ backPath, backLabel, mode, userId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams();
  const persistedSession = useMemo(
    () => hydratePersistedProgramSession(readActiveProgramSession(userId, mode, programId)),
    [mode, programId, userId]
  );
  const injectedProgram = location.state?.program;
  const program = injectedProgram || persistedSession?.program || findProgram(programId);

  const exercises = useMemo(
    () =>
      (program?.exercises || []).map((exercise) => ({
        ...exercise,
        reps: normalizeRepTarget(exercise.reps)
      })),
    [program]
  );
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(Number(persistedSession?.currentIndex || 0), 0));
  const [timerSeconds, setTimerSeconds] = useState(() => Math.max(Number(persistedSession?.timerSeconds || 0), 0));
  const [timerRunning, setTimerRunning] = useState(() => Boolean(persistedSession?.timerRunning));
  const [countdownOpen, setCountdownOpen] = useState(() => (persistedSession ? Boolean(persistedSession.countdownOpen) : true));
  const [countdown, setCountdown] = useState(() => (persistedSession ? Math.max(Number(persistedSession.countdown || 0), 0) : 3));
  const [restOpen, setRestOpen] = useState(() => Boolean(persistedSession?.restOpen));
  const [restSeconds, setRestSeconds] = useState(() => Math.max(Number(persistedSession?.restSeconds || 0), 0));
  const [restContext, setRestContext] = useState(() => String(persistedSession?.restContext || "set"));
  const [currentSet, setCurrentSet] = useState(() => Math.max(Number(persistedSession?.currentSet || 1), 1));
  const [sessionPerformance, setSessionPerformance] = useState(() => (
    persistedSession?.sessionPerformance && typeof persistedSession.sessionPerformance === "object"
      ? persistedSession.sessionPerformance
      : buildInitialProgramPerformance(exercises)
  ));
  const restoredNoticeShownRef = useRef(false);
  const initializedRef = useRef(false);
  const previousProgramIdRef = useRef(programId);
  const currentExercise = exercises[currentIndex];
  const targetSets = Math.max(Number(currentExercise?.sets) || 1, 1);
  const setProgressPercent = Math.min((currentSet / targetSets) * 100, 100);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (!program) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      previousProgramIdRef.current = programId;
      return;
    }
    if (previousProgramIdRef.current === programId) return;
    previousProgramIdRef.current = programId;
    setCountdownOpen(true);
    setCountdown(3);
    setTimerSeconds(0);
    setTimerRunning(false);
    setRestOpen(false);
    setRestSeconds(0);
    setRestContext("set");
    setCurrentSet(1);
    setSessionPerformance(buildInitialProgramPerformance(exercises));
  }, [program, programId, exercises]);

  useEffect(() => {
    if (!persistedSession || restoredNoticeShownRef.current) return;
    restoredNoticeShownRef.current = true;
    emitToast("Restored your active workout session.", "info", 2800);
  }, [persistedSession]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (!countdownOpen) return;
    if (countdown <= 0) {
      setCountdownOpen(false);
      setTimerRunning(true);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdownOpen, countdown]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (!restOpen) return undefined;
    if (restSeconds <= 0) return undefined;
    const id = setInterval(() => {
      setRestSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(id);
  }, [restOpen, restSeconds]);

  useEffect(() => {
    if (!program) return;
    writeActiveProgramSession(userId, mode, programId, {
      program,
      currentIndex,
      timerSeconds,
      timerRunning,
      countdownOpen,
      countdown,
      restOpen,
      restSeconds,
      restContext,
      currentSet,
      sessionPerformance,
      savedAt: Date.now(),
    });
  }, [
    countdown,
    countdownOpen,
    currentIndex,
    currentSet,
    mode,
    program,
    programId,
    restContext,
    restOpen,
    restSeconds,
    sessionPerformance,
    timerRunning,
    timerSeconds,
    userId,
  ]);

  if (!program) {
    return null;
  }

  const handleExitSession = () => {
    clearActiveProgramSession(userId, mode, programId);
    navigate(backPath);
  };

// handleDone manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleDone = () => {
    if (!currentExercise) return;
    const exerciseId = String(currentExercise.id || "");
    const nowIso = new Date().toISOString();
    const existingEntry = sessionPerformance[exerciseId] || {
      targetSets,
      completedSets: 0,
      completedAt: [],
    };
    const nextEntry = {
      ...existingEntry,
      targetSets,
      completedSets: Math.min(Number(existingEntry.completedSets || 0) + 1, targetSets),
      completedAt: [...(existingEntry.completedAt || []), nowIso],
    };
    const nextPerformance = {
      ...sessionPerformance,
      [exerciseId]: nextEntry,
    };
    setSessionPerformance(nextPerformance);

    const isLastSet = currentSet >= targetSets;

    if (!isLastSet) {
      setCurrentSet((prev) => Math.min(prev + 1, targetSets));
      return;
    }

    if (currentIndex >= exercises.length - 1) {
      navigate(`../${programId}/finish`, {
        state: {
          ...(location.state || {}),
          program,
          sessionPerformance: nextPerformance,
          sessionDurationSeconds: timerSeconds,
        },
      });
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setCurrentSet(1);
  };

  const handleCompleteExercise = () => {
    if (!currentExercise) return;
    const exerciseId = String(currentExercise.id || "");
    const nowIso = new Date().toISOString();
    const existingEntry = sessionPerformance[exerciseId] || {
      targetSets,
      completedSets: 0,
      completedAt: [],
    };
    const nextEntry = {
      ...existingEntry,
      targetSets,
      completedSets: targetSets,
      completedAt:
        (existingEntry.completedAt || []).length > 0
          ? existingEntry.completedAt
          : [nowIso],
    };
    const nextPerformance = {
      ...sessionPerformance,
      [exerciseId]: nextEntry,
    };
    setSessionPerformance(nextPerformance);

    if (currentIndex >= exercises.length - 1) {
      navigate(`../${programId}/finish`, {
        state: {
          ...(location.state || {}),
          program,
          sessionPerformance: nextPerformance,
          sessionDurationSeconds: timerSeconds,
        },
      });
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setCurrentSet(1);
  };

  const handlePrevious = () => {
    if (restOpen) {
      setRestOpen(false);
      setRestSeconds(0);
      setRestContext("set");
      return;
    }
    if (currentSet > 1) {
      setCurrentSet((prev) => Math.max(prev - 1, 1));
      return;
    }
    if (currentIndex <= 0) return;
    const previousIndex = currentIndex - 1;
    const previousSets = Math.max(Number(exercises[previousIndex]?.sets) || 1, 1);
    setCurrentIndex(previousIndex);
    setCurrentSet(previousSets);
  };

  const handleAddRest = () => {
    setRestSeconds((prev) => Math.min(prev + 15, 900));
  };

  const handleStartRest = () => {
    const restTargetSeconds = parseRestSeconds(currentExercise?.rest);
    const nextSeconds = restTargetSeconds > 0 ? restTargetSeconds : 60;
    setRestContext("set");
    setRestSeconds(nextSeconds);
    setRestOpen(true);
  };

  const handleRestAdvance = () => {
    if (!restOpen) return;
    setRestOpen(false);
    setRestSeconds(0);
    setRestContext("set");
  };

// handleExerciseInfo manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleExerciseInfo = () => {
    if (!currentExercise) return;
    window.dispatchEvent(
      new CustomEvent("companion_knowledge", {
        detail: {
          type: "exercise",
          id: currentExercise.id,
          name: currentExercise.name,
          focus: currentExercise.focus,
          reps: currentExercise.reps,
          sets: currentExercise.sets
        }
      })
    );
  };

  return (
    <div className="page-shell program-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">{program.name}</h2>
          <p className="page-subtitle">Lock in. One rep at a time.</p>
        </div>
        <button className="studio-back program-back-btn" onClick={handleExitSession}>{backLabel}</button>
      </div>

      <div className="program-top">
        <div className="hud-card program-timer">
          <div className="hud-card-title">Lock-in Timer</div>
          <div className="program-timer-main">{formatTime(timerSeconds)}</div>
            <div className="program-timer-actions">
            <button className="studio-back program-action-btn" onClick={() => setTimerRunning((prev) => !prev)}>
              {timerRunning ? "Pause" : "Resume"}
            </button>
            <button className="studio-back program-action-btn" onClick={() => setTimerSeconds(0)}>Reset</button>
          </div>
        </div>
        {restOpen && (
          <div className="hud-card program-timer">
            <div className="hud-card-title">Rest Timer</div>
            <div className="program-timer-main">{formatTime(restSeconds)}</div>
            <div className="program-status-sub">Manual mode. Continue when ready.</div>
            <div className="program-timer-actions">
              <button className="studio-back program-action-btn" onClick={handleAddRest} type="button">
                +15s
              </button>
              <button className="studio-back program-action-btn" onClick={handleRestAdvance} type="button">
                {restSeconds > 0 ? "Advance now" : "Continue"}
              </button>
            </div>
          </div>
        )}
      </div>

      {currentExercise && (
        <div className="program-deck">
          <div className="hud-card program-card active">
            <div className="hud-card-title">Session Status</div>
            <div className="program-status-main">Exercise {currentIndex + 1} of {exercises.length}</div>
            <div className="program-status-sub">
              {restOpen
                ? `${restContext === "set" ? "Reset between sets." : "Recover before the next exercise."} Continue when ready.`
                : "Stay smooth and control the tempo."}
            </div>
            <div className="program-set-row">
              <div className="program-set-label">
                {isCardioExercise(currentExercise)
                  ? `Timed block ${currentIndex + 1} of ${exercises.length}`
                  : `Set ${Math.min(currentSet, targetSets)} of ${targetSets}`}
              </div>
              <span className={`program-card-badge ${restOpen ? "" : "muted"}`}>
                {restOpen ? `Rest ${formatTime(restSeconds)}` : formatExerciseRestLabel(currentExercise)}
              </span>
            </div>
            <div className="program-status-sub">
              {isCardioExercise(currentExercise)
                ? `${sessionPerformance[currentExercise.id]?.completedSets ? "Timed block complete." : "One timed block to finish."}`
                : `Completed ${sessionPerformance[currentExercise.id]?.completedSets || 0} / ${targetSets} sets`}
            </div>
            <div className="program-set-track" aria-hidden="true">
              <div className="program-set-fill" style={{ width: `${setProgressPercent}%` }} />
            </div>
            <div className="program-set-dots" aria-label={`Set progress ${currentSet} of ${targetSets}`}>
              {Array.from({ length: targetSets }).map((_, idx) => {
                const setNumber = idx + 1;
                const isDone =
                  setNumber < currentSet;
                const isActive = !restOpen && setNumber === currentSet;
                return (
                  <span
                    key={`set-dot-${currentExercise.id}-${setNumber}`}
                    className={`program-set-dot ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}
                  />
                );
              })}
            </div>
            <div className="program-card-head">
              <button className="program-card-title" onClick={handleExerciseInfo} type="button">
                {currentExercise.name}
              </button>
              {renderCardioBadge(currentExercise)}
              <span className="program-card-badge">Active</span>
            </div>
            <div className="program-card-meta">{formatExercisePrescription(currentExercise)} · {formatExerciseRestLabel(currentExercise)}</div>
            <div className="program-card-focus">{currentExercise.focus}</div>
            <div className="program-session-actions">
              <button
                className="studio-back program-action-btn program-back-step"
                onClick={handlePrevious}
                disabled={currentIndex === 0 && currentSet === 1 && !restOpen}
              >
                Previous exercise
              </button>
              {!restOpen ? (
                <>
                  <button className="studio-back program-action-btn" onClick={handleStartRest} type="button">
                    Rest
                  </button>
                  <button className="studio-back program-action-btn program-done" onClick={handleDone}>
                    {isCardioExercise(currentExercise) ? "Complete block" : "Complete set"}
                  </button>
                  <button className="studio-back program-action-btn program-done" onClick={handleCompleteExercise}>
                    {currentIndex >= exercises.length - 1 ? "Finish session" : "Complete exercise"}
                  </button>
                </>
              ) : (
                <button className="studio-back program-action-btn program-done" type="button" onClick={handleRestAdvance}>
                  {restSeconds > 0 ? "Advance now" : "Continue"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {countdownOpen && (
        <div className="studio-countdown-overlay">
          <div className={`studio-countdown-ring countdown-${countdown}`}>
            <div className={`studio-countdown-number countdown-${countdown}`}>{countdown}</div>
            <div className="studio-countdown-sub">Lock in</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ProgramFinish manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function ProgramFinish({ backPath, backLabel, mode, userId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams();
  const persistedSession = useMemo(
    () => readActiveProgramSession(userId, mode, programId),
    [mode, programId, userId]
  );
  const effectiveState = useMemo(
    () => ({
      ...(location.state || {}),
      ...(persistedSession?.program ? { program: persistedSession.program } : {}),
      ...(persistedSession?.sessionPerformance ? { sessionPerformance: persistedSession.sessionPerformance } : {}),
      ...(Number.isFinite(Number(persistedSession?.timerSeconds))
        ? { sessionDurationSeconds: Number(persistedSession.timerSeconds || 0) }
        : {}),
    }),
    [location.state, persistedSession]
  );
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (!holding) return;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(100, Math.round((elapsed / 2000) * 100));
      setProgress(next);
      if (next >= 100) {
        clearInterval(id);
        setHolding(false);
        navigate(`../${programId}/congrats`, { state: effectiveState });
      }
    }, 50);
    return () => clearInterval(id);
  }, [effectiveState, holding, navigate, programId]);

// stopHold manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const stopHold = () => {
    setHolding(false);
    setProgress(0);
  };

  return (
    <div className="page-shell program-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Finish Session</h2>
          <p className="page-subtitle">Hold to complete the session.</p>
        </div>
        <button
          className="studio-back program-back-btn"
          onClick={() => {
            clearActiveProgramSession(userId, mode, programId);
            navigate(backPath);
          }}
        >
          {backLabel}
        </button>
      </div>

      <div className="hud-card program-finish">
        <div className="program-finish-instruction">Hold to finish</div>
        <button
          className={holding ? "program-hold active" : "program-hold"}
          onMouseDown={() => setHolding(true)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => setHolding(true)}
          onTouchEnd={stopHold}
          type="button"
        >
          {holding ? `Holding ${progress}%` : "Hold"}
        </button>
        <div className="program-hold-bar">
          <div className="program-hold-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

// ProgramCongrats manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function ProgramCongrats({ backPath, backLabel, mode, userId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams();
  const persistedRef = useRef(false);
  const [sessionLoggedPulseOpen, setSessionLoggedPulseOpen] = useState(true);
  const [sessionAwardedXp, setSessionAwardedXp] = useState(0);
  const [syncWarning, setSyncWarning] = useState("");
  const persistedSession = useMemo(
    () => readActiveProgramSession(userId, mode, programId),
    [mode, programId, userId]
  );
  const effectiveState = useMemo(
    () => ({
      ...(location.state || {}),
      ...(persistedSession?.program ? { program: persistedSession.program } : {}),
      ...(persistedSession?.sessionPerformance ? { sessionPerformance: persistedSession.sessionPerformance } : {}),
      ...(Number.isFinite(Number(persistedSession?.timerSeconds))
        ? { sessionDurationSeconds: Number(persistedSession.timerSeconds || 0) }
        : {}),
    }),
    [location.state, persistedSession]
  );
  const injectedProgram = effectiveState?.program;
  const program = injectedProgram || findProgram(programId);
  const sessionPerformance = useMemo(
    () => effectiveState?.sessionPerformance || EMPTY_OBJECT,
    [effectiveState]
  );
  const sessionDurationSeconds = Number(effectiveState?.sessionDurationSeconds || 0);
  const resolvedUserId = userId || localStorage.getItem("exervia_user_id") || "";
  const logsPath = mode === "athlete" ? `/athlete/${resolvedUserId}/logs` : `/gym/${resolvedUserId}/logs`;
  const templateDurationText = String(program?.duration || "");
  const templateMinutesMatch = templateDurationText.match(/\d+/);
  const templateMinutes = templateMinutesMatch ? Number(templateMinutesMatch[0]) : "";
  const recapMinutes = sessionDurationSeconds > 0 ? Math.max(1, Math.round(sessionDurationSeconds / 60)) : templateMinutes;
  const recapDurationText = recapMinutes ? `${recapMinutes} min` : templateDurationText;
  const recapExercises = useMemo(
    () =>
      (program?.exercises || []).map((exercise, index) => {
        const entry = sessionPerformance[String(exercise?.id || "")] || null;
        const isCardio = isCardioExercise(exercise);
        const targetSets = Number(exercise?.sets) || 0;
        const sets = Number(entry?.completedSets ?? targetSets) || 0;
        const reps = normalizeRepTarget(exercise?.reps);
        const weight = isCardio ? 0 : Number(exercise?.weight) || 0;
        const repCount = estimateRepCount(reps);
        const tonnage = !isCardio && sets > 0 && repCount > 0 && weight > 0 ? sets * repCount * weight : 0;
        return {
          id: exercise?.id || `${program?.name || "Program"}-${index + 1}`,
          sets,
          tonnage,
        };
      }),
    [program?.exercises, program?.name, sessionPerformance]
  );
  const recapTotalSets = useMemo(
    () => recapExercises.reduce((sum, item) => sum + (Number(item.sets) || 0), 0),
    [recapExercises]
  );

  const withTimeout = async (promise, timeoutMs, label = "Request timed out") => {
    let timeoutHandle = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  useEffect(() => {
    if (!resolvedUserId || persistedRef.current) return;
    persistedRef.current = true;
    clearActiveProgramSession(userId, mode, programId);
    const minutes = sessionDurationSeconds > 0 ? Math.max(1, Math.round(sessionDurationSeconds / 60)) : templateMinutes;
    const durationText = minutes ? `${minutes} min` : templateDurationText;
    const planName = program?.name || "Program";
    const reportExercises = (program?.exercises || []).map((exercise, index) => {
      const entry = sessionPerformance[String(exercise?.id || "")] || null;
      const isCardio = isCardioExercise(exercise);
      const targetSets = Number(exercise?.sets) || 0;
      const sets = Number(entry?.completedSets ?? targetSets) || 0;
      const reps = normalizeRepTarget(exercise?.reps);
      const weight = isCardio ? 0 : Number(exercise?.weight) || 0;
      const repCount = estimateRepCount(reps);
      const tonnage = !isCardio && sets > 0 && repCount > 0 && weight > 0 ? sets * repCount * weight : 0;
      return {
        id: exercise?.id || `${planName}-${index + 1}`,
        name: exercise?.name || `Exercise ${index + 1}`,
        type: exercise?.type || "",
        sets,
        targetSets,
        reps,
        weight: exercise?.weight ?? "",
        distance: exercise?.distance ?? "",
        incline: exercise?.incline ?? "",
        calories: exercise?.calories ?? "",
        rest: exercise?.rest || "",
        tonnage,
      };
    });
    const totalSets = reportExercises.reduce((sum, item) => sum + (Number(item.sets) || 0), 0);
    const totalTonnage = reportExercises.reduce((sum, item) => sum + (Number(item.tonnage) || 0), 0);
    const persistCompletion = async () => {
      let awardedXp = 0;
      let hadSyncIssue = false;
      const validStrengthRows = reportExercises
        .filter((exercise) => exercise?.name && !isCardioExercise(exercise) && Number(exercise.sets || 0) > 0)
        .map((exercise) => ({
          user_id: Number(resolvedUserId),
          exercise_name: String(exercise.name),
          exercise_type: Number(exercise.weight || 0) > 0 ? "weights" : "bodyweight",
          weight: Number(exercise.weight || 0),
          reps: Math.max(estimateRepCount(exercise.reps), 1),
          sets: Number(exercise.sets || 1),
          notes: `${planName} completion`,
          mood_emoji: "🔥",
        }));

      if (validStrengthRows.length > 0) {
        let insertedRows = [];
        let insertError = null;
        try {
          const response = await withTimeout(
            supabase
              .from("strength_logs")
              .insert(validStrengthRows)
              .select("id,exercise_name,weight,reps,sets"),
            6500,
            "Strength save timed out"
          );
          insertedRows = response?.data || [];
          insertError = response?.error || null;
        } catch (error) {
          insertError = error;
        }

        if (insertError) {
          console.error("Could not persist program lifts to strength_logs:", insertError);
          hadSyncIssue = true;
          setSyncWarning("Session saved locally. Strength sync will retry shortly.");
        } else {
          const baseXp = Math.min(90, Math.max(20, Number(totalSets || 0) * 3));
          if (insertedRows?.[0]?.id && baseXp > 0) {
            const strengthXp = await withTimeout(
              grantXpEventSafe({
                userId: Number(resolvedUserId),
                eventType: "strength_log",
                baseXp,
              idempotencyKey: `strength_session:${insertedRows[0].id}`,
              sourceTable: "strength_logs",
              sourceId: String(insertedRows[0].id),
              meta: {
                session_type: mode === "athlete" ? "training_program" : "workout_program",
                program_name: planName,
                total_sets: totalSets,
                total_tonnage: totalTonnage,
              },
              }),
              4500,
              "XP grant timed out"
            );
            awardedXp += Number(strengthXp.awardedXp || 0);
          }

          for (const row of insertedRows || []) {
            const idempotencyKey = `pr:${row.id}:user:${Number(resolvedUserId)}`;
            const { data: prAwarded, error: prError } = await withTimeout(supabase.rpc("verify_pr_and_award_xp", {
              p_log_id: String(row.id),
              p_user_id: Number(resolvedUserId),
              p_exercise_name: String(row.exercise_name || ""),
              p_weight: Number(row.weight || 0),
              p_reps: Number(row.reps || 0),
              p_sets: Number(row.sets || 0),
              p_idempotency_key: idempotencyKey,
            }), 4500, "PR award timed out");
            if (prError) {
              console.error("verify_pr_and_award_xp failed:", prError);
            } else {
              awardedXp += Number(prAwarded || 0);
            }
          }
        }
      }
      setSessionAwardedXp(awardedXp);
      if (awardedXp > 0) {
        emitToast(`Session logged. +${awardedXp} XP earned.`, "success", 3200);
      } else {
        emitToast("Session logged.", "info", 2800);
      }
      if (hadSyncIssue) {
        emitToast("Session saved locally. Strength sync will retry shortly.", "warn", 3600);
      }
      window.dispatchEvent(new Event("user_state_updated"));

      queueLogsTrainingPrefill(resolvedUserId, {
        source: "session_completion",
        type: mode === "athlete" ? "Training Program" : "Workout Program",
        title: planName,
        minutes,
        notes: `${planName} completed`,
        report: {
          category: "workout_program",
          programId: String(program?.id || programId || ""),
          programName: planName,
          completedAt: new Date().toISOString(),
          duration: durationText || "",
          durationSeconds: sessionDurationSeconds || null,
          totalExercises: reportExercises.length,
          totalSets,
          totalTonnage,
          exercises: reportExercises,
        },
      });

      const historyProgramKey = String(program?.id || programId || "").trim();
      if (historyProgramKey) {
        pushProgramHistoryEntry(resolvedUserId, historyProgramKey, {
          completedAt: new Date().toISOString(),
          minutes: Number(minutes || 0),
          duration: String(durationText || ""),
          totalExercises: Number(reportExercises.length || 0),
          totalSets: Number(totalSets || 0),
        });
      }

      const nudgeUserId = localStorage.getItem("exervia_user_id") || resolvedUserId || "guest";
      localStorage.setItem(
        `exervia_recovery_nudge_${nudgeUserId}`,
        JSON.stringify({
          type: "program_completion",
          label: String(planName || "Program"),
          minutes: Number(minutes || 0),
          at: Date.now(),
        })
      );

    };

    withTimeout(persistCompletion(), 9000, "Session sync timed out")
      .catch((error) => {
        console.error("ProgramCongrats persist timed out:", error);
        setSyncWarning("Session saved locally. Sync is still processing.");
      })
      .finally(() => {
        setTimeout(() => {
          setSessionLoggedPulseOpen(false);
        }, 1100);
      });
    return undefined;
  }, [
    effectiveState,
    logsPath,
    mode,
    navigate,
    program?.id,
    program?.name,
    program?.duration,
    program?.exercises,
    programId,
    resolvedUserId,
    sessionDurationSeconds,
    sessionPerformance,
    templateDurationText,
    templateMinutes,
    userId,
  ]);

  return (
    <div className="page-shell program-shell">
      {sessionLoggedPulseOpen && (
        <div className="studio-log-pulse-overlay" role="status" aria-live="polite">
          <div className="studio-log-pulse-card">
            <div className="studio-log-pulse-check" aria-hidden="true">&#10003;</div>
            <div className="studio-log-pulse-title">Session logged</div>
            <div className="studio-log-pulse-sub">
              {sessionAwardedXp > 0 ? `+${sessionAwardedXp} XP earned · Opening your logs...` : "Opening your logs..."}
            </div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h2 className="page-title">Session Complete</h2>
          <p className="page-subtitle">{program?.name || "Program"} finished.</p>
        </div>
        <button className="studio-back program-back-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
      </div>

      <div className="hud-card program-complete">
        {syncWarning ? <div className="exervia-banner warn">{syncWarning}</div> : null}
        <div className="program-celebration" aria-hidden="true">
          {[...Array(10)].map((_, index) => (
            <span key={`program-spark-${index}`} className={`program-spark spark-${index + 1}`} />
          ))}
          <div className="program-celebration-badge">✓</div>
        </div>
        <div className="program-complete-main">Locked in. Great work.</div>
        <div className="program-complete-sub">{program?.name || "Program"} logged.</div>
        <div className="program-complete-sub">Session captured. Review it now or move back into your training system.</div>
        <div className="program-complete-metrics">
          <div className="program-complete-metric">
            <span>XP earned</span>
            <strong>{sessionAwardedXp > 0 ? `+${sessionAwardedXp}` : "Logged"}</strong>
          </div>
          <div className="program-complete-metric">
            <span>Exercises</span>
            <strong>{recapExercises.length}</strong>
          </div>
          <div className="program-complete-metric">
            <span>Sets</span>
            <strong>{recapTotalSets}</strong>
          </div>
          <div className="program-complete-metric">
            <span>Duration</span>
            <strong>{recapDurationText || "Tracked"}</strong>
          </div>
        </div>
        <div className="program-complete-next">
          <div className="program-complete-next-title">Next best move</div>
          <div className="program-complete-next-sub">
            Open Logs to review the session report and keep your progression trail clean.
          </div>
        </div>
        <button
          className="studio-primary-btn"
          onClick={() => navigate(logsPath, { state: effectiveState })}
        >
          Open logs
        </button>
        <button className="studio-back program-back-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
      </div>
    </div>
  );
}

export default function WorkoutProgram({ mode }) {
  const { id } = useParams();
  const backPath =
    mode === "gym" ? `/gym/${id}/progress` : mode === "athlete" ? `/athlete/${id}/training` : "/";
  const backLabel = mode === "athlete" ? "Back to Training" : "Back to Strength";
  return (
    <Routes>
      <Route index element={<ProgramList backPath={backPath} backLabel={backLabel} />} />
      <Route path=":programId" element={<ProgramPreview backPath={backPath} backLabel={backLabel} />} />
      <Route path=":programId/session" element={<ProgramSession backPath={backPath} backLabel={backLabel} mode={mode} userId={id} />} />
      <Route path=":programId/finish" element={<ProgramFinish backPath={backPath} backLabel={backLabel} mode={mode} userId={id} />} />
      <Route path=":programId/congrats" element={<ProgramCongrats backPath={backPath} backLabel={backLabel} mode={mode} userId={id} />} />
    </Routes>
  );
}
