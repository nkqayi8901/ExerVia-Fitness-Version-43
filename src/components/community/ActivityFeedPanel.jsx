import React from "react";

export default function ActivityFeedPanel({
  statusDraft,
  statusPosting,
  onStatusDraftChange,
  onCreateStatusPost,
  activityFeedLoading,
  activityFeedItems,
  profiles,
  openThreadPage,
  openUserProfile,
  formatTime,
  renderEmptyState,
}) {
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
            const openStatus = () => openThreadPage(item.postId);

            return (
              <div
                key={item.id || item.postId}
                className="community-feed-card community-activity-card clickable"
                role="button"
                tabIndex={0}
                aria-label={
                  `${item.title}${item.sub ? `. ${item.sub}` : ""}. Opens forum post.`
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
                    <span className="community-feed-sub community-activity-time">{formatTime(item.created_at)}</span>
                  </div>
                  <div className="community-activity-destination" aria-hidden="true">
                    <span className="community-activity-destination-icon">STATUS</span>
                    <span>Status Update</span>
                  </div>
                </div>
                <div className="community-feed-sub community-activity-title">{item.title}</div>
                {item.sub ? <div className="community-feed-sub community-activity-detail">{item.sub}</div> : null}
                <div className="community-thread-actions">
                  <button
                    type="button"
                    className="studio-back community-action-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      openStatus();
                    }}
                  >
                    Open status
                  </button>
                </div>
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
