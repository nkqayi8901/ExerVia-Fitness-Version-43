// AchievementsPanel.jsx
// Trophy wall: earned achievements + locked preview.
// Fetches from get_my_achievements() and achievement_catalogue.
// Listens for "achievements_updated" DOM events to refresh.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { emitToast } from "../utils/toast";
import "./AchievementsPanel.css";

const CATEGORY_LABELS = {
  training:  "Training",
  running:   "Running",
  challenge: "Challenges",
  nutrition: "Nutrition",
  social:    "Community",
  streak:    "Streaks",
  xp:        "XP Milestones",
  special:   "Special",
};

function RarityBadge({ rarity }) {
  return <span className={`ach-rarity ach-rarity-${rarity}`}>{rarity}</span>;
}

function AchCard({ ach, earned }) {
  return (
    <div className={`ach-card ${earned ? "earned" : "locked"} rarity-${ach.rarity}`}>
      <div className="ach-icon">{earned ? ach.icon : "🔒"}</div>
      <div className="ach-body">
        <div className="ach-title">
          {earned ? ach.title : "???"}
          <RarityBadge rarity={ach.rarity} />
        </div>
        <div className="ach-desc">
          {earned ? ach.description : "Keep pushing to unlock this."}
        </div>
        {earned && ach.xp_reward > 0 && (
          <div className="ach-xp">⚡ +{ach.xp_reward.toLocaleString()} XP</div>
        )}
        {earned && ach.awarded_at && (
          <div className="ach-date">
            {new Date(ach.awarded_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AchievementsPanel({ userId }) {
  const [earned, setEarned]     = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [{ data: myAchs }, { data: cat }] = await Promise.all([
        supabase.rpc("get_my_achievements"),
        supabase.from("achievement_catalogue").select("*").eq("is_active", true).order("sort_order"),
      ]);

      // Mark unnotified achievements for toast
      const newOnes = (myAchs || []).filter((a) => !a.notified);
      if (newOnes.length) {
        newOnes.forEach((a) => emitToast(`${a.icon} Achievement unlocked: ${a.title}!`, "success", 4000));
        await supabase.rpc("mark_achievements_notified", {
          p_slugs: newOnes.map((a) => a.slug),
        });
      }

      // Build merged list: earned first (with awarded_at), then locked
      const earnedList = (myAchs || []).sort((a, b) => new Date(b.awarded_at) - new Date(a.awarded_at));
      setEarned(earnedList);
      setCatalogue(cat || []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener("achievements_updated", handler);
    return () => window.removeEventListener("achievements_updated", handler);
  }, [fetchAll]);

  // Build display list
  const earnedSlugs = new Set(earned.map((a) => a.slug));
  const catMap = Object.fromEntries(catalogue.map((c) => [c.slug, c]));

  // Merge earned with catalogue details
  const earnedWithDetails = earned.map((a) => ({
    ...catMap[a.slug],
    ...a,
  }));
  const locked = catalogue.filter((c) => !earnedSlugs.has(c.slug));

  const categories = ["all", ...Object.keys(CATEGORY_LABELS)];

  const filterFn = (item) =>
    activeCategory === "all" || item.category === activeCategory;

  const displayEarned = earnedWithDetails.filter(filterFn);
  const displayLocked = locked.filter(filterFn);

  const earnedCount = earned.length;
  const totalCount  = catalogue.length;
  const pct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <div className="ach-shell">
      {/* Header */}
      <div className="ach-header">
        <div className="ach-header-left">
          <div className="ach-kicker">Hall of Fame</div>
          <h3 className="ach-title">Achievements</h3>
        </div>
        <div className="ach-header-right">
          <div className="ach-count">{earnedCount} / {totalCount}</div>
          <div className="ach-count-label">unlocked</div>
        </div>
      </div>

      {/* Overall progress */}
      <div className="ach-overall">
        <div className="ach-overall-track">
          <div className="ach-overall-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="ach-overall-label">{pct}% complete</div>
      </div>

      {/* Category tabs */}
      <div className="ach-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`ach-tab ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ach-skeleton">
          {[1, 2, 3, 4].map((i) => <div key={i} className="ach-skeleton-card" />)}
        </div>
      ) : (
        <div className="ach-list">
          {displayEarned.length === 0 && displayLocked.length === 0 && (
            <div className="ach-empty">No achievements in this category yet.</div>
          )}

          {/* Earned section */}
          {displayEarned.length > 0 && (
            <>
              <div className="ach-section-label">
                Earned ({displayEarned.length})
              </div>
              {displayEarned.map((a) => (
                <AchCard key={a.slug} ach={a} earned={true} />
              ))}
            </>
          )}

          {/* Locked section */}
          {displayLocked.length > 0 && (
            <>
              <div className="ach-section-label locked-label">
                Locked ({displayLocked.length})
              </div>
              {displayLocked.map((a) => (
                <AchCard key={a.slug} ach={a} earned={false} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
