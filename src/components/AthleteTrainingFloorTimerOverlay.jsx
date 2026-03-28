import React from 'react';

function AthleteTrainingFloorTimerOverlay({
  floorUiHidden,
  setFloorUiHidden,
  setTimerRunning,
  setTimerOpen,
  timelinePlan,
  sessionFocus,
  session,
  formatTime,
  timerSeconds,
  safeTargetSeconds,
  timerProgress,
  timerChecklistWeek,
  startFinishHold,
  endFinishHold,
  finishHold,
  isHoldingFinish,
  timerRunning,
}) {
  return (
    <div
      className={`studio-floor-overlay ${floorUiHidden ? 'hidden-ui' : ''}`}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (floorUiHidden) {
          setFloorUiHidden(false);
          return;
        }
        setTimerRunning(false);
        setTimerOpen(false);
      }}
    >
      <div className="studio-floor-top">
        <div>
          <div className="studio-kicker">FLOOR MODE</div>
          <div className="studio-floor-title">
            {timelinePlan ? timelinePlan.name : 'Focused Session'}
          </div>
          <div className="studio-floor-sub">
            {sessionFocus} {'\u00B7'} {session.sport.toUpperCase()}
          </div>
        </div>
        <button
          className="studio-swap-close"
          onClick={() => {
            setTimerRunning(false);
            setTimerOpen(false);
          }}
          type="button"
        >
          Close
        </button>
      </div>
      <div className="studio-floor-center">
        <div className="studio-floor-clock">{formatTime(timerSeconds)}</div>
        <div className="studio-floor-target">Target {formatTime(safeTargetSeconds)}</div>
        <div className="studio-floor-bar">
          <div
            className="studio-floor-progress"
            style={{ width: `${timerProgress * 100}%` }}
          />
        </div>
        {timerChecklistWeek?.sessions?.length ? (
          <div className="studio-floor-plan-checklist">
            <div className="studio-floor-plan-checklist-title">Session Objectives</div>
            <div className="studio-floor-plan-checklist-week">
              {timerChecklistWeek?.week || 'Week 1'}
            </div>
            <ul className="studio-floor-plan-checklist-list">
              {(timerChecklistWeek?.sessions || []).map((sessionItem, index) => (
                <li key={`timer-check-${index}`}>{sessionItem}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="studio-floor-actions">
        <button
          className="studio-queue-btn ghost"
          onClick={() => setTimerRunning(!timerRunning)}
          type="button"
        >
          {timerRunning ? 'Pause session' : 'Resume session'}
        </button>
        <button
          className="studio-primary-btn studio-hold-btn"
          onMouseDown={startFinishHold}
          onMouseUp={endFinishHold}
          onMouseLeave={endFinishHold}
          onTouchStart={startFinishHold}
          onTouchEnd={endFinishHold}
          onTouchCancel={endFinishHold}
          type="button"
        >
          <span className="studio-hold-fill" style={{ width: `${finishHold * 100}%` }} />
          {isHoldingFinish ? 'Holding...' : 'Hold to finish'}
        </button>
      </div>
    </div>
  );
}

export default AthleteTrainingFloorTimerOverlay;
