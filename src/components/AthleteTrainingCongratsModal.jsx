import React from 'react';

function AthleteTrainingCongratsModal({
  setCongratsOpen,
  completedSessionLabel,
  sessionRecap,
  sessionReflection,
  setSessionReflection,
  saveReflection,
  reflectionSaving,
  navigate,
  userId,
}) {
  return (
    <div
      className="studio-congrats-overlay"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        setCongratsOpen(false);
      }}
    >
      <div className="studio-congrats-panel">
        <div className="program-celebration" aria-hidden="true">
          {[...Array(10)].map((_, index) => (
            <span key={`program-spark-${index}`} className={`program-spark spark-${index + 1}`} />
          ))}
          <div className="program-celebration-badge">{'\u2713'}</div>
        </div>
        <div className="studio-congrats-title">Well done.</div>
        <div className="studio-congrats-sub">
          Session closed. Momentum logged.
        </div>
        <div className="studio-congrats-sub">
          {completedSessionLabel || 'Session'} logged.
        </div>
        <div className="studio-congrats-metrics">
          <div className="studio-congrats-metric">
            <span>XP earned</span>
            <strong>{sessionRecap.xp > 0 ? `+${sessionRecap.xp}` : 'Logged'}</strong>
          </div>
          <div className="studio-congrats-metric">
            <span>Duration</span>
            <strong>{sessionRecap.duration > 0 ? `${sessionRecap.duration} min` : 'Tracked'}</strong>
          </div>
          <div className="studio-congrats-metric">
            <span>Focus</span>
            <strong>{sessionRecap.focus || 'Base'}</strong>
          </div>
        </div>
        <div className="studio-congrats-next">
          <div className="studio-congrats-next-title">
            {sessionRecap.streak > 1 ? `Streak protected: ${sessionRecap.streak} days` : 'System on track'}
          </div>
          <div className="studio-congrats-next-sub">
            Next best move: review the session in Logs or capture one reflection before you close the day.
          </div>
        </div>
        {sessionRecap.prs?.length ? (
          <div className="studio-congrats-prs">
            <div className="studio-congrats-prs-title">Performance signal</div>
            <div className="studio-congrats-pr-list">
              {sessionRecap.prs.map((pr) => (
                <div className="studio-congrats-pr-chip" key={`${pr.label}-${pr.value}`}>
                  <span>{pr.label}</span>
                  <strong>{pr.value}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <label className="studio-congrats-reflection">
          <span className="studio-input-label">Reflection</span>
          <textarea
            value={sessionReflection}
            onChange={(event) => setSessionReflection(event.target.value)}
            placeholder="What did you learn or feel?"
          />
        </label>
        <div className="studio-congrats-actions">
          <button
            className="studio-queue-btn ghost"
            onClick={() => setCongratsOpen(false)}
            type="button"
          >
            Close
          </button>
          <button
            className="studio-primary-btn"
            onClick={saveReflection}
            disabled={reflectionSaving}
            type="button"
          >
            {reflectionSaving ? 'Saving...' : 'Save reflection'}
          </button>
          <button
            className="studio-queue-btn ghost"
            onClick={() => {
              setCongratsOpen(false);
              navigate(`/athlete/${userId}/logs`);
            }}
            type="button"
          >
            Open logs
          </button>
        </div>
      </div>
    </div>
  );
}

export default AthleteTrainingCongratsModal;
