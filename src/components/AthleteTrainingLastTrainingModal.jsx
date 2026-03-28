import React from 'react';
import EmptyState from './EmptyState';
import { formatDistance } from '../utils/athleteMetrics';

function AthleteTrainingLastTrainingModal({
  setLastTrainingOpen,
  lastTraining,
  lastTrainingTitle,
  recentTrainingSessions,
  getRecentPlanName,
  getRecentPlanWeek,
  getRecentObjectives,
  distanceUnit,
  navigate,
  userId,
}) {
  return (
    <div className="studio-swap-backdrop" onClick={(event) => event.target === event.currentTarget && setLastTrainingOpen(false)}>
      <div className="studio-swap-panel" onClick={(event) => event.stopPropagation()}>
        <div className="studio-swap-header">
          <div>
            <div className="studio-panel-title">Last training</div>
            <div className="studio-swap-sub">
              {lastTraining
                ? `${lastTrainingTitle} - ${lastTraining.duration_minutes || 0} min`
                : 'No training logged yet'}
            </div>
          </div>
          <button className="studio-swap-close" onClick={() => setLastTrainingOpen(false)} type="button">
            Close
          </button>
        </div>
        <div className="studio-swap-body">
          {recentTrainingSessions.length ? (
            <div className="studio-plan-timeline">
              {recentTrainingSessions.slice(0, 3).map((row) => (
                <div key={`recent-ath-${row.id}`} className="studio-plan-week">
                  <div className="studio-plan-week-title">
                    {getRecentPlanName(row)} - {row.duration_minutes || 0} min
                  </div>
                  <ul className="studio-plan-week-list">
                    <li>{new Date(row.created_at).toLocaleString()}</li>
                    {getRecentPlanWeek(row) ? <li>{getRecentPlanWeek(row)}</li> : null}
                    {getRecentObjectives(row).map((objective, objectiveIndex) => (
                      <li key={`recent-objective-${row.id}-${objectiveIndex}`}>{objective}</li>
                    ))}
                    {!getRecentObjectives(row).length && row?.metrics?.distance ? (
                      <li>
                        Distance: {formatDistance(row.metrics.distance, { unit: distanceUnit, includeUnit: true })}
                      </li>
                    ) : null}
                    {!getRecentObjectives(row).length && row?.metrics?.focus ? <li>Focus: {row.metrics.focus}</li> : null}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No training history yet"
              description="Log a session to build your recent training timeline."
            />
          )}
          <button className="studio-primary-btn" type="button" onClick={() => navigate(`/athlete/${userId}/logs`)}>
            Open full logs
          </button>
        </div>
      </div>
    </div>
  );
}

export default AthleteTrainingLastTrainingModal;
