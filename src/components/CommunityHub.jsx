// Below we import React hooks used throughout this component:
// useState manages local UI state (tabs, modals, forms, loaded data),
// useEffect runs side effects like fetching data + realtime subscriptions,
// useMemo memoises expensive derived values (filtering + sorting lists).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// adapted from https://reactrouter.com/en/main/hooks/use-navigate
// useNavigate is used for client-side navigation
import { useNavigate, useParams } from "react-router-dom";
// supabase client is imported to interact with our backend for data fetching and mutations
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";
import { trackDailyActivity } from "../services/activityTracker";
import { parseBlockedIds, toggleBlockedId } from "../utils/moderation";
import { toUserFacingNetworkMessage } from "../utils/networkError";
import { emitToast } from "../utils/toast";
import { isErrorBanner } from "../utils/banner";
import GroupRoomPanel from "./community/GroupRoomPanel";
import ActivityFeedPanel from "./community/ActivityFeedPanel";
import LeaderboardPanel from "./community/LeaderboardPanel";
import ChallengesPanel from "./community/ChallengesPanel";
import ForumsPanel from "./community/ForumsPanel";
import GroupsPanel from "./community/GroupsPanel";
import CirclePanel from "./community/CirclePanel";
import CommunityModal from "./community/CommunityModal";
import PageWalkthroughModal from "./PageWalkthroughModal";
import useCommunityModalState from "../hooks/useCommunityModalState";
import useCommunityData from "../hooks/useCommunityData";
import {
  GROUP_QUESTION_PREFIX,
  STATUS_PREFIX,
  buildQuestionReplyPayload,
  buildReplyTree,
  forumTracks,
  formatTime,
  normalizeGroupPostChannel,
  parseQuestionReplyPayload,
  reactionOptions,
} from "./community/communityHelpers";

const GROUP_ROOM_POST_BUFFER_LIMIT = 400;
const FORUM_TRACK_ORDER = forumTracks.reduce((acc, track, index) => {
  acc[track.id] = index;
  return acc;
}, {});

const sortForumsByTrackOrder = (list) => {
  const rows = Array.isArray(list) ? [...list] : [];
  return rows.sort((a, b) => {
    const aSlug = String(a?.topic_slug || a?.id || "");
    const bSlug = String(b?.topic_slug || b?.id || "");
    const aOrder = Number.isFinite(FORUM_TRACK_ORDER[aSlug]) ? FORUM_TRACK_ORDER[aSlug] : 999;
    const bOrder = Number.isFinite(FORUM_TRACK_ORDER[bSlug]) ? FORUM_TRACK_ORDER[bSlug] : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a?.title || aSlug).localeCompare(String(b?.title || bSlug));
  });
};

const COMMUNITY_WALKTHROUGH_STEPS = [
  {
    id: "forums",
    title: "Forums",
    what: "Use Forums to post discussion threads and reply to training topics.",
    why: "Forums are best for long-form discussion and searchable knowledge.",
    firstAction: "Open Forums tab.",
  },
  {
    id: "feed",
    title: "Feed",
    what: "Use Feed for quick updates, status posts, and lightweight interaction.",
    why: "Feed gives fast visibility into what your network is doing now.",
    firstAction: "Open Feed tab.",
  },
  {
    id: "groups",
    title: "Groups and Challenges",
    what: "Join groups for accountability and enter challenges for weekly goals.",
    why: "Group pressure and challenge targets improve follow-through.",
    firstAction: "Open Groups tab.",
  },
  {
    id: "friends",
    title: "Friends",
    what: "Add friends, accept requests, and keep training conversations active.",
    why: "A connected circle increases retention and consistency.",
    firstAction: "Open Friends tab.",
  },
];
// Component: CommunityHub - UI layout and interactions.
// This component renders the communityhub experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the main Community Hub component which serves as the
//  central place for all community interactions
// it manages state for forums, groups, challenges, posts, replies, friends, and more,
// it also handles all interactions like creating posts, joining groups, adding friends, etc.
// The UI is organized into tabs for forums, groups, challenges, and friends,
// with modals for creating new content and managing interactions.

// This is the main Community Hub component 
// which serves as the central place for all community interactions
// CommunityHub is the main component for the community section of the app,
// it manages state for forums, groups, challenges, posts, replies, friends, and more,
// it also handles all interactions like creating posts, joining groups, adding friends, etc.
// The UI is organized into tabs for forums, groups, challenges, and friends,
// with modals for creating new content and managing interactions.
// The component also sets up realtime subscriptions to update the UI in response to new posts,
// replies, and messages without needing a page refresh.
export default function CommunityHub({ userId, forceGroupRoom = false, forceThreadPage = false }) {
  const navigate = useNavigate();
  const { groupId: routeGroupId, threadId: routeThreadId } = useParams();
  const routePrefix =
    typeof window !== "undefined" && window.location.pathname.startsWith("/gym/")
      ? "gym"
      : "athlete";
  const communityBasePath = `/${routePrefix}/${userId || ""}/community`;
  const messagesBasePath = `/${routePrefix}/${userId || ""}/messages`;
  const groupRoomPath = (groupId) => `${communityBasePath}/group/${groupId}`;
  const threadPath = (threadId) => `${communityBasePath}/thread/${threadId}`;
  const messagesPath = (friendId) =>
    friendId ? `${messagesBasePath}?friend=${friendId}` : messagesBasePath;
  const blockedProfilesStorageKey = `exervia_blocked_profiles_${userId || ""}`;
  const openThreadPage = (threadId) => {
    const id = String(threadId || "").trim();
    if (!id) return;
    setActiveThreadId(id);
    navigate(threadPath(id));
  };
  const openRunPage = (runId, actorId) => {
    const resolvedRunId = String(runId || "").trim();
    if (!resolvedRunId) return;
    const targetViewerId = Number(userId);
    const targetActorId = Number(actorId);
    if (!targetViewerId) return;
    if (routePrefix === "athlete") {
      navigate(`/athlete/${targetViewerId}/routes/${resolvedRunId}`);
      return;
    }
    if (targetActorId) {
      navigate(`/athlete/${targetViewerId}/profile/${targetActorId}`);
    }
  };
  const openTrainingWorld = (sport) => {
    const world = String(sport || "").trim().toLowerCase();
    if (!world || !userId) return;
    navigate(`/${routePrefix}/${userId}/training?world=${world}`);
  };
  const openUserProfile = (targetProfileId) => {
    const resolvedTarget = Number(targetProfileId);
    if (!resolvedTarget || !userId) return;
    const selfId = Number(userId);
    if (resolvedTarget === selfId) {
      navigate(`/${routePrefix}/${userId}/profile`);
      return;
    }
    navigate(`/${routePrefix}/${userId}/profile/${resolvedTarget}`);
  };
  const storedMode = localStorage.getItem("exervia_active_mode") || "athlete";
  const backPath = storedMode === "gym" ? `/gym/${userId || ""}` : `/athlete/${userId || ""}`;
  const [activeTab, setActiveTab] = useState("forums");
  const [activeForum, setActiveForum] = useState("hyrox");
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [search, setSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [forums, setForums] = useState([]);
  const [groups, setGroups] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [forumPosts, setForumPosts] = useState([]);
  const [postReplies, setPostReplies] = useState({});
  const [globalForumPosts, setGlobalForumPosts] = useState([]);
  const [globalPostReplies, setGlobalPostReplies] = useState({});
  const [profiles, setProfiles] = useState({});
  const [friendStats, setFriendStats] = useState({});
  const [friendLatest, setFriendLatest] = useState({});
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [routeThread, setRouteThread] = useState(null);
  const [routeThreadReplies, setRouteThreadReplies] = useState([]);
  const [routeGroupBootLoading, setRouteGroupBootLoading] = useState(false);
  const [routeThreadBootLoading, setRouteThreadBootLoading] = useState(false);
  const [threadSort, setThreadSort] = useState("newest");
  const [threadReplySort, setThreadReplySort] = useState("liked");
  const [memberships, setMemberships] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState("");
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [communityLoadError, setCommunityLoadError] = useState("");
  const [communityReloadToken, setCommunityReloadToken] = useState(0);
  const [blockedProfileIds, setBlockedProfileIds] = useState([]);
  const {
    createGroupOpen,
    setCreateGroupOpen,
    createChallengeOpen,
    setCreateChallengeOpen,
    createPostOpen,
    setCreatePostOpen,
    createReplyOpen,
    setCreateReplyOpen,
    addFriendOpen,
    setAddFriendOpen,
    createRecipeTemplateOpen,
    setCreateRecipeTemplateOpen,
    newGroup,
    setNewGroup,
    newChallenge,
    setNewChallenge,
    newPost,
    setNewPost,
    newRecipeTemplate,
    setNewRecipeTemplate,
    newPostForum,
    setNewPostForum,
    newReply,
    setNewReply,
    statusDraft,
    setStatusDraft,
    statusPosting,
    setStatusPosting,
    newFriendUsername,
    setNewFriendUsername,
    editGroupOpen,
    setEditGroupOpen,
    editGroupTarget,
    setEditGroupTarget,
    editGroupForm,
    setEditGroupForm,
    confirmDialog,
    setConfirmDialog,
    confirmBusy,
    setConfirmBusy,
    openConfirmDialog,
    closeConfirmDialog,
  } = useCommunityModalState(activeForum);
  const [groupRoomId, setGroupRoomId] = useState(null);
  const [groupRoomPosts, setGroupRoomPosts] = useState([]);
  const [groupRoomMembers, setGroupRoomMembers] = useState([]);
  const [groupRoomGeneralDraft, setGroupRoomGeneralDraft] = useState("");
  const [groupRoomQuestionDraft, setGroupRoomQuestionDraft] = useState("");
  const [groupRoomQuestionReplyTargetId, setGroupRoomQuestionReplyTargetId] = useState("");
  const [groupRoomSending, setGroupRoomSending] = useState(false);
  const [groupRoomChannel, setGroupRoomChannel] = useState("general");
  const [groupRoomSeenByChannel, setGroupRoomSeenByChannel] = useState({});
  const [groupRoomLoading, setGroupRoomLoading] = useState(false);
  const [threadInlineReplyOpen, setThreadInlineReplyOpen] = useState(false);
  const [reactionCounts, setReactionCounts] = useState({});
  const [userReactions, setUserReactions] = useState({});
  const groupRoomListRef = useRef(null);
  const createPostTitleRef = useRef(null);
  const createPostBodyRef = useRef(null);
  const [expandedPostIds, setExpandedPostIds] = useState({});
  const [forumThreadCounts, setForumThreadCounts] = useState({});
  const [pinnedThreadIds, setPinnedThreadIds] = useState({});
  const [recentThreadIds, setRecentThreadIds] = useState({});
  const [collapsedThreadIds, setCollapsedThreadIds] = useState({});
  const [groupMemberCounts, setGroupMemberCounts] = useState({});
  const [groupLastActive, setGroupLastActive] = useState({});
  const [challengeParticipantCounts, setChallengeParticipantCounts] = useState({});
  const [challengeMyProgress, setChallengeMyProgress] = useState({});
  const [sharedTemplates, setSharedTemplates] = useState([]);
  const [templateRatings, setTemplateRatings] = useState({});
  const [templateTryCounts, setTemplateTryCounts] = useState({});
  const [templateTriedByMe, setTemplateTriedByMe] = useState({});
  const [templateComments, setTemplateComments] = useState({});
  const [templateCommentDrafts, setTemplateCommentDrafts] = useState({});
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateTypeFilter, setTemplateTypeFilter] = useState("all");
  const [templateFocusFilter, setTemplateFocusFilter] = useState("all");
  const [templateSort, setTemplateSort] = useState("top");
  const [templateViewMode, setTemplateViewMode] = useState("forum");
  const [templateDeckIndex, setTemplateDeckIndex] = useState(0);
  const [templateDeckDragX, setTemplateDeckDragX] = useState(0);
  const [templateDeckAnimating, setTemplateDeckAnimating] = useState(null);
  const [templateQueueExpanded, setTemplateQueueExpanded] = useState(false);
  const [leaderboardGroupId, setLeaderboardGroupId] = useState("");
  void templateTriedByMe;
  void templateComments;
  void setTemplateSearch;
  void setTemplateTypeFilter;
  void setTemplateSort;
  void templateViewMode;
  void setTemplateViewMode;
  const retryCommunityLoad = () => setCommunityReloadToken((prev) => prev + 1);
  const handleWalkthroughAction = (step) => {
    const stepId = String(step?.id || "");
    if (stepId === "forums") {
      setActiveTab("forums");
      return;
    }
    if (stepId === "feed") {
      setActiveTab("feed");
      return;
    }
    if (stepId === "groups") {
      setActiveTab("groups");
      return;
    }
    if (stepId === "friends") {
      setActiveTab("friends");
    }
  };
  const templateDeckPointerRef = useRef({ active: false, startX: 0, moved: false });
  const completedChallengeAwardRef = useRef(new Set());
  const templateRefreshTimerRef = useRef(null);
  const templatesBootstrappedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setGroupRoomSeenByChannel({});
      return;
    }
    try {
      const raw = localStorage.getItem(`exervia_group_room_seen_${userId}`);
      setGroupRoomSeenByChannel(raw ? JSON.parse(raw) : {});
    } catch {
      setGroupRoomSeenByChannel({});
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(
        `exervia_group_room_seen_${userId}`,
        JSON.stringify(groupRoomSeenByChannel || {})
      );
    } catch {
      // best-effort persistence only
    }
  }, [groupRoomSeenByChannel, userId]);

  useEffect(() => {
    if (!banner) return;
    const timeout = setTimeout(() => setBanner(""), 2600);
    return () => clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    if (!banner) return;
    const errorLike = isErrorBanner(banner);
    emitToast(banner, errorLike ? "error" : "info", errorLike ? 3600 : 3000);
  }, [banner]);

  useEffect(() => {
    if (!userId) return;
    setBlockedProfileIds(parseBlockedIds(localStorage.getItem(blockedProfilesStorageKey)));
  }, [blockedProfilesStorageKey, userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(blockedProfilesStorageKey, JSON.stringify(blockedProfileIds));
    } catch {
      // no-op
    }
  }, [blockedProfilesStorageKey, blockedProfileIds, userId]);

  const isBlockedProfile = useCallback(
    (profileId) => blockedProfileIds.includes(Number(profileId)),
    [blockedProfileIds]
  );
  const isVisibleAuthor = useCallback(
    (profileId) => !profileId || !isBlockedProfile(profileId),
    [isBlockedProfile]
  );

  const handleToggleBlockProfile = (profileId) => {
    const normalized = Number(profileId);
    if (!normalized || Number(normalized) === Number(userId)) return;
    const currentlyBlocked = isBlockedProfile(normalized);
    const profileLabel = profiles?.[normalized] || `User ${normalized}`;
    openConfirmDialog({
      kind: "block",
      title: currentlyBlocked ? "Unblock user?" : "Block user?",
      body: currentlyBlocked
        ? `Unblock ${profileLabel}.`
        : `Block ${profileLabel}. You can reverse this later.`,
      payload: { profileId: normalized, currentlyBlocked },
    });
  };

  const handleReportContent = async ({ targetType, targetId, targetUserId = null }) => {
    if (!userId || !targetType || !targetId) return;
    const targetLabel = targetUserId ? profiles?.[Number(targetUserId)] || `User ${targetUserId}` : "this content";
    openConfirmDialog({
      kind: "report-content",
      title: "Report content?",
      body: `Submit report for ${targetLabel}?`,
      payload: { targetType, targetId, targetUserId },
    });
  };

  const recordEngagementAction = async (actionType) => {
    if (!userId) return;
    await trackDailyActivity(userId, actionType);
    await recalcUserState(userId);
    window.dispatchEvent(new Event("user_state_updated"));
  };

  const handleConfirmDialogAction = async () => {
    if (confirmBusy || !confirmDialog.open) return;
    setConfirmBusy(true);
    try {
      if (confirmDialog.kind === "block") {
        const normalized = Number(confirmDialog.payload?.profileId);
        const currentlyBlocked = Boolean(confirmDialog.payload?.currentlyBlocked);
        if (normalized) {
          setBlockedProfileIds((prev) => toggleBlockedId(prev, normalized));
          setBanner(currentlyBlocked ? "Profile unblocked." : "Profile blocked.");
        }
        return;
      }
      if (confirmDialog.kind === "report-content") {
        const targetType = confirmDialog.payload?.targetType;
        const targetId = confirmDialog.payload?.targetId;
        const targetUserId = confirmDialog.payload?.targetUserId;
        if (!userId || !targetType || !targetId) return;
        const payload = {
          reporter_id: Number(userId),
          target_type: String(targetType),
          target_id: String(targetId),
          target_user_id: targetUserId ? Number(targetUserId) : null
        };
        const { error } = await supabase.from("community_reports").insert([payload]);
        if (error) {
          setBanner("Report captured. Moderation review tools are not enabled yet.");
          return;
        }
        setBanner("Report submitted.");
        return;
      }
      if (confirmDialog.kind === "delete-group") {
        await executeDeleteGroup(confirmDialog.payload?.group);
      }
    } finally {
      setConfirmBusy(false);
      setConfirmDialog({ open: false, kind: "", title: "", body: "", payload: null });
    }
  };
