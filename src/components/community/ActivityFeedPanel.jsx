import React from "react";
import RoutePreviewVisual from "../RoutePreviewVisual";

function formatRunMetric(item) {
  const preview = item.runPreview;
  if (!preview) return [];
  const paceSeconds = Number(preview.pacePerKmSeconds || 0);
  const paceLabel = paceSeconds
    ? `${String(Math.floor(paceSeconds / 60)).padStart(2, "0")}:${String(paceSeconds % 60).padStart(2, "0")}/km`
    : "--:--/km";
  const elapsed = Number(preview.elapsedSeconds || 0);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const elapsedLabel =
    hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return [
    `${Number(preview.distanceKm || 0).toFixed(2)} km`,
    elapsedLabel,
    paceLabel,
  ];
}

export default function ActivityFeedPanel({
  statusDraft,
  statusPosting,
  onStatusDraftChange,
  onCreateStatusPost,
  activityFeedLoading,
  activityFeedItems,
  profiles,
  openThreadPage,
  openRunPage,
  openTrainingWorld,
  openUserProfile,
  reactionOptions,
  reactionCounts,
  userReactions,
  onReact,
  formatTime,
  renderEmptyState,
}) {
  const buildHeadline = (item) => {
    const actor = item.actor_id ? profiles[item.actor_id] || `User ${item.actor_id}` : "";
    if (item.type === "training_post") {
      return `${actor} trained today`;
    }
    if (item.type === "run_post") {
      return `${actor} logged a run`;
    }
    if (item.type === "group_momentum") {
      return item.title;
    }
    return item.title;
  };

  return (
    <div className="community-panel community-activity-panel">
      <div className="community-panel-title">Activity Feed</div>
      <div className="community-inline-reply">
        <div className="community-inline-reply-head">
          <span className="community-section-label">Status</span>
          <span className="community-inline-reply-parent">Post to your feed</span>
        </div>
        <textarea
          className="community-modal-textarea community-inline-reply-input"
          placeholder="Share a status with your friends and groups..."
          value={statusDraft}
          onChange={(event) => onStatusDraftChange(event.target.value)}
        />
        <div className="community-modal-actions">
          <button
            className="studio-back community-cta-btn community-primary-btn"
            type="button"
            onClick={onCreateStatusPost}
            disabled={statusPosting || !statusDraft.trim()}
          >
            {statusPosting ? "Posting..." : "Post status"}
          </button>
        </div>
      </div>
      <div className="community-feed-list">
        {activityFeedLoading && <div className="community-empty">Loading feed...</div>}
        {!activityFeedLoading &&
          activityFeedItems.map((item) => {
            const isPromotion = item.type === "promotion";
            const isGroupMomentum = item.type === "group_momentum";
            const isRunPost = item.type === "run_post" && item.runId;
            const isTrainingPost = item.type === "training_post" && item.trainingMeta?.sport;
            const openStatus = () => {
              if (isPromotion) {
                openUserProfile(item.actor_id);
                return;
              }
              if (isGroupMomentum) {
                return;
              }
              if (isRunPost) {
                openRunPage(item.runId, item.actor_id);
                return;
              }
              if (isTrainingPost) {
                openTrainingWorld(item.trainingMeta.sport);
                return;
              }
              openThreadPage(item.postId);
            };

            return (
              <div
                key={item.id || item.postId}
                className={`community-feed-card community-activity-card clickable activity-${item.type || "status_post"}`}
                role="button"
                tabIndex={0}
                aria-label={
                  `${item.title}${item.sub ? `. ${item.sub}` : ""}.${isPromotion ? " Opens profile." : isRunPost ? " Opens run detail." : " Opens forum post."}`
                }
                onClick={openStatus}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openStatus();
                  }
                }}
              >
                <div className="community-feed-head">
                  <div className="community-feed-title-row">
                    {item.actor_id ? (
                      <button
                        type="button"
                        className="community-profile-link community-feed-title community-activity-actor"
                        onClick={(event) => {
                          event.stopPropagation();
                          openUserProfile(item.actor_id);
                        }}
                      >
                        {profiles[item.actor_id] || `User ${item.actor_id}`}
                      </button>
                    ) : (
                      <span className="community-feed-title community-activity-actor">{buildHeadline(item)}</span>
                    )}
                    <span className="community-feed-sub community-activity-time">{formatTime(item.created_at)}</span>
                  </div>
                  <div className="community-activity-destination" aria-hidden="true">
                    <span className="community-activity-destination-icon">{isPromotion ? "RANK" : item.type === "run_post" ? "RUN" : item.type === "training_post" ? "WORK" : item.type === "group_momentum" ? "GROUP" : "STATUS"}</span>
                    <span>{isPromotion ? "Progression Update" : item.type === "run_post" ? "Run Update" : item.type === "training_post" ? "Training Update" : item.type === "group_momentum" ? "Group Signal" : "Status Update"}</span>
                  </div>
                </div>
                <div className="community-feed-sub community-activity-title">{buildHeadline(item)}</div>
                {item.entityLabel && (item.type === "run_post" || item.type === "training_post") ? (
                  <div className="community-activity-promo-chip">{item.entityLabel}</div>
                ) : null}
                {item.type === "run_post" && item.runPreview ? (
                  <div className="community-run-preview" aria-hidden="true">
                    <div className="community-run-preview-map">
                      <RoutePreviewVisual
                        points={item.runPreview.routePoints}
                        className="community-run-preview-visual"
                        fallbackLabel="Route ready"
                        gradientId={`run-gradient-${item.id || item.runId}`}
                      />
                    </div>
                    <div className="community-run-preview-meta">
                      {formatRunMetric(item).map((metric) => (
                        <span key={`${item.id || item.runId}-${metric}`}>{metric}</span>
                      ))}
                    </div>
                    {item.runStory?.highlights?.length ? (
                      <div className="community-run-highlight-row">
                        {item.runStory.highlights.map((highlight) => (
                          <span key={`${item.id || item.runId}-${highlight}`} className="community-run-highlight">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {item.type === "training_post" && item.trainingStory ? (
                  <div className="community-training-preview" aria-hidden="true">
                    <div className="community-training-preview-head">
                      <span className="community-training-world">{item.trainingStory.world.title}</span>
                      {item.trainingMeta?.focus ? (
                        <span className="community-training-focus">{item.trainingMeta.focus}</span>
                      ) : null}
                    </div>
                    {item.trainingMeta?.durationLabel ? (
                      <div className="community-training-duration">{item.trainingMeta.durationLabel}</div>
                    ) : null}
                    {item.trainingStory.highlights?.length ? (
                      <div className="community-run-highlight-row">
                        {item.trainingStory.highlights.map((highlight) => (
                          <span key={`${item.id}-${highlight}`} className="community-run-highlight">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {item.sub ? <div className="community-feed-sub community-activity-detail">{item.sub}</div> : null}
                {item.type === "run_post" && item.runStory?.summary ? (
                  <div className="community-feed-sub community-run-story-copy">{item.runStory.summary}</div>
                ) : null}
                {item.type === "training_post" && item.trainingStory?.summary ? (
                  <div className="community-feed-sub community-run-story-copy">{item.trainingStory.summary}</div>
                ) : null}
                {isPromotion && item.primaryLabel ? (
                  <div className="community-activity-promo-chip">{item.primaryLabel}</div>
                ) : null}
                {item.postId ? (
                  <div className="community-reaction-row community-feed-reactions" onClick={(event) => event.stopPropagation()}>
                    {reactionOptions.map((option) => {
                      const key = `post:${item.postId}-${option.id}`;
                      const count = reactionCounts[key] || 0;
                      const active = Boolean(userReactions[key]);
                      return (
                        <button
                          key={`${item.postId}-${option.id}`}
                          type="button"
                          className={`community-reaction-btn ${active ? "active" : ""}`}
                          onClick={() => onReact({ postId: item.postId, reaction: option.id })}
                        >
                          <span className="community-reaction-emoji" aria-hidden="true">{option.emoji}</span>
                          <span className="community-reaction-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {!isGroupMomentum ? (
                  <div className="community-thread-actions">
                    <button
                      type="button"
                      className="studio-back community-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        openStatus();
                      }}
                    >
                      {isPromotion ? "Open profile" : item.type === "run_post" ? "View run" : item.type === "training_post" ? "Open world" : "Open status"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        {!activityFeedLoading &&
          !activityFeedItems.length &&
          renderEmptyState({
            icon: "LIVE",
            title: "No statuses yet",
            sub: "Status updates from your circle will appear here.",
          })}
      </div>
    </div>
  );
}
