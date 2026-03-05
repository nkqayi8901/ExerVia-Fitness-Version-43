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
  const NOTIFICATION_RETENTION_DAYS = 14;
  const NOTIFICATION_DISPLAY_LIMIT = 15;
  const navigate = useNavigate();
  const location = useLocation();
  const [userState, setUserState] = useState(null);
  const [account, setAccount] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const accountRef = useRef(null);
  const notifRef = useRef(null);
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
  const notificationSeenKey = `exervia_notifications_seen_${resolvedUserId || ""}`;
  const notificationClearedKey = `exervia_notifications_cleared_${resolvedUserId || ""}`;
  const communityPath = mode === "gym"
    ? `/gym/${resolvedUserId || ""}/community`
    : `/athlete/${resolvedUserId || ""}/community`;

  const fetchNotifications = async () => {
    if (!resolvedUserId) {
      setNotifications([]);
      setUnreadNotifCount(0);
      return;
    }
    try {
      const [friendRes, messageRes, myPostsRes] = await Promise.all([
        supabase
          .from("community_friends")
          .select("id,user_id,friend_user_id,status,created_at")
          .or(`user_id.eq.${resolvedUserId},friend_user_id.eq.${resolvedUserId}`)
          .in("status", ["pending_low", "pending_high"])
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("community_friend_messages")
          .select("id,user_id,friend_user_id,body,created_at")
          .eq("friend_user_id", resolvedUserId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("community_posts")
          .select("id")
          .eq("created_by", resolvedUserId)
          .limit(60),
      ]);

      const postIds = (myPostsRes.data || []).map((row) => row.id);
      let replyRows = [];
      if (postIds.length) {
        const { data } = await supabase
          .from("community_post_replies")
          .select("id,post_id,created_by,body,created_at")
          .in("post_id", postIds)
          .neq("created_by", resolvedUserId)
          .order("created_at", { ascending: false })
          .limit(20);
        replyRows = data || [];
      }

      const profileIds = new Set();
      (friendRes.data || []).forEach((row) => {
        profileIds.add(Number(row.user_id));
        profileIds.add(Number(row.friend_user_id));
      });
      (messageRes.data || []).forEach((row) => profileIds.add(Number(row.user_id)));
      replyRows.forEach((row) => profileIds.add(Number(row.created_by)));
      profileIds.delete(Number(resolvedUserId));

      let profileMap = {};
      if (profileIds.size) {
        const { data: profileRows } = await supabase
          .from("user_profiles")
          .select("id,username,display_name,full_name")
          .in("id", Array.from(profileIds));
        profileMap = (profileRows || []).reduce((acc, row) => {
          const label = row?.username ? `@${row.username}` : row?.display_name || row?.full_name || `User ${row?.id}`;
          acc[Number(row.id)] = label;
          return acc;
        }, {});
      }

      const requestItems = (friendRes.data || [])
        .filter((row) => {
          const uid = Number(row.user_id);
          const fid = Number(row.friend_user_id);
          const me = Number(resolvedUserId);
          return (row.status === "pending_low" && fid === me) || (row.status === "pending_high" && uid === me);
        })
        .map((row) => {
          const senderId = Number(row.status === "pending_low" ? row.user_id : row.friend_user_id);
          return {
            id: `request-${row.id}`,
            kind: "friend_request",
            actorId: senderId,
            actor: profileMap[senderId] || `User ${senderId}`,
            text: "sent you a friend request",
            created_at: row.created_at,
            targetPath: messagesPath,
          };
        });

      const messageItems = (messageRes.data || []).map((row) => {
        const senderId = Number(row.user_id);
        return {
          id: `message-${row.id}`,
          kind: "message",
          actorId: senderId,
          actor: profileMap[senderId] || `User ${senderId}`,
          text: String(row.body || "sent a message"),
          created_at: row.created_at,
          targetPath: `${messagesPath}?friend=${senderId}`,
        };
      });

      const replyItems = replyRows.map((row) => {
        const senderId = Number(row.created_by);
        return {
          id: `reply-${row.id}`,
          kind: "reply",
          actorId: senderId,
          actor: profileMap[senderId] || `User ${senderId}`,
          text: "replied to your forum post",
          created_at: row.created_at,
          targetPath: communityPath,
        };
      });

      const retentionCutoffMs = Date.now() - (NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const clearedAtRaw = localStorage.getItem(notificationClearedKey);
      const clearedAtMs = clearedAtRaw ? new Date(clearedAtRaw).getTime() : 0;
      const activeCutoffMs = Math.max(retentionCutoffMs, Number.isFinite(clearedAtMs) ? clearedAtMs : 0);

      const merged = [...requestItems, ...messageItems, ...replyItems]
        .filter((item) => new Date(item.created_at || 0).getTime() > activeCutoffMs)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, NOTIFICATION_DISPLAY_LIMIT);
      setNotifications(merged);

      const seenAtRaw = localStorage.getItem(notificationSeenKey);
      const seenAtMs = seenAtRaw ? new Date(seenAtRaw).getTime() : 0;
      const unread = merged.filter((item) => new Date(item.created_at || 0).getTime() > seenAtMs).length;
      setUnreadNotifCount(unread);
    } catch (error) {
      console.error("Notification fetch failed:", error);
    }
  };

  const clearNotifications = () => {
    const nowIso = new Date().toISOString();
    localStorage.setItem(notificationClearedKey, nowIso);
    localStorage.setItem(notificationSeenKey, nowIso);
    setNotifications([]);
    setUnreadNotifCount(0);
  };

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
    setNotifOpen(false);
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

  useEffect(() => {
    if (!notifOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [notifOpen]);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId, location.pathname]);


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
            <div className="hud-notif-wrap" ref={notifRef}>
              <button
                type="button"
                className={`hud-notif-btn ${notifOpen ? "active" : ""}`}
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) {
                    const nowIso = new Date().toISOString();
                    localStorage.setItem(notificationSeenKey, nowIso);
                    setUnreadNotifCount(0);
                  }
                }}
                aria-label="Open notifications"
              >
                <span className="hud-notif-icon" aria-hidden="true">🔔</span>
                {unreadNotifCount > 0 ? (
                  <span className="hud-notif-badge">{Math.min(unreadNotifCount, 99)}</span>
                ) : null}
              </button>
              <button
                type="button"
                className={`hud-settings-btn ${notifOpen ? "hidden" : ""}`}
                onClick={() => navigate("/settings")}
                aria-label="Open profile settings"
                title="Profile settings"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8.2 3.8a7.6 7.6 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8.2 8.2 0 0 0-1.8-1l-.3-2.6h-4l-.3 2.6a8.2 8.2 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8.2 8.2 0 0 0 1.8 1l.3 2.6h4l.3-2.6a8.2 8.2 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {notifOpen && (
                <div className="hud-notif-menu" role="menu">
                  <div className="hud-notif-title-row">
                    <div className="hud-notif-title">Notifications</div>
                    <button type="button" className="hud-notif-clear" onClick={clearNotifications}>
                      Clear
                    </button>
                  </div>
                  {!notifications.length ? (
                    <div className="hud-notif-empty">No new activity.</div>
                  ) : (
                    <div className="hud-notif-list">
                      {notifications.slice(0, 10).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="hud-notif-item"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate(item.targetPath);
                          }}
                        >
                          <span className="hud-notif-item-main">
                            <span className="hud-notif-item-actor">{item.actor}</span>
                            <span className="hud-notif-item-text">{item.text}</span>
                          </span>
                          <span className="hud-notif-item-time">
                            {new Date(item.created_at || 0).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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




