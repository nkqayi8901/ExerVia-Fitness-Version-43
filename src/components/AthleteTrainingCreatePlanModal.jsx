import React from 'react';

function AthleteTrainingCreatePlanModal({
  closeCreatePlanModal,
  newPlan,
  setNewPlan,
  sports,
  focusOptions,
  buildOutline,
  savePlan,
  isPlanSaving,
}) {
  return (
    <div className="studio-swap-backdrop" onClick={(event) => event.target === event.currentTarget && closeCreatePlanModal()}>
      <div className="studio-swap-panel" onClick={(event) => event.stopPropagation()}>
        <div className="studio-swap-header">
          <div>
            <div className="studio-panel-title">Create Plan</div>
            <div className="studio-swap-sub">Build or customize your plan.</div>
          </div>
          <button
            className="studio-swap-close"
            onClick={closeCreatePlanModal}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="studio-swap-body studio-create-program-panel">
          <div className="studio-form-grid">
            <label className="studio-form-field">
              <span className="studio-input-label">Plan name</span>
              <input
                className="studio-search"
                value={newPlan.name}
                onChange={(event) => setNewPlan((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Hybrid Build"
              />
            </label>
            <label className="studio-form-field">
              <span className="studio-input-label">Sport</span>
              <select
                className="studio-select"
                value={newPlan.sport}
                onChange={(event) => setNewPlan((prev) => ({ ...prev, sport: event.target.value }))}
              >
                {sports.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport.charAt(0).toUpperCase() + sport.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="studio-form-field">
              <span className="studio-input-label">Default focus</span>
              <select
                className="studio-select"
                value={newPlan.defaultFocus}
                onChange={(event) => setNewPlan((prev) => ({ ...prev, defaultFocus: event.target.value }))}
              >
                {focusOptions.map((focus) => (
                  <option key={focus} value={focus}>{focus}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="studio-form-field">
            <span className="studio-input-label">Goal</span>
            <input
              className="studio-search"
              value={newPlan.goal}
              onChange={(event) => setNewPlan((prev) => ({ ...prev, goal: event.target.value }))}
              placeholder="Endurance + strength blend"
            />
          </label>

          <label className="studio-form-field">
            <span className="studio-input-label">Summary</span>
            <textarea
              className="studio-textarea"
              value={newPlan.summary}
              onChange={(event) => setNewPlan((prev) => ({ ...prev, summary: event.target.value }))}
              placeholder="What makes this plan unique"
            />
          </label>

          <div className="studio-form-grid">
            <label className="studio-form-field">
              <span className="studio-input-label">Target duration</span>
              <input
                className="studio-search"
                value={newPlan.durationTarget}
                onChange={(event) => setNewPlan((prev) => ({ ...prev, durationTarget: event.target.value }))}
                placeholder="60"
              />
            </label>
            <label className="studio-form-field">
              <span className="studio-input-label">Target distance</span>
              <input
                className="studio-search"
                value={newPlan.distanceTarget}
                onChange={(event) => setNewPlan((prev) => ({ ...prev, distanceTarget: event.target.value }))}
                placeholder="8"
              />
            </label>
          </div>

          <div className="studio-panel-title">Outline</div>
          <div className="studio-create-list studio-outline-editor">
            {newPlan.outline.map((block, idx) => (
              <div key={`${block.week}-${idx}`} className="studio-outline-week-card">
                <div className="studio-outline-week-head">
                  <label className="studio-form-field">
                    <span className="studio-input-label">Week title</span>
                    <input
                      className="studio-form-input studio-outline-week-input"
                      value={block.week}
                      onChange={(event) => {
                        const next = [...newPlan.outline];
                        next[idx] = { ...next[idx], week: event.target.value };
                        setNewPlan((prev) => ({ ...prev, outline: next }));
                      }}
                      placeholder="Week 1"
                    />
                  </label>
                  {newPlan.outline.length > 1 ? (
                    <button
                      className="studio-queue-btn ghost danger"
                      onClick={() => {
                        setNewPlan((prev) => ({
                          ...prev,
                          outline: prev.outline.filter((_, outlineIndex) => outlineIndex !== idx),
                        }));
                      }}
                      type="button"
                    >
                      Remove week
                    </button>
                  ) : null}
                </div>
                <label className="studio-form-field">
                  <span className="studio-input-label">Session objectives</span>
                  <textarea
                    className="studio-textarea studio-outline-sessions"
                    value={(block.sessions || []).join('\n')}
                    onChange={(event) => {
                      const next = [...newPlan.outline];
                      next[idx] = {
                        ...next[idx],
                        sessions: event.target.value
                          .split('\n')
                          .map((sessionLine) => sessionLine.trim())
                          .filter(Boolean),
                      };
                      setNewPlan((prev) => ({ ...prev, outline: next }));
                    }}
                    placeholder={'One objective per line\nTempo run 20 min\nMobility reset'}
                  />
                </label>
                {(block.sessions || []).length > 0 ? (
                  <div className="studio-outline-preview">
                    {(block.sessions || []).map((sessionLine, sessionIndex) => (
                      <span
                        key={`${block.week}-${sessionLine}-${sessionIndex}`}
                        className="studio-outline-preview-pill"
                      >
                        {sessionLine}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="studio-create-actions">
            <button
              className="studio-queue-btn ghost"
              onClick={() => setNewPlan((prev) => ({
                ...prev,
                outline: [...prev.outline, { week: `Week ${prev.outline.length + 1}`, sessions: [''] }],
              }))}
              type="button"
            >
              Add week
            </button>
            <button
              className="studio-queue-btn ghost"
              onClick={() => setNewPlan((prev) => ({
                ...prev,
                outline: buildOutline(prev.sport, prev.defaultFocus, prev.durationTarget, prev.distanceTarget),
              }))}
              type="button"
            >
              Auto-fill 4 weeks
            </button>
            <button
              className="studio-queue-btn"
              onClick={savePlan}
              type="button"
              disabled={isPlanSaving}
            >
              {isPlanSaving ? 'Saving...' : 'Save plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AthleteTrainingCreatePlanModal;
