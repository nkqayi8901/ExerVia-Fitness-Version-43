// CityLeaderboard.jsx
// Monthly city challenge leaderboard + global all-time rankings.
// Two tabs: City (filtered to user's city) and Global.
// Own entry is highlighted. Rank badge animates for top 3.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import "./CityLeaderboard.css";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function currentMonthLabel() {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="cl-badge gold" aria-label="Rank 1">🥇</span>;
  if (rank === 2) return <span className="cl-badge silver" aria-label="Rank 2">🥈</span>;
  if (rank === 3) return <span className="cl-badge bronze" aria-label="Rank 3">🥉</span>;
  return <span className="cl-rank-num">#{rank}</span>;
}

export default function CityLeaderboard({ userId, userCity }) {
  const [tab, setTab] = useState(userCity ? "city" : "global");
  const [cityRows, setCityRows] = useState([]);
  const [globalRows, setGlobalRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userCityLocal, setUserCityLocal] = useState(userCity || "");
  const [cosmetics, setCosmetics] = useState({});

  // If userCity not passed, fetch it
  useEffect(() => {
    if (userCity) { setUserCityLocal(userCity); return; }
    if (!userId) return;
    supabase
      .from("user_profiles")
      .select("city")
      .eq("id", Number(userId))
      .maybeSingle()
      .then(({ data }) => {
        if (data?.city) setUserCityLocal(data.city);
      });
  }, [userId, userCity]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const fetchBoth = async () => {
      try {
        const [cityRes, globalRes] = await Promise.all([
          userCityLocal
            ? supabase
                .from("city_challenge_leaderboard")
                .select("city,user_id,display_name,total_xp,monthly_wins,monthly_losses,monthly_battles,city_rank")
                .eq("city", userCityLocal)
                .order("city_rank", { ascending: true })
                .limit(50)
            : Promise.resolve({ data: [] }),
          supabase
            .from("global_challenge_leaderboard")
            .select("user_id,display_name,city,total_xp,total_wins,total_losses,win_rate_pct,global_rank")
            .order("global_rank", { ascending: true })
            .limit(50),
        ]);
        if (Array.isArray(cityRes.data))   setCityRows(cityRes.data);
        if (Array.isArray(globalRes.data)) setGlobalRows(globalRes.data);

        // Batch-load flairs/titles for all visible users
        const allIds = [
          ...(cityRes.data || []).map((r) => Number(r.user_id)),
          ...(globalRes.data || []).map((r) => Number(r.user_id)),
        ].filter((v, i, a) => a.indexOf(v) === i);

        if (allIds.length > 0) {
          const { data: cosData } = await supabase.rpc("get_user_cosmetics", { p_user_ids: allIds });
          if (Array.isArray(cosData)) {
            const map = {};
            cosData.forEach((c) => { map[c.user_id] = c; });
            setCosmetics(map);
          }
        }
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    };
    fetchBoth();
  }, [userId, userCityLocal]);

  const rows = tab === "city" ? cityRows : globalRows;
  const rankField = tab === "city" ? "city_rank" : "global_rank";
  const winsField = tab === "city" ? "monthly_wins" : "total_wins";
  const lossesField = tab === "city" ? "monthly_losses" : "total_losses";

  return (
    <div className="cl-shell">
      <div className="cl-header">
        <div>
          <span className="cl-kicker">LEADERBOARD</span>
          <h3 className="cl-title">
            {tab === "city"
              ? `${userCityLocal || "City"} · ${currentMonthLabel()}`
              : "Global · All time"}
          </h3>
        </div>
        <div className="cl-tabs" role="tablist">
          {userCityLocal ? (
            <button
              type="button"
              role="tab"
              className={`cl-tab ${tab === "city" ? "active" : ""}`}
              onClick={() => setTab("city")}
              aria-selected={tab === "city"}
            >
              {userCityLocal}
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            className={`cl-tab ${tab === "global" ? "active" : ""}`}
            onClick={() => setTab("global")}
            aria-selected={tab === "global"}
          >
            Global
          </button>
        </div>
      </div>

      {loading ? (
        <div className="cl-skeleton-list">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="cl-skeleton-row">
              <div className="cl-skeleton-rank" />
              <div className="cl-skeleton-avatar" />
              <div className="cl-skeleton-info">
                <div className="cl-skeleton-name" />
                <div className="cl-skeleton-stat" />
              </div>
              <div className="cl-skeleton-xp" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="cl-empty">
          <div className="cl-empty-icon" aria-hidden="true">🏙️</div>
          <div className="cl-empty-title">
            {tab === "city" ? "No battles in your city yet" : "No battles recorded yet"}
          </div>
          <div className="cl-empty-sub">
            {tab === "city"
              ? `Be the first to challenge in ${userCityLocal || "your city"} this month.`
              : "Complete a challenge to appear on the global board."}
          </div>
        </div>
      ) : (
        <div className="cl-list">
          {rows.map((row) => {
            const isSelf = Number(row.user_id) === Number(userId);
            const rank = Number(row[rankField]);
            const wins = Number(row[winsField] || 0);
            const losses = Number(row[lossesField] || 0);
            const total = wins + losses;
            const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
            const cos = cosmetics[row.user_id] || {};

            return (
              <div
                key={row.user_id}
                className={`cl-row ${isSelf ? "self" : ""} ${rank <= 3 ? "top3" : ""}`}
                aria-current={isSelf ? "true" : undefined}
              >
                <div className="cl-rank">
                  <RankBadge rank={rank} />
                </div>
                <div className="cl-avatar-wrap">
                  <div className="cl-avatar-placeholder" aria-hidden="true">
                    {String(row.display_name || "?").charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="cl-info">
                  <div className="cl-name">
                    {row.display_name || "Runner"}
                    {cos.flair ? <span className="exervia-flair" title={`${cos.rarity} flair`}>{cos.flair}</span> : null}
                    {isSelf ? <span className="cl-you-tag">You</span> : null}
                  </div>
                  {cos.title ? <div className="exervia-title-badge">{cos.title}</div> : null}
                  {row.city && tab === "global"
                    ? <div className="cl-city">{row.city}</div>
                    : null}
                  <div className="cl-record">
                    <span className="cl-w">{wins}W</span>
                    <span className="cl-dash">—</span>
                    <span className="cl-l">{losses}L</span>
                    {total > 0 ? <span className="cl-pct">· {winRate}%</span> : null}
                  </div>
                </div>
                <div className="cl-xp-col">
                  <div className="cl-xp">{Number(row.total_xp || 0).toLocaleString()}</div>
                  <div className="cl-xp-label">XP</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && rows.length > 0 && tab === "city" ? (
        <div className="cl-resets">Resets {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
      ) : null}
    </div>
  );
}
