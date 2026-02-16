import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { queueLogsTrainingPrefill } from "../services/logsStorage";
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
            <div className="program-list-meta">{program.exercises.length} exercises · {program.duration}</div>
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
  const injectedProgram = location.state?.program;
  const program =
    findProgram(programId) ||
    (String(injectedProgram?.id || "") === String(programId || "") ? injectedProgram : null);
  const [editedExercises, setEditedExercises] = useState([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideExercise, setGuideExercise] = useState(null);
  const [guideDetails, setGuideDetails] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);


  const handleExerciseGuide = async (exercise) => {
    if (!exercise?.name) return;
    setGuideExercise(exercise);
    setGuideOpen(true);
    setGuideLoading(true);
    setGuideDetails(null);
    try {
      const response = await fetch(
        `https://wger.de/api/v2/exerciseinfo/?language=2&limit=1&name=${encodeURIComponent(exercise.name)}`
      );
      const data = await response.json();
      const result = data?.results?.[0];
      const description = result?.description
        ? result.description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        : '';
      const steps = description
        ? description.split('.').map((part) => part.trim()).filter(Boolean).slice(0, 4)
        : [];
      setGuideDetails({ description, steps });
    } catch (error) {
      console.error('Guide fetch failed:', error);
    } finally {
      setGuideLoading(false);
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
    setEditedExercises(
      program.exercises.map((exercise, index) => ({
        ...exercise,
        id: exercise.id || `${program.id}-${index}`,
        sets: Number(exercise.sets) || 1,
        reps: normalizeRepTarget(exercise.reps),
        weight: exercise.weight ?? ""
      }))
    );
  }, [program]);

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
        <div className="program-preview-meta">{program.exercises.length} exercises · {program.duration}</div>
        <div className="program-preview-head">
          <span />
          <span className="program-preview-head-label">Sets</span>
          <span className="program-preview-head-label">Rep Range</span>
          <span className="program-preview-head-label">Weight (kg)</span>
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
              <input
                type="number"
                min="1"
                max={MAX_SETS}
                className="program-preview-input"
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
              <input
                type="number"
                min="0"
                className="program-preview-input"
                value={exercise.weight ?? ""}
                onChange={(event) => {
                  const next = [...editedExercises];
                  const value = event.target.value === "" ? "" : Number(event.target.value);
                  next[index] = { ...next[index], weight: value };
                  setEditedExercises(next);
                }}
              />
            </div>
          ))}
        </div>
        <button
          className="hud-secondary-btn"
          onClick={() =>
            navigate("./session", {
              state: { program: { ...program, exercises: editedExercises } }
            })
          }
        >
          Start program
        </button>
      </div>

      {guideOpen && (
        <div className="studio-swap-backdrop">
          <div className="studio-swap-panel">
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
                  <div className="studio-guide-meta">
                    {guideExercise.sets} sets · {normalizeRepTarget(guideExercise.reps)} rep range
                  </div>
                  {guideLoading ? (
                    <div className="studio-empty">Loading guide...</div>
                  ) : (
                    <>
                      <div className="studio-guide-text">
                        {guideDetails?.description || 'No guide yet. Focus on control and form.'}
                      </div>
                      <div className="studio-guide-section">
                        <div className="studio-guide-label">Step by step</div>
                        <ol className="studio-guide-steps">
                          {(guideDetails?.steps?.length
                            ? guideDetails.steps
                            : ['Set your stance and brace core.', 'Move with control through full range.', 'Keep form tight and breathe steadily.']
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
function ProgramSession({ backPath, backLabel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams();
  const injectedProgram = location.state?.program;
  const program = injectedProgram || findProgram(programId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [countdownOpen, setCountdownOpen] = useState(true);
  const [countdown, setCountdown] = useState(3);

  const exercises = useMemo(
    () =>
      (program?.exercises || []).map((exercise) => ({
        ...exercise,
        reps: normalizeRepTarget(exercise.reps)
      })),
    [program]
  );
  const currentExercise = exercises[currentIndex];

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    setCountdownOpen(true);
    setCountdown(3);
    setTimerSeconds(0);
    setTimerRunning(false);
  }, [programId]);

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

  if (!program) {
    return null;
  }

// handleDone manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleDone = () => {
    if (currentIndex >= exercises.length - 1) {
      navigate(`../${programId}/finish`, { state: { ...location.state } });
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const handlePrevious = () => {
    if (currentIndex <= 0) return;
    setCurrentIndex((prev) => prev - 1);
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
        <button className="studio-back program-back-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
      </div>

      <div className="program-top">
        <div className="hud-card program-timer">
          <div className="hud-card-title">Lock-in Timer</div>
          <div className="program-timer-main">{formatTime(timerSeconds)}</div>
          <div className="program-timer-actions">
            <button className="hud-secondary-btn" onClick={() => setTimerRunning((prev) => !prev)}>
              {timerRunning ? "Pause" : "Resume"}
            </button>
            <button className="hud-secondary-btn" onClick={() => setTimerSeconds(0)}>Reset</button>
          </div>
        </div>
      </div>

      {currentExercise && (
        <div className="program-deck">
          <div className="hud-card program-card active">
            <div className="hud-card-title">Session Status</div>
            <div className="program-status-main">Exercise {currentIndex + 1} of {exercises.length}</div>
            <div className="program-status-sub">Stay smooth and control the tempo.</div>
            <div className="program-card-head">
              <button className="program-card-title" onClick={handleExerciseInfo} type="button">
                {currentExercise.name}
              </button>
              <span className="program-card-badge">Active</span>
            </div>
            <div className="program-card-meta">
              {currentExercise.sets} sets · {currentExercise.reps} rep range
              {Number(currentExercise.weight) > 0 ? ` · ${currentExercise.weight}kg` : ""} · {currentExercise.rest} rest
            </div>
            <div className="program-card-focus">{currentExercise.focus}</div>
            <div className="program-session-actions">
              <button
                className="hud-secondary-btn program-back-step"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                Previous exercise
              </button>
              <button className="hud-secondary-btn program-done" onClick={handleDone}>
                Complete exercise
              </button>
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
function ProgramFinish({ backPath, backLabel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams();
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
        navigate(`../${programId}/congrats`, { state: { ...location.state } });
      }
    }, 50);
    return () => clearInterval(id);
  }, [holding, navigate, programId, location.state]);

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
        <button className="studio-back program-back-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
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
  const injectedProgram = location.state?.program;
  const program = injectedProgram || findProgram(programId);
  const resolvedUserId = userId || localStorage.getItem("exervia_user_id") || "";
  const logsPath = mode === "athlete" ? `/athlete/${resolvedUserId}/logs` : `/gym/${resolvedUserId}/logs`;

  useEffect(() => {
    if (!resolvedUserId) return;
    const durationText = String(program?.duration || "");
    const minutesMatch = durationText.match(/\d+/);
    const minutes = minutesMatch ? Number(minutesMatch[0]) : "";
    const planName = program?.name || "Program";
    const reportExercises = (program?.exercises || []).map((exercise, index) => {
      const sets = Number(exercise?.sets) || 0;
      const reps = normalizeRepTarget(exercise?.reps);
      const weight = Number(exercise?.weight) || 0;
      const repCount = estimateRepCount(reps);
      const tonnage = sets > 0 && repCount > 0 && weight > 0 ? sets * repCount * weight : 0;
      return {
        id: exercise?.id || `${planName}-${index + 1}`,
        name: exercise?.name || `Exercise ${index + 1}`,
        sets,
        reps,
        weight: exercise?.weight ?? "",
        rest: exercise?.rest || "",
        tonnage,
      };
    });
    const totalSets = reportExercises.reduce((sum, item) => sum + (Number(item.sets) || 0), 0);
    const totalTonnage = reportExercises.reduce((sum, item) => sum + (Number(item.tonnage) || 0), 0);
    queueLogsTrainingPrefill(resolvedUserId, {
      source: "session_completion",
      type: mode === "athlete" ? "Training Program" : "Workout Program",
      title: planName,
      minutes,
      notes: `${planName} completed`,
      report: {
        category: "workout_program",
        duration: durationText || "",
        totalExercises: reportExercises.length,
        totalSets,
        totalTonnage,
        exercises: reportExercises,
      },
    });
    const redirectTimer = setTimeout(() => {
      navigate(logsPath, { state: location.state });
    }, 1800);
    return () => clearTimeout(redirectTimer);
  }, [location.state, logsPath, mode, navigate, program?.name, program?.duration, program?.exercises, resolvedUserId]);

  return (
    <div className="page-shell program-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Session Complete</h2>
          <p className="page-subtitle">{program?.name || "Program"} finished.</p>
        </div>
        <button className="studio-back program-back-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
      </div>

      <div className="hud-card program-complete">
        <div className="program-celebration" aria-hidden="true">
          {[...Array(10)].map((_, index) => (
            <span key={`program-spark-${index}`} className={`program-spark spark-${index + 1}`} />
          ))}
          <div className="program-celebration-badge">✓</div>
        </div>
        <div className="program-complete-main">Locked in. Great work.</div>
        <div className="program-complete-sub">{program?.name || "Program"} logged.</div>
        <div className="program-complete-sub">Session captured. Redirecting to Logs...</div>
        <button
          className="studio-back program-back-btn"
          onClick={() => navigate(logsPath, { state: location.state })}
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
  const backLabel = mode === "athlete" ? "Back to training" : "Back to strength";
  return (
    <Routes>
      <Route index element={<ProgramList backPath={backPath} backLabel={backLabel} />} />
      <Route path=":programId" element={<ProgramPreview backPath={backPath} backLabel={backLabel} />} />
      <Route path=":programId/session" element={<ProgramSession backPath={backPath} backLabel={backLabel} />} />
      <Route path=":programId/finish" element={<ProgramFinish backPath={backPath} backLabel={backLabel} />} />
      <Route path=":programId/congrats" element={<ProgramCongrats backPath={backPath} backLabel={backLabel} mode={mode} userId={id} />} />
    </Routes>
  );
}

