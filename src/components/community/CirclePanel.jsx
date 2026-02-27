import React, { useEffect, useState } from "react";

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
}) {
  const [friendsListOpen, setFriendsListOpen] = useState(false);

  useEffect(() => {
    if (forceFriendsListOpen) {
      setFriendsListOpen(true);
    }
  }, [forceFriendsListOpen]);

  return (
    <div className="community-panel">
      <div className="community-panel-title">Overview</div>
      <div className="community-circle-grid">
        <div className="community-circle-card">
          <div className="community-circle-title">Social Groups</div>
          <div className="community-circle-sub">{memberships.length} groups joined</div>
          <button className="studio-back community-cta-btn" onClick={() => setCreateGroupOpen(true)}>
            Create group
          </button>
        </div>
        <div className="community-circle-card">
          <div className="community-circle-title">
            Friends List
            {unreadCount > 0 && <span className="community-notification-pill">{unreadCount}</span>}
            {incomingRequestCount > 0 && (
              <span
                className="community-notification-dot alert"
                title={`${incomingRequestCount} incoming friend request${incomingRequestCount === 1 ? "" : "s"}`}
              />
            )}
          </div>
          <div className="community-circle-sub">{friends.length} connections</div>
          <div className="community-group-item-actions">
            <button className="studio-back community-cta-btn" onClick={() => setAddFriendOpen(true)}>
              Add friend
            </button>
            <button className="studio-back community-cta-btn" type="button" onClick={() => setFriendsListOpen(true)}>
              Friends list
            </button>
            <button className="studio-back community-cta-btn" onClick={() => navigate(messagesPath())}>
              Open inbox
            </button>
          </div>
        </div>
      </div>

      {friendsListOpen && (
        <div
          className="community-friends-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Friends list"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFriendsListOpen(false);
          }}
        >
          <div className="community-friends-sheet" onMouseDown={(event) => event.stopPropagation()}>
            <div className="community-friends-sheet-head">
              <div className="community-panel-title">Friends list</div>
              <button className="studio-back community-cta-btn" type="button" onClick={() => setFriendsListOpen(false)}>
                Close
              </button>
            </div>

            <div className="community-friends-list">
              {friends.map((friend) => {
                const status = getFriendStatus(friend);
                const label = buildFriendLabel(friend);
                const otherId = friend.user_id === Number(userId) ? friend.friend_user_id : friend.user_id;
                const hasUnread = getFriendUnread(friend);
                return (
                  <div key={friend.id} className="community-friend-card">
                    <div>
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
                          <span className="community-notification-dot alert" title="Incoming friend request" />
                        )}
                      </div>
                      <div className="community-friend-sub">{buildFriendMeta(friend)}</div>
                      <div className="community-friend-sub">
                        {status === "accepted"
                          ? "Connected"
                          : status === "outgoing"
                          ? "Friend request sent"
                          : "Friend request received"}
                      </div>
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
                          <button className="studio-back community-cta-btn" onClick={() => handleRemoveFriend(friend)}>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {!friends.length &&
                renderEmptyState({
                  icon: "??",
                  title: "No connections yet",
                  sub: "Approve a friend request to unlock direct messages.",
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
