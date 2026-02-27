import React from "react";

export default function GroupsPanel({
  groupSearch,
  setGroupSearch,
  discoverGroups,
  joinedGroups,
  groupMemberCounts,
  groupLastActive,
  groupPrivacyLabel,
  formatTime,
  groupRoomId,
  setActiveGroupId,
  navigate,
  groupRoomPath,
  handleJoinGroup,
  handleLeaveGroup,
  isGroupOwner,
  handleOpenEditGroup,
  handleDeleteGroup,
  renderEmptyState,
  setCreateGroupOpen,
}) {
  return (
    <div className="community-panel">
      <div className="community-panel-title">Find Groups</div>
      <input
        className="community-search"
        placeholder="Search groups (e.g. Keto Diet Group)"
        value={groupSearch}
        onChange={(event) => setGroupSearch(event.target.value)}
      />

      <div className="community-panel-title">Discover Groups</div>
      <div className="community-scroll-list community-group-list community-group-square-grid">
        {discoverGroups.map((group) => {
          const members = groupMemberCounts[group.id] || 0;
          const lastActive = groupLastActive[group.id];
          return (
            <div key={group.id} className="community-forum-item community-group-square">
              <div className="community-forum-title">{group.name}</div>
              <div className="community-group-meta-line">
                <span className="community-meta-pill">{members} members</span>
                <span className="community-meta-pill">{groupPrivacyLabel(group.privacy)}</span>
              </div>
              <div className="community-forum-sub">{group.goal || "Community group"}</div>
              <div className="community-group-activity-row">
                <span className={`community-notification-dot mini ${lastActive ? "" : "idle"}`} />
                <span>{lastActive ? `Active ${formatTime(lastActive)}` : "No chat activity yet"}</span>
              </div>
              <div className="community-group-item-actions">
                <button
                  type="button"
                  className="studio-back community-cta-btn community-group-open-btn"
                  onClick={() => handleJoinGroup(group.id, true)}
                >
                  Join group
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!discoverGroups.length &&
        renderEmptyState({
          icon: "ðŸ‘¥",
          title: "No groups found",
          sub: "Try a different search or create a new group.",
          ctaLabel: "Create group",
          onCta: () => setCreateGroupOpen(true),
        })}

      <div className="community-panel-title">Joined Groups</div>
      <div className="community-scroll-list community-group-list community-group-square-grid">
        {joinedGroups.map((group) => {
          const members = groupMemberCounts[group.id] || 0;
          const lastActive = groupLastActive[group.id];
          return (
            <div
              key={group.id}
              className={`community-forum-item community-group-square ${String(groupRoomId) === String(group.id) ? "active" : ""}`}
            >
              <div className="community-forum-title">{group.name}</div>
              <div className="community-group-meta-line">
                <span className="community-meta-pill">{members} members</span>
                <span className="community-meta-pill">{groupPrivacyLabel(group.privacy)}</span>
              </div>
              <div className="community-forum-sub">{group.goal || "Community group"}</div>
              <div className="community-group-activity-row">
                <span className={`community-notification-dot mini ${lastActive ? "" : "idle"}`} />
                <span>{lastActive ? `Active ${formatTime(lastActive)}` : "No chat activity yet"}</span>
              </div>
              <div className="community-group-item-actions">
                <button
                  type="button"
                  className="studio-back community-cta-btn community-primary-btn community-group-open-btn"
                  onClick={() => {
                    setActiveGroupId(group.id);
                    navigate(groupRoomPath(group.id));
                  }}
                >
                  Open room
                </button>
                <button
                  type="button"
                  className="studio-back community-cta-btn community-group-open-btn"
                  onClick={() => handleLeaveGroup(group.id)}
                >
                  Leave
                </button>
                {isGroupOwner(group) && (
                  <button
                    type="button"
                    className="studio-back community-cta-btn community-group-open-btn"
                    onClick={() => handleOpenEditGroup(group)}
                  >
                    Edit group
                  </button>
                )}
                {isGroupOwner(group) && (
                  <button
                    type="button"
                    className="studio-back community-cta-btn community-group-open-btn"
                    onClick={() => handleDeleteGroup(group)}
                  >
                    Delete group
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!joinedGroups.length &&
        renderEmptyState({
          icon: "ðŸ‘¥",
          title: "No joined groups yet",
          sub: "Join a group above and it will appear here.",
        })}
    </div>
  );
}

