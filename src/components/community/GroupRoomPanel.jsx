import React from "react";

export default function GroupRoomPanel({
  isRouteMode = false,
  activeGroup,
  groupRoomMembers,
  groupRoomPosts,
  groupRoomLoading,
  groupRoomVisiblePosts,
  groupRoomChannel,
  groupRoomQuestionRepliesByQuestionId,
  groupRoomQuestionPostById,
  groupRoomQuestionReplyTargetId,
  groupRoomGeneralUnreadCount = 0,
  groupRoomQuestionUnreadCount = 0,
  groupRoomDraft,
  groupRoomSending,
  groupRoomListRef,
  userId,
  profiles,
  groupPrivacyLabel,
  formatTime,
  parseQuestionReplyPayload,
  normalizeGroupPostChannel,
  isBlockedProfile,
  openUserProfile,
  onBackToGroups,
  onLeaveGroup,
  onSwitchChannel,
  onReplyToQuestion,
  onReportContent,
  onDeletePost,
  onToggleBlockProfile,
  onCancelQuestionReply,
  onQuestionDraftChange,
  onGeneralDraftChange,
  onSend,
  renderEmptyState,
  groupQuestionPrefix = "[Q] ",
}) {
  return (
    <div className={`community-group-room-shell ${isRouteMode ? "route-mode" : ""}`}>
      <div className="community-group-room-head">
        <div className="community-group-room-head-left">
          <button className="studio-back community-cta-btn" onClick={onBackToGroups} type="button">
            Back to groups
          </button>
          <div>
            <div className="community-group-room-title">{activeGroup?.name || "Group room"}</div>
            <div className="community-group-room-sub">{activeGroup?.goal || "Live chat for your group."}</div>
          </div>
        </div>
        <div className="community-group-room-head-meta">
          <span className="community-room-chip">{groupRoomMembers.length} members</span>
          <span className="community-room-chip">{groupRoomPosts.length} messages</span>
          {activeGroup?.privacy ? (
            <span className="community-room-chip">{groupPrivacyLabel(activeGroup.privacy)}</span>
          ) : null}
          {activeGroup?.id ? (
            <button className="studio-back community-cta-btn" type="button" onClick={() => onLeaveGroup(activeGroup.id)}>
              Leave group
            </button>
          ) : null}
        </div>
      </div>
      <div className="community-group-room-layout">
        <aside className="community-group-room-left">
          <div className="community-panel-title">Channels</div>
          <button
            type="button"
            className={`community-room-channel ${groupRoomChannel === "general" ? "active" : ""}`}
            aria-label="General Chat"
            onClick={() => onSwitchChannel("general")}
          >
            General Chat
            {groupRoomGeneralUnreadCount > 0 ? (
              <span
                className="community-room-channel-badge-dot"
                aria-label={`${groupRoomGeneralUnreadCount} unread in General Chat`}
                title={`${groupRoomGeneralUnreadCount} unread`}
              />
            ) : null}
          </button>
          <button
            type="button"
            className={`community-room-channel ${groupRoomChannel === "questions" ? "active" : ""}`}
            aria-label="Questions"
            onClick={() => onSwitchChannel("questions")}
          >
            Questions
            {groupRoomQuestionUnreadCount > 0 ? (
              <span
                className="community-room-channel-badge-dot"
                aria-label={`${groupRoomQuestionUnreadCount} unread in Questions`}
                title={`${groupRoomQuestionUnreadCount} unread`}
              />
            ) : null}
          </button>
          <div className="community-room-note">
            General Chat is for live discussion. Questions is a mini forum lane for focused Q&amp;A.
          </div>
        </aside>

        <section className={`community-group-room-center ${groupRoomChannel === "general" ? "general-chat" : ""}`}>
          <div
            className={`community-group-room-messages ${groupRoomChannel === "general" ? "general-chat" : ""}`}
            ref={groupRoomListRef}
          >
            {groupRoomLoading && renderEmptyState({ icon: "...", title: "Loading room", sub: "Syncing latest messages." })}
            {!groupRoomLoading &&
              !groupRoomVisiblePosts.length &&
              renderEmptyState({
                icon: groupRoomChannel === "questions" ? "?" : "...",
                title: groupRoomChannel === "questions" ? "No questions yet" : "No messages yet",
                sub:
                  groupRoomChannel === "questions"
                    ? "Ask the first question for this group."
                    : "Start the room with your first message.",
              })}
            {!groupRoomLoading &&
              groupRoomVisiblePosts
                .filter((post) => !isBlockedProfile(post.created_by))
                .map((post) => {
                  const authorName = profiles[post.created_by] || "Athlete";
                  const initial = String(authorName).replace(/^@+/, "").charAt(0).toUpperCase();
                  const isSelf = Number(post.created_by) === Number(userId);
                  const isQuestionMessage = normalizeGroupPostChannel(post) === "questions";
                  const rawBody = String(post.body || "");
                  const bodyText = isQuestionMessage
                    ? rawBody.startsWith(groupQuestionPrefix)
                      ? rawBody.slice(groupQuestionPrefix.length).trim()
                      : rawBody.trim()
                    : rawBody;
                  const [questionTitleRaw, ...questionRest] = String(bodyText || "").split("\n\n");
                  const questionTitle = String(questionTitleRaw || "").trim();
                  const questionDetails = String(questionRest.join("\n\n") || "").trim();
                  const questionReplies = groupRoomQuestionRepliesByQuestionId[String(post.id)] || [];
                  return (
                    <div key={post.id} className={`community-group-room-msg-row ${isSelf ? "self" : ""}`}>
                      <div className={`community-group-room-msg ${isSelf ? "self" : ""} ${isQuestionMessage ? "question" : ""}`}>
                        <div className="community-group-room-msg-head">
                          {isQuestionMessage ? (
                            <span className="community-group-room-avatar" aria-hidden="true">{initial}</span>
                          ) : null}
                          <button
                            type="button"
                            className="community-profile-link community-group-room-author"
                            onClick={() => openUserProfile(post.created_by)}
                          >
                            {authorName}
                          </button>
                          <span className="community-group-room-time">{formatTime(post.created_at)}</span>
                        </div>
                        {isQuestionMessage ? <div className="community-group-room-question-tag">Question</div> : null}
                        {isQuestionMessage ? (
                          <div className="community-group-room-question-wrap">
                            <div className="community-group-room-question-title">{questionTitle || bodyText}</div>
                            {questionDetails ? (
                              <div className="community-group-room-question-details">{questionDetails}</div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="community-group-room-body">{bodyText}</div>
                        )}
                        {isQuestionMessage ? (
                          <div className="community-reply-actions">
                            <button className="community-reply-btn" type="button" onClick={() => onReplyToQuestion(post)}>
                              Reply
                            </button>
                            <span className="community-reply-meta">
                              {questionReplies.length} {questionReplies.length === 1 ? "reply" : "replies"}
                            </span>
                            <button
                              className="community-reply-btn"
                              type="button"
                              onClick={() =>
                                onReportContent({
                                  targetType: "group_post",
                                  targetId: post.id,
                                  targetUserId: post.created_by,
                                })
                              }
                            >
                              Report
                            </button>
                            {isSelf ? (
                              <button className="community-reply-btn" type="button" onClick={() => onDeletePost(post.id)}>
                                Delete
                              </button>
                            ) : (
                              <button
                                className="community-reply-btn"
                                type="button"
                                onClick={() => onToggleBlockProfile(post.created_by)}
                              >
                                {isBlockedProfile(post.created_by) ? "Unblock" : "Block"}
                              </button>
                            )}
                          </div>
                        ) : null}
                        {isQuestionMessage && questionReplies.length > 0 ? (
                          <div className="community-question-replies">
                            {questionReplies.map((reply) => {
                              const parsedReply = parseQuestionReplyPayload(reply.body);
                              const replyBody = String(parsedReply?.text || "").trim();
                              const replyAuthor = profiles[reply.created_by] || "Athlete";
                              const replyIsSelf = Number(reply.created_by) === Number(userId);
                              return (
                                <div key={reply.id} className={`community-question-reply ${replyIsSelf ? "self" : ""}`}>
                                  <div className="community-question-reply-head">
                                    <button
                                      type="button"
                                      className="community-profile-link community-group-room-author"
                                      onClick={() => openUserProfile(reply.created_by)}
                                    >
                                      {replyAuthor}
                                    </button>
                                    <span className="community-group-room-time">{formatTime(reply.created_at)}</span>
                                    {replyIsSelf ? (
                                      <button type="button" className="community-reply-btn" onClick={() => onDeletePost(reply.id)}>
                                        Delete
                                      </button>
                                    ) : null}
                                  </div>
                                  <div className="community-question-reply-body">{replyBody}</div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
          </div>

          <div className="community-group-room-inputbar community-friend-chat-input">
            {groupRoomChannel === "questions" ? (
              <>
                {groupRoomQuestionReplyTargetId ? (
                  <div className="community-question-compose-meta">
                    <span>
                      Replying to: {String(groupRoomQuestionPostById[String(groupRoomQuestionReplyTargetId)]?.body || "")
                        .replace(groupQuestionPrefix, "")
                        .split("\n\n")[0]
                        .trim()
                        .slice(0, 90)}
                    </span>
                    <button type="button" className="community-reply-btn" onClick={onCancelQuestionReply}>
                      Cancel
                    </button>
                  </div>
                ) : null}
                <textarea
                  className="community-modal-input community-group-room-input community-group-room-question-input"
                  placeholder={
                    groupRoomQuestionReplyTargetId
                      ? "Write your reply"
                      : "Question title on first line, optional details below"
                  }
                  value={groupRoomDraft}
                  disabled={groupRoomSending}
                  onChange={(event) => onQuestionDraftChange(event.target.value)}
                />
              </>
            ) : (
              <input
                className="community-modal-input community-group-room-input"
                placeholder="Write a message"
                value={groupRoomDraft}
                disabled={groupRoomSending}
                onChange={(event) => onGeneralDraftChange(event.target.value)}
              />
            )}
            <button
              className={`studio-back community-cta-btn community-chat-send-btn ${groupRoomChannel === "questions" ? "community-primary-btn" : ""}`}
              onClick={onSend}
              disabled={groupRoomSending || !groupRoomDraft.trim()}
            >
              {groupRoomSending ? "Sending..." : groupRoomChannel === "questions" ? (groupRoomQuestionReplyTargetId ? "Reply" : "Post") : "Send"}
            </button>
          </div>
        </section>

        <aside className="community-group-room-right">
          <div className="community-panel-title">Members ({groupRoomMembers.length})</div>
          <div className="community-group-room-members">
            {groupRoomMembers.map((member) => (
              <div key={member.id} className="community-group-room-member">
                <span className="community-notification-dot mini" />
                <button type="button" className="community-profile-link" onClick={() => openUserProfile(member.user_id)}>
                  {profiles[member.user_id] || "Athlete"}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
