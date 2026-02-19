import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from '../supabaseClient';
import ModeNav from "./ModeNav";
// Component: Navbar - UI layout and interactions.
// This component renders the navbar experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

export default function Navbar({ modeLabel = "SYSTEM", mode = null, userId = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userState, setUserState] = useState(null);
  const [account, setAccount] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const xp = userState?.xp ?? 0;
  const level = userState?.level ?? 1;
  const rank = userState?.rank ?? "E";
  const safeLevel = Math.max(1, level);
  const levelStartXp = 100 * Math.pow(safeLevel - 1, 2);
  const nextLevelXp = 100 * Math.pow(safeLevel, 2);
  const levelSpan = Math.max(1, nextLevelXp - levelStartXp);
  const levelProgressPct = Math.max(
    0,
    Math.min(100, Math.round(((xp - levelStartXp) / levelSpan) * 100))
  );
  const resolvedUserId = userId || localStorage.getItem('exervia_user_id');
  const initials = useMemo(() => {
    const source = account?.display_name || account?.username || "Athlete";
    return String(source)
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [account]);

// fetchUserState manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchUserState = async () => {
    const localUserId = localStorage.getItem('exervia_user_id');
    if (!localUserId) return;

    const { data, error } = await supabase
      .from('user_state')
      .select('*')
      .eq('user_id', localUserId)
      .single();

    if (!error && data) setUserState(data);
  };

  const fetchAccount = async () => {
    if (!resolvedUserId) {
      setAccount(null);
      return;
    }
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, display_name, username, email")
      .eq("id", resolvedUserId)
      .single();
    if (data) {
      setAccount(data);
      localStorage.setItem("exervia_username", String(data.username || ""));
      localStorage.setItem("exervia_display_name", String(data.display_name || data.full_name || ""));
    }
  };

  const resolveProfilePath = () => {
    if (!resolvedUserId) return "/auth";
    const activeMode = mode || localStorage.getItem("exervia_active_mode") || "athlete";
    return activeMode === "gym"
      ? `/gym/${resolvedUserId}/profile`
      : `/athlete/${resolvedUserId}/profile`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("exervia_user_id");
    localStorage.removeItem("exervia_username");
    localStorage.removeItem("exervia_display_name");
    localStorage.removeItem("exervia_auth_uid");
    localStorage.removeItem("exervia_active_mode");
    setMenuOpen(false);
    navigate("/auth");
  };

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    fetchUserState();
    fetchAccount();

// handler manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const handler = () => {
      fetchUserState();
    };
    window.addEventListener("user_state_updated", handler);

    // Render
    return () => window.removeEventListener("user_state_updated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);


  return (
    <nav className="hud-topbar">
      <div className="hud-brand">
        <div className="hud-logo">E</div>
        <div>
          <div className="hud-title">ExerVia</div>
          <div className="hud-subtitle">{modeLabel}</div>
        </div>
      </div>

      {mode && userId && (
        <ModeNav mode={mode} userId={userId} placement="inline" />
      )}

      <div className="hud-stats">
        <div className="hud-stats-row">
          <div className="hud-pill">
            <span className="hud-dim">LV</span>
            <span className="hud-strong">{level}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-dim">RANK</span>
            <span className="hud-strong">{rank}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-dim">XP</span>
            <span className="hud-strong">{xp}</span>
          </div>
        </div>
        <div className="hud-progress-inline" aria-label={`Level progress ${levelProgressPct}%`}>
          <span className="hud-progress-lv">LV {safeLevel}</span>
          <div className="hud-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelProgressPct}>
            <div className="hud-progress-fill" style={{ width: `${levelProgressPct}%` }} />
          </div>
          <span className="hud-progress-lv">LV {safeLevel + 1}</span>
        </div>
      </div>

      <div className="hud-account">
        {resolvedUserId ? (
          <>
            <button
              type="button"
              className="hud-account-trigger"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="hud-account-avatar">{initials || "A"}</span>
              <span className="hud-account-copy">
                <span className="hud-account-name">{account?.display_name || account?.full_name || "Athlete"}</span>
                <span className="hud-account-username">@{account?.username || "username"}</span>
              </span>
            </button>
            {menuOpen && (
              <div className="hud-account-menu" role="menu">
                <button className="hud-account-action" type="button" role="menuitem" onClick={() => navigate(resolveProfilePath())}>
                  Profile
                </button>
                <button className="hud-account-action danger" type="button" role="menuitem" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </>
        ) : (
          <button type="button" className="studio-back hud-account-signin" onClick={() => navigate("/auth")}>
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
