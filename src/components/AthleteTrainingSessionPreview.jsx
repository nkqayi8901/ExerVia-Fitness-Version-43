import React from 'react';
import EmptyState from './EmptyState';
import { formatDistance } from '../utils/athleteMetrics';
import { getAthleteWorldMeta } from '../utils/athleteWorlds';

function AthleteTrainingSessionPreview({
  selectedPlan,
  activeWorldSport,
  ritualWorldMeta,
  sessionLaunchMode,
  setSessionLaunchMode,
  activePlanWeekIndex,
  setActivePlanWeekIndex,
  navigate,
  buildRouteLabUrl,
  openFocusLock,
  setPlanOpen,
  suggestedPlan,
  setSelectedPlan,
  routeRitualPreview,
  userId,
  distanceUnit,
  recoveryNudge,
}) {
  return (
    <section className="studio-panel studio-reveal">
      <div className="studio-panel-title">Session Preview</div>
      {selectedPlan ? (
        <>
          <div className="studio-plan-preview">
            <div className="studio-plan-preview-title">{selectedPlan.name}</div>
            <div className="studio-plan-preview-sub">{selectedPlan.goal}</div>
            {activeWorldSport && ['running', 'cycling', 'trail'].includes(activeWorldSport) ? (
              <div className="studio-inline-guide studio-session-launch-mode">
                <div className="studio-inline-title">Session mode</div>
                <div className="studio-inline-cues">
                  <button
                    type="button"
                    className={`studio-mini-btn ${sessionLaunchMode === 'standard' ? 'active' : ''}`}
                    onClick={() => setSessionLaunchMode('standard')}
                  >
                    Map off
                  </button>
                  <button
                    type="button"
                    className={`studio-mini-btn ${sessionLaunchMode === 'mapped' ? 'active' : ''}`}
                    onClick={() => setSessionLaunchMode('mapped')}
                  >
                    Map on
                  </button>
                </div>
                <div className="studio-session-launch-copy">
                  {sessionLaunchMode === 'mapped'
                    ? `Use the ${ritualWorldMeta.title} route layer for GPS, distance, and mapped effort logging.`
                    : 'Stay in the ritual timer for a faster session start without GPS mapping.'}
                </div>
              </div>
            ) : null}
            {(selectedPlan.outline || []).length > 1 ? (
              <>
                <div className="hud-dim" style={{ marginBottom: 8 }}>Select a week before starting your session.</div>
                <div className="studio-week-selector">
                  {(selectedPlan.outline || []).map((block, index) => (
                    <button
                      key={`week-tab-${block.week}-${index}`}
                      type="button"
                      className={`studio-week-chip-btn ${index === activePlanWeekIndex ? 'active' : ''}`}
                      onClick={() => setActivePlanWeekIndex(index)}
                    >
                      {block.week || `Week ${index + 1}`}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <div className="studio-plan-preview-list">
              {(selectedPlan.outline || []).length > 0 ? (
                <div className="studio-plan-preview-row">
                  <div className="studio-plan-preview-week">
                    {selectedPlan.outline[activePlanWeekIndex]?.week || selectedPlan.outline[0]?.week || 'Week 1'}
                  </div>
                  <div className="studio-plan-preview-sessions">
                    {(
                      selectedPlan.outline[activePlanWeekIndex]?.sessions ||
                      selectedPlan.outline[0]?.sessions ||
                      []
                    ).map((sessionItem, sessionIndex) => (
                      <span
                        key={`preview-${sessionItem}-${sessionIndex}`}
                        className="studio-plan-preview-session-pill"
                      >
                        {sessionItem}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="studio-queue-actions studio-session-preview-actions">
            <button
              className="studio-queue-btn"
              onClick={() => {
                if (sessionLaunchMode === 'mapped' && activeWorldSport && ['running', 'cycling', 'trail'].includes(activeWorldSport)) {
                  navigate(buildRouteLabUrl());
                  return;
                }
                openFocusLock(selectedPlan, activePlanWeekIndex);
              }}
              type="button"
            >
              {sessionLaunchMode === 'mapped' && activeWorldSport && ['running', 'cycling', 'trail'].includes(activeWorldSport)
                ? 'Start mapped session'
                : 'Start session'}
            </button>
            <button
              className="studio-queue-btn ghost"
              onClick={() => setPlanOpen(true)}
              type="button"
            >
              View plan
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          className="studio-session-empty"
          title={activeWorldSport ? `Pick a plan to start ${ritualWorldMeta.title}.` : 'Choose a training world first.'}
          description={
            activeWorldSport
              ? 'Choose a plan first, then this panel becomes your session launch point.'
              : 'Pick a world above to unlock plans and build a cleaner session flow.'
          }
          actionLabel={activeWorldSport && suggestedPlan ? `Try ${suggestedPlan.name}` : ''}
          onAction={activeWorldSport && suggestedPlan ? () => setSelectedPlan(suggestedPlan) : undefined}
        />
      )}

      {activeWorldSport ? (
        <div className="studio-route-ritual">
          <div className="studio-route-ritual-top">
            <div>
              <div className="studio-panel-title">{ritualWorldMeta.title} Mapped Efforts</div>
              <div className="studio-route-ritual-sub">
                Keep route work inside this world without breaking Training Ritual.
              </div>
            </div>
            <button
              className="studio-mini-btn"
              type="button"
              onClick={() => navigate(buildRouteLabUrl())}
            >
              Open
            </button>
          </div>
          <div className="studio-route-ritual-actions">
            <div className="studio-route-ritual-note">
              Turn <strong>Map on</strong> above when this plan needs a live route.
            </div>
          </div>
          {routeRitualPreview.length ? (
            <div className="studio-route-ritual-list">
              {routeRitualPreview.map((effort) => (
                <button
                  key={`route-effort-${effort.id}`}
                  type="button"
                  className="studio-route-ritual-card"
                  onClick={() => navigate(`/athlete/${userId}/routes/${effort.id}`)}
                >
                  <div className="studio-route-ritual-head">
                    <strong>{effort.title || 'Mapped effort'}</strong>
                    <span>{formatDistance(effort.distance_km, { unit: distanceUnit, includeUnit: true })}</span>
                  </div>
                  <div className="studio-route-ritual-meta">
                    <span>{getAthleteWorldMeta(effort.discipline).title}</span>
                    <span>{Number(effort.elapsed_seconds || 0) > 0 ? `${Math.max(1, Math.floor(Number(effort.elapsed_seconds || 0) / 60))} min` : 'Tracked'}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="studio-route-ritual-empty">
              No mapped effort yet for {ritualWorldMeta.title}. Start one when this world needs live route data.
            </div>
          )}
        </div>
      ) : null}
      {recoveryNudge ? (
        <div className="studio-inline-guide studio-recovery-guide">
          <div className="studio-inline-title">Recovery signal</div>
          <div className="studio-session-empty-copy">
            {recoveryNudge.label || 'Recent session'} logged for {Number(recoveryNudge.minutes || 0)} min. If you are stacking hard days, consider a lighter effort or recovery session next.
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AthleteTrainingSessionPreview;