// loadProfiles takes a list of user ids and fetches their profiles from the backend,
// it then maps the profiles into a dictionary for easy lookup when displaying posts, 
// replies, and friends
// loadFriendStats is similar but it fetches the rank and level of friends to display 
// in the friend list
  const loadProfiles = useCallback(async (ids) => {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, display_name, username")
      .in("id", uniqueIds);
    if (error || !data) return;
    const mapped = {};
    data.forEach((profile) => {
      const username = String(profile.username || "").trim().replace(/^@+/, "");
      mapped[profile.id] = username ? `@${username}` : profile.display_name || `User ${profile.id}`;
    });
    setProfiles((prev) => ({ ...prev, ...mapped }));
  }, []);

  const {
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
  } = useCommunityData({
    userId,
    friends,
    memberships,
    activeTab,
    leaderboardGroupId,
    loadProfiles,
  });

  const refreshGroupsAndMemberships = async () => {
    if (!userId) return;
    const [{ data: groupData }, { data: membershipData }] = await Promise.all([
      supabase.from("community_groups").select("*").order("created_at", { ascending: false }),
      supabase.from("community_group_members").select("*").eq("user_id", Number(userId))
    ]);
    setGroups(groupData || []);
    setMemberships(membershipData || []);
  };
// loadFriendStats is similar but it fetches the rank and level of friends to display
// in the friend list, it also maps the stats into a dictionary keyed by user id for easy lookup
// when rendering the friend list and their associated stats
  const loadFriendStats = async (ids) => {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return;
    const { data, error } = await supabase
      .from("user_state")
      .select("user_id, rank, level")
      .in("user_id", uniqueIds);
    if (error || !data) return;
    const mapped = {};
    data.forEach((row) => {
      mapped[row.user_id] = { rank: row.rank, level: row.level };
    });
    setFriendStats((prev) => ({ ...prev, ...mapped }));
  };
// getFriendStatus is a helper function that takes a friend relationship row and determines
// the status of the friendship from the perspective of the current user, it returns
// "accepted" if they are friends, "outgoing" if the current user sent a request,
// "incoming" if the current user received a request, and "" if there is no relationship
// this function is used when rendering the friend list to determine what 
// actions to show for each friend
  const getFriendStatus = useCallback((friendRow) => {
    if (friendRow.status === "accepted") return "accepted";
    const currentId = Number(userId);
    const requesterId =
      friendRow.status === "pending_low" ? friendRow.user_id : friendRow.friend_user_id;
    if (currentId === requesterId) return "outgoing";
    return "incoming";
  }, [userId]);
// loadFriendMessageSummaries fetches the latest message for 
// each friend conversation to display
// in the friend list, and keeps the preview list fresh,
// it queries the messages table for any messages involving the current user,
// and then reduces the list to one latest message per friend
  const loadFriendMessageSummaries = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("community_friend_messages")
      .select("*")
      .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(200);
    const latest = {};
    (data || []).forEach((msg) => {
      const otherId = Number(msg.user_id) === Number(userId) ? msg.friend_user_id : msg.user_id;
      if (!latest[otherId]) {
        latest[otherId] = msg;
      }
    });
    setFriendLatest(latest);
  };

  const loadForumThreadCounts = async () => {
    const { data } = await supabase.from("community_posts").select("id,forum_id,title,created_by");
    const counts = {};
    (data || []).forEach((post) => {
      if (String(post.title || "").startsWith(STATUS_PREFIX)) return;
      if (isBlockedProfile(post.created_by)) return;
      if (!post.forum_id) return;
      counts[post.forum_id] = (counts[post.forum_id] || 0) + 1;
    });
    setForumThreadCounts(counts);
  };

  const loadGroupStats = async () => {
    const [{ data: memberData }, { data: postData }] = await Promise.all([
      supabase.from("community_group_members").select("group_id"),
      supabase
        .from("community_group_posts")
        .select("group_id,created_at")
        .order("created_at", { ascending: false })
    ]);

    const counts = {};
    (memberData || []).forEach((row) => {
      if (!row.group_id) return;
      counts[row.group_id] = (counts[row.group_id] || 0) + 1;
    });

    const latestByGroup = {};
    (postData || []).forEach((row) => {
      if (!row.group_id || latestByGroup[row.group_id]) return;
      latestByGroup[row.group_id] = row.created_at;
    });

    setGroupMemberCounts(counts);
    setGroupLastActive(latestByGroup);
  };

  const loadChallengeStats = async () => {
    const { data } = await supabase
      .from("community_challenge_participants")
      .select("challenge_id,user_id,progress");
    const counts = {};
    const mine = {};
    (data || []).forEach((row) => {
      if (!row.challenge_id) return;
      counts[row.challenge_id] = (counts[row.challenge_id] || 0) + 1;
      if (Number(row.user_id) === Number(userId)) {
        mine[row.challenge_id] = Number(row.progress || 0);
      }
    });
    setChallengeParticipantCounts(counts);
    setChallengeMyProgress(mine);
  };

  const loadSharedTemplateData = useCallback(async () => {
    const [{ data: templateData }, { data: ratingData }, { data: tryData }, { data: commentData }] = await Promise.all([
      supabase.from("shared_templates").select("*").order("created_at", { ascending: false }).limit(220),
      supabase.from("shared_template_ratings").select("template_id,user_id,rating"),
      supabase.from("shared_template_tries").select("template_id,user_id"),
      supabase
        .from("shared_template_comments")
        .select("id,template_id,user_id,body,created_at")
        .order("created_at", { ascending: false })
        .limit(320)
    ]);

    const ratingBuckets = {};
    const myRatings = {};
    (ratingData || []).forEach((row) => {
      const key = String(row.template_id);
      if (!ratingBuckets[key]) {
        ratingBuckets[key] = { sum: 0, count: 0, mine: null };
      }
      ratingBuckets[key].sum += Number(row.rating || 0);
      ratingBuckets[key].count += 1;
      if (Number(row.user_id) === Number(userId)) {
        ratingBuckets[key].mine = Number(row.rating || 0);
        myRatings[key] = Number(row.rating || 0);
      }
    });

    const tryCounts = {};
    const triedByMe = {};
    (tryData || []).forEach((row) => {
      const key = String(row.template_id);
      tryCounts[key] = (tryCounts[key] || 0) + 1;
      if (Number(row.user_id) === Number(userId)) {
        triedByMe[key] = true;
      }
    });

    const commentsByTemplate = {};
    (commentData || []).forEach((row) => {
      const key = String(row.template_id);
      if (!commentsByTemplate[key]) commentsByTemplate[key] = [];
      commentsByTemplate[key].push(row);
    });

    setSharedTemplates(templateData || []);
    setTemplateRatings(ratingBuckets);
    setTemplateTryCounts(tryCounts);
    setTemplateTriedByMe(triedByMe);
    setTemplateComments(commentsByTemplate);

    const profileIds = [
      ...(templateData || []).map((row) => row.created_by),
      ...(commentData || []).map((row) => row.user_id)
    ];
    loadProfiles(profileIds);
  }, [loadProfiles, userId]);

  const scheduleTemplateRefresh = useCallback(() => {
    if (templateRefreshTimerRef.current) {
      clearTimeout(templateRefreshTimerRef.current);
    }
    templateRefreshTimerRef.current = setTimeout(() => {
      loadSharedTemplateData();
      templateRefreshTimerRef.current = null;
    }, 240);
  }, [loadSharedTemplateData]);

  useEffect(() => {
    if (!userId) return;
    if (activeTab !== "templates") return;
    if (templatesBootstrappedRef.current) return;
    templatesBootstrappedRef.current = true;
    loadSharedTemplateData();
  }, [activeTab, loadSharedTemplateData, userId]);
