import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from '../supabaseClient';
import ModeNav from "./ModeNav";
// Component: Navbar - UI layout and interactions.
// This component renders the navbar experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the main navigation bar that is shown at the top of the app when a user is logged in
// it shows the app logo and name, the current mode (gym or athlete),
// the user's level, rank, and XP, and an account menu with profile and logout options
// the UI layout and styling was adapted from Tailwind components found on https://tailwindui.com/preview
// the data fetching and state management logic was adapted from the patterns I learned in the SystemStatus component
// the account menu is accessible by clicking on the user's name or avatar in the top right corner
// the menu provides options to view the user's profile, go to profile settings, or log out

export default function Navbar({ modeLabel = "SYSTEM", mode = null, userId = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userState, setUserState] = useState(null);
  const [account, setAccount] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef(null);
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
  const messagesPath = mode === "gym"
    ? `/gym/${resolvedUserId || ""}/messages`
    : `/athlete/${resolvedUserId || ""}/messages`;
  const messageFabInlineStyle = {
    position: "fixed",
    right: "16px",
    bottom: "max(4px, env(safe-area-inset-bottom, 0px))",
    top: "auto",
    left: "auto",
  };
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
  const accountUsernameLabel = useMemo(() => {
    const normalized = String(account?.username || "").trim().replace(/^@+/, "");
    return normalized ? `@${normalized}` : "@username";
  }, [account?.username]);

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
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout failed:", error.message);
    }
    localStorage.removeItem("exervia_user_id");
    localStorage.removeItem("exervia_username");
    localStorage.removeItem("exervia_display_name");
    localStorage.removeItem("exervia_auth_uid");
    localStorage.removeItem("exervia_active_mode");
    setMenuOpen(false);
    navigate("/auth", { replace: true });
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

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!accountRef.current) return;
      if (!accountRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);


  return (
    <>
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

      <div className="hud-account" ref={accountRef}>
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
                <span className="hud-account-username">{accountUsernameLabel}</span>
              </span>
            </button>
            {menuOpen && (
              <div className="hud-account-menu" role="menu">
                <button className="hud-account-action" type="button" role="menuitem" onClick={() => navigate(resolveProfilePath())}>
                  Profile
                </button>
                <button className="hud-account-action" type="button" role="menuitem" onClick={() => navigate("/settings")}>
                  Profile Settings
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
    {mode && resolvedUserId ? (
      <button
        type="button"
        className="hud-message-fab"
        style={messageFabInlineStyle}
        onClick={() => navigate(messagesPath)}
        aria-label="Open messages"
        title="Messages"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4 4v-4.2A2.5 2.5 0 0 1 4 13.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    ) : null}
    </>
  );
}
