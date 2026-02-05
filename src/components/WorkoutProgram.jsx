import { useEffect, useMemo, useState } from "react";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";

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

const formatTime = (value) => {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const findProgram = (programId) => programs.find((program) => program.id === programId);

function ProgramList({ backPath, backLabel }) {
  const navigate = useNavigate();

  return (
    <div className="page-shell program-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Workout Programs</h2>
          <p className="page-subtitle">Pick a plan and lock in.</p>
        </div>
        <button className="hud-secondary-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
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
            <div className="program-list-meta">{program.exercises.length} exercises ? {program.duration}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgramPreview({ backPath, backLabel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams();
  const injectedProgram = location.state?.program;
  const program = findProgram(programId) || (injectedProgram?.id === programId ? injectedProgram : null);
  const [editedExercises, setEditedExercises] = useState([]);

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
        reps: exercise.reps ?? "10",
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
          <button className="hud-secondary-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
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
        <button className="hud-secondary-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
      </div>

      <div className="hud-card program-preview">
        <div className="hud-card-title">Program Overview</div>
        <div className="program-preview-meta">{program.exercises.length} exercises ? {program.duration}</div>
        <div className="program-preview-head">
          <span />
          <span className="program-preview-head-label">Sets</span>
          <span className="program-preview-head-label">Reps</span>
          <span className="program-preview-head-label">Weight (kg)</span>
        </div>
        <div className="program-preview-list">
          {editedExercises.map((exercise, index) => (
            <div key={exercise.id} className="program-preview-row">
              <span>{exercise.name}</span>
              <span className="program-preview-edit">
                <input
                  type="number"
                  min="1"
                  className="program-preview-input"
                  value={exercise.sets}
                  onChange={(event) => {
                    const next = [...editedExercises];
                    next[index] = { ...next[index], sets: Number(event.target.value) || 1 };
                    setEditedExercises(next);
                  }}
                />
                <input
                  type="text"
                  className="program-preview-input"
                  value={exercise.reps}
                  onChange={(event) => {
                    const next = [...editedExercises];
                    next[index] = { ...next[index], reps: event.target.value };
                    setEditedExercises(next);
                  }}
                />
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
              </span>
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
    </div>
  );
}

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

  const exercises = useMemo(() => program?.exercises || [], [program]);
  const currentExercise = exercises[currentIndex];
  const nextExercise = exercises[currentIndex + 1];

  useEffect(() => {
    setCountdownOpen(true);
    setCountdown(3);
    setTimerSeconds(0);
    setTimerRunning(false);
  }, [programId]);

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

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  if (!program) {
    return null;
  }

  const handleDone = () => {
    if (currentIndex >= exercises.length - 1) {
      navigate(`../${programId}/finish`);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

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
        <button className="hud-secondary-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
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

        <div className="hud-card program-status">
          <div className="hud-card-title">Session Status</div>
          <div className="program-status-main">Exercise {currentIndex + 1} of {exercises.length}</div>
          <div className="program-status-sub">Stay smooth and control the tempo.</div>
        </div>
      </div>

      {currentExercise && (
        <div className="program-deck">
          <div className="hud-card program-card active">
            <div className="program-card-head">
              <button className="program-card-title" onClick={handleExerciseInfo} type="button">
                {currentExercise.name}
              </button>
              <span className="program-card-badge">Active</span>
            </div>
            <div className="program-card-meta">
              {currentExercise.sets} sets · {currentExercise.reps} reps
              {Number(currentExercise.weight) > 0 ? ` · ${currentExercise.weight}kg` : ""} · {currentExercise.rest} rest
            </div>
            <div className="program-card-focus">{currentExercise.focus}</div>
            <button className="hud-secondary-btn program-done" onClick={handleDone}>
              Done - keep {currentExercise.reps} reps
            </button>
          </div>

          {nextExercise && (
            <div className="hud-card program-card peek">
              <div className="program-card-head">
                <div className="program-card-title">{nextExercise.name}</div>
                <span className="program-card-badge muted">Next</span>
              </div>
              <div className="program-card-meta">
                {nextExercise.sets} sets · {nextExercise.reps} reps
                {Number(nextExercise.weight) > 0 ? ` · ${nextExercise.weight}kg` : ""} · {nextExercise.rest} rest
              </div>
            </div>
          )}
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

function ProgramFinish({ backPath, backLabel }) {
  const navigate = useNavigate();
  const { programId } = useParams();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

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
        navigate(`../${programId}/congrats`);
      }
    }, 50);
    return () => clearInterval(id);
  }, [holding, navigate, programId]);

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
        <button className="hud-secondary-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
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

function ProgramCongrats({ backPath, backLabel }) {
  const navigate = useNavigate();
  const { programId } = useParams();
  const program = findProgram(programId);

  return (
    <div className="page-shell program-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Session Complete</h2>
          <p className="page-subtitle">{program?.name || "Program"} finished.</p>
        </div>
        <button className="hud-secondary-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
      </div>

      <div className="hud-card program-complete">
        <div className="program-complete-main">Locked in. Great work.</div>
        <div className="program-complete-sub">Log the session and recover well.</div>
        <button className="hud-secondary-btn" onClick={() => navigate(backPath)}>{backLabel}</button>
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
      <Route path=":programId/congrats" element={<ProgramCongrats backPath={backPath} backLabel={backLabel} />} />
    </Routes>
  );
}
