import React from "react";

export default function LeaderboardPanel({
  leaderboardGroupId,
  setLeaderboardGroupId,
  memberships,
  groups,
  leaderboardLoading,
  groupLeaderboardLoading,
  globalLeaderboard,
  groupLeaderboard,
  globalLeaderboardLoaded,
  groupLeaderboardLoaded,
  profiles,
  openUserProfile,
}) {
  return (
    <div className="community-panel">
      <div className="community-panel-title">Leaderboards</div>
      <div className="community-thread-toolbar">
        <div className="community-thread-toolbar-left">
          <div className="community-thread-label">Group leaderboard</div>
          <select
            className="community-thread-select"
            value={leaderboardGroupId}
            onChange={(event) => setLeaderboardGroupId(event.target.value)}
          >
            <option value="">Select group</option>
            {memberships.map((membership) => {
              const id = String(membership.group_id || "");
              const group = groups.find((item) => String(item.id) === id);
              return (
                <option key={`lb-group-${id}`} value={id}>
                  {group?.name || "Group"}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      <div className="community-leaderboard-grid">
        <div className="community-feed-card">
          <div className="community-panel-title">Global Top</div>
          {leaderboardLoading && <div className="community-empty">Loading leaderboard...</div>}
          {!leaderboardLoading &&
            globalLeaderboard.slice(0, 15).map((row, index) => (
              <div key={`global-${row.user_id}`} className="community-leaderboard-row">
                <span className="community-meta-pill">#{index + 1}</span>
                <button
                  type="button"
                  className="community-profile-link community-leaderboard-name"
                  onClick={() => openUserProfile(row.user_id)}
                >
                  {profiles[row.user_id] || `User ${row.user_id}`}
                </button>
                <div className="community-leaderboard-meta-stack">
                  <span className="community-meta-pill">XP {Number(row.xp || 0)}</span>
                  <span className="community-meta-pill">{row.rank || "-"}</span>
                </div>
              </div>
            ))}
          {!leaderboardLoading && globalLeaderboardLoaded && !globalLeaderboard.length ? (
            <div className="community-empty">No ranked users available yet.</div>
          ) : null}
        </div>
        <div className="community-feed-card">
          <div className="community-panel-title">Group Top</div>
          {!leaderboardGroupId && <div className="community-empty">Join a group to view rankings.</div>}
          {!!leaderboardGroupId && groupLeaderboardLoading && (
            <div className="community-empty">Loading group leaderboard...</div>
          )}
          {!!leaderboardGroupId &&
            !groupLeaderboardLoading &&
            groupLeaderboard.slice(0, 15).map((row, index) => (
              <div key={`group-${row.user_id}`} className="community-leaderboard-row">
                <span className="community-meta-pill">#{index + 1}</span>
                <button
                  type="button"
                  className="community-profile-link community-leaderboard-name"
                  onClick={() => openUserProfile(row.user_id)}
                >
                  {profiles[row.user_id] || `User ${row.user_id}`}
                </button>
                <div className="community-leaderboard-meta-stack">
                  <span className="community-meta-pill">XP {Number(row.xp || 0)}</span>
                  <span className="community-meta-pill">{row.rank || "-"}</span>
                </div>
              </div>
            ))}
          {!!leaderboardGroupId && !groupLeaderboardLoading && groupLeaderboardLoaded && !groupLeaderboard.length && (
            <div className="community-empty">No ranked members yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
