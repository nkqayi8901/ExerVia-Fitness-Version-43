import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { STATUS_PREFIX } from "../components/community/communityHelpers";
import { PROMOTION_PREFIX } from "../utils/progressionFeed";

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
  activeTab,
  leaderboardGroupId,
  loadProfiles,
}) {
  const normalizeId = (value) => {
    if (value === null || value === undefined) return "";
    const raw = String(value).trim();
    return raw;
  };

  const cacheRef = useRef({
    global: { data: [], at: 0 },
    group: {},
    feed: { data: [], at: 0 },
  });

  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [leaderboardSignals, setLeaderboardSignals] = useState({});
  const [activityFeedItems, setActivityFeedItems] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [groupLeaderboardLoading, setGroupLeaderboardLoading] = useState(false);
  const [globalLeaderboardLoaded, setGlobalLeaderboardLoaded] = useState(false);
  const [groupLeaderboardLoaded, setGroupLeaderboardLoaded] = useState(false);
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
      const loadSignals = async (rowsToAnnotate) => {
        const ids = Array.from(new Set((rowsToAnnotate || []).map((row) => row.user_id).filter(Boolean)));
        if (!ids.length) return;
        const promotionRes = await withTimeout(
          supabase
            .from("community_posts")
            .select("created_by,created_at,title")
            .in("created_by", ids)
            .like("title", `${STATUS_PREFIX}${PROMOTION_PREFIX}%`)
            .order("created_at", { ascending: false })
            .limit(120)
        );
        const recentByUser = {};
        (promotionRes?.data || []).forEach((row) => {
          if (!row?.created_by || recentByUser[row.created_by]) return;
          recentByUser[row.created_by] = row;
        });
        const nextSignals = {};
        ids.forEach((actorId) => {
          const boardRow = (rowsToAnnotate || []).find((item) => Number(item.user_id) === Number(actorId));
          const streakDays = Number(boardRow?.streak_days || 0);
          const promotionRow = recentByUser[actorId];
          const promotedRecently =
            promotionRow &&
            Date.now() - new Date(promotionRow.created_at || 0).getTime() < 7 * 24 * 60 * 60 * 1000;
          nextSignals[actorId] = {
            promotedRecently: Boolean(promotedRecently),
            hotStreak: streakDays >= 5,
          };
        });
        setLeaderboardSignals((prev) => ({ ...prev, ...nextSignals }));
      };

      if (error) {
        const fallback = await withTimeout(supabase.from("user_profiles").select("id").limit(30));
        let rows = (fallback.data || []).map((row) => ({
          user_id: row.id,
          xp: 0,
          level: 1,
          rank: "E",
          streak_days: 0,
        }));
        if (!rows.length) {
          const selfState = await withTimeout(
            supabase
              .from("user_state")
              .select("user_id,xp,level,rank,streak_days")
              .eq("user_id", Number(userId))
              .maybeSingle()
          );
          if (selfState?.data?.user_id) {
            rows = [selfState.data];
          }
        }
        setGlobalLeaderboard(rows);
        cacheRef.current.global = { data: rows, at: Date.now() };
        loadProfiles(rows.map((row) => row.user_id));
        await loadSignals(rows);
        return;
      }
      let rows = data || [];
      if (!rows.length) {
        const selfState = await withTimeout(
          supabase
            .from("user_state")
            .select("user_id,xp,level,rank,streak_days")
            .eq("user_id", Number(userId))
            .maybeSingle()
        );
        if (selfState?.data?.user_id) {
          rows = [selfState.data];
        }
      }
      setGlobalLeaderboard(rows);
      cacheRef.current.global = { data: rows, at: Date.now() };
      loadProfiles(rows.map((row) => row.user_id));
      await loadSignals(rows);
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
        const loadSignals = async (rowsToAnnotate) => {
          const ids = Array.from(new Set((rowsToAnnotate || []).map((row) => row.user_id).filter(Boolean)));
          if (!ids.length) return;
          const promotionRes = await withTimeout(
            supabase
              .from("community_posts")
              .select("created_by,created_at,title")
              .in("created_by", ids)
              .like("title", `${STATUS_PREFIX}${PROMOTION_PREFIX}%`)
              .order("created_at", { ascending: false })
              .limit(120)
          );
          const recentByUser = {};
          (promotionRes?.data || []).forEach((row) => {
            if (!row?.created_by || recentByUser[row.created_by]) return;
            recentByUser[row.created_by] = row;
          });
          const nextSignals = {};
          ids.forEach((actorId) => {
            const boardRow = (rowsToAnnotate || []).find((item) => Number(item.user_id) === Number(actorId));
            const streakDays = Number(boardRow?.streak_days || 0);
            const promotionRow = recentByUser[actorId];
            const promotedRecently =
              promotionRow &&
              Date.now() - new Date(promotionRow.created_at || 0).getTime() < 7 * 24 * 60 * 60 * 1000;
            nextSignals[actorId] = {
              promotedRecently: Boolean(promotedRecently),
              hotStreak: streakDays >= 5,
            };
          });
          setLeaderboardSignals((prev) => ({ ...prev, ...nextSignals }));
        };

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
          await loadSignals(fallbackRows);
          return;
        }
        setGroupLeaderboard(rows || []);
        cacheRef.current.group[groupKey] = { data: rows || [], at: Date.now() };
        loadProfiles(memberIds.map((id) => normalizeId(id)).filter(Boolean));
        await loadSignals(rows || []);
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
      const statusRes = await runWithRetry(() =>
        withTimeout(
          supabase
            .from("community_posts")
            .select("id,title,body,created_by,created_at")
            .in("created_by", actorIds)
            .like("title", `${STATUS_PREFIX}%`)
            .order("created_at", { ascending: false })
            .limit(80),
          QUERY_TIMEOUT_MS + 1500
        )
      );
      let statusRows = statusRes?.data || [];

      if (statusRes?.error) {
        const fallback = await supabase
          .from("community_posts")
          .select("id,title,body,created_by,created_at")
          .like("title", `${STATUS_PREFIX}%`)
          .order("created_at", { ascending: false })
          .limit(80);
        statusRows = fallback.data || [];
      }

      loadProfiles(statusRows.map((row) => row.created_by));

      const finalItems = statusRows
        .map((row) => {
          const rawTitle = String(row.title || "");
          const promotionLabel = rawTitle.replace(STATUS_PREFIX, "").replace(PROMOTION_PREFIX, "").trim();
          const isPromotion = rawTitle.includes(PROMOTION_PREFIX);
          return {
            id: `status-${row.id}`,
            created_at: row.created_at,
            actor_id: row.created_by,
            title: isPromotion ? "Promotion earned" : "Status",
            sub: String(row.body || rawTitle || "").replace(STATUS_PREFIX, "").trim(),
            primaryLabel: isPromotion ? promotionLabel : "",
            postId: String(row.id || ""),
            type: isPromotion ? "promotion" : "status_post",
          };
        })
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
  }, [friends, loadProfiles, userId]);

  useEffect(() => {
    if (activeTab !== "feed") return;
    loadActivityFeed();
  }, [activeTab, loadActivityFeed]);

  useEffect(() => {
    if (activeTab !== "feed") return undefined;
    const handler = () => loadActivityFeed();
    window.addEventListener("exervia:progression_event", handler);
    return () => window.removeEventListener("exervia:progression_event", handler);
  }, [activeTab, loadActivityFeed]);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    loadGlobalLeaderboard();
  }, [activeTab, loadGlobalLeaderboard]);

  useEffect(() => {
    if (activeTab !== "leaderboard" || !leaderboardGroupId) return;
    loadGroupLeaderboard(leaderboardGroupId);
  }, [activeTab, leaderboardGroupId, loadGroupLeaderboard]);

  return {
    globalLeaderboard,
    groupLeaderboard,
    leaderboardSignals,
    activityFeedItems,
    leaderboardLoading,
    groupLeaderboardLoading,
    globalLeaderboardLoaded,
    groupLeaderboardLoaded,
    activityFeedLoading,
    loadActivityFeed,
  };
}