// loadForumPosts takes a forum slug and loads the posts for that forum from the backend,
// it also loads the profiles of the post creators and the replies to those posts,
// this function is called when the active forum changes and also when a new post is created
// to refresh the list of posts, it queries the posts table for posts in the specified forum,
// then it loads the profiles of the post creators and the replies to those posts
// to display all the relevant information when rendering the forum posts
// similar functions exist for loading group posts and group information when 
// the active group changes
// the function also handles the case where the forum data is not yet 
// loaded and uses the forumTracks as a fallback
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
// fetchCommunity manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const fetchCommunity = async () => {
      setLoading(true);
      setBanner("");
      setCommunityLoadError("");
      try {
        await Promise.all(
          forumTracks.map((forum) =>
            supabase
              .from("community_forums")
              .upsert(
                {
                  title: forum.title,
                  subtitle: forum.subtitle,
                  topic_slug: forum.id,
                  created_by: userId
                },
                { onConflict: "topic_slug" }
              )
          )
        );
        const forumRes = await supabase.from("community_forums").select("*").order("created_at", { ascending: true });
        const [
          groupRes,
          challengeRes,
          membershipRes,
          friendRes,
          forumPostRes,
          groupMemberRes,
          groupPostRes,
          challengeParticipantRes
        ] = await Promise.all([
          supabase.from("community_groups").select("*").order("created_at", { ascending: false }),
          supabase.from("community_challenges").select("*").order("created_at", { ascending: false }),
          supabase.from("community_group_members").select("*").eq("user_id", Number(userId)),
          supabase
            .from("community_friends")
            .select("*")
            .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`),
          supabase.from("community_posts").select("id,forum_id"),
          supabase.from("community_group_members").select("group_id,user_id"),
          supabase
            .from("community_group_posts")
            .select("group_id,created_at")
            .order("created_at", { ascending: false })
            .limit(700),
          supabase.from("community_challenge_participants").select("challenge_id,user_id,progress")
        ]);
        if (!mounted) return;
        setForums(sortForumsByTrackOrder(forumRes.data || []));
        setGroups(groupRes.data || []);
        setChallenges(challengeRes.data || []);
        setMemberships(membershipRes.data || []);
        const threadCounts = {};
        (forumPostRes.data || []).forEach((post) => {
          if (!post.forum_id) return;
          threadCounts[post.forum_id] = (threadCounts[post.forum_id] || 0) + 1;
        });
        setForumThreadCounts(threadCounts);

        const groupCounts = {};
        (groupMemberRes.data || []).forEach((row) => {
          if (!row.group_id) return;
          groupCounts[row.group_id] = (groupCounts[row.group_id] || 0) + 1;
        });
        setGroupMemberCounts(groupCounts);
        const groupLatest = {};
        (groupPostRes.data || []).forEach((row) => {
          if (!row.group_id || groupLatest[row.group_id]) return;
          groupLatest[row.group_id] = row.created_at;
        });
        setGroupLastActive(groupLatest);

        const challengeCounts = {};
        const challengeMine = {};
        (challengeParticipantRes.data || []).forEach((row) => {
          if (!row.challenge_id) return;
          challengeCounts[row.challenge_id] = (challengeCounts[row.challenge_id] || 0) + 1;
          if (Number(row.user_id) === Number(userId)) {
            challengeMine[row.challenge_id] = Number(row.progress || 0);
          }
        });
        setChallengeParticipantCounts(challengeCounts);
        setChallengeMyProgress(challengeMine);

        const friendList = friendRes.data || [];
        setFriends(friendList);
        const friendIds = [Number(userId), ...friendList.flatMap((row) => [row.user_id, row.friend_user_id])];
        loadProfiles(friendIds);
        loadFriendStats(friendIds);
        loadFriendMessageSummaries();
        const defaultForum = forumTracks[0].id;
        setActiveForum(defaultForum);
        loadForumPosts(defaultForum, forumRes.data || []);
      } catch (error) {
        if (mounted) {
          setCommunityLoadError(
            toUserFacingNetworkMessage(error, "Could not load community right now. Please retry.")
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCommunity();
    // Render
    return () => {
      mounted = false;
    };
  }, [userId, communityReloadToken]);

  useEffect(() => {
    if (!userId) return;
    try {
      const key = `community_pinned_threads_${userId}`;
      const raw = localStorage.getItem(key);
      setPinnedThreadIds(raw ? JSON.parse(raw) : {});
    } catch {
      setPinnedThreadIds({});
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const key = `community_pinned_threads_${userId}`;
    localStorage.setItem(key, JSON.stringify(pinnedThreadIds));
  }, [pinnedThreadIds, userId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentThreadIds((prev) => {
        let changed = false;
        const next = {};
        Object.entries(prev).forEach(([postId, createdMs]) => {
          if (now - Number(createdMs) < 12000) {
            next[postId] = createdMs;
          } else {
            changed = true;
          }
        });
        if (!changed && Object.keys(next).length === Object.keys(prev).length) return prev;
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);
// below are useEffect hooks that set up realtime subscriptions to the 
// backend using Supabase's realtime features,
// the first subscription listens for new friend messages and 
// updates the friend list and message threads accordingly,
// the second subscription listens for new forum posts and replies and
//  updates the forum threads in realtime,
// these subscriptions ensure that users see new messages and posts
//  without needing to refresh the page
  useEffect(() => {
    if (!userId) return () => {};
    const channel = supabase
      .channel(`friend-messages-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_friend_messages" },
        (payload) => {
          const message = payload.new;
          const currentId = Number(userId);
          if (!message) return;
          if (Number(message.user_id) !== currentId && Number(message.friend_user_id) !== currentId) return;
          const otherId =
            Number(message.user_id) === currentId ? Number(message.friend_user_id) : Number(message.user_id);
          setFriendLatest((prev) => ({ ...prev, [otherId]: message }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
// the second subscription listens for new forum posts and replies,
// it keeps the thread list and reply list in sync with realtime inserts,
// this prevents users from missing new activity while they browse,
// and keeps the UI reactive without a manual refresh
  useEffect(() => {
    if (!userId) return () => {};
    const activeForumId = forums.find((forum) => forum.topic_slug === activeForum)?.id;
    const postIdSet = new Set(forumPosts.map((post) => post.id));

    const channel = supabase
      .channel(`community-forums-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        (payload) => {
          const post = payload.new;
          if (!post || !activeForumId) return;
          if (post.forum_id !== activeForumId) return;
          if (String(post.title || "").startsWith(STATUS_PREFIX)) return;
          setForumPosts((prev) => [post, ...prev]);
          setForumThreadCounts((prev) => ({
            ...prev,
            [post.forum_id]: (prev[post.forum_id] || 0) + 1
          }));
          setRecentThreadIds((prev) => ({ ...prev, [post.id]: Date.now() }));
          if (post.created_by) loadProfiles([post.created_by]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_post_replies" },
        (payload) => {
          const reply = payload.new;
          if (!reply) return;
          if (!postIdSet.has(reply.post_id)) return;
          setPostReplies((prev) => {
            const next = { ...prev };
            const current = next[reply.post_id] || [];
            next[reply.post_id] = [...current, reply];
            return next;
          });
          if (reply.created_by) loadProfiles([reply.created_by]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, activeForum, forums, forumPosts]);

  useEffect(() => {
    if (!userId) return () => {};
    const channel = supabase
      .channel(`community-templates-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_templates" }, scheduleTemplateRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_template_ratings" }, scheduleTemplateRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_template_tries" }, scheduleTemplateRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_template_comments" }, scheduleTemplateRefresh)
      .subscribe();
    return () => {
      if (templateRefreshTimerRef.current) {
        clearTimeout(templateRefreshTimerRef.current);
        templateRefreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const feedPostIds = (activityFeedItems || []).map((item) => item?.postId).filter(Boolean);
    if (!feedPostIds.length) return;

    let cancelled = false;
    const loadFeedReactions = async () => {
      const { data: reactionData } = await supabase
        .from("community_reactions")
        .select("*")
        .in("post_id", feedPostIds);

      if (cancelled) return;

      const nextReactions = {};
      const nextUserReactions = {};
      (reactionData || []).forEach((reaction) => {
        const key = `post:${reaction.post_id}-${reaction.reaction}`;
        nextReactions[key] = (nextReactions[key] || 0) + 1;
        if (userId && Number(reaction.user_id) === Number(userId)) {
          nextUserReactions[key] = reaction.id;
        }
      });

      setReactionCounts((prev) => ({ ...prev, ...nextReactions }));
      setUserReactions((prev) => ({ ...prev, ...nextUserReactions }));
    };

    loadFeedReactions();
    return () => {
      cancelled = true;
    };
  }, [activityFeedItems, userId]);

// derived forum lists and select options are memoised to avoid
// re-filtering and re-mapping on every render,
// these values update only when their dependencies change,
// and help keep scrolling + search snappy for large lists
  const filteredForums = useMemo(() => {
    return forums.length ? sortForumsByTrackOrder(forums) : forumTracks;
  }, [forums]);

  const forumTitleById = useMemo(() => {
    const map = {};
    forums.forEach((forum) => {
      map[forum.id] = forum.title || forum.topic_slug || "Forum";
    });
    return map;
  }, [forums]);

  const forumThreadCountsBySlug = useMemo(() => {
    const next = {};
    filteredForums.forEach((forum) => {
      const slug = forum.topic_slug || forum.id;
      const count = forumThreadCounts[forum.id] || 0;
      next[slug] = count;
    });
    return next;
  }, [filteredForums, forumThreadCounts]);

  const forumSelectOptions = useMemo(() => {
    return forums.length ? sortForumsByTrackOrder(forums) : forumTracks;
  }, [forums]);

  const tabOrder = ["forums", "feed", "leaderboard", "groups", "challenges", "friends", "circle"];
  const activeTabIndex = Math.max(tabOrder.indexOf(activeTab), 0);

  useEffect(() => {
    if (!leaderboardGroupId && memberships.length) {
      const nextGroupId = String(memberships[0]?.group_id || "");
      if (nextGroupId) setLeaderboardGroupId(nextGroupId);
    }
  }, [leaderboardGroupId, memberships]);

// sync the new post modal forum selector with the active forum,
// this ensures the modal always defaults to the forum the user is browsing,
// and prevents stale forum selection if the user switches tabs,
// the value resets whenever the modal closes
  useEffect(() => {
    if (!createPostOpen) {
      setNewPostForum(activeForum);
    }
  }, [activeForum, createPostOpen, setNewPostForum]);

  useEffect(() => {
    if (activeTab !== "forums") return;
    loadForumThreadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, blockedProfileIds]);

  useEffect(() => {
    let cancelled = false;
    let debounceHandle = null;
    const query = search.trim().toLowerCase();
    if (activeTab !== "forums" || query.length < 2 || !forums.length) {
      setGlobalForumPosts([]);
      setGlobalPostReplies({});
      return () => {
        cancelled = true;
        if (debounceHandle) clearTimeout(debounceHandle);
      };
    }

    const loadGlobalSearchResults = async () => {
      const forumIds = forums.map((forum) => forum.id).filter(Boolean);
      if (!forumIds.length) return;

      const { data: posts } = await supabase
        .from("community_posts")
        .select("*")
        .in("forum_id", forumIds)
        .limit(300)
        .order("created_at", { ascending: false });

      const filteredPosts = (posts || []).filter((post) => {
        if (String(post.title || "").startsWith(STATUS_PREFIX)) return false;
        if (!isVisibleAuthor(post.created_by)) return false;
        const title = (post.title || "").toLowerCase();
        const body = (post.body || "").toLowerCase();
        return title.includes(query) || body.includes(query);
      });

      if (cancelled) return;
      setGlobalForumPosts(filteredPosts);

      if (!filteredPosts.length) {
        setGlobalPostReplies({});
        return;
      }

      const postIds = filteredPosts.map((post) => post.id);
      const { data: replyData } = await supabase
        .from("community_post_replies")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });

      const groupedReplies = {};
      (replyData || []).forEach((reply) => {
        if (!groupedReplies[reply.post_id]) groupedReplies[reply.post_id] = [];
        groupedReplies[reply.post_id].push(reply);
      });

      if (cancelled) return;
      setGlobalPostReplies(groupedReplies);

      const authorIds = [
        ...filteredPosts.map((post) => post.created_by),
        ...(replyData || []).map((reply) => reply.created_by)
      ];
      loadProfiles(authorIds);
    };

    debounceHandle = setTimeout(() => {
      loadGlobalSearchResults();
    }, 220);
    return () => {
      cancelled = true;
      if (debounceHandle) clearTimeout(debounceHandle);
    };
  }, [activeTab, search, forums, isVisibleAuthor, loadProfiles]);

// below are the action handlers for create/join/update flows,
// they call supabase mutations, set banner feedback,
// and refresh the relevant lists after successful operations,
// each handler also validates required fields before submitting
  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) return;
    if (!userId) {
      setBanner("Sign in to create a group.");
      return;
    }
    const { data, error } = await supabase
      .from("community_groups")
      .insert([
        {
          name: newGroup.name.trim(),
          goal: newGroup.goal.trim(),
          privacy: newGroup.privacy,
          created_by: userId
        }
      ])
      .select("*")
      .single();
    if (error) {
      setBanner(error.message || "Could not create group.");
      return;
    }
    const { error: memberError } = await supabase.from("community_group_members").insert([
      {
        group_id: data.id,
        user_id: userId,
        role: "owner"
      }
    ]);
    if (memberError) {
      setBanner(memberError.message || "Could not join group.");
    }
    setCreateGroupOpen(false);
    setNewGroup({ name: "", goal: "", privacy: "invite" });
    setBanner("Group created.");
    const { data: groupData } = await supabase
      .from("community_groups")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: membershipData } = await supabase
      .from("community_group_members")
      .select("*")
      .eq("user_id", userId);
    setGroups(groupData || []);
    setMemberships(membershipData || []);
    loadGroupStats();
    setActiveTab("groups");
    if (data?.id) {
      await openGroupRoom(data.id);
    }
  };

// create a new challenge tied to the current user,
// validates required fields and normalizes numeric inputs,
// then refreshes the challenges list after insert,
// and surfaces any errors via the banner
  const handleCreateChallenge = async () => {
    if (!newChallenge.title.trim()) return;
    if (!userId) {
      setBanner("Sign in to create a challenge.");
      return;
    }
    const { error } = await supabase.from("community_challenges").insert([
      {
        title: newChallenge.title.trim(),
        type: newChallenge.type,
        target_value: newChallenge.target ? Number(newChallenge.target) : null,
        duration_days: newChallenge.durationDays ? Number(newChallenge.durationDays) : 7,
        created_by: userId
      }
    ]);
    if (error) {
      setBanner(error.message || "Could not create challenge.");
      return;
    }
    setCreateChallengeOpen(false);
    setNewChallenge({ title: "", type: "distance", target: "", durationDays: "7" });
    setBanner("Challenge created.");
    const { data } = await supabase
      .from("community_challenges")
      .select("*")
      .order("created_at", { ascending: false });
    setChallenges(data || []);
    loadChallengeStats();
  };

// create a new forum post for the selected forum,
// resolves the forum id from the current slug selection,
// prevents posting if the forum or user is missing,
// then refreshes the active forum feed after success
  const handleCreatePost = async (draftPost) => {
    const payloadTitle = String(draftPost?.title || "").trim();
    const payloadBody = String(draftPost?.body || "").trim();
    if (!payloadTitle) return;
    const forumSlug = newPostForum || activeForum;
    let forumId = forums.find((forum) => forum.topic_slug === forumSlug)?.id;
    if (!forumId && forumSlug) {
      const { data } = await supabase
        .from("community_forums")
        .select("id")
        .eq("topic_slug", forumSlug)
        .single();
      forumId = data?.id || null;
    }
    if (!forumId) {
      setBanner("Select a forum to post in.");
      return;
    }
    if (!userId) {
      setBanner("Sign in to post.");
      return;
    }
    const { error } = await supabase.from("community_posts").insert([
      {
        forum_id: forumId,
        title: payloadTitle,
        body: payloadBody,
        created_by: userId
      }
    ]);
    if (error) {
      setBanner(error.message || "Could not create post.");
      return;
    }
    setCreatePostOpen(false);
    setNewPost({ title: "", body: "" });
    setNewPostForum(forumSlug);
    setBanner("Post created.");
    await recordEngagementAction("community_post");
    loadForumThreadCounts();
    loadForumPosts(forumSlug);
  };

// create a reply on the active thread or parent reply,
// validates input and requires authentication,
// posts to the replies table and refreshes the thread,
// then clears the reply modal state
  const handleCreateReply = async () => {
    if (!newReply.body.trim() || !activeThreadId) return;
    if (!userId) {
      setBanner("Sign in to reply.");
      return;
    }
    const { error } = await supabase.from("community_post_replies").insert([
      {
        post_id: activeThreadId,
        parent_id: newReply.parentId,
        body: newReply.body.trim(),
        created_by: userId
      }
    ]);
    if (error) {
      setBanner(error.message || "Could not post reply.");
      return;
    }
    setCreateReplyOpen(false);
    setThreadInlineReplyOpen(false);
    setNewReply({ body: "", parentId: null });
    await recordEngagementAction("community_reply");
    if (forceThreadPage && selectedThread?.id) {
      const { data: replyData } = await supabase
        .from("community_post_replies")
        .select("*")
        .eq("post_id", selectedThread.id)
        .order("created_at", { ascending: true });
      setRouteThreadReplies(replyData || []);
      return;
    }
    loadForumPosts(activeForum);
  };

  const loadGroupRoom = async (groupId) => {
    if (!groupId) return;
    setGroupRoomLoading(true);
    try {
      const [{ data: postsData }, { data: memberData }] = await Promise.all([
        supabase
          .from("community_group_posts")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(GROUP_ROOM_POST_BUFFER_LIMIT),
        supabase
          .from("community_group_members")
          .select("*")
          .eq("group_id", groupId)
      ]);
      const orderedPosts = [...(postsData || [])].reverse();
      setGroupRoomPosts(orderedPosts);
      setGroupRoomMembers(memberData || []);
      const profileIds = [
        ...(postsData || []).map((post) => post.created_by),
        ...(memberData || []).map((member) => member.user_id)
      ];
      loadProfiles(profileIds);
    } catch (error) {
      setBanner(toUserFacingNetworkMessage(error, "Could not load this group room right now."));
    } finally {
      setGroupRoomLoading(false);
    }
  };

  const openGroupRoom = async (groupId) => {
    if (!groupId) return;
    const member = memberships.some(
      (membership) => String(membership.group_id) === String(groupId)
    );
    if (!member) {
      setBanner("Join group first to open room.");
      return;
    }
    setActiveGroupId(groupId);
    setGroupRoomId(groupId);
    setGroupRoomChannel("general");
    setGroupRoomQuestionReplyTargetId("");
    await loadGroupRoom(groupId);
  };

  const handleReplyToQuestion = (post) => {
    const authorName = profiles?.[post?.created_by] || "athlete";
    const authorHandle = String(authorName || "").startsWith("@")
      ? String(authorName || "")
      : `@${String(authorName || "").replace(/^@+/, "")}`;
    setGroupRoomChannel("questions");
    setGroupRoomQuestionReplyTargetId(String(post?.id || ""));
    setGroupRoomQuestionDraft(`${authorHandle} `);
  };

  const handleDeleteGroupRoomPost = async (postId) => {
    const resolvedPostId = String(postId || "").trim();
    if (!resolvedPostId) return;
    const { error } = await supabase
      .from("community_group_posts")
      .delete()
      .eq("id", resolvedPostId);
    if (error) {
      setBanner(error.message || "Could not delete message.");
      return;
    }
    setGroupRoomPosts((prev) => prev.filter((row) => String(row.id) !== resolvedPostId));
    setBanner("Deleted.");
  };

  const handleSendGroupRoomPost = async () => {
    if (groupRoomSending) return;
    const trimmedDraft = String(groupRoomDraft || "").trim();
    if (!trimmedDraft || !groupRoomId) return;
    if (!userId) {
      setBanner("Sign in to post in group room.");
      return;
    }
    let payloadBody = trimmedDraft;
    if (groupRoomChannel === "questions") {
      if (groupRoomQuestionReplyTargetId) {
        if (trimmedDraft.length < 2) {
          setBanner("Reply must be at least 2 characters.");
          return;
        }
        payloadBody = buildQuestionReplyPayload(groupRoomQuestionReplyTargetId, trimmedDraft);
      } else {
        const parts = trimmedDraft
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const title = String(parts[0] || "").slice(0, 140).trim();
        const details = parts.slice(1).join("\n").trim();
        if (!title) {
          setBanner("Add a short question title.");
          return;
        }
        payloadBody = details
          ? `${GROUP_QUESTION_PREFIX}${title}\n\n${details}`
          : `${GROUP_QUESTION_PREFIX}${title}`;
      }
    }
    setGroupRoomSending(true);
    try {
      const { error } = await supabase.from("community_group_posts").insert([
        {
          group_id: groupRoomId,
          channel: groupRoomChannel === "questions" ? "questions" : "general",
          body: payloadBody,
          created_by: userId
        }
      ]);
      if (error) {
        setBanner(error.message || "Could not post in room.");
        return;
      }
      if (groupRoomChannel === "questions") {
        setGroupRoomQuestionDraft("");
        setGroupRoomQuestionReplyTargetId("");
      } else {
        setGroupRoomGeneralDraft("");
      }
      loadGroupStats();
      await recordEngagementAction("community_post");
    } finally {
      setGroupRoomSending(false);
    }
  };

// send a friend request by username,
// validates input, checks that the user exists,
// inserts the relationship row with ordered ids,
// then refreshes the friends list and closes the modal
  const handleAddFriend = async () => {
    if (!newFriendUsername.trim()) return;
    if (!userId) {
      setBanner("Sign in to send request.");
      return;
    }
    const requestedUsername = String(newFriendUsername).trim().toLowerCase();
    if (requestedUsername.length < 3) {
      setBanner("Username must be at least 3 characters.");
      return;
    }
    const { data: friendProfile, error: friendLookupError } = await supabase
      .from("user_profiles")
      .select("id, username")
      .ilike("username", requestedUsername)
      .maybeSingle();
    if (friendLookupError || !friendProfile) {
      setBanner("Username not found.");
      return;
    }
    const parsedFriendId = Number(friendProfile.id);
    if (!parsedFriendId || parsedFriendId === Number(userId)) {
      setBanner("You can't send a request to yourself.");
      return;
    }
    const orderedUserId = Math.min(Number(userId), parsedFriendId);
    const orderedFriendId = Math.max(Number(userId), parsedFriendId);
    const requesterId = Number(userId);
    const requesterIsLower = requesterId === orderedUserId;
    const { error } = await supabase.from("community_friends").insert([
      {
        user_id: orderedUserId,
        friend_user_id: orderedFriendId,
        status: requesterIsLower ? "pending_low" : "pending_high"
      }
    ]);
    if (error && error.code !== "23505") {
      setBanner(error.message || "Could not send friend request.");
      return;
    }
    setAddFriendOpen(false);
    setNewFriendUsername("");
    setBanner("Friend request sent.");
    const { data } = await supabase
      .from("community_friends")
      .select("*")
      .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);
    setFriends(data || []);
  };

