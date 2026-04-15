// DailyQuests.jsx
// Shows today's 3 daily quests, progress, and claim button.
// Quests are assigned server-side via assign_daily_quests() RPC.
// Progress updates come from update_quest_progress() called by other parts of the app.
// XP is claimed via claim_quest_reward() — respects active boosts.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { emitToast } from "../utils/toast";
import "./DailyQuests.css";

function timeUntilMidnightUTC() {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  const ms = midnight - now;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `Resets in ${h}h ${m}m`;
  return `Resets in ${m}m`;
}

function ProgressBar({ progress, target, complete, difficulty }) {
  const pct = complete ? 100 : Math.round((progress / Math.max(target, 1)) * 100);
  return (
    <>
      <div className="dq-progress-track">
        <div
          className="dq-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="dq-progress-label">
        {complete ? "Complete!" : `${progress} / ${target}`}
      </div>
    </>
  );
}

export default function DailyQuests({ userId, mode = "athlete", onXpClaimed }) {
  const [quests, setQuests] = useState([]);
  const [catalogue, setCatalogue] = useState({});
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [resetLabel, setResetLabel] = useState("");

  const fetchQuests = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Assign today's quests (idempotent — returns existing if already assigned)
      const { data: assigned, error } = await supabase.rpc("assign_daily_quests", {
        p_mode: mode,
      });
      if (error) throw error;

      if (!assigned || assigned.length === 0) {
        setQuests([]);
        setLoading(false);
        return;
      }

      // Fetch catalogue details for the assigned quest IDs
      const questIds = assigned.map((q) => q.quest_id);
      const { data: catData } = await supabase
        .from("quest_catalogue")
        .select("id, title, description, icon, category, xp_reward, target_value, unit, difficulty")
        .in("id", questIds);

      const catMap = {};
      (catData || []).forEach((c) => { catMap[c.id] = c; });
      setCatalogue(catMap);
      setQuests(assigned);
    } catch (err) {
      emitToast("Could not load daily quests.", "error");
    } finally {
      setLoading(false);
    }
  }, [userId, mode]);

  useEffect(() => {
    fetchQuests();
    // Refresh reset label every minute
    setResetLabel(timeUntilMidnightUTC());
    const timer = setInterval(() => setResetLabel(timeUntilMidnightUTC()), 60000);
    return () => clearInterval(timer);
  }, [fetchQuests]);

  // Listen for progress updates triggered by other components
  useEffect(() => {
    const handler = () => fetchQuests();
    window.addEventListener("quest_progress_updated", handler);
    return () => window.removeEventListener("quest_progress_updated", handler);
  }, [fetchQuests]);

  const handleClaim = async (quest) => {
    if (claiming || !quest.is_complete || quest.is_claimed) return;
    setClaiming(quest.id);
    try {
      const { data, error } = await supabase.rpc("claim_quest_reward", {
        p_user_quest_id: quest.id,
      });
      if (error || !data?.ok) {
        emitToast(data?.error || "Could not claim reward.", "error");
        return;
      }
      emitToast(`${data.icon} +${data.awarded_xp} XP — ${data.quest_title}!`, "success", 4000);
      // Update local state immediately
      setQuests((prev) =>
        prev.map((q) => q.id === quest.id ? { ...q, is_claimed: true } : q)
      );
      window.dispatchEvent(new CustomEvent("user_state_updated"));
      if (onXpClaimed) onXpClaimed(data.awarded_xp);
      // Fire achievement check after quest claim (fire-and-forget)
      supabase.rpc("check_and_award_achievements").then(() => {
        window.dispatchEvent(new CustomEvent("achievements_updated"));
      });
    } catch {
      emitToast("Claim failed. Try again.", "error");
    } finally {
      setClaiming(null);
    }
  };

  const totalXp = quests.reduce((sum, q) => {
    const cat = catalogue[q.quest_id];
    return sum + (cat?.xp_reward || 0);
  }, 0);
  const completedCount = quests.filter((q) => q.is_complete).length;
  const claimedCount = quests.filter((q) => q.is_claimed).length;
  const allClaimed = quests.length > 0 && claimedCount === quests.length;

  return (
    <div className="dq-shell">
      <div className="dq-header">
        <div className="dq-header-left">
          <div className="dq-kicker">Daily Quests</div>
          <h3 className="dq-title">Today's Missions</h3>
        </div>
        <div className="dq-header-right">
          <div className="dq-xp-total">⚡ {totalXp.toLocaleString()} XP</div>
          <div className="dq-xp-label">available today</div>
          {resetLabel ? <div className="dq-resets">{resetLabel}</div> : null}
        </div>
      </div>

      {/* Overall progress bar */}
      {quests.length > 0 && (
        <div className="dq-overall-progress">
          <div className="dq-overall-track">
            <div
              className="dq-overall-fill"
              style={{ width: `${Math.round((completedCount / quests.length) * 100)}%` }}
            />
          </div>
          <div className="dq-overall-label">
            <span>{completedCount}/{quests.length} complete</span>
            <span>{claimedCount} claimed</span>
          </div>
        </div>
      )}

      {/* All done banner */}
      {allClaimed && (
        <div className="dq-all-done">
          <div className="dq-all-done-icon">🏆</div>
          <div className="dq-all-done-title">All quests conquered!</div>
          <div className="dq-all-done-sub">Come back tomorrow for a new set. Keep the streak alive.</div>
        </div>
      )}

      {loading ? (
        <div className="dq-skeleton">
          {[1, 2, 3].map((i) => <div key={i} className="dq-skeleton-card" />)}
        </div>
      ) : (
        <div className="dq-list">
          {quests.map((quest) => {
            const cat = catalogue[quest.quest_id];
            if (!cat) return null;
            const pct = quest.is_complete
              ? 100
              : Math.round((quest.progress / Math.max(cat.target_value, 1)) * 100);

            return (
              <div
                key={quest.id}
                className={`dq-card diff-${cat.difficulty} ${quest.is_complete ? "complete" : ""} ${quest.is_claimed ? "claimed" : ""}`}
              >
                <div className="dq-icon">{cat.icon}</div>
                <div className="dq-body">
                  <div className="dq-card-title">
                    {cat.title}
                    <span className={`dq-diff-badge dq-diff-${cat.difficulty}`}>
                      {cat.difficulty}
                    </span>
                  </div>
                  <div className="dq-desc">{cat.description}</div>
                  <ProgressBar
                    progress={quest.progress}
                    target={cat.target_value}
                    complete={quest.is_complete}
                    difficulty={cat.difficulty}
                  />
                </div>
                <div className="dq-right">
                  <div className="dq-xp-badge">
                    ⚡{cat.xp_reward}
                  </div>
                  {quest.is_claimed ? (
                    <span className="dq-claimed-badge">✓ Claimed</span>
                  ) : quest.is_complete ? (
                    <button
                      className="dq-claim-btn"
                      type="button"
                      onClick={() => handleClaim(quest)}
                      disabled={claiming === quest.id}
                    >
                      {claiming === quest.id ? "…" : "Claim"}
                    </button>
                  ) : (
                    <span className="dq-complete-check" style={{ color: "rgba(255,255,255,0.15)" }}>○</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
