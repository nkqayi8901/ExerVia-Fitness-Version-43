import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  STATUS_PREFIX,
  getActivityLabel,
  normalizeGroupFeedPreview,
  toDayKey,
} from "../components/community/communityHelpers";

export default function useCommunityData({
  userId,
  friends,
  memberships,
  activeTab,
  leaderboardGroupId,
  loadProfiles,
  setBanner,
  openConfirmDialog,
}) {
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [gymLeaderboard, setGymLeaderboard] = useState([]);
  const [gymLeaderboardContext, setGymLeaderboardContext] = useState({ placeId: "", name: "" });
  const [activityFeedItems, setActivityFeedItems] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [gymLeaderboardLoading, setGymLeaderboardLoading] = useState(false);
  const [reportingLeaderboardUserIds, setReportingLeaderboardUserIds] = useState({});
  const [activityFeedLoading, setActivityFeedLoading] = useState(false);

  const loadGlobalLeaderboard = useCallback(async () => {
    if (!userId) return;
    setLeaderboardLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_state")
        .select("user_id,xp,level,rank,streak_days")
        .order("xp", { ascending: false })
        .limit(30);
      if (error) {
        setGlobalLeaderboard([]);
        return;
      }
      const rows = data || [];
      setGlobalLeaderboard(rows);
      loadProfiles(rows.map((row) => row.user_id));
    } catch {
      setGlobalLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [loadProfiles, userId]);

  const loadGroupLeaderboard = useCallback(
    async (groupId) => {
      if (!groupId || !userId) {
        setGroupLeaderboard([]);
        return;
      }
      const { data: members, error: memberError } = await supabase
        .from("community_group_members")
        .select("user_id")
        .eq("group_id", groupId);
      if (memberError) {
        setGroupLeaderboard([]);
        return;
      }
      const memberIds = Array.from(
        new Set((members || []).map((row) => Number(row.user_id)).filter(Boolean))
      );
      if (!memberIds.length) {
        setGroupLeaderboard([]);
        return;
      }
      const { data: rows, error: boardError } = await supabase
        .from("user_state")
        .select("user_id,xp,level,rank,streak_days")
        .in("user_id", memberIds)
        .order("xp", { ascending: false });
      if (boardError) {
        setGroupLeaderboard([]);
        return;
      }
      setGroupLeaderboard(rows || []);
      loadProfiles(memberIds);
    },
    [loadProfiles, userId]
  );

  const loadGymLeaderboard = useCallback(async () => {
    if (!userId) return;
    setGymLeaderboardLoading(true);
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("primary_gym_place_id, primary_gym_name")
        .eq("id", Number(userId))
        .maybeSingle();
      const placeId = String(profile?.primary_gym_place_id || "").trim();
      const gymName = String(profile?.primary_gym_name || "").trim();
      setGymLeaderboardContext({ placeId, name: gymName });
      if (!placeId) {
        setGymLeaderboard([]);
        return;
      }
      const { data, error } = await supabase.rpc("get_weekly_gym_leaderboard", {
        p_viewer_profile_id: Number(userId),
        p_limit: 30,
      });
      if (error) {
        console.error("Could not load gym leaderboard:", error);
        setGymLeaderboard([]);
        return;
      }
      const rows = data || [];
      setGymLeaderboard(rows);
      loadProfiles(rows.map((row) => row.user_id));
    } catch {
      setGymLeaderboard([]);
    } finally {
      setGymLeaderboardLoading(false);
    }
  }, [loadProfiles, userId]);

  const executeReportLeaderboardEntry = useCallback(
    async (row) => {
      if (!userId || !row?.user_id || !gymLeaderboardContext.placeId) return;
      const targetId = Number(row.user_id);
      if (!targetId || targetId === Number(userId)) return;
      if (reportingLeaderboardUserIds[targetId]) return;
      setReportingLeaderboardUserIds((prev) => ({ ...prev, [targetId]: true }));
      const payload = {
        reporter_user_id: Number(userId),
        reported_user_id: targetId,
        gym_place_id: gymLeaderboardContext.placeId,
        reason: "suspicious_activity",
      };
      const { error } = await supabase.from("gym_leaderboard_reports").insert([payload]);
      setReportingLeaderboardUserIds((prev) => ({ ...prev, [targetId]: false }));
      if (error?.code === "23505") {
        setBanner("Already reported for this week.");
      } else if (error) {
        setBanner("Could not submit report right now.");
        return;
      }
      setBanner("Leaderboard report submitted.");
      loadGymLeaderboard();
    },
    [gymLeaderboardContext.placeId, loadGymLeaderboard, reportingLeaderboardUserIds, setBanner, userId]
  );

  const handleReportLeaderboardEntry = useCallback(
    async (row) => {
      if (!userId || !row?.user_id || !gymLeaderboardContext.placeId) return;
      if (Number(row.user_id) === Number(userId)) return;
      const targetLabel = `User ${row.user_id}`;
      openConfirmDialog?.({
        kind: "report-leaderboard",
        title: "Report leaderboard user?",
        body: `Report ${targetLabel} on this week's gym leaderboard?`,
        payload: { row },
      });
    },
    [gymLeaderboardContext.placeId, openConfirmDialog, userId]
  );

  const loadActivityFeed = useCallback(async () => {
    if (!userId) return;
    setActivityFeedLoading(true);
    try {
      const friendIds = (friends || [])
        .map((row) => (Number(row.user_id) === Number(userId) ? row.friend_user_id : row.user_id))
        .map((id) => Number(id))
        .filter(Boolean);
      const actorIds = Array.from(new Set([Number(userId), ...friendIds].filter(Boolean)));
      const joinedGroupIds = Array.from(new Set((memberships || []).map((row) => String(row.group_id)).filter(Boolean)));

      const requests = [
        supabase
          .from("daily_activity")
          .select("id,user_id,activity_type,activity_date,created_at")
          .in("user_id", actorIds)
          .order("created_at", { ascending: false })
          .limit(120),
        joinedGroupIds.length
          ? supabase
              .from("community_group_posts")
              .select("id,group_id,created_by,created_at,body,channel")
              .in("group_id", joinedGroupIds)
              .order("created_at", { ascending: false })
              .limit(60)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("community_posts")
          .select("id,forum_id,title,body,created_by,created_at")
          .in("created_by", actorIds)
          .order("created_at", { ascending: false })
          .limit(40),
      ];

      const [activityRes, groupPostRes, forumPostRes] = await Promise.all(requests);
      const activityRows = activityRes.data || [];
      const groupPostRows = groupPostRes.data || [];
      const forumPostRows = forumPostRes.data || [];

      const groupIdSet = Array.from(new Set(groupPostRows.map((row) => String(row.group_id)).filter(Boolean)));
      let groupNameById = {};
      if (groupIdSet.length) {
        const { data: groupRows } = await supabase.from("community_groups").select("id,name").in("id", groupIdSet);
        groupNameById = (groupRows || []).reduce((acc, row) => {
          acc[row.id] = row.name || "Group";
          return acc;
        }, {});
      }

      const actorProfileIds = [
        ...activityRows.map((row) => row.user_id),
        ...groupPostRows.map((row) => row.created_by),
        ...forumPostRows.map((row) => row.created_by),
      ];
      loadProfiles(actorProfileIds);

      const forumPostByActorDay = {};
      forumPostRows.forEach((row) => {
        const actor = Number(row.created_by);
        const dayKey = toDayKey(row.created_at);
        if (!actor || !dayKey) return;
        const key = `${actor}:${dayKey}`;
        if (!forumPostByActorDay[key]) {
          forumPostByActorDay[key] = String(row.id || "");
        }
      });

      const normalized = [
        ...activityRows.map((row) => ({
          id: `activity-${row.id}`,
          created_at: row.created_at || `${row.activity_date}T12:00:00`,
          actor_id: row.user_id,
          title: getActivityLabel(row.activity_type),
          sub: row.activity_date ? `on ${row.activity_date}` : "",
          activityType: String(row.activity_type || ""),
          activityDate: row.activity_date || "",
          postId:
            String(row.activity_type || "").toLowerCase() === "community_post" && row.activity_date
              ? forumPostByActorDay[`${Number(row.user_id)}:${String(row.activity_date)}`] || ""
              : "",
          type: "activity",
        })),
        ...groupPostRows.map((row) => ({
          id: `group-post-${row.id}`,
          created_at: row.created_at,
          actor_id: row.created_by,
          title: `posted in ${groupNameById[row.group_id] || "group chat"}`,
          sub: normalizeGroupFeedPreview(row.body).slice(0, 180),
          groupId: String(row.group_id || ""),
          groupPostId: String(row.id || ""),
          type: "group_post",
        })),
        ...forumPostRows.map((row) => ({
          id: `forum-post-${row.id}`,
          created_at: row.created_at,
          actor_id: row.created_by,
          title: String(row.title || "").startsWith(STATUS_PREFIX) ? "posted a status" : "created a forum thread",
          sub: String(row.title || "").startsWith(STATUS_PREFIX)
            ? String(row.body || row.title || "").replace(STATUS_PREFIX, "")
            : row.title || "",
          postId: String(row.id || ""),
          type: "forum_post",
        })),
      ]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 80);

      setActivityFeedItems(normalized);
    } catch {
      setActivityFeedItems([]);
    } finally {
      setActivityFeedLoading(false);
    }
  }, [friends, memberships, loadProfiles, userId]);

  useEffect(() => {
    if (activeTab !== "feed") return;
    loadActivityFeed();
  }, [activeTab, loadActivityFeed]);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    loadGlobalLeaderboard();
    loadGymLeaderboard();
  }, [activeTab, loadGlobalLeaderboard, loadGymLeaderboard]);

  useEffect(() => {
    if (activeTab !== "leaderboard" || !leaderboardGroupId) return;
    loadGroupLeaderboard(leaderboardGroupId);
  }, [activeTab, leaderboardGroupId, loadGroupLeaderboard]);

  return {
    globalLeaderboard,
    groupLeaderboard,
    gymLeaderboard,
    gymLeaderboardContext,
    activityFeedItems,
    leaderboardLoading,
    gymLeaderboardLoading,
    reportingLeaderboardUserIds,
    activityFeedLoading,
    loadActivityFeed,
    executeReportLeaderboardEntry,
    handleReportLeaderboardEntry,
  };
}
