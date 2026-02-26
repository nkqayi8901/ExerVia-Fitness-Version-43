import React from "react";

export default function ActivityFeedPanel({
  statusDraft,
  statusPosting,
  onStatusDraftChange,
  onCreateStatusPost,
  activityFeedLoading,
  activityFeedItems,
  profiles,
  routePrefix,
  userId,
  navigate,
  setActiveTab,
  setGroupRoomId,
  setActiveGroupId,
  groupRoomPath,
  openThreadPage,
  openUserProfile,
  formatTime,
  renderEmptyState,
}) {
  return (
    <div className="community-panel">
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
            const openTraining = () =>
              navigate(`/${routePrefix}/${userId}/logs?day=${encodeURIComponent(item.activityDate)}`);
            const openForumPost = () => openThreadPage(item.postId);
            const openForums = () => setActiveTab("forums");
            const openGroupChat = () => {
              setGroupRoomId(item.groupId);
              setActiveGroupId(item.groupId);
              navigate(groupRoomPath(item.groupId));
            };

            let primaryAction = null;
            let primaryLabel = "";
            let primaryIcon = "";
            if (item.type === "activity" && item.activityType === "training_session" && item.activityDate) {
              primaryAction = openTraining;
              primaryLabel = "Training Log";
              primaryIcon = "LOG";
            } else if (item.type === "activity" && item.activityType === "community_post" && item.postId) {
              primaryAction = openForumPost;
              primaryLabel = "Forum Post";
              primaryIcon = "FORUM";
            } else if (item.type === "activity" && item.activityType === "community_post" && !item.postId) {
              primaryAction = openForums;
              primaryLabel = "Forums";
              primaryIcon = "FORUM";
            } else if (item.type === "forum_post" && item.postId) {
              primaryAction = openForumPost;
              primaryLabel = "Forum Post";
              primaryIcon = "FORUM";
            } else if (item.type === "group_post" && item.groupId) {
              primaryAction = openGroupChat;
              primaryLabel = "Group Chat";
              primaryIcon = "GROUP";
            }

            return (
              <div
                key={item.id}
                className={`community-feed-card community-activity-card${primaryAction ? " clickable" : ""}`}
                role={primaryAction ? "button" : undefined}
                tabIndex={primaryAction ? 0 : undefined}
                aria-label={
                  primaryAction
                    ? `${item.title}${item.sub ? `. ${item.sub}` : ""}. Opens ${primaryLabel || "details"}.`
                    : undefined
                }
                onClick={primaryAction || undefined}
                onKeyDown={
                  primaryAction
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          primaryAction();
                        }
                      }
                    : undefined
                }
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
                  {primaryAction ? (
                    <div className="community-activity-destination" aria-hidden="true">
                      <span className="community-activity-destination-icon">{primaryIcon}</span>
                      <span>{primaryLabel}</span>
                    </div>
                  ) : null}
                </div>
                <div className="community-feed-sub community-activity-title">{item.title}</div>
                {item.sub ? <div className="community-feed-sub community-activity-detail">{item.sub}</div> : null}
                <div className="community-thread-actions">
                  {item.type === "activity" && item.activityType === "training_session" && item.activityDate ? (
                    <button
                      type="button"
                      className="studio-back community-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        openTraining();
                      }}
                    >
                      Open training log
                    </button>
                  ) : null}
                  {item.type === "activity" && item.activityType === "community_post" && item.postId ? (
                    <button
                      type="button"
                      className="studio-back community-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        openForumPost();
                      }}
                    >
                      Open forum post
                    </button>
                  ) : null}
                  {item.type === "activity" && item.activityType === "community_post" && !item.postId ? (
                    <button
                      type="button"
                      className="studio-back community-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        openForums();
                      }}
                    >
                      Open forums
                    </button>
                  ) : null}
                  {item.type === "forum_post" && item.postId ? (
                    <button
                      type="button"
                      className="studio-back community-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        openForumPost();
                      }}
                    >
                      Open forum post
                    </button>
                  ) : null}
                  {item.type === "group_post" && item.groupId ? (
                    <button
                      type="button"
                      className="studio-back community-action-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        openGroupChat();
                      }}
                    >
                      Open group chat
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        {!activityFeedLoading &&
          !activityFeedItems.length &&
          renderEmptyState({
            icon: "LIVE",
            title: "No activity yet",
            sub: "When your friends and groups log progress, it will appear here.",
          })}
      </div>
    </div>
  );
}

