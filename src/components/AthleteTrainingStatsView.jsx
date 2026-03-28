import React from 'react';

function AthleteTrainingStatsView({
  totalSessionsLogged,
  uniqueSportsTracked,
  bestDurationMinutes,
  avgDurationMinutes,
  activeWorldSport,
  ritualWorldMeta,
  activeWorldSessionCount,
  activeWorldMinutes,
  activeWorldDistanceKm,
  routePrStats,
  selectedTrainingTrendDayKey,
  setSelectedTrainingTrendDay,
  weeklyVolumeChart,
  paceTrendPoints,
  paceTrendRange,
  paceTrendPolyline,
  topSportsTrend,
  maxSportCount,
  selectedDaySessions,
  getRecentPlanName,
  maxTrainingMinutesByDay,
  lastTraining,
  lastTrainingTitle,
}) {
  return (
    <div className="studio-stats">
      <section className="studio-panel studio-reveal">
        <div className="studio-panel-title">Stats Snapshot</div>
        <div className="studio-pr-grid">
          <div className="studio-pr-card">
            <div className="studio-pr-title">Sessions Logged</div>
            <div className="studio-pr-value">{totalSessionsLogged}</div>
            <div className="studio-pr-sub">Recent training sessions</div>
          </div>
          <div className="studio-pr-card">
            <div className="studio-pr-title">Sports Tracked</div>
            <div className="studio-pr-value">{uniqueSportsTracked}</div>
            <div className="studio-pr-sub">Unique sports in log</div>
          </div>
          <div className="studio-pr-card">
            <div className="studio-pr-title">Best Time</div>
            <div className="studio-pr-value">{bestDurationMinutes > 0 ? `${bestDurationMinutes} min` : 'Untimed'}</div>
            <div className="studio-pr-sub">Best timed completion</div>
          </div>
          <div className="studio-pr-card">
            <div className="studio-pr-title">Avg Duration</div>
            <div className="studio-pr-value">{avgDurationMinutes > 0 ? `${avgDurationMinutes} min` : 'Untimed'}</div>
            <div className="studio-pr-sub">Average timed session</div>
          </div>
          {activeWorldSport ? (
            <div className="studio-pr-card studio-pr-card-world">
              <div className="studio-pr-title">This Block in {ritualWorldMeta.title}</div>
              <div className="studio-pr-value">{activeWorldSessionCount} sessions</div>
              <div className="studio-pr-sub">
                {activeWorldMinutes} min logged - {activeWorldDistanceKm > 0 ? `${activeWorldDistanceKm.toFixed(1)} km mapped` : 'No mapped distance yet'}
              </div>
            </div>
          ) : null}
          {routePrStats.bestPace || routePrStats.longestDistance > 0 ? (
            <div className="studio-pr-card studio-pr-card-world">
              <div className="studio-pr-title">Route Signals</div>
              <div className="studio-pr-value">{routePrStats.bestPace || 'No pace yet'}</div>
              <div className="studio-pr-sub">
                {routePrStats.longestDistance > 0
                  ? `Longest effort ${routePrStats.longestDistance.toFixed(1)} km - ${routePrStats.longestDiscipline}`
                  : 'Complete a mapped effort to unlock route PRs.'}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="studio-panel studio-reveal">
        <div className="studio-panel-title">Progress Trends</div>
        <div className="studio-progress-grid">
          <div className="studio-progress-card">
            <div className="studio-progress-title">7-Day Training Minutes</div>
            <div className="studio-chart-shell">
              <div className="studio-volume-chart" role="img" aria-label="7 day training minutes chart">
                {weeklyVolumeChart.map((item) => (
                  <button
                    type="button"
                    className={`studio-volume-bar${selectedTrainingTrendDayKey === item.key ? ' active' : ''}`}
                    key={`ath-trend-${item.key}`}
                    onClick={() => setSelectedTrainingTrendDay(item.key)}
                    title={`${item.label}: ${Math.round(item.minutes)} training minutes`}
                    aria-label={`${item.label}: ${Math.round(item.minutes)} training minutes`}
                  >
                    <span
                      className="studio-volume-bar-fill"
                      style={{ height: `${Math.max(10, item.ratio * 100)}%` }}
                    />
                    <span className="studio-volume-bar-minutes">{Math.round(item.minutes)}m</span>
                    <span className="studio-volume-bar-label">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="studio-chart-caption">Tap a day to focus the breakdown below.</div>
            </div>
          </div>

          <div className="studio-progress-card">
            <div className="studio-progress-title">Route Pace Trend</div>
            {paceTrendPoints.length >= 2 ? (
              <div className="studio-chart-shell">
                <div className="studio-line-chart" role="img" aria-label="Route pace trend chart">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="0" y1="88" x2="100" y2="88" className="studio-line-chart-axis" />
                    <polyline points={paceTrendPolyline} className="studio-line-chart-path" />
                    {paceTrendPoints.map((item, index) => {
                      const spread = Math.max(1, paceTrendRange.max - paceTrendRange.min);
                      const stepX = paceTrendPoints.length > 1 ? 100 / (paceTrendPoints.length - 1) : 100;
                      const normalized = (item.paceSeconds - paceTrendRange.min) / spread;
                      const x = index * stepX;
                      const y = 100 - normalized * 74 - 12;
                      return (
                        <circle
                          key={`pace-point-${item.id}`}
                          cx={x}
                          cy={y}
                          r="2.5"
                          className="studio-line-chart-point"
                        />
                      );
                    })}
                  </svg>
                </div>
                <div className="studio-line-chart-legend">
                  {paceTrendPoints.map((item) => (
                    <div
                      className="studio-line-chart-chip"
                      key={`pace-chip-${item.id}`}
                      title={`${item.label}: ${item.paceLabel}`}
                    >
                      <span>{item.label}</span>
                      <strong>{item.paceLabel}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : topSportsTrend.length ? (
              <div className="studio-progress-list">
                {topSportsTrend.map((item) => (
                  <div className="studio-progress-row" key={`ath-sport-${item.sport}`}>
                    <div className="studio-progress-label">{item.sport}</div>
                    <div className="studio-progress-bar-shell">
                      <div
                        className="studio-progress-bar alt"
                        style={{ width: `${Math.max(8, (item.count / maxSportCount) * 100)}%` }}
                      />
                    </div>
                    <div className="studio-progress-value">{item.count}x</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="studio-empty">Complete mapped efforts to unlock pace trends.</div>
            )}
          </div>
        </div>
      </section>

      <section className="studio-panel studio-reveal">
        <div className="studio-panel-row">
          <div className="studio-panel-title">Day Breakdown</div>
          <div className="studio-hud-date">{selectedTrainingTrendDayKey || 'No day selected'}</div>
        </div>
        <div className="studio-progress-list">
          {selectedDaySessions.length ? (
            selectedDaySessions.map((row) => (
              <div className="studio-progress-row" key={`ath-day-${row.id}`}>
                <div className="studio-progress-label">{getRecentPlanName(row)}</div>
                <div className="studio-progress-bar-shell">
                  <div
                    className="studio-progress-bar"
                    style={{ width: `${Math.max(8, (Number(row.duration_minutes || 0) / Math.max(1, maxTrainingMinutesByDay)) * 100)}%` }}
                  />
                </div>
                <div className="studio-progress-value">{Number(row.duration_minutes || 0)}m</div>
              </div>
            ))
          ) : (
            <div className="studio-empty">No sessions logged for this day.</div>
          )}
        </div>
        <div className="logs-list-sub">
          {lastTraining
            ? `Latest: ${lastTrainingTitle} - ${new Date(lastTraining.created_at).toLocaleString()}`
            : 'No recent sessions logged yet.'}
        </div>
      </section>
    </div>
  );
}

export default AthleteTrainingStatsView;
