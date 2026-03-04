import React from "react";
import { templateFocusOptions, templateTypeOptions } from "./communityHelpers";

export default function TemplatesPanel({
  templateSearch,
  setTemplateSearch,
  setCreateRecipeTemplateOpen,
  templateTypeFilter,
  setTemplateTypeFilter,
  templateFocusFilter,
  setTemplateFocusFilter,
  templateSort,
  setTemplateSort,
  filteredTemplates,
  templateViewMode,
  setTemplateViewMode,
  swipeTemplates,
  templateDeckIndex,
  visibleSwipeQueue,
  setTemplateDeckIndex,
  setTemplateDeckDragX,
  setTemplateDeckAnimating,
  templateQueueExpanded,
  setTemplateQueueExpanded,
  templateDeckDragX,
  templateDeckAnimating,
  handleTemplateDeckPointerDown,
  handleTemplateDeckPointerMove,
  handleTemplateDeckPointerEnd,
  handleTemplateDeckKeyDown,
  templateRatings,
  templateTryCounts,
  templateComments,
  profiles,
  getTemplatePreviewRows,
  getTemplateMetaBadges,
  openUserProfile,
  formatTime,
  handleTemplateDeckAction,
  likedTemplates,
  handleAddTemplateToMine,
  renderEmptyState,
  templateTriedByMe,
  handleRateTemplate,
  handleTryTemplate,
  templateCommentDrafts,
  setTemplateCommentDrafts,
  handleCommentTemplate,
}) {
  const showFocusFilters = templateTypeFilter !== "training_plan";
  const [expandedTemplateIds, setExpandedTemplateIds] = React.useState({});

  const toggleTemplateExpanded = (templateId) => {
    const id = String(templateId || "");
    if (!id) return;
    setExpandedTemplateIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="community-panel">
      <div className="community-panel-title">Shared Templates</div>
      <div className="community-forum-topbar">
        <input
          className="community-search"
          placeholder="Search templates (e.g. protein balls, 20k training plan)"
          value={templateSearch}
          onChange={(event) => setTemplateSearch(event.target.value)}
        />
        <button
          className="studio-back community-cta-btn community-primary-btn"
          type="button"
          onClick={() => setCreateRecipeTemplateOpen(true)}
        >
          Create recipe
        </button>
      </div>
      <div className="community-tabs community-topic-tabs">
        {templateTypeOptions.map((option) => (
          <button
            key={option.id}
            className={`community-tab ${templateTypeFilter === option.id ? "active" : ""}`}
            type="button"
            onClick={() => setTemplateTypeFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {showFocusFilters ? (
        <div className="community-tabs community-topic-tabs">
          {templateFocusOptions.map((option) => (
            <button
              key={option.id}
              className={`community-tab ${templateFocusFilter === option.id ? "active" : ""}`}
              type="button"
              onClick={() => setTemplateFocusFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="community-thread-toolbar">
        <div className="community-thread-toolbar-left">
          <div className="community-thread-label">Sort</div>
          <select
            className="community-thread-select"
            value={templateSort}
            onChange={(event) => setTemplateSort(event.target.value)}
          >
            <option value="top">Top rated</option>
            <option value="tried">Most tried</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        <div className="community-thread-count">
          {filteredTemplates.length} {filteredTemplates.length === 1 ? "template" : "templates"}
        </div>
      </div>
      
      {templateViewMode === "swipe" && swipeTemplates.length > 0 && (
        <div className="community-template-deck-shell">
          <div className="community-template-deck-head">
            <div className="community-panel-title">Template Swipe Deck</div>
            <div className="community-thread-count">
              {Math.min(templateDeckIndex + 1, swipeTemplates.length)} / {swipeTemplates.length}
            </div>
          </div>
          <div className="community-template-queue" role="list" aria-label="Template queue">
            {visibleSwipeQueue.map(({ template, queueIndex }) => {
              return (
                <button
                  key={`queue-${template.id}`}
                  type="button"
                  className={`community-template-queue-item ${
                    queueIndex === templateDeckIndex ? "active" : ""
                  }`}
                  onClick={() => {
                    setTemplateDeckIndex(queueIndex);
                    setTemplateDeckDragX(0);
                    setTemplateDeckAnimating(null);
                  }}
                >
                  <span className="community-template-queue-title">{template.title}</span>
                  <span className="community-template-queue-type">{template.template_type.replace("_", " ")}</span>
                </button>
              );
            })}
          </div>
          {swipeTemplates.length > 12 && (
            <button
              type="button"
              className="studio-back community-action-btn"
              onClick={() => setTemplateQueueExpanded((prev) => !prev)}
            >
              {templateQueueExpanded ? "Show less queue" : `Show full queue (${swipeTemplates.length})`}
            </button>
          )}
          <div className="community-template-stack-layer layer-back-2" aria-hidden="true" />
          <div className="community-template-stack-layer layer-back-1" aria-hidden="true" />
          {templateDeckIndex < swipeTemplates.length ? (
            (() => {
              const template = swipeTemplates[templateDeckIndex];
              if (!template) return null;
              const rating = templateRatings[template.id] || { sum: 0, count: 0, mine: null };
              const avg = rating.count > 0 ? rating.sum / rating.count : 0;
              const tryCount = Number(templateTryCounts[template.id] || 0);
              const comments = templateComments[template.id] || [];
              const author = profiles[template.created_by] || "Athlete";
              const previewRows = getTemplatePreviewRows(template, true);
              const metaBadges = getTemplateMetaBadges(template);
              const payload = template.payload || {};
              const workoutRows = Array.isArray(payload.exercises) ? payload.exercises : [];
              const outlineRows = Array.isArray(payload.outline) ? payload.outline : [];
              return (
                <div
                  key={`deck-${template.id}`}
                  className={`community-feed-card community-template-swipe-card ${
                    templateDeckDragX > 24 ? "swipe-right" : templateDeckDragX < -24 ? "swipe-left" : ""
                  } ${templateDeckAnimating === "left" ? "animate-left" : ""} ${
                    templateDeckAnimating && templateDeckAnimating !== "left" ? "animate-right" : ""
                  }`}
                  style={{ transform: `translateX(${templateDeckDragX}px) rotate(${templateDeckDragX * 0.03}deg)` }}
                  onPointerDown={handleTemplateDeckPointerDown}
                  onPointerMove={handleTemplateDeckPointerMove}
                  onPointerUp={handleTemplateDeckPointerEnd}
                  onPointerCancel={handleTemplateDeckPointerEnd}
                  onPointerLeave={handleTemplateDeckPointerEnd}
                  onKeyDown={handleTemplateDeckKeyDown}
                  tabIndex={0}
                  role="group"
                  aria-label="Template swipe card. Use left and right arrow keys to pass or like."
                >
                  {templateDeckDragX > 24 && <div className="community-swipe-indicator right">LIKE</div>}
                  {templateDeckDragX < -24 && <div className="community-swipe-indicator left">PASS</div>}
                  <div className="community-template-swipe-main">
                    <div className="community-feed-title">{template.title}</div>
                    <div className="community-thread-meta">
                      <button
                        type="button"
                        className="community-meta-pill community-meta-author community-profile-link"
                        onClick={() => openUserProfile(template.created_by)}
                      >
                        {author}
                      </button>
                      <span className="community-meta-pill">{formatTime(template.created_at)}</span>
                      <span className="community-meta-pill">{template.template_type.replace("_", " ")}</span>
                    </div>
                    <div className="community-feed-sub">{template.summary || template.subtitle || "Shared template."}</div>
                    {metaBadges.length > 0 && (
                      <div className="community-template-meta-row">
                        {metaBadges.map((badge, index) => (
                          <span key={`deck-${template.id}-meta-${index}`} className="community-template-meta-pill">
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}
                    {template.template_type === "workout_program" && workoutRows.length > 0 && (
                      <div className="community-template-program-report">
                        <div className="community-template-program-head">
                          <span className="exercise">Exercise</span>
                          <span>Sets</span>
                          <span>Rep Range</span>
                          <span>Weight (kg)</span>
                        </div>
                        <div className="community-template-program-body">
                          {workoutRows.map((exercise, index) => (
                            <div className="community-template-program-row" key={`deck-program-${template.id}-${index}`}>
                              <span className="exercise">{exercise?.name || `Exercise ${index + 1}`}</span>
                              <span>{Number(exercise?.sets) || 0}</span>
                              <span>{exercise?.reps || "custom"}</span>
                              <span>{Number(exercise?.weight) > 0 ? exercise.weight : "-"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {template.template_type === "training_plan" && outlineRows.length > 0 && (
                      <div className="community-template-outline">
                        <div className="community-template-preview-title">Full plan outline</div>
                        <div className="community-template-outline-list">
                          {outlineRows.map((block, blockIndex) => {
                            const sessions = Array.isArray(block?.sessions) ? block.sessions : [];
                            return (
                              <div key={`deck-outline-${template.id}-${blockIndex}`} className="community-template-outline-block">
                                <div className="community-template-outline-week">{block?.week || `Week ${blockIndex + 1}`}</div>
                                <div className="community-template-outline-sessions">
                                  {sessions.length
                                    ? sessions.map((item, itemIndex) => (
                                        <div key={`deck-outline-session-${template.id}-${blockIndex}-${itemIndex}`}>{item}</div>
                                      ))
                                    : "No sessions"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {template.template_type === "recipe" && previewRows.length > 0 && (
                      <div className="community-template-preview">
                        <div className="community-template-preview-title">Recipe preview</div>
                        <div className="community-template-preview-list">
                          {previewRows.map((row, index) => (
                            <div key={`deck-${template.id}-preview-${index}`} className="community-template-preview-item">
                              {row}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="community-reaction-row">
                      <span className="community-meta-pill">Rating {avg.toFixed(1)} ({rating.count})</span>
                      <span className="community-meta-pill">Tried {tryCount}</span>
                      <span className="community-meta-pill">Comments {comments.length}</span>
                    </div>
                  </div>
                  <div className="community-template-swipe-actions community-template-hinge-actions">
                    <button
                      className="studio-back community-action-btn community-template-swipe-btn ghost hinge pass"
                      type="button"
                      onClick={() => handleTemplateDeckAction("left")}
                    >
                      Pass
                    </button>
                    <button
                      className="studio-back community-action-btn community-primary-btn community-template-swipe-btn hinge like"
                      type="button"
                      onClick={() => handleTemplateDeckAction("like")}
                    >
                      Like
                    </button>
                    <button
                      className="studio-back community-action-btn community-template-swipe-btn hinge add"
                      type="button"
                      onClick={() => handleTemplateDeckAction("add")}
                    >
                      Add to mine
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="community-empty community-empty-state">
              <div className="community-empty-icon" aria-hidden="true">DONE</div>
              <div className="community-empty-title">You reached the end of this deck</div>
              <div className="community-empty-sub">Reset to swipe these templates again.</div>
              <button
                className="studio-back community-cta-btn community-primary-btn"
                type="button"
                onClick={() => setTemplateDeckIndex(0)}
              >
                Restart deck
              </button>
            </div>
          )}
        </div>
      )}
      <div className="community-liked-strip">
        <div className="community-panel-title">Liked Templates</div>
        {likedTemplates.length > 0 ? (
          <div className="community-liked-list">
            {likedTemplates.map((template) => (
              <div key={`liked-${template.id}`} className="community-liked-item">
                <div className="community-liked-main">
                  <div className="community-liked-title">{template.title}</div>
                  <div className="community-liked-sub">{template.template_type.replace("_", " ")}</div>
                </div>
                <div className="community-liked-actions">
                  <button
                    className="studio-back community-action-btn"
                    type="button"
                    onClick={() => {
                      const targetIndex = swipeTemplates.findIndex((item) => item.id === template.id);
                      if (targetIndex >= 0) {
                        setTemplateDeckIndex(targetIndex);
                        setTemplateDeckDragX(0);
                        setTemplateDeckAnimating(null);
                      }
                    }}
                  >
                    View
                  </button>
                  <button
                    className="studio-back community-action-btn community-primary-btn"
                    type="button"
                    onClick={() => handleAddTemplateToMine(template)}
                  >
                    Add to mine
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="community-liked-empty">No liked templates yet. Swipe right or tap Like to save them here.</div>
        )}
      </div>
      {!filteredTemplates.length &&
        renderEmptyState({
          icon: "CHAT",
          title: "No shared templates yet",
          sub: "Share your best plan, program, or recipe and let others add it to their library.",
        })}
      {filteredTemplates.length > 0 && (
          <div className="community-thread-list">
            {filteredTemplates.map((template) => {
              const templateId = String(template.id || "");
              const isExpanded = Boolean(expandedTemplateIds[templateId]);
              const rating = templateRatings[template.id] || { sum: 0, count: 0, mine: null };
              const avg = rating.count > 0 ? rating.sum / rating.count : 0;
              const myRating = Number(rating.mine || 0);
              const tryCount = Number(templateTryCounts[template.id] || 0);
              const comments = templateComments[template.id] || [];
              const author = profiles[template.created_by] || "Athlete";
              const previewRows = getTemplatePreviewRows(template, true);
              const metaBadges = getTemplateMetaBadges(template);
              const payload = template.payload || {};
              const workoutRows = Array.isArray(payload.exercises) ? payload.exercises : [];
              const outlineRows = Array.isArray(payload.outline) ? payload.outline : [];
              return (
                <div key={template.id} className="community-feed-card">
                  <div className="community-feed-title">{template.title}</div>
                  <div className="community-thread-meta">
                    <button
                      type="button"
                      className="community-meta-pill community-meta-author community-profile-link"
                      onClick={() => openUserProfile(template.created_by)}
                    >
                      {author}
                    </button>
                    <span className="community-meta-pill">{formatTime(template.created_at)}</span>
                    <span className="community-meta-pill">{template.template_type.replace("_", " ")}</span>
                    {template.goal && <span className="community-meta-pill">{template.goal}</span>}
                  </div>
                  <div className="community-feed-sub">{template.summary || template.subtitle || "Shared template."}</div>
                  {metaBadges.length > 0 && (
                    <div className="community-template-meta-row">
                      {metaBadges.map((badge, index) => (
                        <span key={`${template.id}-meta-${index}`} className="community-template-meta-pill">
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                  {isExpanded && template.template_type === "workout_program" && workoutRows.length > 0 && (
                    <div className="community-template-program-report">
                      <div className="community-template-program-head">
                        <span className="exercise">Exercise</span>
                        <span>Sets</span>
                        <span>Rep Range</span>
                        <span>Weight (kg)</span>
                      </div>
                      <div className="community-template-program-body">
                        {workoutRows.map((exercise, index) => (
                          <div className="community-template-program-row" key={`forum-program-${template.id}-${index}`}>
                            <span className="exercise">{exercise?.name || `Exercise ${index + 1}`}</span>
                            <span>{Number(exercise?.sets) || 0}</span>
                            <span>{exercise?.reps || "custom"}</span>
                            <span>{Number(exercise?.weight) > 0 ? exercise.weight : "-"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isExpanded && template.template_type === "training_plan" && outlineRows.length > 0 && (
                    <div className="community-template-outline">
                      <div className="community-template-preview-title">Full plan outline</div>
                      <div className="community-template-outline-list">
                        {outlineRows.map((block, blockIndex) => {
                          const sessions = Array.isArray(block?.sessions) ? block.sessions : [];
                          return (
                            <div key={`forum-outline-${template.id}-${blockIndex}`} className="community-template-outline-block">
                              <div className="community-template-outline-week">{block?.week || `Week ${blockIndex + 1}`}</div>
                              <div className="community-template-outline-sessions">
                                {sessions.length
                                  ? sessions.map((item, itemIndex) => (
                                      <div key={`forum-outline-session-${template.id}-${blockIndex}-${itemIndex}`}>{item}</div>
                                    ))
                                  : "No sessions"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {isExpanded && template.template_type === "recipe" && previewRows.length > 0 && (
                    <div className="community-template-preview">
                      <div className="community-template-preview-title">Recipe</div>
                      <div className="community-template-preview-list">
                        {previewRows.map((row, index) => (
                          <div key={`${template.id}-preview-${index}`} className="community-template-preview-item">
                            {row}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isExpanded && (
                    <div className="community-tags">
                      {(template.tags || []).slice(0, 6).map((tag, index) => (
                        <span key={`${template.id}-tag-${index}`}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="community-reaction-row">
                    <span className="community-meta-pill">Rating {avg.toFixed(1)} ({rating.count})</span>
                    <span className="community-meta-pill">Tried {tryCount}</span>
                    <span className="community-meta-pill">Comments {comments.length}</span>
                  </div>
                  {!isExpanded && comments.length > 0 ? (
                    <div className="community-reply-card">
                      <div className="community-reply-body">{comments[0]?.body || ""}</div>
                      <div className="community-thread-meta">
                        <button
                          type="button"
                          className="community-meta-pill community-meta-author community-profile-link"
                          onClick={() => openUserProfile(comments[0]?.user_id)}
                        >
                          {profiles[comments[0]?.user_id] || "Athlete"}
                        </button>
                        <span className="community-meta-pill">{formatTime(comments[0]?.created_at)}</span>
                        {comments.length > 1 ? (
                          <span className="community-meta-pill">+{comments.length - 1} more</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {isExpanded && (
                    <div className="community-reaction-row">
                      {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={`${template.id}-rate-${value}`}
                        className={`community-reaction-btn community-rating-btn ${myRating === value ? "active" : ""}`}
                        data-rating={value}
                        aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                        type="button"
                        onClick={() => handleRateTemplate(template.id, value)}
                      >
                        {value}â˜…
                      </button>
                    ))}
                      <button
                        className={`community-reaction-btn ${templateTriedByMe[template.id] ? "active" : ""}`}
                        type="button"
                        onClick={() => handleTryTemplate(template.id)}
                      >
                        Tried it
                      </button>
                    </div>
                  )}
                  <div className="community-thread-actions">
                    <button
                      className="studio-back community-action-btn"
                      type="button"
                      onClick={() => toggleTemplateExpanded(templateId)}
                    >
                      {isExpanded ? "Hide" : "View"}
                    </button>
                    <button
                      className="studio-back community-action-btn community-primary-btn"
                      type="button"
                      onClick={() => handleAddTemplateToMine(template)}
                    >
                      Add to mine
                    </button>
                  </div>
                  {isExpanded && (
                    <>
                      <div className="community-template-commentbar">
                        <input
                          className="community-modal-input"
                          placeholder="Comment on this template"
                          value={templateCommentDrafts[template.id] || ""}
                          onChange={(event) =>
                            setTemplateCommentDrafts((prev) => ({
                              ...prev,
                              [template.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          className="studio-back community-cta-btn"
                          type="button"
                          onClick={() => handleCommentTemplate(template.id)}
                        >
                          Comment
                        </button>
                      </div>
                      {comments.slice(0, 3).map((comment) => (
                        <div key={comment.id} className="community-reply-card">
                          <div className="community-reply-body">{comment.body}</div>
                          <div className="community-thread-meta">
                            <button
                              type="button"
                              className="community-meta-pill community-meta-author community-profile-link"
                              onClick={() => openUserProfile(comment.user_id)}
                            >
                              {profiles[comment.user_id] || "Athlete"}
                            </button>
                            <span className="community-meta-pill">{formatTime(comment.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
