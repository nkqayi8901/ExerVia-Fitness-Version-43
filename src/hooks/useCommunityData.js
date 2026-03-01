import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  STATUS_PREFIX,
  getActivityLabel,
  normalizeGroupFeedPreview,
  toDayKey,
} from "../components/community/communityHelpers";

const QUERY_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 45000;

const withTimeout = (promise, ms = QUERY_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);

const runWithRetry = async (fn, retries = 1) => {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

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
  const normalizeId = (value) => {
    if (value === null || value === undefined) return "";
    const raw = String(value).trim();
    return raw;
  };

  const cacheRef = useRef({
    global: { data: [], at: 0 },
    group: {},
    gym: { data: [], context: { placeId: "", name: "" }, at: 0 },
    feed: { data: [], at: 0 },
  });

  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [gymLeaderboard, setGymLeaderboard] = useState([]);
  const [gymLeaderboardContext, setGymLeaderboardContext] = useState({ placeId: "", name: "" });
  const [activityFeedItems, setActivityFeedItems] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [groupLeaderboardLoading, setGroupLeaderboardLoading] = useState(false);
  const [gymLeaderboardLoading, setGymLeaderboardLoading] = useState(false);
  const [globalLeaderboardLoaded, setGlobalLeaderboardLoaded] = useState(false);
  const [groupLeaderboardLoaded, setGroupLeaderboardLoaded] = useState(false);
  const [gymLeaderboardLoaded, setGymLeaderboardLoaded] = useState(false);
  const [reportingLeaderboardUserIds, setReportingLeaderboardUserIds] = useState({});
  const [activityFeedLoading, setActivityFeedLoading] = useState(false);

  const loadGlobalLeaderboard = useCallback(async () => {
    if (!userId) return;
    const cache = cacheRef.current.global;
    if (Date.now() - Number(cache.at || 0) < CACHE_TTL_MS && Array.isArray(cache.data)) {
      setGlobalLeaderboard(cache.data);
      setGlobalLeaderboardLoaded(true);
    }
    setLeaderboardLoading(true);
    setGlobalLeaderboardLoaded(false);
    try {
      let data = [];
      let error = null;
      await runWithRetry(async () => {
        const response = await withTimeout(
          supabase
            .from("user_state")
            .select("user_id,xp,level,rank,streak_days")
            .order("xp", { ascending: false })
            .limit(30)
        );
        data = response?.data || [];
        error = response?.error || null;
        if (error) {
          const retryResponse = await withTimeout(
            supabase
              .from("user_state")
              .select("user_id,xp,level,rank")
              .order("xp", { ascending: false })
              .limit(30)
          );
          data = retryResponse?.data || [];
          error = retryResponse?.error || null;
        }
      });
      if (error) {
        const fallback = await withTimeout(supabase.from("user_profiles").select("id").limit(30));
        const rows = (fallback.data || []).map((row) => ({
          user_id: row.id,
          xp: 0,
          level: 1,
          rank: "E",
          streak_days: 0,
        }));
        setGlobalLeaderboard(rows);
        cacheRef.current.global = { data: rows, at: Date.now() };
        loadProfiles(rows.map((row) => row.user_id));
        return;
      }
      const rows = data || [];
      setGlobalLeaderboard(rows);
      cacheRef.current.global = { data: rows, at: Date.now() };
      loadProfiles(rows.map((row) => row.user_id));
    } catch {
      if (!Array.isArray(cacheRef.current.global.data) || !cacheRef.current.global.data.length) {
        setGlobalLeaderboard([]);
      }
    } finally {
      setLeaderboardLoading(false);
      setGlobalLeaderboardLoaded(true);
    }
  }, [loadProfiles, userId]);

  const loadGroupLeaderboard = useCallback(
    async (groupId) => {
      if (!groupId || !userId) {
        setGroupLeaderboard([]);
        setGroupLeaderboardLoaded(false);
        return;
      }
      const groupKey = String(groupId);
      const cachedGroup = cacheRef.current.group[groupKey];
      if (
        cachedGroup &&
        Date.now() - Number(cachedGroup.at || 0) < CACHE_TTL_MS &&
        Array.isArray(cachedGroup.data)
      ) {
        setGroupLeaderboard(cachedGroup.data);
        setGroupLeaderboardLoaded(true);
      }
      setGroupLeaderboardLoading(true);
      setGroupLeaderboardLoaded(false);
      try {
        const memberResponse = await runWithRetry(() =>
          withTimeout(
            supabase
              .from("community_group_members")
              .select("user_id")
              .eq("group_id", groupId)
          )
        );
        const members = memberResponse?.data || [];
        const memberError = memberResponse?.error;
        if (memberError) {
          setGroupLeaderboard([]);
          return;
        }
        const memberIds = Array.from(new Set((members || []).map((row) => row.user_id).filter(Boolean)));
        if (!memberIds.length) {
          setGroupLeaderboard([]);
          return;
        }
        const boardResponse = await runWithRetry(() =>
          withTimeout(
            supabase
              .from("user_state")
              .select("user_id,xp,level,rank,streak_days")
              .in("user_id", memberIds)
              .order("xp", { ascending: false })
          )
        );
        const rows = boardResponse?.data || [];
        const boardError = boardResponse?.error;
        if (boardError) {
          // Fallback if streak_days is not available in schema.
          const retry = await withTimeout(
            supabase
              .from("user_state")
              .select("user_id,xp,level,rank")
              .in("user_id", memberIds)
              .order("xp", { ascending: false })
          );
          if (retry.error) {
            setGroupLeaderboard([]);
            return;
          }
          const fallbackRows = retry.data || [];
          setGroupLeaderboard(fallbackRows);
          cacheRef.current.group[groupKey] = { data: fallbackRows, at: Date.now() };
          loadProfiles(memberIds.map((id) => normalizeId(id)).filter(Boolean));
          return;
        }
        setGroupLeaderboard(rows || []);
        cacheRef.current.group[groupKey] = { data: rows || [], at: Date.now() };
        loadProfiles(memberIds.map((id) => normalizeId(id)).filter(Boolean));
      } catch {
        if (!cachedGroup || !Array.isArray(cachedGroup.data) || !cachedGroup.data.length) {
          setGroupLeaderboard([]);
        }
      } finally {
        setGroupLeaderboardLoading(false);
        setGroupLeaderboardLoaded(true);
      }
    },
    [loadProfiles, userId]
  );

  const loadGymLeaderboard = useCallback(async () => {
    if (!userId) return;
    const gymCache = cacheRef.current.gym;
    if (Date.now() - Number(gymCache.at || 0) < CACHE_TTL_MS) {
      setGymLeaderboard(gymCache.data || []);
      setGymLeaderboardContext(gymCache.context || { placeId: "", name: "" });
      setGymLeaderboardLoaded(true);
    }
    setGymLeaderboardLoading(true);
    setGymLeaderboardLoaded(false);
    try {
      const profileResponse = await runWithRetry(() =>
        withTimeout(
          supabase
            .from("user_profiles")
            .select("primary_gym_place_id, primary_gym_name")
            .eq("id", Number(userId))
            .maybeSingle()
        )
      );
      const profile = profileResponse?.data;
      const placeId = String(profile?.primary_gym_place_id || "").trim();
      const gymName = String(profile?.primary_gym_name || "").trim();
      setGymLeaderboardContext({ placeId, name: gymName });
      if (!placeId) {
        setGymLeaderboard([]);
        cacheRef.current.gym = { data: [], context: { placeId, name: gymName }, at: Date.now() };
        return;
      }
      const response = await runWithRetry(() =>
        withTimeout(
          supabase.rpc("get_weekly_gym_leaderboard", {
            p_viewer_profile_id: Number(userId),
            p_limit: 30,
          })
        )
      );
      const data = response?.data || [];
      const error = response?.error;
      if (error) {
        console.error("Could not load gym leaderboard:", error);
        setGymLeaderboard([]);
        return;
      }
      const rows = data || [];
      setGymLeaderboard(rows);
      cacheRef.current.gym = {
        data: rows,
        context: { placeId, name: gymName },
        at: Date.now(),
      };
      loadProfiles(rows.map((row) => row.user_id));
    } catch {
      if (!Array.isArray(gymCache.data) || !gymCache.data.length) {
        setGymLeaderboard([]);
      }
    } finally {
      setGymLeaderboardLoading(false);
      setGymLeaderboardLoaded(true);
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
    const feedCache = cacheRef.current.feed;
    if (Date.now() - Number(feedCache.at || 0) < 30000 && Array.isArray(feedCache.data)) {
      setActivityFeedItems(feedCache.data);
    }
    setActivityFeedLoading(true);
    try {
      const friendIds = (friends || [])
        .map((row) => (String(row.user_id) === String(userId) ? row.friend_user_id : row.user_id))
        .map((id) => normalizeId(id))
        .filter(Boolean);
      const actorIds = Array.from(new Set([normalizeId(userId), ...friendIds].filter(Boolean)));
      const joinedGroupIds = Array.from(new Set((memberships || []).map((row) => normalizeId(row.group_id)).filter(Boolean)));

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

      const [activityRes, groupPostRes, forumPostRes] = await runWithRetry(() =>
        withTimeout(Promise.all(requests), QUERY_TIMEOUT_MS + 1500)
      );
      let activityRows = activityRes.data || [];
      let groupPostRows = groupPostRes.data || [];
      let forumPostRows = forumPostRes.data || [];

      // Resilient fallback path: if filtered feed queries fail, show latest global rows.
      if (activityRes.error && forumPostRes.error) {
        const [fallbackActivity, fallbackForum] = await Promise.all([
          supabase
            .from("daily_activity")
            .select("id,user_id,activity_type,activity_date,created_at")
            .order("created_at", { ascending: false })
            .limit(80),
          supabase
            .from("community_posts")
            .select("id,forum_id,title,body,created_by,created_at")
            .order("created_at", { ascending: false })
            .limit(60),
        ]);
        activityRows = fallbackActivity.data || [];
        forumPostRows = fallbackForum.data || [];
      }
      if (groupPostRes.error) {
        const fallbackGroups = await supabase
          .from("community_group_posts")
          .select("id,group_id,created_by,created_at,body")
          .order("created_at", { ascending: false })
          .limit(60);
        groupPostRows = fallbackGroups.data || [];
      }

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
      const forumPostById = {};
      forumPostRows.forEach((row) => {
        const postId = normalizeId(row.id);
        if (postId) {
          forumPostById[postId] = row;
        }
        const actor = normalizeId(row.created_by);
        const dayKey = toDayKey(row.created_at);
        if (!actor || !dayKey) return;
        const key = `${actor}:${dayKey}`;
        if (!forumPostByActorDay[key]) {
          forumPostByActorDay[key] = postId;
        }
      });

      const activityCommunityPostByActorDay = new Set(
        activityRows
          .filter((row) => String(row.activity_type || "").toLowerCase() === "community_post")
          .map((row) => {
            const actor = normalizeId(row.user_id);
            const dayKey = toDayKey(row.created_at || `${row.activity_date}T12:00:00`);
            return actor && dayKey ? `${actor}:${dayKey}` : "";
          })
          .filter(Boolean)
      );

      const normalized = [
        ...activityRows.map((row) => {
          const linkedPostId =
            String(row.activity_type || "").toLowerCase() === "community_post" && row.activity_date
              ? forumPostByActorDay[`${normalizeId(row.user_id)}:${String(row.activity_date)}`] || ""
              : "";
          const linkedPost = linkedPostId ? forumPostById[String(linkedPostId)] : null;
          const linkedIsStatus = String(linkedPost?.title || "").startsWith(STATUS_PREFIX);
          return {
            id: `activity-${row.id}`,
            created_at: row.created_at || `${row.activity_date}T12:00:00`,
            actor_id: row.user_id,
            title:
              String(row.activity_type || "").toLowerCase() === "community_post" && linkedIsStatus
                ? "posted a status"
                : getActivityLabel(row.activity_type),
            sub:
              String(row.activity_type || "").toLowerCase() === "community_post" && linkedIsStatus
                ? String(linkedPost?.body || linkedPost?.title || "").replace(STATUS_PREFIX, "").slice(0, 180)
                : row.activity_date
                ? `on ${row.activity_date}`
                : "",
            activityType: String(row.activity_type || ""),
            activityDate: row.activity_date || "",
            postId: linkedPostId,
            type: "activity",
          };
        }),
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
        ...forumPostRows
          .filter((row) => {
            const isStatus = String(row.title || "").startsWith(STATUS_PREFIX);
            if (!isStatus) return true;
            const actor = normalizeId(row.created_by);
            const dayKey = toDayKey(row.created_at);
            if (!actor || !dayKey) return true;
            return !activityCommunityPostByActorDay.has(`${actor}:${dayKey}`);
          })
          .map((row) => ({
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
      ];

      // Prevent duplicate status/forum entries when an activity row and forum row reference the same post.
      const deduped = [];
      const seenKeys = new Set();
      normalized.forEach((item) => {
        const postId = normalizeId(item.postId);
        const key = postId ? `post:${postId}` : `${item.type}:${item.id}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        deduped.push(item);
      });

      const finalItems = deduped
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 80);

      setActivityFeedItems(finalItems);
      cacheRef.current.feed = { data: finalItems, at: Date.now() };
    } catch {
      if (!Array.isArray(feedCache.data) || !feedCache.data.length) {
        setActivityFeedItems([]);
      }
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
    groupLeaderboardLoading,
    gymLeaderboardLoading,
    globalLeaderboardLoaded,
    groupLeaderboardLoaded,
    gymLeaderboardLoaded,
    reportingLeaderboardUserIds,
    activityFeedLoading,
    loadActivityFeed,
    executeReportLeaderboardEntry,
    handleReportLeaderboardEntry,
  };
}
