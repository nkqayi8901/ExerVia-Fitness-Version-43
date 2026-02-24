import { useEffect, useMemo, useState } from "react";
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
    setLoading(true);

    const [{ data: profileData }, { data: stateData }, { data: memberships }, { data: sessions }] =
      await Promise.all([
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
          .select("id, sport, duration, created_at")
          .eq("user_id", viewedUserId)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

    const mappedGroups = (memberships || []).map((row) => ({
      id: row.group_id,
      name: row.community_groups?.name || "Group",
      role: row.role || "member",
    }));

    setProfile(profileData || null);
    setUserState(stateData || null);
    setGroups(mappedGroups);
    setRecentSessions(sessions || []);
    await fetchFriendStatus();
    setLoading(false);
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
          <div key={session.id} className="flex items-center justify-between mt-2">
            <span>{String(session.sport || "session").toUpperCase()}</span>
            <span className="hud-dim">
              {session.duration ? `${session.duration} min` : "No duration"} · {formatDate(session.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

