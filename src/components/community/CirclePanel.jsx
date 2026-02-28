import React, { useState } from "react";

export default function CirclePanel({
  memberships,
  unreadCount,
  incomingRequestCount,
  friends,
  setCreateGroupOpen,
  setAddFriendOpen,
  navigate,
  messagesPath,
  getFriendStatus,
  buildFriendLabel,
  buildFriendMeta,
  getFriendUnread,
  openUserProfile,
  handleAcceptFriend,
  handleRejectFriend,
  handleRemoveFriend,
  userId,
  renderEmptyState,
  forceFriendsListOpen = false,
  openGroupsTab,
  openFriendsTab,
}) {
  const [expandedFriendId, setExpandedFriendId] = useState(null);
  const showFriendsView = Boolean(forceFriendsListOpen);

  return (
    <div className="community-panel">
      {!showFriendsView ? (
      <>
      <div className="community-panel-title">Overview</div>
      <div className="community-circle-grid">
        <div className="community-circle-card">
          <div className="community-circle-title">Social Groups</div>
          <div className="community-circle-sub">{memberships.length} groups joined</div>
          <div className="community-group-item-actions">
            <button className="studio-back community-cta-btn" onClick={() => openGroupsTab?.()}>
              Open groups
            </button>
            <button className="studio-back community-cta-btn" onClick={() => setCreateGroupOpen(true)}>
              Create group
            </button>
          </div>
        </div>
        <div className="community-circle-card">
          <div className="community-circle-title">
            Friends List
            {unreadCount > 0 && (
              <span
                className="community-notification-dot"
                title={`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`}
              />
            )}
            {incomingRequestCount > 0 && (
              <span
                className="community-notification-dot request"
                title={`${incomingRequestCount} incoming friend request${incomingRequestCount === 1 ? "" : "s"}`}
              />
            )}
          </div>
          <div className="community-circle-sub">{friends.length} connections</div>
          <div className="community-group-item-actions">
            <button className="studio-back community-cta-btn" onClick={() => setAddFriendOpen(true)}>
              Add friend
            </button>
            <button className="studio-back community-cta-btn" type="button" onClick={() => openFriendsTab?.()}>
              Friends list
            </button>
            <button className="studio-back community-cta-btn" onClick={() => navigate(messagesPath())}>
              Open inbox
            </button>
          </div>
        </div>
      </div>
      </>
      ) : (
      <div className="community-friends-page">
        <div className="community-friends-sheet-head">
          <div className="community-panel-title">Friends list</div>
          <button className="studio-back community-cta-btn" type="button" onClick={() => navigate(messagesPath())}>
            Open inbox
          </button>
        </div>
      </div>
      )}

      {showFriendsView ? (
      <div className="community-friends-list-page">
        {friends.map((friend) => {
                const status = getFriendStatus(friend);
                const label = buildFriendLabel(friend);
                const otherId = friend.user_id === Number(userId) ? friend.friend_user_id : friend.user_id;
                const hasUnread = getFriendUnread(friend);
                const isExpanded = String(expandedFriendId || "") === String(friend.id || "");
                return (
                  <div key={friend.id} className={`community-friend-card ${isExpanded ? "expanded" : "compact"}`}>
                    <div className="community-friend-main">
                      <div className="community-friend-title-row">
                        <button
                          type="button"
                          className="community-profile-link community-friend-title"
                          onClick={() => openUserProfile(otherId)}
                        >
                          {label}
                        </button>
                        {hasUnread && <span className="community-notification-dot" />}
                        {status === "incoming" && (
                          <span className="community-notification-dot request" title="Incoming friend request" />
                        )}
                      </div>
                      {isExpanded ? (
                        <>
                          <div className="community-friend-sub">{buildFriendMeta(friend)}</div>
                          <div className="community-friend-sub">
                            {status === "accepted"
                              ? "Connected"
                              : status === "outgoing"
                              ? "Friend request sent"
                              : "Friend request received"}
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div className="community-friend-actions">
                      {status === "incoming" && (
                        <>
                          <button className="studio-back community-cta-btn" onClick={() => handleAcceptFriend(friend)}>
                            Approve
                          </button>
                          <button className="hud-secondary-btn danger" onClick={() => handleRejectFriend(friend)}>
                            Reject
                          </button>
                        </>
                      )}
                      {status === "accepted" && (
                        <>
                          <button
                            className="studio-back community-cta-btn"
                            onClick={() => {
                              navigate(messagesPath(otherId));
                            }}
                          >
                            Message
                            {hasUnread && <span className="community-notification-dot mini" />}
                          </button>
                          {isExpanded ? (
                            <button className="studio-back community-cta-btn" onClick={() => handleRemoveFriend(friend)}>
                              Remove
                            </button>
                          ) : null}
                        </>
                      )}
                      <button
                        className="studio-back community-cta-btn"
                        type="button"
                        onClick={() =>
                          setExpandedFriendId((prev) => (String(prev || "") === String(friend.id || "") ? null : friend.id))
                        }
                      >
                        {isExpanded ? "Less" : "Details"}
                      </button>
                    </div>
                  </div>
                );
        })}
        {!friends.length &&
          renderEmptyState({
            icon: "FR",
            title: "No connections yet",
            sub: "Approve a friend request to unlock direct messages.",
          })}
      </div>
      ) : null}
    </div>
  );
}
