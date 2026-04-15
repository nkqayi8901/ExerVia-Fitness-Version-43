// NearbyChallenge.jsx
// Three panels in one component:
//
//   1. <NearbyRunnerCard>   — tap a runner marker to open a challenge invitation
//   2. <OutgoingChallenge>  — shows pending state after challenger sends invite
//   3. <IncomingChallenge>  — shows for the challenged user (accept / reject)
//   4. <ActiveChallenge>    — shown to both during in_progress + completed
//
// All panels are self-contained overlays — parent just passes the relevant props.

import { useState } from "react";
import { generateChallengeCard, shareChallengeCard } from "../utils/challengeShareCard";
import "./NearbyChallenge.css";

const DISTANCE_OPTIONS_KM = [
  { label: "1K", km: 1 },
  { label: "2K", km: 2 },
  { label: "5K", km: 5 },
  { label: "10K", km: 10 },
];

const XP_WAGER_OPTIONS = [25, 50, 100, 200, 500];

function formatElapsed(seconds) {
  if (!seconds || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// 1. NearbyRunnerCard — opened when user taps a runner marker on the map
// ---------------------------------------------------------------------------
export function NearbyRunnerCard({
  runner,
  selectedDistanceKm,
  selectedDistanceLabel,
  selectedXpWager,
  onDistanceChange,
  onWagerChange,
  onSendChallenge,
  onClose,
  userXp,
  error,
}) {
  if (!runner) return null;

  const canAfford = userXp >= selectedXpWager;

  return (
    <div className="nc-overlay" role="dialog" aria-modal="true" aria-label={`Challenge ${runner.display_name}`}>
      <div className="nc-card">
        <button className="nc-close" type="button" onClick={onClose} aria-label="Close challenge card">×</button>

        <div className="nc-runner-head">
          <div className="nc-runner-avatar" aria-hidden="true">
            {runner.avatar_url
              ? <img src={runner.avatar_url} alt={runner.display_name} />
              : <span>{String(runner.display_name || "R").charAt(0).toUpperCase()}</span>}
          </div>
          <div className="nc-runner-info">
            <strong className="nc-runner-name">{runner.display_name || "Anonymous Runner"}</strong>
            <span className="nc-runner-meta">
              {String(runner.discipline || "Running")} · {String(runner.run_mode || "Challenge")} mode
            </span>
          </div>
          <div className="nc-runner-badge">LIVE</div>
        </div>

        <div className="nc-section-label">Challenge distance</div>
        <div className="nc-chip-row" role="group" aria-label="Challenge distance">
          {DISTANCE_OPTIONS_KM.map(({ label, km }) => (
            <button
              key={label}
              type="button"
              className={`nc-chip ${selectedDistanceKm === km ? "active" : ""}`}
              onClick={() => onDistanceChange(km, label)}
              aria-pressed={selectedDistanceKm === km}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="nc-section-label">XP wager</div>
        <div className="nc-chip-row" role="group" aria-label="XP wager amount">
          {XP_WAGER_OPTIONS.map((xp) => (
            <button
              key={xp}
              type="button"
              className={`nc-chip ${selectedXpWager === xp ? "active" : ""} ${userXp < xp ? "disabled" : ""}`}
              onClick={() => userXp >= xp && onWagerChange(xp)}
              aria-pressed={selectedXpWager === xp}
              aria-disabled={userXp < xp}
            >
              {xp} XP
            </button>
          ))}
        </div>

        <div className="nc-wager-info">
          <span>Your XP: <strong>{userXp ?? "—"}</strong></span>
          <span>At stake: <strong className={!canAfford ? "nc-warn" : ""}>{selectedXpWager} XP</strong></span>
        </div>

        {error ? <div className="nc-error" role="alert">{error}</div> : null}

        <button
          type="button"
          className="nc-send-btn"
          onClick={() => onSendChallenge(runner, selectedDistanceKm, selectedDistanceLabel, selectedXpWager)}
          disabled={!canAfford}
          aria-label={`Send ${selectedDistanceLabel} challenge to ${runner.display_name} for ${selectedXpWager} XP`}
        >
          {canAfford ? `Challenge to ${selectedDistanceLabel}` : "Not enough XP"}
        </button>
        <div className="nc-hint">
          Both runners must accept within 60 seconds. Winner takes the XP wager.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. OutgoingChallenge — challenger's waiting screen
// ---------------------------------------------------------------------------
export function OutgoingChallenge({ challenge, onCancel }) {
  if (!challenge || challenge.status !== "pending") return null;

  return (
    <div className="nc-overlay" role="status" aria-live="polite">
      <div className="nc-card nc-pending">
        <div className="nc-pending-pulse" aria-hidden="true" />
        <div className="nc-pending-label">Challenge sent</div>
        <div className="nc-pending-target">{challenge.challenged_name}</div>
        <div className="nc-pending-meta">
          {challenge.distance_label} · {challenge.xp_wager} XP wager · 60s window
        </div>
        <div className="nc-pending-hint">Waiting for them to accept...</div>
        <button type="button" className="nc-cancel-btn" onClick={() => onCancel(challenge.id)}>
          Cancel challenge
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. IncomingChallenge — challenged user's accept/reject screen
// ---------------------------------------------------------------------------
export function IncomingChallenge({ challenge, onRespond, userXp }) {
  if (!challenge || challenge.status !== "pending") return null;

  const canAfford = (userXp ?? 0) >= challenge.xp_wager;

  return (
    <div className="nc-overlay" role="dialog" aria-modal="true" aria-label="Incoming challenge">
      <div className="nc-card nc-incoming">
        <div className="nc-incoming-label">Incoming challenge</div>
        <div className="nc-incoming-from">{challenge.challenger_name}</div>
        <div className="nc-incoming-details">
          <span>{challenge.distance_label}</span>
          <span>·</span>
          <span>{challenge.xp_wager} XP on the line</span>
        </div>
        {!canAfford
          ? <div className="nc-error">You don't have enough XP to accept this wager ({challenge.xp_wager} XP needed).</div>
          : null}
        <div className="nc-incoming-actions">
          <button
            type="button"
            className="nc-send-btn"
            onClick={() => onRespond(challenge.id, "accepted")}
            disabled={!canAfford}
          >
            Accept
          </button>
          <button
            type="button"
            className="nc-cancel-btn"
            onClick={() => onRespond(challenge.id, "rejected")}
          >
            Reject
          </button>
        </div>
        <div className="nc-hint">Challenge expires in 60 seconds.</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. ActiveChallenge — shown during in_progress and completed states
// ---------------------------------------------------------------------------
export function ActiveChallenge({
  challenge,
  userId,
  elapsedSeconds,
  distanceKm,
  distanceUnit,
  city,
  onSubmitFinish,
  onDismiss,
}) {
  const [sharing, setSharing] = useState(false);

  if (!challenge) return null;

  const isChallenger = Number(challenge.challenger_id) === Number(userId);
  const opponentName = isChallenger ? challenge.challenged_name : challenge.challenger_name;
  const myName = isChallenger ? challenge.challenger_name : challenge.challenged_name;
  const myFinished = isChallenger
    ? Boolean(challenge.challenger_time_seconds)
    : Boolean(challenge.challenged_time_seconds);
  const opponentFinished = isChallenger
    ? Boolean(challenge.challenged_time_seconds)
    : Boolean(challenge.challenger_time_seconds);
  const isWinner = challenge.winner_id && Number(challenge.winner_id) === Number(userId);

  const handleShare = async () => {
    setSharing(true);
    try {
      const winnerTime = isWinner
        ? (isChallenger ? challenge.challenger_time_seconds : challenge.challenged_time_seconds)
        : (isChallenger ? challenge.challenged_time_seconds : challenge.challenger_time_seconds);
      const loserTime = isWinner
        ? (isChallenger ? challenge.challenged_time_seconds : challenge.challenger_time_seconds)
        : (isChallenger ? challenge.challenger_time_seconds : challenge.challenged_time_seconds);

      const blob = await generateChallengeCard({
        winnerName: isWinner ? myName : opponentName,
        loserName: isWinner ? opponentName : myName,
        winnerTime,
        loserTime,
        distanceLabel: challenge.distance_label || "5K",
        distanceKm: Number(challenge.distance_km) || 5,
        xpWager: challenge.xp_wager,
        isWinner,
        city: city || "",
      });
      const caption = isWinner
        ? `I just beat ${opponentName} in a live ${challenge.distance_label} challenge on ExerVia 🏆 +${challenge.xp_wager} XP`
        : `Just had an epic ${challenge.distance_label} battle with ${opponentName} on ExerVia 💪`;
      await shareChallengeCard(blob, caption);
    } catch {
      // share failed silently
    } finally {
      setSharing(false);
    }
  };

  if (challenge.status === "completed") {
    return (
      <div className="nc-overlay nc-result-overlay" role="status" aria-live="assertive">
        <div className={`nc-card nc-result ${isWinner ? "nc-win" : "nc-loss"}`}>
          <div className="nc-result-icon" aria-hidden="true">{isWinner ? "🏆" : "💪"}</div>
          <div className="nc-result-label">{isWinner ? "You won!" : "They got you"}</div>
          <div className="nc-result-xp">
            {isWinner
              ? `+${challenge.xp_wager} XP`
              : `-${challenge.xp_wager} XP`}
          </div>
          <div className="nc-result-meta">
            <span>Your time: {isChallenger
              ? formatElapsed(challenge.challenger_time_seconds)
              : formatElapsed(challenge.challenged_time_seconds)}
            </span>
            <span>{opponentName}: {isChallenger
              ? formatElapsed(challenge.challenged_time_seconds)
              : formatElapsed(challenge.challenger_time_seconds)}
            </span>
          </div>
          <button
            type="button"
            className="nc-send-btn nc-share-btn"
            onClick={handleShare}
            disabled={sharing}
          >
            {sharing ? "Generating..." : isWinner ? "Share your win" : "Share the battle"}
          </button>
          <button type="button" className="nc-cancel-btn" onClick={onDismiss}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // in_progress or accepted
  const targetKm = Number(challenge.distance_km) || 5;
  const progressPct = Math.min(100, (distanceKm / targetKm) * 100);

  return (
    <div className="nc-active-bar" role="status" aria-live="polite">
      <div className="nc-active-row">
        <span className="nc-active-badge">LIVE BATTLE</span>
        <span className="nc-active-vs">{opponentName}</span>
        <span className="nc-active-wager">{challenge.xp_wager} XP</span>
      </div>
      <div className="nc-progress-track" aria-label={`${progressPct.toFixed(0)}% of challenge distance completed`}>
        <div className="nc-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="nc-active-meta">
        <span>{formatElapsed(elapsedSeconds)}</span>
        <span>{(distanceKm || 0).toFixed(2)} / {targetKm}km</span>
        {opponentFinished ? <span className="nc-opp-done">They finished!</span> : null}
      </div>
      {!myFinished ? (
        <button
          type="button"
          className="nc-send-btn nc-finish-btn"
          onClick={() => onSubmitFinish(challenge.id, elapsedSeconds)}
        >
          I finished!
        </button>
      ) : (
        <div className="nc-waiting-label">Waiting for {opponentName}...</div>
      )}
    </div>
  );
}
