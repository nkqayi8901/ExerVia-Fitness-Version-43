import React from 'react';
import { useNavigate } from 'react-router-dom';

function AthleteTrainingPlanDetailModal({
  selectedPlan,
  closePlanModal,
  activePlanWeekIndex,
  setActivePlanWeekIndex,
  openFocusLock,
  planFavorites,
  togglePlanFavorite,
  remixPlan,
  prefillPlanEditor,
  deletePlan,
  setPlanOpen,
  buildRouteLabUrl,
}) {
  const navigate = useNavigate();
  if (!selectedPlan) return null;

  return (
    <div className="studio-swap-backdrop" onClick={(event) => event.target === event.currentTarget && closePlanModal()}>
      <div className="studio-swap-panel" onClick={(event) => event.stopPropagation()}>
        <div className="studio-swap-header">
          <div>
            <div className="studio-panel-title">Plan Details</div>
            <div className="studio-swap-sub">{selectedPlan.name}</div>
          </div>
          <button
            className="studio-swap-close"
            onClick={closePlanModal}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="studio-swap-body">
          <div className="studio-plan-detail">{selectedPlan.summary}</div>
          {(selectedPlan.outline || []).length > 1 ? (
            <>
              <div className="hud-dim" style={{ marginBottom: 8 }}>Select a week before starting.</div>
              <div className="studio-week-selector" style={{ marginTop: 0 }}>
                {(selectedPlan.outline || []).map((block, index) => (
                  <button
                    key={`plan-open-week-tab-${block.week}-${index}`}
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
          <div className="studio-plan-timeline">
            {(selectedPlan.outline || [])
              .filter((_, blockIndex) => blockIndex === activePlanWeekIndex || (selectedPlan.outline || []).length === 1)
              .map((block) => (
                <div key={block.week} className="studio-plan-week">
                  <div className="studio-plan-week-title">
                    {block.week}
                    {block.intensity ? (
                      <span className="studio-week-pill">{block.intensity}</span>
                    ) : null}
                    {block.focus ? (
                      <span className="studio-week-chip">{block.focus}</span>
                    ) : null}
                  </div>
                  {block.intensity ? (
                    <div className="studio-week-progress">
                      <div
                        className="studio-week-fill"
                        style={{ width: block.intensity }}
                      />
                    </div>
                  ) : null}
                  <ul className="studio-plan-week-list">
                    {(block.sessions || []).map((item, itemIndex) => (
                      <li key={`${block.week}-${item}-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
          <button
            className="studio-primary-btn"
            onClick={() => {
              setPlanOpen(false);
              openFocusLock(selectedPlan, activePlanWeekIndex);
            }}
            type="button"
          >
            Start session
          </button>
          {buildRouteLabUrl ? (
            <button
              className="studio-queue-btn ghost"
              onClick={() => {
                setPlanOpen(false);
                navigate(buildRouteLabUrl());
              }}
              type="button"
            >
              Open Map
            </button>
          ) : null}
          <div className="studio-plan-actions">
            <button
              className={`studio-queue-btn ghost ${planFavorites.includes(selectedPlan.name) ? 'active' : ''}`}
              onClick={() => togglePlanFavorite(selectedPlan)}
              type="button"
            >
              {planFavorites.includes(selectedPlan.name) ? 'Pinned' : 'Pin'}
            </button>
            <button
              className="studio-queue-btn ghost"
              onClick={() => {
                setPlanOpen(false);
                remixPlan(selectedPlan);
              }}
              type="button"
            >
              Edit plan
            </button>
          </div>
          {selectedPlan.source === 'user' ? (
            <div className="studio-plan-actions">
              <button
                className="studio-queue-btn ghost"
                onClick={() => {
                  setPlanOpen(false);
                  prefillPlanEditor(selectedPlan);
                }}
                type="button"
              >
                Edit plan
              </button>
              <button
                className="studio-queue-btn ghost danger"
                onClick={deletePlan}
                type="button"
              >
                Delete plan
              </button>
            </div>
          ) : (
            <div className="studio-plan-actions">
              <button
                className="studio-queue-btn ghost"
                onClick={() => {
                  setPlanOpen(false);
                  prefillPlanEditor(selectedPlan);
                }}
                type="button"
              >
                Save as my plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AthleteTrainingPlanDetailModal;
