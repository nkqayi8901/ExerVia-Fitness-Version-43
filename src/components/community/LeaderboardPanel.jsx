import React from "react";

export default function LeaderboardPanel({
  leaderboardGroupId,
  setLeaderboardGroupId,
  memberships,
  groups,
  leaderboardLoading,
  globalLeaderboard,
  groupLeaderboard,
  gymLeaderboardContext,
  gymLeaderboardLoading,
  gymLeaderboard,
  reportingLeaderboardUserIds,
  profiles,
  userId,
  openUserProfile,
  openGymProfile,
  handleReportLeaderboardEntry,
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
                <span className="community-meta-pill">XP {Number(row.xp || 0)}</span>
                <span className="community-meta-pill">{row.rank || "-"}</span>
              </div>
            ))}
        </div>
        <div className="community-feed-card">
          <div className="community-panel-title">Group Top</div>
          {!leaderboardGroupId && <div className="community-empty">Join a group to view rankings.</div>}
          {!!leaderboardGroupId &&
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
                <span className="community-meta-pill">XP {Number(row.xp || 0)}</span>
                <span className="community-meta-pill">{row.rank || "-"}</span>
              </div>
            ))}
          {!!leaderboardGroupId && !groupLeaderboard.length && (
            <div className="community-empty">No ranked members yet.</div>
          )}
        </div>
        <div className="community-feed-card">
          <div className="community-panel-title">Gym Top (This Week)</div>
          {!gymLeaderboardContext.placeId && (
            <div className="community-empty">Link a gym in Profile Settings to unlock this leaderboard.</div>
          )}
          {!!gymLeaderboardContext.placeId && (
            <div className="community-feed-title-row">
              <div className="community-feed-sub">{gymLeaderboardContext.name || "Linked Gym"}</div>
              <button
                type="button"
                className="studio-back community-cta-btn"
                onClick={() => openGymProfile(gymLeaderboardContext.placeId)}
              >
                Open gym page
              </button>
            </div>
          )}
          {gymLeaderboardLoading && <div className="community-empty">Loading gym leaderboard...</div>}
          {!gymLeaderboardLoading &&
            gymLeaderboard.slice(0, 15).map((row, index) => (
              <div key={`gym-${row.user_id}`} className="community-leaderboard-row">
                <span className="community-meta-pill">#{index + 1}</span>
                <button
                  type="button"
                  className="community-profile-link community-leaderboard-name"
                  onClick={() => openUserProfile(row.user_id)}
                >
                  {profiles[row.user_id] || `User ${row.user_id}`}
                </button>
                <div className="community-leaderboard-meta-stack">
                  <span className="community-meta-pill">
                    {Number(row.weekly_tonnage || 0).toLocaleString()} kg
                  </span>
                  {Number(row.delta_to_next || 0) > 0 ? (
                    <span className="community-meta-pill">
                      +{Number(row.delta_to_next || 0).toLocaleString()} to next
                    </span>
                  ) : null}
                  {row.suspicious ? <span className="community-meta-pill danger">Flagged</span> : null}
                  {Number(row.reports_count || 0) > 0 ? (
                    <span className="community-meta-pill">
                      {Number(row.reports_count)} report{Number(row.reports_count) === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                {Number(row.user_id) !== Number(userId) ? (
                  <button
                    type="button"
                    className="studio-back community-cta-btn"
                    onClick={() => handleReportLeaderboardEntry(row)}
                    disabled={Boolean(reportingLeaderboardUserIds[Number(row.user_id)])}
                  >
                    {reportingLeaderboardUserIds[Number(row.user_id)] ? "Reporting..." : "Report"}
                  </button>
                ) : (
                  <span className="community-meta-pill">You</span>
                )}
              </div>
            ))}
          {!!gymLeaderboardContext.placeId && !gymLeaderboardLoading && !gymLeaderboard.length && (
            <div className="community-empty">No gym lifts logged yet this week.</div>
          )}
        </div>
      </div>
    </div>
  );
}

