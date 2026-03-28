import React from 'react';

function AthleteTrainingLoggedPulseOverlay() {
  return (
    <div className="studio-log-pulse-overlay" role="status" aria-live="polite">
      <div className="studio-log-pulse-card">
        <div className="studio-log-pulse-check" aria-hidden="true">&#10003;</div>
        <div className="studio-log-pulse-title">Session logged</div>
        <div className="studio-log-pulse-sub">Opening your logs...</div>
      </div>
    </div>
  );
}

export default AthleteTrainingLoggedPulseOverlay;
