// RivalsPanel.jsx
// Shows the user's head-to-head rivalry records.
// Sorted by most battles, with "RIVAL" badge at 3+ battles.
// Online indicators powered by active_runners Realtime.

import useRivals from "../hooks/useRivals";
import "./RivalsPanel.css";

function formatTimeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function WinRateBar({ wins, total }) {
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  return (
    <div className="rp-bar-track" aria-label={`Win rate ${pct}%`}>
      <div
        className={`rp-bar-fill ${pct >= 50 ? "winning" : "losing"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function RivalsPanel({ userId }) {
  const { rivals, loading, onlineRivalIds } = useRivals({ userId });

  if (loading) {
    return (
      <div className="rp-shell">
        <div className="rp-header">
          <span className="rp-kicker">RIVALRIES</span>
          <h3 className="rp-title">Head-to-head record</h3>
        </div>
        <div className="rp-skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rp-skeleton-card">
              <div className="rp-skeleton-avatar" />
              <div className="rp-skeleton-lines">
                <div className="rp-skeleton-name" />
                <div className="rp-skeleton-stats" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rivals.length) {
    return (
      <div className="rp-shell">
        <div className="rp-header">
          <span className="rp-kicker">RIVALRIES</span>
          <h3 className="rp-title">Head-to-head record</h3>
        </div>
        <div className="rp-empty">
          <div className="rp-empty-icon" aria-hidden="true">⚔️</div>
          <div className="rp-empty-title">No rivals yet</div>
          <div className="rp-empty-sub">
            Challenge nearby runners. After 3 battles the rivalry is locked in.
          </div>
        </div>
      </div>
    );
  }

  const topRivals = rivals.slice(0, 8);

  return (
    <div className="rp-shell">
      <div className="rp-header">
        <div>
          <span className="rp-kicker">RIVALRIES</span>
          <h3 className="rp-title">Head-to-head record</h3>
        </div>
        <div className="rp-header-meta">{rivals.length} opponent{rivals.length !== 1 ? "s" : ""}</div>
      </div>

      <div className="rp-list">
        {topRivals.map((r) => {
          const isOnline = onlineRivalIds.has(Number(r.opponent_id));
          const isRival = r.is_rival;
          const winRate = r.total_battles > 0
            ? Math.round((Number(r.wins) / Number(r.total_battles)) * 100)
            : 0;

          return (
            <div key={r.opponent_id} className={`rp-card ${isRival ? "rival" : ""}`}>
              <div className="rp-card-left">
                <div className="rp-avatar-wrap">
                  <div className="rp-avatar-placeholder" aria-hidden="true">
                    {String(r.opponent_name || "?").charAt(0).toUpperCase()}
                  </div>
                  {isOnline ? <span className="rp-online-dot" aria-label="Online now" /> : null}
                </div>
                <div className="rp-info">
                  <div className="rp-name-row">
                    <span className="rp-name">{r.opponent_name || "Runner"}</span>
                    {isRival ? <span className="rp-rival-badge">RIVAL</span> : null}
                    {isOnline ? <span className="rp-online-label">Online</span> : null}
                  </div>
                  <div className="rp-record">
                    <span className="rp-wins">{r.wins}W</span>
                    <span className="rp-sep">—</span>
                    <span className="rp-losses">{r.losses}L</span>
                    <span className="rp-total">· {r.total_battles} battles</span>
                  </div>
                  <WinRateBar wins={Number(r.wins)} total={Number(r.total_battles)} />
                </div>
              </div>
              <div className="rp-card-right">
                <div className="rp-winrate">{winRate}%</div>
                <div className="rp-winrate-label">win rate</div>
                <div className="rp-last-battle">{formatTimeAgo(r.last_battle_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {rivals.length > 8 ? (
        <div className="rp-more">+{rivals.length - 8} more opponents</div>
      ) : null}
    </div>
  );
}
