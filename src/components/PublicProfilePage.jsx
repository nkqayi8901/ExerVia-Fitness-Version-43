import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
// Component: PublicProfilePage - UI layout and interactions.
// This component renders the publicprofilepage experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the public profile page which shows a user's profile information,
// their groups, and recent training sessions
// this page is accessible from the community section of both gym and athlete modes by clicking on a user's name or avatar
// the UI layout and styling was adapted from Tailwind card components found on https://tailwindui.com/preview
// the data fetching and state management logic was adapted from the patterns I learned in the SystemStatus and Navbar components

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "";
  }
};

export default function PublicProfilePage({ mode = "athlete", viewerId }) {
  const navigate = useNavigate();
  const { id, targetId } = useParams();
  const currentUserId = Number(viewerId || id);
  const viewedUserId = Number(targetId);
  const [profile, setProfile] = useState(null);
  const [userState, setUserState] = useState(null);
  const [groups, setGroups] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [friendStatus, setFriendStatus] = useState("none");
  const [banner, setBanner] = useState("");
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const withTimeout = async (promise, timeoutMs, label = "Request timed out") => {
    let timeoutHandle = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  const backPath = mode === "gym" ? `/gym/${id}/community` : `/athlete/${id}/community`;
  const isSelf = currentUserId === viewedUserId;

  const handleLabel = useMemo(() => {
    const username = String(profile?.username || "").trim().replace(/^@+/, "");
    if (username) return `@${username}`;
    if (isSelf) {
      const fullName = String(profile?.full_name || "").trim();
      if (fullName) return fullName;
    }
    const display = String(profile?.display_name || "").trim();
    if (display) return display;
    return "Athlete";
  }, [isSelf, profile]);

  const joinedGroupSummary = useMemo(() => {
    if (!groups.length) return "No groups joined yet.";
    return groups.slice(0, 4).map((group) => group.name).join(" · ");
  }, [groups]);

  const fetchFriendStatus = async () => {
    if (!currentUserId || !viewedUserId || isSelf) return;
    const low = Math.min(currentUserId, viewedUserId);
    const high = Math.max(currentUserId, viewedUserId);
    const { data } = await supabase
      .from("community_friends")
      .select("status,user_id,friend_user_id")
      .eq("user_id", low)
      .eq("friend_user_id", high)
      .maybeSingle();
    if (!data) {
      setFriendStatus("none");
      return;
    }
    if (data.status === "accepted") {
      setFriendStatus("accepted");
      return;
    }
    const requesterIsCurrent =
      (data.status === "pending_low" && Number(data.user_id) === currentUserId) ||
      (data.status === "pending_high" && Number(data.friend_user_id) === currentUserId);
    setFriendStatus(requesterIsCurrent ? "outgoing" : "incoming");
  };

  const fetchData = async () => {
    if (!viewedUserId) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    const cacheKey = `exervia_public_profile_${viewedUserId}`;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.profile) {
          setProfile(cached.profile || null);
          setUserState(cached.userState || null);
          setGroups(Array.isArray(cached.groups) ? cached.groups : []);
          setRecentSessions(Array.isArray(cached.recentSessions) ? cached.recentSessions : []);
        }
      }
    } catch {
      // ignore cache parse failures
    }

    try {
      const [
        { data: profileData },
        { data: stateData },
        { data: memberships },
        { data: sessions },
        { data: strengthRows },
        { data: activityRows },
      ] = await withTimeout(
        Promise.all([
          supabase
            .from("user_profiles")
            .select("id, full_name, display_name, username, fitness_level, primary_goal")
            .eq("id", viewedUserId)
            .maybeSingle(),
          supabase.from("user_state").select("*").eq("user_id", viewedUserId).maybeSingle(),
          supabase
            .from("community_group_members")
            .select("group_id, role, community_groups(name)")
            .eq("user_id", viewedUserId)
            .limit(12),
          supabase
            .from("training_sessions")
            .select("id, sport, duration_minutes, created_at")
            .eq("user_id", viewedUserId)
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("strength_logs")
            .select("id, exercise_name, sets, reps, weight, created_at")
            .eq("user_id", viewedUserId)
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("daily_activity")
            .select("id, activity_type, activity_date, created_at")
            .eq("user_id", viewedUserId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]),
        7000,
        "Public profile load timed out"
      );
      if (requestRef.current !== requestId) return;

      const mappedGroups = (memberships || []).map((row) => ({
        id: row.group_id,
        name: row.community_groups?.name || "Group",
        role: row.role || "member",
      }));

      setProfile(profileData || null);
      setUserState(stateData || null);
      setGroups(mappedGroups);
      const combinedRecent = [
        ...(sessions || []).map((row) => ({
          id: String(row.id),
          sourceType: "training",
          title: String(row.sport || "Training").toUpperCase(),
          subtitle: `${Number(row.duration_minutes || 0)} min`,
          created_at: row.created_at,
        })),
        ...(strengthRows || []).map((row) => ({
          id: String(row.id),
          sourceType: "strength",
          title: String(row.exercise_name || "Strength").toUpperCase(),
          subtitle: `${Number(row.sets || 0)} sets · ${row.reps || 0} reps${
            Number(row.weight || 0) > 0 ? ` · ${row.weight} kg` : ""
          }`,
          created_at: row.created_at,
        })),
      ]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 3);
      const fallbackRecent = (activityRows || [])
        .filter((row) => {
          const type = String(row.activity_type || "").trim().toLowerCase();
          return type === "training_session" || type === "logs_activity" || type === "session_completion";
        })
        .map((row) => {
          const type = String(row.activity_type || "").trim().toLowerCase();
          const title =
            type === "training_session"
              ? "TRAINING"
              : type === "session_completion"
                ? "SESSION COMPLETE"
                : "TRAINING LOGGED";
          return {
            id: String(row.id),
            sourceType: "activity",
            title,
            subtitle: "Activity log entry",
            originLabel: "From activity feed",
            created_at: row.created_at || row.activity_date,
          };
        })
        .slice(0, 3);
      const recentToShow = combinedRecent.length ? combinedRecent : fallbackRecent;
      setRecentSessions(recentToShow);
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          profile: profileData || null,
          userState: stateData || null,
          groups: mappedGroups,
          recentSessions: recentToShow,
        })
      );
      await withTimeout(fetchFriendStatus(), 3000, "Friend status timed out");
    } catch (error) {
      console.error("PublicProfilePage load failed:", error);
      if (!profile) {
        setBanner("Could not fully load profile right now.");
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedUserId, currentUserId]);

  const handleAddFriend = async () => {
    if (!currentUserId || !viewedUserId || isSelf) return;
    const orderedUserId = Math.min(currentUserId, viewedUserId);
    const orderedFriendId = Math.max(currentUserId, viewedUserId);
    const requesterIsLower = currentUserId === orderedUserId;
    const { error } = await supabase.from("community_friends").insert([
      {
        user_id: orderedUserId,
        friend_user_id: orderedFriendId,
        status: requesterIsLower ? "pending_low" : "pending_high",
      },
    ]);
    if (error && error.code !== "23505") {
      setBanner(error.message || "Could not send friend request.");
      return;
    }
    setFriendStatus("outgoing");
    setBanner("Friend request sent.");
  };

  const handleApproveRequest = async () => {
    const low = Math.min(currentUserId, viewedUserId);
    const high = Math.max(currentUserId, viewedUserId);
    const { error } = await supabase
      .from("community_friends")
      .update({ status: "accepted" })
      .eq("user_id", low)
      .eq("friend_user_id", high);
    if (error) {
      setBanner(error.message || "Could not approve request.");
      return;
    }
    setFriendStatus("accepted");
    setBanner("Message request approved.");
  };

  const handleRejectRequest = async () => {
    const low = Math.min(currentUserId, viewedUserId);
    const high = Math.max(currentUserId, viewedUserId);
    const { error } = await supabase
      .from("community_friends")
      .delete()
      .eq("user_id", low)
      .eq("friend_user_id", high);
    if (error) {
      setBanner(error.message || "Could not reject request.");
      return;
    }
    setFriendStatus("none");
    setBanner("Message request rejected.");
  };

  const handleOpenMessages = () => {
    if (!currentUserId || !viewedUserId) return;
    const path = mode === "gym" ? `/gym/${id}/messages?friend=${viewedUserId}` : `/athlete/${id}/messages?friend=${viewedUserId}`;
    navigate(path);
  };

  const handleOpenSession = (session) => {
    if (!currentUserId || !viewedUserId || !session?.id || !session?.sourceType) return;
    if (session.sourceType !== "training" && session.sourceType !== "strength") return;
    const base = mode === "gym" ? `/gym/${id}` : `/athlete/${id}`;
    navigate(`${base}/profile/${viewedUserId}/session/${session.sourceType}/${session.id}`);
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="hud-card">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-shell">
        <div className="hud-card">
          <button className="studio-back" onClick={() => navigate(backPath)} type="button">
            {"Back"}
          </button>
          <div className="page-title mt-3">Profile not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <button className="studio-back" onClick={() => navigate(backPath)} type="button">
            {"Back"}
          </button>
          <h2 className="page-title">{handleLabel}</h2>
          <p className="page-subtitle">
            {profile.fitness_level || "Athlete"} · {profile.primary_goal || "General Fitness"}
          </p>
        </div>
        {!isSelf && (
          <div className="flex gap-2 flex-wrap">
            {friendStatus === "accepted" && (
              <button className="studio-back community-cta-btn" type="button" onClick={handleOpenMessages}>
                Message
              </button>
            )}
            {friendStatus === "outgoing" && (
              <button className="studio-back community-cta-btn" type="button" disabled>
                Friend request sent
              </button>
            )}
            {friendStatus === "incoming" && (
              <>
                <button className="studio-back community-cta-btn" type="button" onClick={handleApproveRequest}>
                  Approve
                </button>
                <button className="studio-back community-cta-btn" type="button" onClick={handleRejectRequest}>
                  Reject
                </button>
              </>
            )}
            {friendStatus === "none" && (
              <button className="studio-back community-cta-btn" type="button" onClick={handleAddFriend}>
                Send friend request
              </button>
            )}
          </div>
        )}
      </div>

      {banner ? <div className="hud-card">{banner}</div> : null}

      <div className="grid-3">
        <div className="hud-card">
          <div className="hud-card-title">RANK</div>
          <div className="hud-big">{userState?.rank || "D"}</div>
          <div className="hud-dim">Community standing</div>
        </div>
        <div className="hud-card">
          <div className="hud-card-title">LEVEL</div>
          <div className="hud-big">{userState?.level || 1}</div>
          <div className="hud-dim">Progression level</div>
        </div>
        <div className="hud-card">
          <div className="hud-card-title">STREAK</div>
          <div className="hud-big">{userState?.streak_days || 0}</div>
          <div className="hud-dim">Active days in a row</div>
        </div>
      </div>

      <div className="hud-card mt-4">
        <div className="hud-card-title">GROUPS</div>
        <div className="hud-dim">{groups.length} joined</div>
        <div className="mt-2">{joinedGroupSummary}</div>
      </div>

      <div className="hud-card mt-4">
        <div className="hud-card-title">RECENT TRAINING</div>
        {!recentSessions.length && <div className="hud-dim mt-2">No recent sessions logged.</div>}
        {recentSessions.map((session) => (
          <button
            key={`${session.sourceType}-${session.id}`}
            type="button"
            className="public-session-row mt-2"
            onClick={() => handleOpenSession(session)}
            disabled={session.sourceType === "activity"}
          >
            <span className="public-session-main">
              <span className="public-session-title">{session.title || "SESSION"}</span>
              <span className="public-session-subtitle">
                {session.subtitle || "No detail"} | {formatDate(session.created_at)}
              </span>
              {session.originLabel ? (
                <span className="public-session-subtitle">{session.originLabel}</span>
              ) : null}
            </span>
            <span className="public-session-action">
              {session.sourceType === "activity" ? "Logged" : "View session"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}


