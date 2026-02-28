import React from "react";

export default function ChallengesPanel({
  challenges,
  challengeTypeMeta,
  challengeParticipantCounts,
  challengeMyProgress,
  joinedChallengeIds,
  handleJoinChallenge,
  renderEmptyState,
}) {
  return (
    <div className="community-panel">
      <div className="community-panel-title">Weekly Challenges</div>
      {challenges.map((challenge) => {
        const type = String(challenge.type || "distance").toLowerCase();
        const typeMeta = challengeTypeMeta[type] || { label: "Challenge", icon: "GO" };
        const participants = challengeParticipantCounts[challenge.id] || 0;
        const targetValue = Number(challenge.target_value || 0);
        const myProgress = Number(challengeMyProgress[challenge.id] || 0);
        const completion = targetValue > 0 ? Math.min((myProgress / targetValue) * 100, 100) : 0;
        const joined = joinedChallengeIds.has(String(challenge.id));
        const createdAtMs = Date.parse(challenge.created_at || "");
        const durationDays = Number(challenge.duration_days || 7);
        const elapsedDays = Number.isNaN(createdAtMs)
          ? 0
          : Math.floor((Date.now() - createdAtMs) / 86400000);
        const daysRemaining = Math.max(durationDays - elapsedDays, 0);
        return (
          <div key={challenge.id} className="community-feed-card community-challenge-card">
            <div className="community-challenge-head">
              <div className="community-challenge-type-icon" aria-hidden="true">
                {typeMeta.icon}
              </div>
              <div>
                <div className="community-feed-title">{challenge.title}</div>
                <div className="community-feed-sub">
                  {typeMeta.label} challenge - target {challenge.target_value || "--"}
                </div>
              </div>
            </div>
            <div className="community-challenge-stats">
              <span className="community-meta-pill">{participants} joined</span>
              <span className="community-meta-pill">{daysRemaining} days left</span>
              <span className="community-meta-pill">You: {myProgress || 0}</span>
            </div>
            <div className="community-challenge-progress">
              <div className="community-challenge-progress-fill" style={{ width: `${completion}%` }} />
            </div>
            <div className="community-tags">
              <span>{typeMeta.label}</span>
              <span>{durationDays} days</span>
            </div>
            <button
              className="studio-back community-cta-btn"
              onClick={() => handleJoinChallenge(challenge.id)}
              disabled={joined}
            >
              {joined ? "Joined" : "Join challenge"}
            </button>
          </div>
        );
      })}
      {!challenges.length &&
        renderEmptyState({
          icon: "\u{1F3C1}",
          title: "No challenges yet",
          sub: "Create the first challenge and get people moving.",
        })}
    </div>
  );
}