// handleJoinGroup manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleJoinGroup = async (groupId, openAfterJoin = false) => {
    if (!userId) {
      setBanner("Sign in to join a group.");
      return;
    }
    const alreadyMember = memberships.some(
      (membership) => String(membership.group_id) === String(groupId)
    );
    if (alreadyMember) {
      setBanner("Already joined.");
      if (openAfterJoin) {
        navigate(groupRoomPath(groupId));
      }
      return;
    }
    const { error } = await supabase.from("community_group_members").insert([
      {
        group_id: groupId,
        user_id: Number(userId),
        role: "member"
      }
    ]);
    if (error && error.code !== "23505") {
      setBanner(error.message || "Could not join group.");
      return;
    }
    setBanner("Joined group.");
    await refreshGroupsAndMemberships();
    setActiveGroupId(groupId);
    loadGroupStats();
    if (openAfterJoin) {
      navigate(groupRoomPath(groupId));
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!userId || !groupId) return;
    const { error } = await supabase
      .from("community_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", Number(userId));
    if (error) {
      setBanner(error.message || "Could not leave group.");
      return;
    }
    setBanner("Left group.");
    await refreshGroupsAndMemberships();
    loadGroupStats();
    if (String(groupRoomId) === String(groupId) || String(activeGroupId) === String(groupId)) {
      setGroupRoomId(null);
      setActiveGroupId(null);
      navigate(communityBasePath);
    }
  };

  const executeDeleteGroup = async (group) => {
    if (!userId || !group?.id) return;
    const createdBy = group.created_by;
    const userNumeric = Number(userId);
    const ownerMatches =
      (Number.isFinite(Number(createdBy)) && Number(createdBy) === userNumeric) ||
      String(createdBy) === String(userId);
    if (!ownerMatches) {
      setBanner("Only the group owner can delete this group.");
      return;
    }

    const { error } = await supabase
      .from("community_groups")
      .delete()
      .eq("id", String(group.id))
      .eq("created_by", createdBy);
    if (error) {
      setBanner(error.message || "Could not delete group.");
      return;
    }

    setBanner("Group deleted.");
    await refreshGroupsAndMemberships();
    loadGroupStats();
    if (String(groupRoomId) === String(group.id) || String(activeGroupId) === String(group.id)) {
      setGroupRoomId(null);
      setActiveGroupId(null);
      navigate(communityBasePath);
    }
  };

  const handleDeleteGroup = (group) => {
    if (!group?.id) return;
    openConfirmDialog({
      kind: "delete-group",
      title: "Delete group?",
      body: `Delete "${group.name || "this group"}"? This cannot be undone.`,
      payload: { group },
    });
  };

  const isGroupOwner = (group) => {
    const createdBy = group?.created_by;
    const userNumeric = Number(userId);
    return (
      (Number.isFinite(Number(createdBy)) && Number(createdBy) === userNumeric) ||
      String(createdBy) === String(userId)
    );
  };

  const handleOpenEditGroup = (group) => {
    if (!group || !isGroupOwner(group)) return;
    setEditGroupTarget(group);
    setEditGroupForm({ name: String(group.name || ""), goal: String(group.goal || "") });
    setEditGroupOpen(true);
  };

  const handleUpdateGroup = async () => {
    if (!editGroupTarget?.id || !userId) return;
    const nextName = String(editGroupForm.name || "").trim();
    const nextGoal = String(editGroupForm.goal || "").trim();
    if (!nextName) {
      setBanner("Group name is required.");
      return;
    }
    const { error } = await supabase
      .from("community_groups")
      .update({ name: nextName, goal: nextGoal })
      .eq("id", String(editGroupTarget.id))
      .eq("created_by", editGroupTarget.created_by);
    if (error) {
      setBanner(error.message || "Could not update group.");
      return;
    }
    setEditGroupOpen(false);
    setEditGroupTarget(null);
    setBanner("Group updated.");
    await refreshGroupsAndMemberships();
    loadGroupStats();
  };

  const handleCreateStatusPost = async () => {
    const body = String(statusDraft || "").trim();
    if (!body || !userId || statusPosting) return;
    const statusForumId = forums.find((forum) => forum.topic_slug === "mindset")?.id || forums[0]?.id;
    if (!statusForumId) {
      setBanner("Status posting is unavailable right now.");
      return;
    }
    setStatusPosting(true);
    try {
      const { error } = await supabase.from("community_posts").insert([
        {
          forum_id: statusForumId,
          title: `${STATUS_PREFIX}${body.slice(0, 120)}`,
          body,
          created_by: Number(userId)
        }
      ]);
      if (error) {
        setBanner(error.message || "Could not post status.");
        return;
      }
      setStatusDraft("");
      setBanner("Status posted.");
      await recordEngagementAction("community_post");
      loadActivityFeed();
    } finally {
      setStatusPosting(false);
    }
  };

// accept an incoming friend request,
// updates the relationship status in the backend,
// refreshes the friends list on success,
// and shows feedback via the banner
  const handleAcceptFriend = async (friendRow) => {
    const { error } = await supabase
      .from("community_friends")
      .update({ status: "accepted" })
      .eq("id", friendRow.id);
    if (error) {
      setBanner(error.message || "Could not approve request.");
      return;
    }
    setBanner("Message request approved.");
    const { data } = await supabase
      .from("community_friends")
      .select("*")
      .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);
    setFriends(data || []);
  };

// reject an incoming friend request,
// removes the relationship row in the backend,
// refreshes the friends list on success,
// and shows feedback via the banner
  const handleRejectFriend = async (friendRow) => {
    const { error } = await supabase
      .from("community_friends")
      .delete()
      .eq("id", friendRow.id);
    if (error) {
      setBanner(error.message || "Could not reject request.");
      return;
    }
    setBanner("Message request rejected.");
    const { data } = await supabase
      .from("community_friends")
      .select("*")
      .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);
    setFriends(data || []);
  };

  const handleRemoveFriend = async (friendRow) => {
    if (!userId) return;
    const { error } = await supabase
      .from("community_friends")
      .delete()
      .eq("id", friendRow.id);
    if (error) {
      setBanner(error.message || "Could not remove friend.");
      return;
    }
    setBanner("Connection removed.");
    const { data } = await supabase
      .from("community_friends")
      .select("*")
      .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);
    setFriends(data || []);
  };

// build the display label for a friend row,
// resolves the "other" user id from the relationship,
// falls back to the numeric id if profile data is missing,
// used throughout the friend list and chat header
  const buildFriendLabel = (friendRow) => {
    const currentId = Number(userId);
    const otherId = friendRow.user_id === currentId ? friendRow.friend_user_id : friendRow.user_id;
    return profiles[otherId] || "Athlete";
  };

// build the small stats line for a friend row,
// uses cached rank + level from user_state,
// falls back to placeholder values if missing,
// keeps the friend list compact and readable
  const buildFriendMeta = (friendRow) => {
    const currentId = Number(userId);
    const otherId = friendRow.user_id === currentId ? friendRow.friend_user_id : friendRow.user_id;
    const stats = friendStats[otherId];
    if (!stats) return "Rank -- · Level --";
    return `Rank ${stats.rank || "--"} · Level ${stats.level ?? "--"}`;
  };

// determine whether a friend has unread messages,
// ignores messages sent by the current user,
// used to show notification dots in the UI
  const getFriendUnread = useCallback((friendRow) => {
    const currentId = Number(userId);
    const otherId = friendRow.user_id === currentId ? friendRow.friend_user_id : friendRow.user_id;
    const latest = friendLatest[otherId];
    if (!latest) return false;
    return Number(latest.user_id) !== Number(userId);
  }, [friendLatest, userId]);

// delete a forum post owned by the current user,
// validates user authentication and ownership,
// removes the post from the backend,
// then reloads the active forum feed
  const handleDeletePost = async (postId) => {
    if (!userId) return;
    const { error } = await supabase
      .from("community_posts")
      .delete()
      .eq("id", postId)
      .eq("created_by", Number(userId));
    if (error) {
      setBanner(error.message || "Could not delete post.");
      return;
    }
    setBanner("Post deleted.");
    if (forceThreadPage) {
      navigate(communityBasePath);
      return;
    }
    loadForumThreadCounts();
    loadForumPosts(activeForum);
  };

// delete a reply owned by the current user,
// validates user authentication and ownership,
// removes the reply from the backend,
// then reloads the active forum thread list
  const handleDeleteReply = async (replyId) => {
    if (!userId) return;
    const { error } = await supabase
      .from("community_post_replies")
      .delete()
      .eq("id", replyId)
      .eq("created_by", Number(userId));
    if (error) {
      setBanner(error.message || "Could not delete reply.");
      return;
    }
    setBanner("Reply deleted.");
    if (forceThreadPage && selectedThread?.id) {
      setRouteThreadReplies((prev) => prev.filter((reply) => reply.id !== replyId));
      return;
    }
    loadForumPosts(activeForum);
  };

// handleJoinChallenge manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleJoinChallenge = async (challengeId) => {
    if (!userId) {
      setBanner("Sign in to join a challenge.");
      return;
    }
    const { error } = await supabase.from("community_challenge_participants").insert([
      {
        challenge_id: challengeId,
        user_id: Number(userId),
        progress: 0
      }
    ]);
    if (error && error.code !== "23505") {
      setBanner(error.message || "Could not join challenge.");
      return;
    }
    setBanner(error?.code === "23505" ? "Already joined challenge." : "Challenge joined.");
    loadChallengeStats();
  };

  const handleRateTemplate = async (templateId, rating) => {
    if (!userId || !templateId) return;
    const normalized = Number(rating || 0);
    if (!Number.isFinite(normalized) || normalized < 1 || normalized > 5) return;
    const { error } = await supabase
      .from("shared_template_ratings")
      .upsert(
        [{ template_id: templateId, user_id: Number(userId), rating: normalized }],
        { onConflict: "template_id,user_id" }
      );
    if (error) {
      setBanner("Could not save rating.");
      return;
    }
    await recordEngagementAction("community_template_rate");
    await loadSharedTemplateData();
  };

  const handleTryTemplate = async (templateId) => {
    if (!userId || !templateId) return;
    const { error } = await supabase
      .from("shared_template_tries")
      .insert([{ template_id: templateId, user_id: Number(userId) }]);
    if (error && error.code !== "23505") {
      setBanner("Could not save try.");
      return;
    }
    await recordEngagementAction("community_template_try");
    await loadSharedTemplateData();
  };

  const handleAddTemplateToMine = async (template) => {
    if (!userId || !template) return;
    const payload = template.payload || {};
    try {
      if (template.template_type === "training_plan") {
        const insertPayload = {
          user_id: Number(userId),
          name: payload.name || template.title,
          sport: payload.sport || template.sport || "running",
          goal: payload.goal || template.goal || "",
          summary: payload.summary || template.summary || "",
          default_focus: payload.defaultFocus || "Base",
          duration_target: payload.durationTarget ?? template.duration_target ?? null,
          distance_target: payload.distanceTarget ?? template.distance_target ?? null,
          outline: Array.isArray(payload.outline) ? payload.outline : []
        };
        const { error } = await supabase.from("user_training_plans").insert([insertPayload]);
        if (error) throw error;
      } else if (template.template_type === "workout_program") {
        const insertPayload = {
          user_id: Number(userId),
          name: payload.name || template.title,
          level: payload.level || template.level || "All levels",
          focus: payload.focus || template.focus || "Mixed",
          description: payload.description || template.summary || "",
          exercises: Array.isArray(payload.exercises) ? payload.exercises : []
        };
        const { error } = await supabase.from("user_programs").insert([insertPayload]);
        if (error) throw error;
      } else if (template.template_type === "recipe") {
        const mealName = String(payload.name || template.title || "").trim();
        if (!mealName) {
          setBanner("Recipe is missing a title.");
          return;
        }
        const { data: existing } = await supabase
          .from("saved_meals")
          .select("id,name")
          .eq("user_id", Number(userId))
          .limit(500);
        const exists = (existing || []).some(
          (row) => String(row.name || "").trim().toLowerCase() === mealName.toLowerCase()
        );
        if (!exists) {
          const { error } = await supabase.from("saved_meals").insert([
            {
              user_id: Number(userId),
              name: mealName,
              source: "community_template"
            }
          ]);
          if (error) throw error;
        }
      }

      await recordEngagementAction("community_template_add");
      setBanner("Added to your library.");
    } catch (error) {
      setBanner("Could not add template.");
    }
  };

  const handleCommentTemplate = async (templateId) => {
    if (!userId || !templateId) return;
    const body = String(templateCommentDrafts[templateId] || "").trim();
    if (!body) return;
    const { error } = await supabase
      .from("shared_template_comments")
      .insert([{ template_id: templateId, user_id: Number(userId), body }]);
    if (error) {
      setBanner("Could not post comment.");
      return;
    }
    setTemplateCommentDrafts((prev) => ({ ...prev, [templateId]: "" }));
    await recordEngagementAction("community_template_comment");
    await loadSharedTemplateData();
  };

  const handleCreateRecipeTemplate = async () => {
    if (!userId) return;
    const title = String(newRecipeTemplate.title || "").trim();
    if (!title) {
      setBanner("Add a recipe title.");
      return;
    }

    const ingredients = String(newRecipeTemplate.ingredients || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [ingredient, ...rest] = line.split(" - ");
        return {
          ingredient: String(ingredient || "").trim(),
          measure: String(rest.join(" - ") || "").trim()
        };
      })
      .filter((item) => item.ingredient);

    const steps = String(newRecipeTemplate.steps || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const tags = String(newRecipeTemplate.tags || "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12);

    const payload = {
      name: title,
      mealType: newRecipeTemplate.mealType || "Dinner",
      prepMinutes: newRecipeTemplate.prepMinutes ? Number(newRecipeTemplate.prepMinutes) : null,
      cookMinutes: newRecipeTemplate.cookMinutes ? Number(newRecipeTemplate.cookMinutes) : null,
      servings: newRecipeTemplate.servings ? Number(newRecipeTemplate.servings) : null,
      ingredients,
      steps,
      tags
    };

    const { error } = await supabase.from("shared_templates").insert([
      {
        template_type: "recipe",
        title,
        subtitle: `${payload.mealType} recipe`,
        goal: payload.mealType,
        summary: steps[0] || "Community recipe",
        tags,
        payload,
        created_by: Number(userId)
      }
    ]);
    if (error) {
      setBanner("Could not create recipe template.");
      return;
    }

    await recordEngagementAction("community_template_share");
    setCreateRecipeTemplateOpen(false);
    setNewRecipeTemplate({
      title: "",
      mealType: "Dinner",
      ingredients: "",
      steps: "",
      prepMinutes: "",
      cookMinutes: "",
      servings: "",
      tags: ""
    });
    setBanner("Recipe template shared.");
    await loadSharedTemplateData();
  };

  const togglePinnedThread = (postId) => {
    setPinnedThreadIds((prev) => {
      const next = { ...prev };
      if (next[postId]) {
        delete next[postId];
      } else {
        next[postId] = true;
      }
      return next;
    });
  };

// load all posts for a forum slug,
// then fetch replies and reactions for those posts,
// builds lookup tables for quick render access,
// and loads author profile names for display
  const loadForumPosts = async (forumSlug, forumList = forums) => {
    const forumId = forumList.find((forum) => forum.topic_slug === forumSlug)?.id;
    if (!forumId) return;
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .eq("forum_id", forumId)
      .order("created_at", { ascending: false });
    const visiblePosts = (data || []).filter(
      (post) => !String(post.title || "").startsWith(STATUS_PREFIX) && isVisibleAuthor(post.created_by)
    );
    setForumPosts(visiblePosts);
    if (!visiblePosts.length) {
      setPostReplies({});
      setReactionCounts({});
      setUserReactions({});
      return;
    }
    const postIds = visiblePosts.map((post) => post.id);
    const { data: replyData } = await supabase
      .from("community_post_replies")
      .select("*")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });
    const grouped = {};
    (replyData || []).forEach((reply) => {
      if (!grouped[reply.post_id]) grouped[reply.post_id] = [];
      grouped[reply.post_id].push(reply);
    });
    setPostReplies(grouped);
    const authorIds = [
      ...visiblePosts.map((post) => post.created_by),
      ...(replyData || []).map((reply) => reply.created_by)
    ];
    loadProfiles(authorIds);
    const { data: reactionData } = await supabase
      .from("community_reactions")
      .select("*")
      .in("post_id", postIds);
    const nextReactions = {};
    const nextUserReactions = {};
    (reactionData || []).forEach((reaction) => {
      const key = reaction.reply_id
        ? `reply:${reaction.reply_id}-${reaction.reaction}`
        : `post:${reaction.post_id}-${reaction.reaction}`;
      nextReactions[key] = (nextReactions[key] || 0) + 1;
      if (userId && reaction.user_id === userId) {
        nextUserReactions[key] = reaction.id;
      }
    });
    setReactionCounts(nextReactions);
    setUserReactions(nextUserReactions);
  };

