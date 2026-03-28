import React from 'react';

function AthleteTrainingCountdownOverlay({ countdown }) {
  return (
    <div className="studio-countdown-overlay">
      <div className={`studio-countdown-ring countdown-${countdown}`}>
        <div className={`studio-countdown-number countdown-${countdown}`}>{countdown}</div>
        <div className="studio-countdown-sub">Lock in</div>
      </div>
    </div>
  );
}

export default AthleteTrainingCountdownOverlay;
