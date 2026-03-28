import React from 'react';
import EmptyState from './EmptyState';

function AthleteTrainingPlanLibrary({
  selectedPlan,
  showPlanLibrary,
  setShowPlanLibrary,
  setEditingPlanId,
  emptyPlan,
  setNewPlan,
  setShowCreatePlan,
  trainingWorlds,
  activeWorldSport,
  worldShortLabels,
  setSelectedPlan,
  setSessionWeekSnapshot,
  setPlanSearch,
  showAllPlans,
  setShowAllPlans,
  planSportFilter,
  setPlanSportFilter,
  ritualWorldMeta,
  activeWorldSessionCount,
  filteredRouteEfforts,
  planSearch,
  apiStatus,
  planFavorites,
  sortedPins,
  setDraggingPin,
  draggingPin,
  savePinnedOrder,
  plans,
  displayPlans,
  togglePlanFavorite,
  setPlanOpen,
  filteredPlans,
}) {
  return (
    <section className="studio-panel studio-reveal">
      <div className="studio-panel-row">
        <div className="studio-panel-title">Plan Library</div>
        <div className="studio-panel-actions">
          <button
            className="studio-mini-btn ghost"
            onClick={() => setShowPlanLibrary((prev) => !prev)}
            type="button"
          >
            {showPlanLibrary ? 'Collapse list' : 'Show plans'}
          </button>
          <button
            className="studio-mini-btn"
            onClick={() => {
              setEditingPlanId(null);
              setNewPlan({ ...emptyPlan });
              setShowCreatePlan(true);
            }}
            type="button"
          >
            Create plan
          </button>
        </div>
      </div>

      <div className="studio-worlds">
        <div className="studio-panel-title">Training Categories</div>
        <div className="studio-world-grid">
          {trainingWorlds.map((world) => (
            <button
              key={world.id}
              type="button"
              className={`studio-world-card ${activeWorldSport === world.sport ? 'active' : ''}`}
              onClick={() => {
                setSelectedPlan(null);
                setSessionWeekSnapshot(null);
                setPlanSearch('');
                setShowAllPlans(false);
                setPlanSportFilter(planSportFilter === world.sport ? '' : world.sport);
              }}
            >
              <div className="studio-world-title">{worldShortLabels[world.sport] || world.title}</div>
              <div className="studio-world-sub">{world.subtitle}</div>
            </button>
          ))}
        </div>
        {activeWorldSport ? (
          <div className="studio-world-summary">
            <span>{ritualWorldMeta.title}</span>
            <span>{activeWorldSessionCount} session{activeWorldSessionCount === 1 ? '' : 's'} logged</span>
            <span>{filteredRouteEfforts.length} mapped effort{filteredRouteEfforts.length === 1 ? '' : 's'}</span>
          </div>
        ) : null}
      </div>

      {showPlanLibrary ? (
        <>
          <input
            className="studio-search"
            placeholder={planSportFilter ? 'Search plans' : 'Select a training category to unlock plans'}
            value={planSearch}
            onChange={(event) => setPlanSearch(event.target.value)}
            disabled={!planSportFilter}
          />
          {apiStatus === 'loading' ? (
            <EmptyState
              title="Syncing plan sources"
              description="Pulling templates, API plans, and your saved plans."
            />
          ) : null}
          {apiStatus === 'error' ? (
            <EmptyState
              title="Plan source offline"
              description="Showing your saved library and local fallbacks."
            />
          ) : null}
          {planSportFilter && planFavorites.length > 0 ? (
            <div className="studio-programs-block">
              <div className="studio-panel-title">Pinned Plans</div>
              <div className="studio-favorite-row">
                {sortedPins.map((item, index) => (
                  <button
                    key={`fav-${item}`}
                    className="studio-favorite-chip"
                    draggable
                    onDragStart={() => setDraggingPin(index)}
                    onDragEnd={() => setDraggingPin(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingPin === null || draggingPin === index) return;
                      const next = [...sortedPins];
                      const [moved] = next.splice(draggingPin, 1);
                      next.splice(index, 0, moved);
                      savePinnedOrder(next);
                      setDraggingPin(null);
                    }}
                    onClick={() => {
                      const match = plans.find((plan) => plan.name === item);
                      if (match) {
                        setSelectedPlan(match);
                      }
                    }}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {!planSportFilter ? (
            <EmptyState
              title="Choose a training world"
              description="Select a training world to unlock curated plans."
              actionLabel="Choose a category"
              onAction={() => {
                if (trainingWorlds[0]) {
                  setPlanSportFilter(trainingWorlds[0].sport);
                }
              }}
            />
          ) : null}

          <div className="studio-programs">
            {displayPlans.map((plan) => (
              <button
                key={plan.id}
                className={`studio-program-card ${selectedPlan?.id === plan.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPlan(plan);
                }}
                type="button"
              >
                <button
                  className={`studio-program-pin ${planFavorites.includes(plan.name) ? 'active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePlanFavorite(plan);
                  }}
                  type="button"
                  aria-label={planFavorites.includes(plan.name) ? 'Unpin plan' : 'Pin plan'}
                >
                  {planFavorites.includes(plan.name) ? '\u2605' : '\u2606'}
                </button>
                <div className="studio-program-head">
                  <div className="studio-program-name">{plan.name}</div>
                  <div className="studio-program-level">
                    {plan.sport.toUpperCase()} {plan.source === 'api' ? '- LIVE' : ''}
                  </div>
                </div>
                <div className="studio-program-sub">{plan.goal}</div>
                <div className="studio-program-desc">{plan.summary}</div>
                <div className="studio-plan-actions">
                  <button
                    className="studio-queue-btn ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedPlan(plan);
                      setPlanOpen(true);
                    }}
                    type="button"
                  >
                    View plan
                  </button>
                </div>
              </button>
            ))}
          </div>

          {planSportFilter && planSearch && filteredPlans.length === 0 ? (
            <EmptyState
              title="No plans found"
              description={`No plans matched "${planSearch}".`}
            />
          ) : null}
        </>
      ) : (
        <EmptyState
          title="Plan list collapsed"
          description="Expand the library when you want to browse again."
        />
      )}

      {planSportFilter && planSearch && filteredPlans.length === 0 ? (
        <EmptyState
          title="No plans found"
          description={`No plans matched "${planSearch}".`}
        />
      ) : null}
      {planSportFilter && !planSearch && filteredPlans.length === 0 ? (
        <EmptyState
          title={`No ${planSportFilter} plans yet`}
          description="Create one or switch to another training world."
        />
      ) : null}
      {planSportFilter && !planSearch && !showAllPlans && filteredPlans.length > 5 ? (
        <button
          className="studio-mini-btn"
          onClick={() => setShowAllPlans(true)}
          type="button"
        >
          Show more
        </button>
      ) : null}
    </section>
  );
}

export default AthleteTrainingPlanLibrary;