// sort threads based on selected mode:
// newest by post timestamp, top by reply count,
// active by latest post/reply activity with tie-breakers
  const sortedForumPosts = useMemo(() => {
    const usingGlobalForumSearch = Boolean(search.trim());
    const sourcePosts = usingGlobalForumSearch ? globalForumPosts : forumPosts;
    const sourceReplies = usingGlobalForumSearch ? globalPostReplies : postReplies;
    if (!sourcePosts.length) return [];
    const copy = [...sourcePosts];
    const getReplyCount = (postId) => (sourceReplies[postId] || []).length;
    const getLatestActivityMs = (post) => {
      const replies = sourceReplies[post.id] || [];
      const latestReplyMs = replies.reduce((latest, reply) => {
        const ms = Date.parse(reply.created_at || "");
        return Number.isNaN(ms) ? latest : Math.max(latest, ms);
      }, 0);
      const postMs = Date.parse(post.created_at || "");
      return Math.max(Number.isNaN(postMs) ? 0 : postMs, latestReplyMs);
    };
    const pinnedDelta = (a, b) =>
      (pinnedThreadIds[b.id] ? 1 : 0) - (pinnedThreadIds[a.id] ? 1 : 0);

    if (threadSort === "newest") {
      return copy.sort((a, b) => {
        const delta = pinnedDelta(a, b);
        if (delta !== 0) return delta;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    if (threadSort === "top") {
      return copy.sort((a, b) => {
        const delta = pinnedDelta(a, b);
        if (delta !== 0) return delta;
        const aCount = getReplyCount(a.id);
        const bCount = getReplyCount(b.id);
        return bCount - aCount;
      });
    }
    if (threadSort === "active") {
      return copy.sort((a, b) => {
        const delta = pinnedDelta(a, b);
        if (delta !== 0) return delta;
        const bLatestMs = getLatestActivityMs(b);
        const aLatestMs = getLatestActivityMs(a);
        if (bLatestMs !== aLatestMs) return bLatestMs - aLatestMs;

        const bCount = getReplyCount(b.id);
        const aCount = getReplyCount(a.id);
        if (bCount !== aCount) return bCount - aCount;

        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    return copy.sort((a, b) => pinnedDelta(a, b));
  }, [forumPosts, postReplies, globalForumPosts, globalPostReplies, threadSort, search, pinnedThreadIds]);

  const filteredThreadPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedForumPosts.filter((post) => isVisibleAuthor(post.created_by));
    return sortedForumPosts.filter((post) => {
      if (!isVisibleAuthor(post.created_by)) return false;
      const title = (post.title || "").toLowerCase();
      const body = (post.body || "").toLowerCase();
      return title.includes(query) || body.includes(query);
    });
  }, [isVisibleAuthor, sortedForumPosts, search]);

  const filteredActivityFeedItems = useMemo(
    () => (activityFeedItems || []).filter((item) => isVisibleAuthor(item?.actor_id)),
    [activityFeedItems, isVisibleAuthor]
  );

// compute unread count for all friends,
// uses latest message + last seen logic per friend,
// keeps the badge count in sync with realtime updates,
// recalculates when message or friend state changes
  const unreadCount = useMemo(() => {
    return friends.reduce((count, friend) => (getFriendUnread(friend) ? count + 1 : count), 0);
  }, [friends, getFriendUnread]);

  const incomingRequestCount = useMemo(() => {
    return friends.reduce((count, friend) => (getFriendStatus(friend) === "incoming" ? count + 1 : count), 0);
  }, [friends, getFriendStatus]);

// build the "Thread Pulse" list (top 5 active threads),
// counts replies per thread and sorts descending,
// used in the sidebar for quick navigation,
// recalculates when posts or replies change
  const threadPulse = useMemo(() => {
    const usingGlobalForumSearch = Boolean(search.trim());
    const sourcePosts = usingGlobalForumSearch ? globalForumPosts : forumPosts;
    const sourceReplies = usingGlobalForumSearch ? globalPostReplies : postReplies;
    if (!sourcePosts.length) return [];
    return [...sourcePosts]
      .map((post) => ({
        post,
        count: (sourceReplies[post.id] || []).length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [forumPosts, postReplies, globalForumPosts, globalPostReplies, search]);

// determine the most active thread id,
// used to display the "Most active" badge,
// falls back to null if there are no threads,
// recalculates when threadPulse changes
  const mostActiveId = useMemo(() => {
    if (!threadPulse.length) return null;
    return threadPulse[0].post.id;
  }, [threadPulse]);

  const selectedThread = useMemo(() => {
    if (forceThreadPage) return routeThread;
    return null;
  }, [forceThreadPage, routeThread]);

  const selectedThreadReplies = useMemo(() => {
    if (forceThreadPage) return routeThreadReplies;
    const usingGlobalForumSearch = Boolean(search.trim());
    const sourceReplies = usingGlobalForumSearch ? globalPostReplies : postReplies;
    if (!selectedThread) return [];
    return sourceReplies[selectedThread.id] || [];
  }, [forceThreadPage, routeThreadReplies, postReplies, globalPostReplies, selectedThread, search]);

  const selectedThreadRepliesSorted = useMemo(() => {
    if (!selectedThreadReplies.length) return [];
    const scoreReply = (replyId) =>
      reactionOptions.reduce(
        (sum, option) => sum + Number(reactionCounts[`reply:${replyId}-${option.id}`] || 0),
        0
      );
    const next = [...selectedThreadReplies];
    if (threadReplySort === "newest") {
      next.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return next;
    }
    next.sort((a, b) => {
      const scoreDiff = scoreReply(b.id) - scoreReply(a.id);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return next;
  }, [selectedThreadReplies, reactionCounts, threadReplySort]);

  const selectedThreadReplyTree = useMemo(() => {
    if (!selectedThreadRepliesSorted.length) return [];
    return buildReplyTree(selectedThreadRepliesSorted);
  }, [selectedThreadRepliesSorted]);

// handle a reaction toggle for posts or replies,
// adds or removes a reaction for the current user,
// updates local reaction counts immediately,
// and stores reaction ids for quick un-react
  const handleReact = async ({ postId, replyId, reaction }) => {
    if (!userId) {
      setBanner("Sign in to react.");
      return;
    }
    const key = replyId
      ? `reply:${replyId}-${reaction}`
      : `post:${postId}-${reaction}`;
    const existingReactionId = userReactions[key];
    if (existingReactionId) {
      const { error } = await supabase
        .from("community_reactions")
        .delete()
        .eq("id", existingReactionId);
      if (error) {
        setBanner("Could not remove reaction.");
        return;
      }
      setUserReactions((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setReactionCounts((prev) => ({
        ...prev,
        [key]: Math.max((prev[key] || 1) - 1, 0)
      }));
      return;
    }
    const { data, error } = await supabase
      .from("community_reactions")
      .insert([
        {
          post_id: postId,
          reply_id: replyId || null,
          user_id: userId,
          reaction
        }
      ])
      .select("id")
      .single();
    if (error) {
      setBanner("Could not add reaction.");
      return;
    }
    setUserReactions((prev) => ({ ...prev, [key]: data?.id }));
    setReactionCounts((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    await recordEngagementAction("community_reaction");
  };

// render replies recursively as a nested tree,
// supports multi-level replies with indentation,
// includes reaction buttons and reply/delete actions,
// used inside each forum thread card
  const renderReplies = (replyNodes, level = 0, rootPostId = null) => {
    if (!replyNodes?.length) return null;
    return replyNodes.map((reply) => {
      if (isBlockedProfile(reply.created_by)) return null;
      const author = profiles[reply.created_by] || reply.created_by || "Anonymous";
      const avatarInitial = String(author).charAt(0).toUpperCase();
      const replyKeyPrefix = `reply:${reply.id}`;
      return (
        <div key={reply.id} className={`community-reply-card ${level > 0 ? "nested" : ""}`}>
          <div className="community-reply-topline">
            <span className="community-reply-avatar" aria-hidden="true">{avatarInitial}</span>
            <button type="button" className="community-profile-link community-reply-author" onClick={() => openUserProfile(reply.created_by)}>{author}</button>
            <span className="community-reply-time">{formatTime(reply.created_at)}</span>
          </div>
          <div className="community-reply-body">{reply.body}</div>
          <div className="community-reaction-row">
            {reactionOptions.map((option) => {
              const key = `${replyKeyPrefix}-${option.id}`;
              const count = reactionCounts[key] || 0;
              const active = Boolean(userReactions[key]);
              return (
                <button
                  key={option.id}
                  className={`community-reaction-btn ${active ? "active" : ""}`}
                  onClick={() =>
                    handleReact({ postId: rootPostId || reply.post_id, replyId: reply.id, reaction: option.id })
                  }
                >
                  <span className="community-reaction-emoji" aria-hidden="true">{option.emoji}</span>
                  <span className="community-reaction-count">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="community-reply-actions">
            <button
              className="studio-back community-action-btn community-primary-btn"
              onClick={() => {
                setActiveThreadId(reply.post_id);
                setNewReply({ body: "", parentId: reply.id });
                if (forceThreadPage) {
                  setThreadInlineReplyOpen(true);
                  setCreateReplyOpen(false);
                } else {
                  setCreateReplyOpen(true);
                }
              }}
              type="button"
            >
              Reply
            </button>
            <button
              className="community-reply-btn"
              type="button"
              onClick={() =>
                handleReportContent({
                  targetType: "reply",
                  targetId: reply.id,
                  targetUserId: reply.created_by
                })
              }
            >
              Report
            </button>
            {Number(userId) === Number(reply.created_by) && (
              <button
                className="community-reply-btn danger"
                onClick={() => handleDeleteReply(reply.id)}
                type="button"
              >
                Delete
              </button>
            )}
            {Number(reply.created_by) !== Number(userId) && (
              <button
                className="community-reply-btn"
                type="button"
                onClick={() => handleToggleBlockProfile(reply.created_by)}
              >
                {isBlockedProfile(reply.created_by) ? "Unblock" : "Block"}
              </button>
            )}
          </div>
          {reply.children?.length > 0 && (
            <div className="community-replies">
              {renderReplies(reply.children, level + 1, rootPostId || reply.post_id)}
            </div>
          )}
        </div>
      );
    });
  };

// derive current group and membership state,
// used to show join/open actions in groups tab,
// keeps the main render logic clean,
// recalculates when groups or memberships update
  const activeGroup = groups.find((group) => String(group.id) === String(groupRoomId || activeGroupId)) || null;
  const groupRoomGeneralPosts = useMemo(
    () =>
      groupRoomPosts.filter((post) => {
        const body = String(post.body || "");
        const channel = normalizeGroupPostChannel(post);
        return channel === "general" && !body.startsWith(GROUP_QUESTION_PREFIX) && !parseQuestionReplyPayload(body);
      }),
    [groupRoomPosts]
  );
  const groupRoomQuestionPosts = useMemo(
    () =>
      groupRoomPosts.filter((post) => {
        const channel = normalizeGroupPostChannel(post);
        return channel === "questions" && !parseQuestionReplyPayload(post.body);
      }),
    [groupRoomPosts]
  );
  const groupRoomQuestionReplyPosts = useMemo(
    () =>
      groupRoomPosts.filter((post) => {
        const channel = normalizeGroupPostChannel(post);
        return channel === "questions" && Boolean(parseQuestionReplyPayload(post.body));
      }),
    [groupRoomPosts]
  );
  const groupRoomQuestionRepliesByQuestionId = useMemo(() => {
    const next = {};
    groupRoomQuestionReplyPosts.forEach((reply) => {
      const parsed = parseQuestionReplyPayload(reply.body);
      const qid = String(parsed?.questionId || "").trim();
      if (!qid) return;
      if (!next[qid]) next[qid] = [];
      next[qid].push(reply);
    });
    return next;
  }, [groupRoomQuestionReplyPosts]);
  const groupRoomQuestionPostById = useMemo(() => {
    const next = {};
    groupRoomQuestionPosts.forEach((post) => {
      next[Number(post.id)] = post;
    });
    return next;
  }, [groupRoomQuestionPosts]);
  const groupRoomVisiblePosts = groupRoomChannel === "questions" ? groupRoomQuestionPosts : groupRoomGeneralPosts;
  const groupRoomGeneralUnreadCount = useMemo(() => {
    const roomId = String(groupRoomId || "").trim();
    if (!roomId || !groupRoomGeneralPosts.length) return 0;
    const seenAt = String(groupRoomSeenByChannel[`${roomId}:general`] || "");
    const seenMs = seenAt ? Date.parse(seenAt) : 0;
    return groupRoomGeneralPosts.reduce((count, post) => {
      if (Number(post.created_by) === Number(userId)) return count;
      const createdMs = Date.parse(String(post.created_at || ""));
      if (!Number.isFinite(createdMs)) return count;
      return createdMs > seenMs ? count + 1 : count;
    }, 0);
  }, [groupRoomGeneralPosts, groupRoomSeenByChannel, groupRoomId, userId]);
  const groupRoomQuestionUnreadCount = useMemo(() => {
    const roomId = String(groupRoomId || "").trim();
    if (!roomId || !groupRoomQuestionPosts.length) return 0;
    const seenAt = String(groupRoomSeenByChannel[`${roomId}:questions`] || "");
    const seenMs = seenAt ? Date.parse(seenAt) : 0;
    return groupRoomQuestionPosts.reduce((count, post) => {
      if (Number(post.created_by) === Number(userId)) return count;
      const createdMs = Date.parse(String(post.created_at || ""));
      if (!Number.isFinite(createdMs)) return count;
      return createdMs > seenMs ? count + 1 : count;
    }, 0);
  }, [groupRoomQuestionPosts, groupRoomSeenByChannel, groupRoomId, userId]);
  const groupRoomDraft = groupRoomChannel === "questions" ? groupRoomQuestionDraft : groupRoomGeneralDraft;
  const isGroupMember = useCallback((groupId) =>
    memberships.some((membership) => String(membership.group_id) === String(groupId)), [memberships]);
  const groupPrivacyLabel = (privacy) => {
    if (privacy === "open") return "Open";
    if (privacy === "request") return "Request";
    return "Invite";
  };
  const challengeTypeMeta = {
    distance: { label: "Distance", icon: "KM" },
    time: { label: "Time", icon: "TM" },
    streak: { label: "Streak", icon: "ST" }
  };
  const visibleGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => {
      const name = String(group.name || "").toLowerCase();
      const goal = String(group.goal || "").toLowerCase();
      return name.includes(query) || goal.includes(query);
    });
  }, [groups, groupSearch]);
  const joinedGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    const base = groups.filter((group) => isGroupMember(group.id));
    if (!query) return base;
    return base.filter((group) => {
      const name = String(group.name || "").toLowerCase();
      const goal = String(group.goal || "").toLowerCase();
      return name.includes(query) || goal.includes(query);
    });
  }, [groups, groupSearch, isGroupMember]);
  const groupsTabUnreadCount = useMemo(() => {
    if (!joinedGroups.length) return 0;
    return joinedGroups.reduce((count, group) => {
      const groupId = String(group?.id || "").trim();
      if (!groupId) return count;
      const lastActiveRaw = groupLastActive[groupId];
      const lastActiveMs = Date.parse(String(lastActiveRaw || ""));
      if (!Number.isFinite(lastActiveMs)) return count;
      const seenGeneralMs = Date.parse(String(groupRoomSeenByChannel[`${groupId}:general`] || ""));
      const seenQuestionsMs = Date.parse(String(groupRoomSeenByChannel[`${groupId}:questions`] || ""));
      const seenMs = Math.max(
        Number.isFinite(seenGeneralMs) ? seenGeneralMs : 0,
        Number.isFinite(seenQuestionsMs) ? seenQuestionsMs : 0
      );
      return lastActiveMs > seenMs ? count + 1 : count;
    }, 0);
  }, [joinedGroups, groupLastActive, groupRoomSeenByChannel]);
  const discoverGroups = useMemo(() => {
    const next = visibleGroups.filter((group) => !isGroupMember(group.id));
    return groupSearch.trim() ? next : next.slice(0, 12);
  }, [visibleGroups, groupSearch, isGroupMember]);
  const joinedChallengeIds = useMemo(() => {
    return new Set(Object.keys(challengeMyProgress).map((id) => String(id)));
  }, [challengeMyProgress]);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !challenges.length) return undefined;

    const awardChallengeCompletions = async () => {
      let awardedCount = 0;
      for (const challenge of challenges) {
        const challengeId = String(challenge?.id || "");
        if (!challengeId) continue;
        const targetValue = Number(challenge?.target_value || 0);
        if (targetValue <= 0) continue;
        const myProgress = Number(challengeMyProgress[challengeId] || 0);
        if (myProgress < targetValue) continue;

        const idempotencyKey = `challenge:${challengeId}:user:${Number(userId)}`;
        if (completedChallengeAwardRef.current.has(idempotencyKey)) continue;

        const { error } = await supabase.rpc("complete_challenge_with_xp", {
          p_challenge_id: challengeId,
          p_user_id: Number(userId),
          p_progress: myProgress,
          p_idempotency_key: idempotencyKey,
        });
        if (error) {
          console.error("complete_challenge_with_xp failed:", error);
          continue;
        }

        completedChallengeAwardRef.current.add(idempotencyKey);
        awardedCount += 1;
      }

      if (!cancelled && awardedCount > 0) {
        setBanner(awardedCount === 1 ? "Challenge completed. XP awarded." : "Challenges completed. XP awarded.");
        await recalcUserState(userId);
        window.dispatchEvent(new Event("user_state_updated"));
      }
    };

    awardChallengeCompletions();
    return () => {
      cancelled = true;
    };
  }, [challengeMyProgress, challenges, userId]);
  const selectedThreadRepliesCollapsed = selectedThread
    ? Boolean(collapsedThreadIds[selectedThread.id])
    : false;

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    const list = sharedTemplates.filter((template) => {
      if (templateTypeFilter !== "all" && template.template_type !== templateTypeFilter) return false;
      if (templateFocusFilter !== "all") {
        const payload = template.payload || {};
        const focusBlob = [
          payload.focus,
          template.focus,
          template.goal,
          template.summary,
          ...(Array.isArray(template.tags) ? template.tags : [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!focusBlob.includes(templateFocusFilter)) return false;
      }
      if (!query) return true;
      const tags = Array.isArray(template.tags) ? template.tags.join(" ") : "";
      const payload = template.payload || {};
      const ingredientBlob = Array.isArray(payload.ingredients)
        ? payload.ingredients
            .map((item) => `${item?.ingredient || ""} ${item?.measure || ""}`.trim())
            .join(" ")
        : "";
      const stepsBlob = Array.isArray(payload.steps) ? payload.steps.join(" ") : "";
      const searchBlob = [
        template.title,
        template.subtitle,
        template.goal,
        template.summary,
        template.sport,
        template.level,
        template.focus,
        tags,
        ingredientBlob,
        stepsBlob
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (searchBlob.includes(query)) return true;
      if (query.includes("20k")) {
        const distance = Number(template.distance_target || 0);
        if (distance >= 20) return true;
      }
      return false;
    });

    return list.sort((a, b) => {
      const aRating = templateRatings[a.id] || { sum: 0, count: 0 };
      const bRating = templateRatings[b.id] || { sum: 0, count: 0 };
      const aAvg = aRating.count > 0 ? aRating.sum / aRating.count : 0;
      const bAvg = bRating.count > 0 ? bRating.sum / bRating.count : 0;
      const aTry = Number(templateTryCounts[a.id] || 0);
      const bTry = Number(templateTryCounts[b.id] || 0);
      if (templateSort === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (templateSort === "tried") {
        return bTry - aTry || bAvg - aAvg;
      }
      const aScore = aAvg * 0.6 + Math.log10(aTry + 1) * 0.4;
      const bScore = bAvg * 0.6 + Math.log10(bTry + 1) * 0.4;
      return bScore - aScore;
    });
  }, [sharedTemplates, templateSearch, templateTypeFilter, templateFocusFilter, templateSort, templateRatings, templateTryCounts]);

  const swipeTemplates = filteredTemplates;
  const likedTemplates = useMemo(
    () =>
      filteredTemplates.filter((template) => {
        const myRating = Number(templateRatings[template.id]?.mine || 0);
        return myRating >= 4;
      }),
    [filteredTemplates, templateRatings]
  );
  const visibleSwipeQueue = useMemo(() => {
    if (!swipeTemplates.length) return [];
    if (templateQueueExpanded || swipeTemplates.length <= 12) {
      return swipeTemplates.map((template, queueIndex) => ({ template, queueIndex }));
    }
    const start = Math.max(0, Math.min(templateDeckIndex - 5, Math.max(0, swipeTemplates.length - 12)));
    return swipeTemplates.slice(start, start + 12).map((template, offset) => ({
      template,
      queueIndex: start + offset,
    }));
  }, [swipeTemplates, templateQueueExpanded, templateDeckIndex]);

  useEffect(() => {
    setTemplateDeckIndex(0);
    setTemplateQueueExpanded(false);
  }, [templateSearch, templateTypeFilter, templateFocusFilter, templateSort]);

  useEffect(() => {
    if (templateTypeFilter === "training_plan" && templateFocusFilter !== "all") {
      setTemplateFocusFilter("all");
    }
  }, [templateTypeFilter, templateFocusFilter]);

  useEffect(() => {
    if (!swipeTemplates.length) setTemplateDeckIndex(0);
  }, [swipeTemplates, templateDeckIndex]);

  const getTemplatePreviewRows = (template, expanded = false) => {
    const payload = template?.payload || {};
    if (template?.template_type === "workout_program") {
      const list = expanded ? (payload.exercises || []) : (payload.exercises || []).slice(0, 3);
      return list
        .map((exercise) => {
          const name = String(exercise?.name || "").trim();
          const sets = Number(exercise?.sets) || 0;
          const reps = Number(exercise?.reps) || 0;
          if (!name) return null;
          const detail = sets > 0 && reps > 0 ? `${sets} x ${reps}` : "custom";
          return `${name} - ${detail}`;
        })
        .filter(Boolean);
    }
    if (template?.template_type === "training_plan") {
      const outline = Array.isArray(payload.outline) ? payload.outline : [];
      const firstBlock = outline[0] || null;
      const sessions = Array.isArray(firstBlock?.sessions) ? firstBlock.sessions : [];
      return (expanded ? sessions : sessions.slice(0, 3)).map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (template?.template_type === "recipe") {
      const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
      return (expanded ? ingredients : ingredients.slice(0, 4))
        .map((item) => {
          const ingredient = String(item?.ingredient || "").trim();
          const measure = String(item?.measure || "").trim();
          if (!ingredient && !measure) return null;
          return `${ingredient}${measure ? ` (${measure})` : ""}`;
        })
        .filter(Boolean);
    }
    return [];
  };

  const getTemplateMetaBadges = (template) => {
    const payload = template?.payload || {};
    if (template?.template_type === "workout_program") {
      const exerciseCount = Array.isArray(payload.exercises) ? payload.exercises.length : 0;
      return [`${exerciseCount} exercises`, template?.level || "All levels", template?.focus || "Mixed"];
    }
    if (template?.template_type === "training_plan") {
      const weeks = Array.isArray(payload.outline) ? payload.outline.length : 0;
      const sport = payload.sport || template?.sport || "training";
      const duration = payload.durationTarget || template?.duration_target;
      const distance = payload.distanceTarget || template?.distance_target;
      return [
        `${weeks} weeks`,
        String(sport).toUpperCase(),
        duration ? `${duration} min` : distance ? `${distance} km` : "custom target"
      ];
    }
    if (template?.template_type === "recipe") {
      const mealType = payload.mealType || "Meal";
      const prep = payload.prepMinutes ? `${payload.prepMinutes} min prep` : null;
      const servings = payload.servings ? `${payload.servings} servings` : null;
      return [mealType, prep, servings].filter(Boolean);
    }
    return [];
  };

  const renderEmptyState = ({ icon = "i", title, sub, ctaLabel, onCta }) => (
    <div className="community-empty community-empty-state">
      <div className="community-empty-icon" aria-hidden="true">{icon}</div>
      <div className="community-empty-title">{title}</div>
      {sub && <div className="community-empty-sub">{sub}</div>}
      {ctaLabel && onCta && (
        <button className="studio-back community-cta-btn community-primary-btn" type="button" onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  );

  const handleTemplateDeckAction = async (action) => {
    if (!swipeTemplates.length) return;
    if (templateDeckAnimating) return;
    const current = swipeTemplates[templateDeckIndex];
    if (!current) return;
    setTemplateDeckAnimating(action);
    if (action === "right" || action === "like") {
      await handleRateTemplate(current.id, 5);
    } else if (action === "add") {
      await handleAddTemplateToMine(current);
    } else if (action === "left") {
      await handleRateTemplate(current.id, 1);
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animationDelay = reducedMotion ? 60 : 320;

    setTimeout(() => {
      setTemplateDeckAnimating(null);
      setTemplateDeckDragX(0);
      setTemplateDeckIndex((prev) => Math.min(prev + 1, swipeTemplates.length));
    }, animationDelay);
  };

  const handleTemplateDeckKeyDown = async (event) => {
    if (!swipeTemplates.length || templateDeckAnimating) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      await handleTemplateDeckAction("right");
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      await handleTemplateDeckAction("left");
    }
  };

  const handleTemplateDeckPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const interactiveTarget = event.target?.closest?.("button,input,textarea,select,a");
    if (interactiveTarget) return;
    templateDeckPointerRef.current = { active: true, startX: event.clientX, moved: false };
    setTemplateDeckDragX(0);
  };

  const handleTemplateDeckPointerMove = (event) => {
    if (!templateDeckPointerRef.current.active) return;
    const delta = event.clientX - templateDeckPointerRef.current.startX;
    if (Math.abs(delta) > 6) {
      templateDeckPointerRef.current.moved = true;
    }
    const clamped = Math.max(-160, Math.min(160, delta));
    setTemplateDeckDragX(clamped);
  };

  const handleTemplateDeckPointerEnd = async () => {
    if (!templateDeckPointerRef.current.active) return;
    const delta = templateDeckDragX;
    templateDeckPointerRef.current = { active: false, startX: 0, moved: false };
    if (delta >= 92) {
      await handleTemplateDeckAction("right");
      return;
    }
    if (delta <= -92) {
      await handleTemplateDeckAction("left");
      return;
    }
    setTemplateDeckDragX(0);
  };
  void handleTryTemplate;
  void handleCommentTemplate;
  void likedTemplates;
  void visibleSwipeQueue;
  void getTemplatePreviewRows;
  void getTemplateMetaBadges;
  void handleTemplateDeckKeyDown;
  void handleTemplateDeckPointerDown;
  void handleTemplateDeckPointerMove;
  void handleTemplateDeckPointerEnd;

  useEffect(() => {
    if (!groupRoomId) return;
    const list = groupRoomListRef.current;
    if (!list) return;
    const raf = window.requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [groupRoomPosts, groupRoomId, groupRoomChannel]);

  useEffect(() => {
    const roomId = String(groupRoomId || "").trim();
    if (!roomId || !groupRoomChannel) return;
    const key = `${roomId}:${groupRoomChannel}`;
    const nowIso = new Date().toISOString();
    setGroupRoomSeenByChannel((prev) => {
      if (prev[key] === nowIso) return prev;
      return { ...prev, [key]: nowIso };
    });
  }, [groupRoomId, groupRoomChannel, groupRoomVisiblePosts.length]);

  useEffect(() => {
    if (!userId || !groupRoomId) return () => {};
    const channel = supabase
      .channel(`community-group-room-${groupRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_group_posts",
          filter: `group_id=eq.${groupRoomId}`
        },
        (payload) => {
          const post = payload.new;
          if (!post) return;
          setGroupRoomPosts((prev) => {
            if (prev.some((row) => String(row.id) === String(post.id))) return prev;
            const next = [...prev, post];
            if (next.length > GROUP_ROOM_POST_BUFFER_LIMIT) {
              return next.slice(-GROUP_ROOM_POST_BUFFER_LIMIT);
            }
            return next;
          });
          setGroupLastActive((prev) => ({ ...prev, [groupRoomId]: post.created_at }));
          if (post.created_by) loadProfiles([post.created_by]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, groupRoomId, loadProfiles]);

  useEffect(() => {
    if (!userId || !forceThreadPage || !selectedThread?.id) return () => {};
    const threadId = selectedThread.id;
    const channel = supabase
      .channel(`community-thread-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_post_replies",
          filter: `post_id=eq.${threadId}`
        },
        (payload) => {
          const reply = payload.new;
          if (!reply) return;
          setRouteThreadReplies((prev) => {
            if (prev.some((row) => Number(row.id) === Number(reply.id))) return prev;
            return [...prev, reply];
          });
          if (reply.created_by) loadProfiles([reply.created_by]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, forceThreadPage, selectedThread?.id, loadProfiles]);

  useEffect(() => {
    if (!forceGroupRoom || !routeGroupId || !userId) return;
    if (String(groupRoomId) === String(routeGroupId)) {
      setRouteGroupBootLoading(false);
      return;
    }
    let cancelled = false;

    const openRoutedRoom = async () => {
      setRouteGroupBootLoading(true);
      setActiveTab("groups");
      const localMember = memberships.some(
        (membership) =>
          String(membership.group_id) === String(routeGroupId) &&
          Number(membership.user_id) === Number(userId)
      );

      let member = localMember;
      if (!member) {
        const { data } = await supabase
          .from("community_group_members")
          .select("group_id,user_id")
          .eq("group_id", routeGroupId)
          .eq("user_id", userId)
          .limit(1);
        member = Array.isArray(data) && data.length > 0;
      }

      if (cancelled) return;
      if (!member) {
        setBanner("Join group first to open room.");
        navigate(communityBasePath);
        setRouteGroupBootLoading(false);
        return;
      }

      setActiveGroupId(routeGroupId);
      setGroupRoomId(routeGroupId);
      setGroupRoomChannel("general");
      setGroupRoomQuestionReplyTargetId("");
      await loadGroupRoom(routeGroupId);
      if (!cancelled) {
        setRouteGroupBootLoading(false);
      }
    };

    openRoutedRoom();
    return () => {
      cancelled = true;
      setRouteGroupBootLoading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceGroupRoom, routeGroupId, userId, memberships, groupRoomId]);

  useEffect(() => {
    if (!forceThreadPage || !routeThreadId || !userId) return;
    let cancelled = false;

    const loadThreadRoute = async () => {
      setRouteThreadBootLoading(true);
      setActiveTab("forums");
      const normalizedThreadId = String(routeThreadId || "").trim();
      if (!normalizedThreadId) {
        navigate(communityBasePath);
        setRouteThreadBootLoading(false);
        return;
      }

      const { data: threadData } = await supabase
        .from("community_posts")
        .select("*")
        .eq("id", normalizedThreadId)
        .single();

      if (cancelled) return;
      if (!threadData) {
        setBanner("Thread not found.");
        navigate(communityBasePath);
        setRouteThreadBootLoading(false);
        return;
      }

      const { data: replyData } = await supabase
        .from("community_post_replies")
        .select("*")
        .eq("post_id", normalizedThreadId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      setActiveThreadId(normalizedThreadId);
      setRouteThread(threadData);
      setRouteThreadReplies(replyData || []);
      loadProfiles([threadData.created_by, ...(replyData || []).map((reply) => reply.created_by)]);
      if (!cancelled) {
        setRouteThreadBootLoading(false);
      }
    };

    loadThreadRoute();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceThreadPage, routeThreadId, userId]);

  const renderGroupRoom = (isRouteMode = false) => (
    <GroupRoomPanel
      isRouteMode={isRouteMode}
      activeGroup={activeGroup}
      groupRoomMembers={groupRoomMembers}
      groupRoomPosts={groupRoomPosts}
      groupRoomLoading={groupRoomLoading}
      groupRoomVisiblePosts={groupRoomVisiblePosts}
      groupRoomChannel={groupRoomChannel}
      groupRoomQuestionRepliesByQuestionId={groupRoomQuestionRepliesByQuestionId}
      groupRoomQuestionPostById={groupRoomQuestionPostById}
      groupRoomQuestionReplyTargetId={groupRoomQuestionReplyTargetId}
      groupRoomGeneralUnreadCount={groupRoomGeneralUnreadCount}
      groupRoomQuestionUnreadCount={groupRoomQuestionUnreadCount}
      groupRoomDraft={groupRoomDraft}
      groupRoomSending={groupRoomSending}
      groupRoomListRef={groupRoomListRef}
      userId={userId}
      profiles={profiles}
      groupPrivacyLabel={groupPrivacyLabel}
      formatTime={formatTime}
      parseQuestionReplyPayload={parseQuestionReplyPayload}
      normalizeGroupPostChannel={normalizeGroupPostChannel}
      isBlockedProfile={isBlockedProfile}
      openUserProfile={openUserProfile}
      onBackToGroups={() => {
        setGroupRoomId(null);
        navigate(communityBasePath);
      }}
      onLeaveGroup={handleLeaveGroup}
      onSwitchChannel={(channel) => {
        setGroupRoomChannel(channel);
        if (channel === "general") setGroupRoomQuestionReplyTargetId("");
      }}
      onReplyToQuestion={handleReplyToQuestion}
      onReportContent={handleReportContent}
      onDeletePost={handleDeleteGroupRoomPost}
      onToggleBlockProfile={handleToggleBlockProfile}
      onCancelQuestionReply={() => {
        setGroupRoomQuestionReplyTargetId("");
        setGroupRoomQuestionDraft("");
      }}
      onQuestionDraftChange={setGroupRoomQuestionDraft}
      onGeneralDraftChange={setGroupRoomGeneralDraft}
      onSend={handleSendGroupRoomPost}
      renderEmptyState={renderEmptyState}
      groupQuestionPrefix={GROUP_QUESTION_PREFIX}
    />
  );

// render the full Community Hub layout,
// includes header, tabs, sidebar, and main feed,
// conditionally renders forum/group/challenge views,
// and attaches modals for creation flows
  return (
    <div className={`community-shell ${forceGroupRoom ? "community-shell-room-mode" : ""} ${forceThreadPage ? "community-shell-thread-mode" : ""}`} data-user={userId || ""}>
      {!forceGroupRoom && !forceThreadPage && (
        <>
          {/* header block with title + summary copy, */}
          {/* visually anchors the community section, */}
          {/* aligns action buttons to the right, */}
          {/* and keeps the page identity consistent */}
          <div className="community-header">
            <div className="community-header-main">
              <button className="studio-back" onClick={() => navigate(backPath)} type="button">
                {'Back'}
              </button>
              <div className="community-kicker">COMMUNITY</div>
              <h2 className="community-title">Train With Others</h2>
              <p className="community-sub">
                Accountability, forums, and challenges built for serious athletes.
              </p>
            </div>
            <div className="community-cta-row">
              <button className="studio-back community-cta-btn" onClick={() => setWalkthroughOpen(true)}>
                Walkthrough
              </button>
              <button className="studio-back community-cta-btn" onClick={() => setCreateGroupOpen(true)}>
                Create group
              </button>
              <button className="studio-back community-cta-btn" onClick={() => setAddFriendOpen(true)}>
                Add friend
              </button>
            </div>
          </div>
          {/* top-level tabs to switch between forums/groups/challenges, */}
          {/* keeps the main content scoped to one view at a time, */}
          {/* updates the activeTab state on click, */}
          {/* and controls which sidebar + feed panels render */}
          <div className="community-tabs community-main-tabs">
            <button
              className={`community-tab ${activeTab === "forums" ? "active" : ""}`}
              onClick={() => setActiveTab("forums")}
              type="button"
            >
              Forums
            </button>
            <button
              className={`community-tab ${activeTab === "feed" ? "active" : ""}`}
              onClick={() => setActiveTab("feed")}
              type="button"
            >
              Feed
            </button>
            <button
              className={`community-tab ${activeTab === "leaderboard" ? "active" : ""}`}
              onClick={() => setActiveTab("leaderboard")}
              type="button"
            >
              Leaderboard
            </button>
            <button
              className={`community-tab ${activeTab === "groups" ? "active" : ""}`}
              onClick={() => setActiveTab("groups")}
              type="button"
            >
              Groups
              {groupsTabUnreadCount > 0 ? (
                <span
                  className="community-tab-alert-dot"
                  aria-label={`${groupsTabUnreadCount} groups with unread activity`}
                  title={`${groupsTabUnreadCount} groups with unread activity`}
                />
              ) : null}
            </button>
            <button
              className={`community-tab ${activeTab === "challenges" ? "active" : ""}`}
              onClick={() => setActiveTab("challenges")}
              type="button"
            >
              Challenges
            </button>
            <button
              className={`community-tab ${activeTab === "friends" ? "active" : ""}`}
              onClick={() => setActiveTab("friends")}
              type="button"
            >
              Friends
            </button>
            <button
              className={`community-tab ${activeTab === "circle" ? "active" : ""}`}
              onClick={() => setActiveTab("circle")}
              type="button"
            >
              Overview
            </button>
            <span
              className="community-tabs-indicator"
              aria-hidden="true"
              style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
            />
          </div>
        </>
      )}
      {forceGroupRoom && (
        <div className="community-group-room-route-panel">
          {routeGroupBootLoading && renderEmptyState({ icon: "...", title: "Loading room", sub: "Fetching group messages." })}
          {!routeGroupBootLoading && groupRoomId && renderGroupRoom(true)}
          {!routeGroupBootLoading &&
            !groupRoomId &&
            renderEmptyState({
              icon: "!",
              title: "Could not open room",
              sub: "Use Back and open the group again.",
            })}
        </div>
      )}
      {forceThreadPage && (
        <div className="community-thread-route-panel">
          {(routeThreadBootLoading || !selectedThread) && renderEmptyState({ icon: "...", title: "Loading thread", sub: "Fetching thread details." })}
          {!routeThreadBootLoading && selectedThread && (
            <div className="community-thread-modal">
              <div className="community-thread-main-column">
              <div className="community-thread-modal-head-card">
                <div className="community-thread-modal-head">
                  <div className="community-thread-head-main">
                    <div className="community-feed-title community-thread-modal-title">{selectedThread.title}</div>
                    <div className="community-thread-meta">
                      <span className="community-meta-pill community-meta-author">
                        <button type="button" className="community-profile-link community-meta-author-link" onClick={() => openUserProfile(selectedThread.created_by)}>
                          {profiles[selectedThread.created_by] || selectedThread.created_by || "Anonymous"}
                        </button>
                      </span>
                      <span className="community-meta-pill">{formatTime(selectedThread.created_at)}</span>
                      <span className="community-meta-pill">{selectedThreadReplies.length} replies</span>
                    </div>
                  </div>
                  <button className="community-thread-close-btn" onClick={() => navigate(communityBasePath)} type="button" aria-label="Back to community">
                    ×
                  </button>
                </div>
                <div className="community-thread-body-card">
                  <div className="community-section-label">Original Post</div>
                  <div className="community-feed-sub community-thread-modal-body">
                    {selectedThread.body || "No details yet."}
                  </div>
                </div>
                <div className="community-reaction-row community-thread-modal-reactions">
                  {reactionOptions.map((option) => {
                    const key = `post:${selectedThread.id}-${option.id}`;
                    const count = reactionCounts[key] || 0;
                    const active = Boolean(userReactions[key]);
                    return (
                      <button
                        key={option.id}
                        className={`community-reaction-btn ${active ? "active" : ""}`}
                        onClick={() => handleReact({ postId: selectedThread.id, reaction: option.id })}
                      >
                        <span className="community-reaction-emoji" aria-hidden="true">{option.emoji}</span>
                        <span className="community-reaction-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="community-thread-actions community-thread-modal-actions community-thread-modal-quick-actions">
                  <button
                    className="studio-back community-action-btn community-primary-btn"
                    type="button"
                    onClick={() => {
                      setActiveThreadId(selectedThread.id);
                      setNewReply({ body: "", parentId: null });
                      setThreadInlineReplyOpen(true);
                      setCreateReplyOpen(false);
                    }}
                  >
                    Reply
                  </button>
                  <button
                    className="studio-back community-action-btn"
                    type="button"
                    onClick={() =>
                      handleReportContent({
                        targetType: "thread",
                        targetId: selectedThread.id,
                        targetUserId: selectedThread.created_by
                      })
                    }
                  >
                    Report
                  </button>
                  {Number(selectedThread.created_by) !== Number(userId) && (
                    <button
                      className="studio-back community-action-btn"
                      type="button"
                      onClick={() => handleToggleBlockProfile(selectedThread.created_by)}
                    >
                      {isBlockedProfile(selectedThread.created_by) ? "Unblock" : "Block"}
                    </button>
                  )}
                  {Number(userId) === Number(selectedThread.created_by) && (
                    <button
                      className="community-reply-btn danger"
                      type="button"
                      onClick={async () => {
                        await handleDeletePost(selectedThread.id);
                        navigate(communityBasePath);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div className="community-thread-comments-section">
                <div className="community-thread-comments-head">
                  <div className="community-section-label">
                    Replies {selectedThreadReplies.length > 0 ? `(${selectedThreadReplies.length})` : ""}
                  </div>
                  <div className="community-thread-head-controls">
                    <div className="community-thread-sort-row">
                      <button
                        type="button"
                        className={`community-thread-sort-btn ${threadReplySort === "liked" ? "active" : ""}`}
                        onClick={() => setThreadReplySort("liked")}
                      >
                        Most liked
                      </button>
                      <button
                        type="button"
                        className={`community-thread-sort-btn ${threadReplySort === "newest" ? "active" : ""}`}
                        onClick={() => setThreadReplySort("newest")}
                      >
                        Newest
                      </button>
                    </div>
                    <button
                      type="button"
                      className="community-thread-collapse-btn"
                      onClick={() =>
                        setCollapsedThreadIds((prev) => ({
                          ...prev,
                          [selectedThread.id]: !prev[selectedThread.id]
                        }))
                      }
                    >
                      {selectedThreadRepliesCollapsed ? "Expand replies" : "Collapse replies"}
                    </button>
                  </div>
                </div>
                <div className={`community-thread-replies-wrap ${selectedThreadRepliesCollapsed ? "collapsed" : ""}`}>
                  {selectedThreadRepliesCollapsed ? (
                    renderEmptyState({ icon: "↕", title: "Thread collapsed", sub: "Expand replies to continue reading." })
                  ) : selectedThreadReplyTree.length > 0 ? (
                    <div className="community-replies">{renderReplies(selectedThreadReplyTree, 0, selectedThread.id)}</div>
                  ) : (
                    renderEmptyState({ icon: "💬", title: "No replies yet", sub: "Start the first response on this thread." })
                  )}
                </div>
              </div>
              {threadInlineReplyOpen && (
                <div className="community-thread-sticky-compose">
                  <div className="community-inline-reply">
                    <div className="community-inline-reply-head">
                      <span className="community-section-label">Reply</span>
                      <span className="community-inline-reply-parent">
                        {newReply.parentId ? "Replying to comment" : "Replying to thread"}
                      </span>
                    </div>
                    <textarea
                      className="community-modal-textarea community-inline-reply-input"
                      placeholder="Write your reply"
                      value={newReply.body}
                      onChange={(event) => setNewReply((prev) => ({ ...prev, body: event.target.value }))}
                    />
                    <div className="community-modal-actions">
                      <button
                        className="studio-back community-cta-btn"
                        type="button"
                        onClick={() => {
                          setThreadInlineReplyOpen(false);
                          setNewReply({ body: "", parentId: null });
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="studio-back community-cta-btn community-primary-btn"
                        type="button"
                        onClick={handleCreateReply}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>
              <aside className="community-thread-side-column">
                <button className="studio-back community-cta-btn community-thread-back-btn" onClick={() => navigate(communityBasePath)} type="button">
                  {'Back to forums'}
                </button>
                <div className="community-thread-side-card">
                  <div className="community-section-label">Thread Summary</div>
                  <div className="community-thread-side-title">{selectedThread.title}</div>
                  <div className="community-thread-side-meta">
                    <span className="community-meta-pill">{selectedThreadReplies.length} replies</span>
                    <span className="community-meta-pill">{formatTime(selectedThread.created_at)}</span>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}
      {!forceGroupRoom && !forceThreadPage && (
        <>
      {banner && <div className="exervia-banner community-banner info">{banner}</div>}
      {communityLoadError && (
        <div className="exervia-banner community-banner error">
          <span>{communityLoadError}</span>
          <button className="studio-back community-cta-btn" type="button" onClick={retryCommunityLoad}>
            Retry
          </button>
        </div>
      )}
      {loading && (
        <div className="community-loading-skeleton" aria-hidden="true">
          <div className="community-skeleton-sidebar">
            <div className="community-skeleton-line w-70" />
            <div className="community-skeleton-line w-90" />
            <div className="community-skeleton-line w-80" />
            <div className="community-skeleton-line w-75" />
          </div>
          <div className="community-skeleton-feed">
            <div className="community-skeleton-row" />
            <div className="community-skeleton-card" />
            <div className="community-skeleton-card" />
            <div className="community-skeleton-card" />
          </div>
        </div>
      )}

      {/* main layout grid that pairs sidebar + feed, */}
      {/* keeps navigation lists on the left, */}
      {/* renders the selected tab content on the right, */}
      {/* and stays consistent across all community views */}
      <div className="community-grid">

        {/* main feed area for the active tab content, */}
        {/* shows threads, group chat, or challenges, */}
        {/* keeps primary interactions on the right panel, */}
        {/* and pairs with the sidebar for navigation */}
        <main className="community-feed">
          {/* forum threads panel with sorting + reactions, */}
          {/* renders posts, reply trees, and thread actions, */}
          {/* supports collapse to keep long threads manageable, */}
          {/* and shows empty state when no posts exist */}
          {activeTab === "forums" && (
            <ForumsPanel
              search={search}
              setSearch={setSearch}
              activeForum={activeForum}
              forums={forums}
              filteredForums={filteredForums}
              forumThreadCountsBySlug={forumThreadCountsBySlug}
              threadSort={threadSort}
              setThreadSort={setThreadSort}
              filteredThreadPosts={filteredThreadPosts}
              globalPostReplies={globalPostReplies}
              postReplies={postReplies}
              profiles={profiles}
              forumTitleById={forumTitleById}
              mostActiveId={mostActiveId}
              expandedPostIds={expandedPostIds}
              setExpandedPostIds={setExpandedPostIds}
              pinnedThreadIds={pinnedThreadIds}
              recentThreadIds={recentThreadIds}
              userId={userId}
              isBlockedProfile={isBlockedProfile}
              openUserProfile={openUserProfile}
              openThreadPage={openThreadPage}
              setActiveThreadId={setActiveThreadId}
              setNewReply={setNewReply}
              setCreateReplyOpen={setCreateReplyOpen}
              togglePinnedThread={togglePinnedThread}
              handleDeletePost={handleDeletePost}
              handleReportContent={handleReportContent}
              handleToggleBlockProfile={handleToggleBlockProfile}
              renderEmptyState={renderEmptyState}
              setNewPostForum={setNewPostForum}
              setCreatePostOpen={setCreatePostOpen}
              setActiveForum={setActiveForum}
              loadForumPosts={loadForumPosts}
              formatTime={formatTime}
            />
          )}

          {activeTab === "feed" && (
            <ActivityFeedPanel
              statusDraft={statusDraft}
              statusPosting={statusPosting}
              onStatusDraftChange={setStatusDraft}
              onCreateStatusPost={handleCreateStatusPost}
              activityFeedLoading={activityFeedLoading}
              activityFeedItems={filteredActivityFeedItems}
              profiles={profiles}
              openThreadPage={openThreadPage}
              openRunPage={openRunPage}
              openTrainingWorld={openTrainingWorld}
              openUserProfile={openUserProfile}
              reactionOptions={reactionOptions}
              reactionCounts={reactionCounts}
              userReactions={userReactions}
              onReact={handleReact}
              formatTime={formatTime}
              renderEmptyState={renderEmptyState}
            />
          )}

          {activeTab === "leaderboard" && (
            <LeaderboardPanel
              leaderboardGroupId={leaderboardGroupId}
              setLeaderboardGroupId={setLeaderboardGroupId}
              memberships={memberships}
              groups={groups}
              leaderboardLoading={leaderboardLoading}
              groupLeaderboardLoading={groupLeaderboardLoading}
              globalLeaderboard={globalLeaderboard}
              groupLeaderboard={groupLeaderboard}
              leaderboardSignals={leaderboardSignals}
              globalLeaderboardLoaded={globalLeaderboardLoaded}
              groupLeaderboardLoaded={groupLeaderboardLoaded}
              profiles={profiles}
              openUserProfile={openUserProfile}
            />
          )}

{/* groups discovery + joined sections */}
          {/* discover list comes first */}
          {/* joined groups are shown below */}
          {/* join routes into room immediately */}
          {activeTab === "groups" && (
            <GroupsPanel
              groupSearch={groupSearch}
              setGroupSearch={setGroupSearch}
              discoverGroups={discoverGroups}
              joinedGroups={joinedGroups}
              groupMemberCounts={groupMemberCounts}
              groupLastActive={groupLastActive}
              groupPrivacyLabel={groupPrivacyLabel}
              formatTime={formatTime}
              groupRoomId={groupRoomId}
              setActiveGroupId={setActiveGroupId}
              navigate={navigate}
              groupRoomPath={groupRoomPath}
              handleJoinGroup={handleJoinGroup}
              handleLeaveGroup={handleLeaveGroup}
              isGroupOwner={isGroupOwner}
              handleOpenEditGroup={handleOpenEditGroup}
              handleDeleteGroup={handleDeleteGroup}
              renderEmptyState={renderEmptyState}
              setCreateGroupOpen={setCreateGroupOpen}
            />
          )}
          {/* challenge list panel with join CTAs, */}
          {/* shows challenge metadata and tags, */}
          {/* encourages participation via simple buttons, */}
          {/* and displays an empty state if none exist */}
          {activeTab === "challenges" && (
            <ChallengesPanel
              challenges={challenges}
              challengeTypeMeta={challengeTypeMeta}
              challengeParticipantCounts={challengeParticipantCounts}
              challengeMyProgress={challengeMyProgress}
              joinedChallengeIds={joinedChallengeIds}
              handleJoinChallenge={handleJoinChallenge}
              renderEmptyState={renderEmptyState}
            />
          )}
          {/* your circle summary panel for social status, */}
          {/* highlights group + friend counts at a glance, */}
          {/* provides quick CTAs to create or add, */}
          {/* and anchors the friends list below */}
          {(activeTab === "circle" || activeTab === "friends") && (
            <CirclePanel
              memberships={memberships}
              unreadCount={unreadCount}
              incomingRequestCount={incomingRequestCount}
              friends={friends}
              setCreateGroupOpen={setCreateGroupOpen}
              setAddFriendOpen={setAddFriendOpen}
              navigate={navigate}
              messagesPath={messagesPath}
              getFriendStatus={getFriendStatus}
              buildFriendLabel={buildFriendLabel}
              buildFriendMeta={buildFriendMeta}
              getFriendUnread={getFriendUnread}
              openUserProfile={openUserProfile}
              handleAcceptFriend={handleAcceptFriend}
              handleRejectFriend={handleRejectFriend}
              handleRemoveFriend={handleRemoveFriend}
              userId={userId}
              renderEmptyState={renderEmptyState}
              forceFriendsListOpen={activeTab === "friends"}
              openGroupsTab={() => setActiveTab("groups")}
              openFriendsTab={() => setActiveTab("friends")}
            />
          )}
        </main>
      </div>
        </>
      )}

      {createRecipeTemplateOpen && (
        <CommunityModal open={createRecipeTemplateOpen} onClose={() => setCreateRecipeTemplateOpen(false)}>
            <div className="community-modal-title">Create recipe template</div>
            <input
              className="community-modal-input"
              placeholder="Recipe title"
              value={newRecipeTemplate.title}
              onChange={(event) => setNewRecipeTemplate((prev) => ({ ...prev, title: event.target.value }))}
            />
            <select
              className="community-modal-input"
              value={newRecipeTemplate.mealType}
              onChange={(event) => setNewRecipeTemplate((prev) => ({ ...prev, mealType: event.target.value }))}
            >
              <option>Breakfast</option>
              <option>Lunch</option>
              <option>Dinner</option>
              <option>Snack</option>
            </select>
            <div className="community-template-commentbar">
              <input
                className="community-modal-input"
                placeholder="Prep minutes"
                value={newRecipeTemplate.prepMinutes}
                onChange={(event) => setNewRecipeTemplate((prev) => ({ ...prev, prepMinutes: event.target.value }))}
              />
              <input
                className="community-modal-input"
                placeholder="Cook minutes"
                value={newRecipeTemplate.cookMinutes}
                onChange={(event) => setNewRecipeTemplate((prev) => ({ ...prev, cookMinutes: event.target.value }))}
              />
            </div>
            <input
              className="community-modal-input"
              placeholder="Servings"
              value={newRecipeTemplate.servings}
              onChange={(event) => setNewRecipeTemplate((prev) => ({ ...prev, servings: event.target.value }))}
            />
            <textarea
              className="community-modal-textarea"
              placeholder={"Ingredients (one per line, use: ingredient - measure)\nExample: oats - 80g"}
              value={newRecipeTemplate.ingredients}
              onChange={(event) => setNewRecipeTemplate((prev) => ({ ...prev, ingredients: event.target.value }))}
            />
            <textarea
              className="community-modal-textarea"
              placeholder={"Steps (one per line)\nExample: Mix dry ingredients"}
              value={newRecipeTemplate.steps}
              onChange={(event) => setNewRecipeTemplate((prev) => ({ ...prev, steps: event.target.value }))}
            />
            <input
              className="community-modal-input"
              placeholder="Tags (comma separated): high-protein, quick, budget"
              value={newRecipeTemplate.tags}
              onChange={(event) => setNewRecipeTemplate((prev) => ({ ...prev, tags: event.target.value }))}
            />
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" onClick={() => setCreateRecipeTemplateOpen(false)}>
                Cancel
              </button>
              <button className="studio-back community-cta-btn" onClick={handleCreateRecipeTemplate}>
                Share recipe
              </button>
            </div>
        </CommunityModal>
      )}

      {/* create group modal with name/goal/privacy fields, */}
      {/* opened from quick actions or group panel, */}
      {/* writes a new group and auto-joins the user, */}
      {/* closes on cancel or successful submit */}
      {createGroupOpen && (
        <CommunityModal open={createGroupOpen} onClose={() => setCreateGroupOpen(false)}>
            <div className="community-modal-title">Create accountability group</div>
            <input
              className="community-modal-input"
              placeholder="Group name"
              value={newGroup.name}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="community-modal-input"
              placeholder="Group goal"
              value={newGroup.goal}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, goal: event.target.value }))}
            />
            <select
              className="community-modal-input"
              value={newGroup.privacy}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, privacy: event.target.value }))}
            >
              <option value="invite">Invite only</option>
              <option value="request">Request to join</option>
              <option value="open">Open</option>
            </select>
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" onClick={() => setCreateGroupOpen(false)}>
                Cancel
              </button>
              <button className="studio-back community-cta-btn" onClick={handleCreateGroup}>
                Create
              </button>
            </div>
        </CommunityModal>
      )}

      {confirmDialog.open && (
        <CommunityModal open={confirmDialog.open} onClose={closeConfirmDialog}>
            <div className="community-modal-title">{confirmDialog.title || "Please confirm"}</div>
            <div className="community-feed-sub">{confirmDialog.body || "Are you sure?"}</div>
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" type="button" onClick={closeConfirmDialog} disabled={confirmBusy}>
                No
              </button>
              <button className="studio-back community-cta-btn community-primary-btn" type="button" onClick={handleConfirmDialogAction} disabled={confirmBusy}>
                {confirmBusy ? "Working..." : "Yes"}
              </button>
            </div>
        </CommunityModal>
      )}

      {editGroupOpen && (
        <CommunityModal open={editGroupOpen} onClose={() => setEditGroupOpen(false)}>
            <div className="community-modal-title">Edit group</div>
            <input
              className="community-modal-input"
              placeholder="Group name"
              value={editGroupForm.name}
              onChange={(event) => setEditGroupForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="community-modal-input"
              placeholder="Group goal"
              value={editGroupForm.goal}
              onChange={(event) => setEditGroupForm((prev) => ({ ...prev, goal: event.target.value }))}
            />
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" onClick={() => setEditGroupOpen(false)}>
                Cancel
              </button>
              <button className="studio-back community-cta-btn" onClick={handleUpdateGroup}>
                Save changes
              </button>
            </div>
        </CommunityModal>
      )}

      {/* create challenge modal for weekly goals, */}
      {/* collects type/target/duration inputs, */}
      {/* inserts a new challenge and refreshes the list, */}
      {/* closes on cancel or submit */}
      {createChallengeOpen && (
        <CommunityModal open={createChallengeOpen} onClose={() => setCreateChallengeOpen(false)}>
            <div className="community-modal-title">Create challenge</div>
            <input
              className="community-modal-input"
              placeholder="Challenge title"
              value={newChallenge.title}
              onChange={(event) => setNewChallenge((prev) => ({ ...prev, title: event.target.value }))}
            />
            <select
              className="community-modal-input"
              value={newChallenge.type}
              onChange={(event) => setNewChallenge((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="distance">Distance</option>
              <option value="time">Time</option>
              <option value="streak">Streak</option>
            </select>
            <input
              className="community-modal-input"
              placeholder="Target value"
              value={newChallenge.target}
              onChange={(event) => setNewChallenge((prev) => ({ ...prev, target: event.target.value }))}
            />
            <input
              className="community-modal-input"
              placeholder="Duration (days)"
              value={newChallenge.durationDays}
              onChange={(event) => setNewChallenge((prev) => ({ ...prev, durationDays: event.target.value }))}
            />
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" onClick={() => setCreateChallengeOpen(false)}>
                Cancel
              </button>
              <button className="studio-back community-cta-btn" onClick={handleCreateChallenge}>
                Create
              </button>
            </div>
        </CommunityModal>
      )}

      {/* create forum post modal, */}
      {/* allows forum selection + title/body entry, */}
      {/* inserts a new post and reloads the active forum, */}
      {/* closes on cancel or successful post */}
      {createPostOpen && (
        <CommunityModal open={createPostOpen} onClose={() => setCreatePostOpen(false)}>
            <div className="community-modal-title">Create forum post</div>
            <select
              className="community-modal-input"
              value={newPostForum}
              onChange={(event) => setNewPostForum(event.target.value)}
            >
              {forumSelectOptions.map((forum) => {
                const value = forum.topic_slug || forum.id;
                return (
                  <option key={value} value={value}>
                    {forum.title}
                  </option>
                );
              })}
            </select>
            <input
              ref={createPostTitleRef}
              className="community-modal-input"
              placeholder="Post title"
              defaultValue={newPost.title}
              data-modal-initial-focus="true"
            />
            <textarea
              ref={createPostBodyRef}
              className="community-modal-textarea"
              placeholder="Post body"
              defaultValue={newPost.body}
            />
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" onClick={() => setCreatePostOpen(false)}>
                Cancel
              </button>
              <button
                className="studio-back community-cta-btn"
                onClick={() =>
                  handleCreatePost({
                    title: createPostTitleRef.current?.value || "",
                    body: createPostBodyRef.current?.value || "",
                  })
                }
              >
                Post
              </button>
            </div>
        </CommunityModal>
      )}

      {/* reply modal for forum threads, */}
      {/* supports replying to a post or nested reply, */}
      {/* posts the reply then refreshes the thread list, */}
      {/* closes on cancel or submit */}
      {createReplyOpen && !forceThreadPage && (
        <CommunityModal open={createReplyOpen && !forceThreadPage} onClose={() => setCreateReplyOpen(false)} topLayer>
            <div className="community-modal-title">Reply</div>
            <textarea
              className="community-modal-textarea"
              placeholder="Write a reply"
              value={newReply.body}
              onChange={(event) => setNewReply((prev) => ({ ...prev, body: event.target.value }))}
            />
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" onClick={() => setCreateReplyOpen(false)}>
                Cancel
              </button>
              <button className="studio-back community-cta-btn" onClick={handleCreateReply}>
                Reply
              </button>
            </div>
        </CommunityModal>
      )}

      {/* send friend request modal using username, */}
      {/* validates the user and inserts a friend request, */}
      {/* refreshes the friends list after send, */}
      {/* closes on cancel or submit */}
      {addFriendOpen && (
        <CommunityModal open={addFriendOpen} onClose={() => setAddFriendOpen(false)}>
            <div className="community-modal-title">Send friend request</div>
            <input
              className="community-modal-input"
              placeholder="Username (e.g. steven78)"
              value={newFriendUsername}
              onChange={(event) => setNewFriendUsername(event.target.value)}
            />
            <div className="community-modal-actions community-modal-actions-compact">
              <button className="studio-back community-cta-btn" onClick={() => setAddFriendOpen(false)}>
                Cancel
              </button>
              <button className="studio-back community-cta-btn" onClick={handleAddFriend}>
                Send friend request
              </button>
            </div>
        </CommunityModal>
      )}
      <PageWalkthroughModal
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        mode={routePrefix}
        userId={userId}
        pageKey="community"
        title="Community Walkthrough"
        steps={COMMUNITY_WALKTHROUGH_STEPS}
        onStepAction={handleWalkthroughAction}
      />
    </div>
  );
}








