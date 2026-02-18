// Below we import React hooks used throughout this component:
// useState manages local UI state (tabs, modals, forms, loaded data),
// useEffect runs side effects like fetching data + realtime subscriptions,
// useMemo memoises expensive derived values (filtering + sorting lists).
import { useEffect, useMemo, useRef, useState } from "react";
// adapted from https://reactrouter.com/en/main/hooks/use-navigate
// useNavigate is used for client-side navigation
import { useNavigate, useParams } from "react-router-dom";
// supabase client is imported to interact with our backend for data fetching and mutations
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";
import { trackDailyActivity } from "../services/activityTracker";
// Component: CommunityHub - UI layout and interactions.
// This component renders the communityhub experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

// This is the main Community Hub component 
// which serves as the central place for all community interactions
const forumTracks = [
  { id: "hyrox", title: "Hyrox", subtitle: "Race prep, stations, engine" },
  { id: "running", title: "Running", subtitle: "Tempo, pacing, endurance" },
  { id: "nutrition", title: "Nutrition", subtitle: "Fueling, recovery, habits" },
  { id: "strength", title: "Strength", subtitle: "Progressions, form, PRs" },
  { id: "mindset", title: "Mindset", subtitle: "Consistency, discipline, recovery" }
];
// reactionOptions defines the different reactions users can give to posts and replies
const reactionOptions = [
  { id: "like", label: "Like", emoji: "👍" },
  { id: "fire", label: "Fire", emoji: "🔥" },
  { id: "insight", label: "Insight", emoji: "💡" }
];

const templateTypeOptions = [
  { id: "all", label: "All" },
  { id: "training_plan", label: "Plans" },
  { id: "workout_program", label: "Programs" },
  { id: "recipe", label: "Recipes" }
];

const templateFocusOptions = [
  { id: "all", label: "All Focus" },
  { id: "upper body", label: "Upper" },
  { id: "lower body", label: "Lower" },
  { id: "full body", label: "Full Body" },
  { id: "push", label: "Push" },
  { id: "pull", label: "Pull" },
  { id: "glutes", label: "Glutes" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "conditioning", label: "Conditioning" }
];

// formatTime manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
const formatTime = (value) => {
  if (!value) return "";
  try {
    const now = Date.now();
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return "";
    const diffMs = now - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};
// buildReplyTree takes a flat list of replies and organizes 
// them into a nested tree structure based on parent-child relationships
const buildReplyTree = (replies) => {
  if (!replies?.length) return [];
  const map = {};
  replies.forEach((reply) => {
    map[reply.id] = { ...reply, children: [] };
  });
  const roots = [];
  replies.forEach((reply) => {
    const node = map[reply.id];
    if (reply.parent_id && map[reply.parent_id]) {
      map[reply.parent_id].children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};
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
  const groupRoomPath = (groupId) => `${communityBasePath}/group/${groupId}`;
  const threadPath = (threadId) => `${communityBasePath}/thread/${threadId}`;
  const openThreadPage = (threadId) => {
    const id = String(threadId || "").trim();
    if (!id) return;
    setActiveThreadId(id);
    navigate(threadPath(id));
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
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [friendMessages, setFriendMessages] = useState([]);
  const [friendMessageDraft, setFriendMessageDraft] = useState("");
  const [friendLastSeen, setFriendLastSeen] = useState({});
  const [friendLatest, setFriendLatest] = useState({});
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [routeThread, setRouteThread] = useState(null);
  const [routeThreadReplies, setRouteThreadReplies] = useState([]);
  const [threadSort, setThreadSort] = useState("newest");
  const [threadReplySort, setThreadReplySort] = useState("liked");
  const [memberships, setMemberships] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState("");
// below are state variables to manage the open/close state of various modals for 
// creating groups, challenges, posts, replies, and adding friends
// there are also state variables to hold the form data for these modals, as well as
// state for reaction counts and user reactions on posts and replies
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChallengeOpen, setCreateChallengeOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createReplyOpen, setCreateReplyOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [createRecipeTemplateOpen, setCreateRecipeTemplateOpen] = useState(false);

  const [newGroup, setNewGroup] = useState({ name: "", goal: "", privacy: "invite" });
  const [newChallenge, setNewChallenge] = useState({
    title: "",
    type: "distance",
    target: "",
    durationDays: "7"
  });
  const [newPost, setNewPost] = useState({ title: "", body: "" });
  const [newRecipeTemplate, setNewRecipeTemplate] = useState({
    title: "",
    mealType: "Dinner",
    ingredients: "",
    steps: "",
    prepMinutes: "",
    cookMinutes: "",
    servings: "",
    tags: ""
  });
  const [newPostForum, setNewPostForum] = useState(activeForum);
  const [newReply, setNewReply] = useState({ body: "", parentId: null });
  const [groupRoomId, setGroupRoomId] = useState(null);
  const [groupRoomPosts, setGroupRoomPosts] = useState([]);
  const [groupRoomMembers, setGroupRoomMembers] = useState([]);
  const [groupRoomDraft, setGroupRoomDraft] = useState("");
  const [groupRoomLoading, setGroupRoomLoading] = useState(false);
  const [threadInlineReplyOpen, setThreadInlineReplyOpen] = useState(false);
  const [reactionCounts, setReactionCounts] = useState({});
  const [userReactions, setUserReactions] = useState({});
  const [newFriendId, setNewFriendId] = useState("");
  const friendChatListRef = useRef(null);
  const groupRoomListRef = useRef(null);
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
  const [templateViewMode, setTemplateViewMode] = useState("swipe");
  const [templateDeckIndex, setTemplateDeckIndex] = useState(0);
  const [templateDeckDragX, setTemplateDeckDragX] = useState(0);
  const [templateDeckAnimating, setTemplateDeckAnimating] = useState(null);
  const templateDeckPointerRef = useRef({ active: false, startX: 0, moved: false });

  useEffect(() => {
    if (!banner) return;
    const timeout = setTimeout(() => setBanner(""), 2600);
    return () => clearTimeout(timeout);
  }, [banner]);

  const recordEngagementAction = async (actionType) => {
    if (!userId) return;
    await trackDailyActivity(userId, actionType);
    await recalcUserState(userId);
    window.dispatchEvent(new Event("user_state_updated"));
  };
// loadProfiles takes a list of user ids and fetches their profiles from the backend,
// it then maps the profiles into a dictionary for easy lookup when displaying posts, 
// replies, and friends
// loadFriendStats is similar but it fetches the rank and level of friends to display 
// in the friend list
  const loadProfiles = async (ids) => {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, display_name, username")
      .in("id", uniqueIds);
    if (error || !data) return;
    const mapped = {};
    data.forEach((profile) => {
      mapped[profile.id] = profile.display_name || profile.username || profile.id;
    });
    setProfiles((prev) => ({ ...prev, ...mapped }));
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
  const getFriendStatus = (friendRow) => {
    if (friendRow.status === "accepted") return "accepted";
    const currentId = Number(userId);
    const requesterId =
      friendRow.status === "pending_low" ? friendRow.user_id : friendRow.friend_user_id;
    if (currentId === requesterId) return "outgoing";
    return "incoming";
  };
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
    const { data } = await supabase.from("community_posts").select("id,forum_id");
    const counts = {};
    (data || []).forEach((post) => {
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

  const loadSharedTemplateData = async () => {
    const [{ data: templateData }, { data: ratingData }, { data: tryData }, { data: commentData }] = await Promise.all([
      supabase.from("shared_templates").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("shared_template_ratings").select("template_id,user_id,rating"),
      supabase.from("shared_template_tries").select("template_id,user_id"),
      supabase
        .from("shared_template_comments")
        .select("id,template_id,user_id,body,created_at")
        .order("created_at", { ascending: false })
        .limit(1000)
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
  };
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
      const [
        forumRes,
        groupRes,
        challengeRes,
        membershipRes,
        friendRes,
        forumPostRes,
        groupMemberRes,
        groupPostRes,
        challengeParticipantRes
      ] = await Promise.all([
        supabase.from("community_forums").select("*").order("created_at", { ascending: true }),
        supabase.from("community_groups").select("*").order("created_at", { ascending: false }),
        supabase.from("community_challenges").select("*").order("created_at", { ascending: false }),
        supabase.from("community_group_members").select("*").eq("user_id", Number(userId)),
        supabase
          .from("community_friends")
          .select("*")
          .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`),
        supabase.from("community_posts").select("id,forum_id"),
        supabase.from("community_group_members").select("group_id,user_id"),
        supabase.from("community_group_posts").select("group_id,created_at").order("created_at", { ascending: false }),
        supabase.from("community_challenge_participants").select("challenge_id,user_id,progress")
      ]);
      if (!mounted) return;
      setForums(forumRes.data || []);
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
      const friendIds = friendList.flatMap((row) => [row.user_id, row.friend_user_id]);
      loadProfiles(friendIds);
      loadFriendStats(friendIds);
      loadFriendMessageSummaries();
      const defaultForum = activeForum || forumTracks[0].id;
      setActiveForum(defaultForum);
      await loadForumPosts(defaultForum, forumRes.data || []);
      await loadSharedTemplateData();
      setLoading(false);
    };
    fetchCommunity();
    // Render
    return () => {
      mounted = false;
    };
  }, [userId]);

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
        const next = {};
        Object.entries(prev).forEach(([postId, createdMs]) => {
          if (now - Number(createdMs) < 12000) {
            next[postId] = createdMs;
          }
        });
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
          if (Number(selectedFriendId) === otherId) {
            setFriendMessages((prev) => [...prev, message]);
            setFriendLastSeen((prev) => ({ ...prev, [otherId]: message.created_at }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedFriendId]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_templates" }, () => loadSharedTemplateData())
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_template_ratings" }, () => loadSharedTemplateData())
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_template_tries" }, () => loadSharedTemplateData())
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_template_comments" }, () => loadSharedTemplateData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

// derived forum lists and select options are memoised to avoid
// re-filtering and re-mapping on every render,
// these values update only when their dependencies change,
// and help keep scrolling + search snappy for large lists
  const filteredForums = useMemo(() => {
    return forums.length ? forums : forumTracks;
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
    return forums.length ? forums : forumTracks;
  }, [forums]);

  const tabOrder = ["forums", "templates", "groups", "challenges", "circle"];
  const activeTabIndex = Math.max(tabOrder.indexOf(activeTab), 0);

// sync the new post modal forum selector with the active forum,
// this ensures the modal always defaults to the forum the user is browsing,
// and prevents stale forum selection if the user switches tabs,
// the value resets whenever the modal closes
  useEffect(() => {
    if (!createPostOpen) {
      setNewPostForum(activeForum);
    }
  }, [activeForum, createPostOpen]);

  useEffect(() => {
    let cancelled = false;
    const query = search.trim().toLowerCase();
    if (activeTab !== "forums" || !query || !forums.length) {
      setGlobalForumPosts([]);
      setGlobalPostReplies({});
      return () => {
        cancelled = true;
      };
    }

    const loadGlobalSearchResults = async () => {
      const forumIds = forums.map((forum) => forum.id).filter(Boolean);
      if (!forumIds.length) return;

      const { data: posts } = await supabase
        .from("community_posts")
        .select("*")
        .in("forum_id", forumIds)
        .order("created_at", { ascending: false });

      const filteredPosts = (posts || []).filter((post) => {
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

    loadGlobalSearchResults();
    return () => {
      cancelled = true;
    };
  }, [activeTab, search, forums]);

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
    await loadGroupStats();
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
    await loadChallengeStats();
  };

// create a new forum post for the selected forum,
// resolves the forum id from the current slug selection,
// prevents posting if the forum or user is missing,
// then refreshes the active forum feed after success
  const handleCreatePost = async () => {
    if (!newPost.title.trim()) return;
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
        title: newPost.title.trim(),
        body: newPost.body.trim(),
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
    await loadForumThreadCounts();
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
    const [{ data: postsData }, { data: memberData }] = await Promise.all([
      supabase
        .from("community_group_posts")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
      supabase
        .from("community_group_members")
        .select("*")
        .eq("group_id", groupId)
    ]);
    setGroupRoomPosts(postsData || []);
    setGroupRoomMembers(memberData || []);
    const profileIds = [
      ...(postsData || []).map((post) => post.created_by),
      ...(memberData || []).map((member) => member.user_id)
    ];
    loadProfiles(profileIds);
    setGroupRoomLoading(false);
  };

  const openGroupRoom = async (groupId) => {
    if (!groupId) return;
    const member = memberships.some(
      (membership) => Number(membership.group_id) === Number(groupId)
    );
    if (!member) {
      setBanner("Join group first to open room.");
      return;
    }
    setActiveGroupId(groupId);
    setGroupRoomId(groupId);
    await loadGroupRoom(groupId);
  };

  const handleSendGroupRoomPost = async () => {
    if (!groupRoomDraft.trim() || !groupRoomId) return;
    if (!userId) {
      setBanner("Sign in to post in group room.");
      return;
    }
    const { error } = await supabase.from("community_group_posts").insert([
      {
        group_id: groupRoomId,
        body: groupRoomDraft.trim(),
        created_by: userId
      }
    ]);
    if (error) {
      setBanner(error.message || "Could not post in room.");
      return;
    }
    setGroupRoomDraft("");
    await loadGroupRoom(groupRoomId);
    await loadGroupStats();
    await recordEngagementAction("community_post");
  };

// send a friend request by numeric user id,
// validates input, checks that the user exists,
// inserts the relationship row with ordered ids,
// then refreshes the friends list and closes the modal
  const handleAddFriend = async () => {
    if (!newFriendId.trim()) return;
    if (!userId) {
      setBanner("Sign in to add friends.");
      return;
    }
    const parsedFriendId = Number(newFriendId.trim());
    if (!Number.isInteger(parsedFriendId)) {
      setBanner("Friend id must be a valid numeric user id.");
      return;
    }
    const { data: friendProfile, error: friendLookupError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", parsedFriendId)
      .single();
    if (friendLookupError || !friendProfile) {
      setBanner("Friend id not found. Ask them for their numeric profile id.");
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
    if (error) {
      setBanner(error.message || "Could not add friend.");
      return;
    }
    setAddFriendOpen(false);
    setNewFriendId("");
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
      (membership) => Number(membership.group_id) === Number(groupId)
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
    const { data: membershipData } = await supabase
      .from("community_group_members")
      .select("*")
      .eq("user_id", Number(userId));
    setMemberships(membershipData || []);
    setActiveGroupId(groupId);
    await loadGroupStats();
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
    const { data: membershipData } = await supabase
      .from("community_group_members")
      .select("*")
      .eq("user_id", Number(userId));
    setMemberships(membershipData || []);
    await loadGroupStats();
    if (Number(groupRoomId) === Number(groupId) || Number(activeGroupId) === Number(groupId)) {
      setGroupRoomId(null);
      setActiveGroupId(null);
      navigate(communityBasePath);
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
      setBanner(error.message || "Could not accept friend.");
      return;
    }
    setBanner("Friend request accepted.");
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
      setBanner(error.message || "Could not reject friend.");
      return;
    }
    setBanner("Friend request rejected.");
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
    setBanner("Friend removed.");
    const { data } = await supabase
      .from("community_friends")
      .select("*")
      .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);
    setFriends(data || []);
    if (Number(selectedFriendId) === Number(friendRow.user_id) || Number(selectedFriendId) === Number(friendRow.friend_user_id)) {
      setSelectedFriendId(null);
      setFriendMessages([]);
      setFriendMessageDraft("");
    }
  };

// build the display label for a friend row,
// resolves the "other" user id from the relationship,
// falls back to the numeric id if profile data is missing,
// used throughout the friend list and chat header
  const buildFriendLabel = (friendRow) => {
    const currentId = Number(userId);
    const otherId = friendRow.user_id === currentId ? friendRow.friend_user_id : friendRow.user_id;
    return profiles[otherId] || `User ${otherId}`;
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
// compares the latest message timestamp to last seen,
// ignores messages sent by the current user,
// used to show notification dots in the UI
  const getFriendUnread = (friendRow) => {
    const currentId = Number(userId);
    const otherId = friendRow.user_id === currentId ? friendRow.friend_user_id : friendRow.user_id;
    const latest = friendLatest[otherId];
    if (!latest) return false;
    if (Number(latest.user_id) === Number(userId)) return false;
    const lastSeen = friendLastSeen[otherId];
    if (!lastSeen) return true;
    return new Date(latest.created_at) > new Date(lastSeen);
  };

// load the full message history for a friend pair,
// orders messages oldest -> newest for chat display,
// updates the last seen timestamp to suppress unread dots,
// then refreshes the message summaries list
  const loadFriendMessages = async (friendId) => {
    if (!friendId || !userId) return;
    const currentId = Number(userId);
    const low = Math.min(currentId, friendId);
    const high = Math.max(currentId, friendId);
    const { data } = await supabase
      .from("community_friend_messages")
      .select("*")
      .or(`and(user_id.eq.${low},friend_user_id.eq.${high}),and(user_id.eq.${high},friend_user_id.eq.${low})`)
      .order("created_at", { ascending: true });
    setFriendMessages(data || []);
    const lastSeen = data?.length ? data[data.length - 1].created_at : new Date().toISOString();
    setFriendLastSeen((prev) => ({ ...prev, [friendId]: lastSeen }));
    loadFriendMessageSummaries();
  };

// send a new private message to the selected friend,
// inserts the message into the backend,
// reloads the conversation and summary list,
// and clears the draft input on success
  const handleSendFriendMessage = async () => {
    if (!friendMessageDraft.trim() || !selectedFriendId || !userId) return;
    const currentId = Number(userId);
    const otherId = Number(selectedFriendId);
    const low = Math.min(currentId, otherId);
    const high = Math.max(currentId, otherId);
    const { error } = await supabase
      .from("community_friend_messages")
      .insert([
        {
          user_id: currentId,
          friend_user_id: otherId,
          body: friendMessageDraft.trim()
        }
      ]);
    if (error) {
      setBanner(error.message || "Could not send message.");
      return;
    }
    setFriendMessageDraft("");
    loadFriendMessages(otherId);
    loadFriendMessageSummaries();
    const next = await supabase
      .from("community_friend_messages")
      .select("*")
      .or(`and(user_id.eq.${low},friend_user_id.eq.${high}),and(user_id.eq.${high},friend_user_id.eq.${low})`)
      .order("created_at", { ascending: true });
    setFriendMessages(next.data || []);
  };

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
    await loadForumThreadCounts();
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
        user_id: userId,
        progress: 0
      }
    ]);
    if (error && error.code !== "23505") {
      setBanner(error.message || "Could not join challenge.");
      return;
    }
    setBanner(error?.code === "23505" ? "Already joined challenge." : "Challenge joined.");
    await loadChallengeStats();
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
    setForumPosts(data || []);
    if (!data?.length) {
      setPostReplies({});
      setReactionCounts({});
      setUserReactions({});
      return;
    }
    const postIds = data.map((post) => post.id);
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
      ...data.map((post) => post.created_by),
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
    if (!query) return sortedForumPosts;
    return sortedForumPosts.filter((post) => {
      const title = (post.title || "").toLowerCase();
      const body = (post.body || "").toLowerCase();
      return title.includes(query) || body.includes(query);
    });
  }, [sortedForumPosts, search]);

// compute unread count for all friends,
// uses latest message + last seen logic per friend,
// keeps the badge count in sync with realtime updates,
// recalculates when message or friend state changes
  const unreadCount = useMemo(() => {
    return friends.reduce((count, friend) => (getFriendUnread(friend) ? count + 1 : count), 0);
  }, [friends, friendLatest, friendLastSeen, userId]);

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
      const author = profiles[reply.created_by] || reply.created_by || "Anonymous";
      const avatarInitial = String(author).charAt(0).toUpperCase();
      const replyKeyPrefix = `reply:${reply.id}`;
      return (
        <div key={reply.id} className={`community-reply-card ${level > 0 ? "nested" : ""}`}>
          <div className="community-reply-topline">
            <span className="community-reply-avatar" aria-hidden="true">{avatarInitial}</span>
            <span className="community-reply-author">{author}</span>
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
            {Number(userId) === Number(reply.created_by) && (
              <button
                className="community-reply-btn danger"
                onClick={() => handleDeleteReply(reply.id)}
                type="button"
              >
                Delete
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
  const activeGroup = groups.find((group) => Number(group.id) === Number(groupRoomId || activeGroupId)) || null;
  const isGroupMember = (groupId) =>
    memberships.some((membership) => Number(membership.group_id) === Number(groupId));
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
  }, [groups, memberships, groupSearch]);
  const discoverGroups = useMemo(() => {
    const next = visibleGroups.filter((group) => !isGroupMember(group.id));
    return groupSearch.trim() ? next : next.slice(0, 12);
  }, [visibleGroups, memberships, groupSearch]);
  const joinedChallengeIds = useMemo(() => {
    return new Set(Object.keys(challengeMyProgress).map((id) => Number(id)));
  }, [challengeMyProgress]);
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

  useEffect(() => {
    setTemplateDeckIndex(0);
  }, [templateSearch, templateTypeFilter, templateFocusFilter, templateSort]);

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

    setTimeout(() => {
      setTemplateDeckAnimating(null);
      setTemplateDeckDragX(0);
      setTemplateDeckIndex((prev) => Math.min(prev + 1, swipeTemplates.length));
    }, 300);
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

  useEffect(() => {
    if (!selectedFriendId) return;
    const list = friendChatListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [friendMessages, selectedFriendId]);

  useEffect(() => {
    if (!groupRoomId) return;
    const list = groupRoomListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [groupRoomPosts, groupRoomId]);

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
            if (prev.some((row) => Number(row.id) === Number(post.id))) return prev;
            return [...prev, post];
          });
          setGroupLastActive((prev) => ({ ...prev, [groupRoomId]: post.created_at }));
          if (post.created_by) loadProfiles([post.created_by]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, groupRoomId]);

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
  }, [userId, forceThreadPage, selectedThread?.id]);

  useEffect(() => {
    if (!forceGroupRoom || !routeGroupId || !userId) return;
    if (Number(groupRoomId) === Number(routeGroupId)) return;
    let cancelled = false;

    const openRoutedRoom = async () => {
      setActiveTab("groups");
      const localMember = memberships.some(
        (membership) =>
          Number(membership.group_id) === Number(routeGroupId) &&
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
        return;
      }

      setActiveGroupId(routeGroupId);
      setGroupRoomId(routeGroupId);
      await loadGroupRoom(routeGroupId);
    };

    openRoutedRoom();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceGroupRoom, routeGroupId, userId, memberships, groupRoomId]);

  useEffect(() => {
    if (!forceThreadPage || !routeThreadId || !userId) return;
    let cancelled = false;

    const loadThreadRoute = async () => {
      setActiveTab("forums");
      const normalizedThreadId = String(routeThreadId || "").trim();
      if (!normalizedThreadId) {
        navigate(communityBasePath);
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
    };

    loadThreadRoute();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceThreadPage, routeThreadId, userId]);

  const renderGroupRoom = (isRouteMode = false) => (
    <div className={`community-group-room-shell ${isRouteMode ? "route-mode" : ""}`}>
      <div className="community-group-room-head">
        <div className="community-group-room-head-left">
          <button
            className="studio-back community-cta-btn"
            onClick={() => {
              setGroupRoomId(null);
              navigate(communityBasePath);
            }}
            type="button"
          >
            {'<- Back to groups'}
          </button>
          <div>
            <div className="community-group-room-title">{activeGroup?.name || "Group room"}</div>
            <div className="community-group-room-sub">{activeGroup?.goal || "Live chat for your group."}</div>
          </div>
        </div>
        <div className="community-group-room-head-meta">
          <span className="community-room-chip">{groupRoomMembers.length} members</span>
          <span className="community-room-chip">{groupRoomPosts.length} messages</span>
          {activeGroup?.privacy && (
            <span className="community-room-chip">{groupPrivacyLabel(activeGroup.privacy)}</span>
          )}
        </div>
      </div>
      <div className="community-group-room-layout">
        <aside className="community-group-room-left">
          <div className="community-panel-title">Channels</div>
          <div className="community-room-channel active"># general</div>
          <div className="community-room-note">More channels unlock as your group grows.</div>
        </aside>
        <section className="community-group-room-center">
          <div className="community-group-room-messages" ref={groupRoomListRef}>
            {groupRoomLoading && renderEmptyState({ icon: "...", title: "Loading room", sub: "Syncing latest messages." })}
            {!groupRoomLoading && !groupRoomPosts.length && (
              renderEmptyState({ icon: "💬", title: "No messages yet", sub: "Start the room with your first message." })
            )}
            {!groupRoomLoading &&
              groupRoomPosts.map((post) => {
                const authorName = profiles[post.created_by] || `User ${post.created_by}`;
                const initial = String(authorName).charAt(0).toUpperCase();
                const isSelf = Number(post.created_by) === Number(userId);
                return (
                  <div key={post.id} className={`community-group-room-msg-row ${isSelf ? "self" : ""}`}>
                    <div className={`community-group-room-msg ${isSelf ? "self" : ""}`}>
                      <div className="community-group-room-msg-head">
                        <span className="community-group-room-avatar" aria-hidden="true">{initial}</span>
                        <span className="community-group-room-author">{authorName}</span>
                        <span className="community-group-room-time">{formatTime(post.created_at)}</span>
                      </div>
                      <div className="community-group-room-body">{post.body}</div>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="community-group-room-inputbar">
            <input
              className="community-modal-input community-group-room-input"
              placeholder="Message #general"
              value={groupRoomDraft}
              onChange={(event) => setGroupRoomDraft(event.target.value)}
            />
            <button className="studio-back community-cta-btn community-primary-btn community-chat-send-btn" onClick={handleSendGroupRoomPost}>
              Send
            </button>
          </div>
        </section>
        <aside className="community-group-room-right">
          <div className="community-panel-title">Members ({groupRoomMembers.length})</div>
          <div className="community-group-room-members">
            {groupRoomMembers.map((member) => (
              <div key={member.id} className="community-group-room-member">
                <span className="community-notification-dot mini" />
                <span>{profiles[member.user_id] || `User ${member.user_id}`}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
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
            <div>
              <button className="studio-back" onClick={() => navigate(backPath)} type="button">
                {'<- Back'}
              </button>
              <div className="community-kicker">COMMUNITY</div>
              <h2 className="community-title">Train With Others</h2>
              <p className="community-sub">
                Accountability, forums, and challenges built for serious athletes.
              </p>
            </div>
            <div className="community-cta-row">
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
              className={`community-tab ${activeTab === "templates" ? "active" : ""}`}
              onClick={() => setActiveTab("templates")}
              type="button"
            >
              Templates
            </button>
            <button
              className={`community-tab ${activeTab === "groups" ? "active" : ""}`}
              onClick={() => setActiveTab("groups")}
              type="button"
            >
              Groups
            </button>
            <button
              className={`community-tab ${activeTab === "challenges" ? "active" : ""}`}
              onClick={() => setActiveTab("challenges")}
              type="button"
            >
              Challenges
            </button>
            <button
              className={`community-tab ${activeTab === "circle" ? "active" : ""}`}
              onClick={() => setActiveTab("circle")}
              type="button"
            >
              Your Circle
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
          {!groupRoomId && renderEmptyState({ icon: "...", title: "Loading room", sub: "Fetching group messages." })}
          {groupRoomId && renderGroupRoom(true)}
        </div>
      )}
      {forceThreadPage && (
        <div className="community-thread-route-panel">
          {!selectedThread && renderEmptyState({ icon: "...", title: "Loading thread", sub: "Fetching thread details." })}
          {selectedThread && (
            <div className="community-thread-modal">
              <div className="community-thread-main-column">
              <div className="community-thread-modal-head-card">
                <div className="community-thread-modal-head">
                  <div className="community-thread-head-main">
                    <div className="community-feed-title community-thread-modal-title">{selectedThread.title}</div>
                    <div className="community-thread-meta">
                      <span className="community-meta-pill community-meta-author">
                        {profiles[selectedThread.created_by] || selectedThread.created_by || "Anonymous"}
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
                  {'<- Back to forums'}
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
      {banner && <div className="community-banner info">{banner}</div>}
      {loading && <div className="community-empty">Loading community...</div>}

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
            <div className="community-panel">
              <div className="community-panel-title">Forum Threads</div>
              <div className="community-forum-topbar">
                <input
                  className="community-search"
                  placeholder="Search threads"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <button
                  className="studio-back community-cta-btn community-primary-btn"
                  onClick={() => {
                    const defaultForum =
                      activeForum ||
                      (forums[0]?.topic_slug ?? forumTracks[0]?.id ?? "");
                    setNewPostForum(defaultForum);
                    setCreatePostOpen(true);
                  }}
                >
                  New post
                </button>
              </div>
              <div className="community-tabs community-topic-tabs">
                {filteredForums.map((forum) => {
                  const slug = forum.topic_slug || forum.id;
                  const count = forumThreadCountsBySlug[slug] || 0;
                  return (
                    <button
                      key={forum.id}
                      className={`community-tab ${activeForum === slug ? "active" : ""}`}
                      onClick={() => {
                        setActiveForum(slug);
                        loadForumPosts(slug);
                      }}
                      type="button"
                    >
                      <span>{forum.title}</span>
                      <span className="community-forum-count-pill">
                        {count} {count === 1 ? "thread" : "threads"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="community-thread-toolbar">
                <div className="community-thread-toolbar-left">
                  <div className="community-thread-label">Sort</div>
                  <select
                    className="community-thread-select"
                    value={threadSort}
                    onChange={(event) => setThreadSort(event.target.value)}
                  >
                    <option value="newest">Newest</option>
                    <option value="top">Top</option>
                    <option value="active">Most active</option>
                  </select>
                </div>
                <div className="community-thread-count">
                  {filteredThreadPosts.length} {filteredThreadPosts.length === 1 ? "thread" : "threads"}
                </div>
              </div>
              <div className="community-thread-list">
              {filteredThreadPosts.map((post) => {
                const usingGlobalForumSearch = Boolean(search.trim());
                const repliesByPost = usingGlobalForumSearch ? globalPostReplies : postReplies;
                const replies = repliesByPost[post.id] || [];
                const author = profiles[post.created_by] || post.created_by || "Anonymous";
                const forumTitle = forumTitleById[post.forum_id];
                const isMostActive = post.id === mostActiveId;
                const previewText = post.body || "No details yet.";
                const isExpanded = Boolean(expandedPostIds[post.id]);
                const isLong = previewText.length > 220;
                const isPinned = Boolean(pinnedThreadIds[post.id]);
                const isRecent = Boolean(recentThreadIds[post.id]);
                return (
                  <div
                    key={post.id}
                    className={`community-feed-card community-thread-card ${isRecent ? "new-thread" : ""}`}
                  >
                    <div className="community-feed-title">
                      <button
                        className="community-thread-open-link"
                        type="button"
                        onClick={() => openThreadPage(post.id)}
                      >
                        {post.title}
                      </button>
                      {isMostActive && <span className="community-thread-badge">Most active</span>}
                      {isPinned && <span className="community-thread-badge pinned">Pinned</span>}
                      {isRecent && <span className="community-thread-badge fresh">New</span>}
                    </div>
                    <div className={`community-feed-sub community-thread-preview ${isExpanded ? "expanded" : "collapsed"}`}>
                      {previewText}
                    </div>
                    {isLong && (
                      <button
                        type="button"
                        className="community-readmore-btn"
                        onClick={() =>
                          setExpandedPostIds((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                        }
                      >
                        {isExpanded ? "Show less" : "Read more"}
                      </button>
                    )}
                    <div className="community-thread-meta">
                      <span className="community-meta-pill community-meta-author">{author}</span>
                      <span className="community-meta-pill">{formatTime(post.created_at)}</span>
                      <span className="community-meta-pill">{replies.length} replies</span>
                      {usingGlobalForumSearch && forumTitle && (
                        <span className="community-meta-pill">{forumTitle}</span>
                      )}
                    </div>
                    <div className="community-thread-actions">
                      <button
                        className="studio-back community-action-btn"
                        type="button"
                        onClick={() => openThreadPage(post.id)}
                      >
                        Open thread
                      </button>
                      <button
                        className="studio-back community-action-btn"
                        type="button"
                        onClick={() => {
                          setActiveThreadId(post.id);
                          setNewReply({ body: "", parentId: null });
                          setCreateReplyOpen(true);
                        }}
                      >
                        Reply
                      </button>
                      <button
                        className="studio-back community-action-btn"
                        type="button"
                        onClick={() => togglePinnedThread(post.id)}
                      >
                        {isPinned ? "Unpin" : "Pin"}
                      </button>
                      {Number(userId) === Number(post.created_by) && (
                        <button className="hud-secondary-btn danger" type="button" onClick={() => handleDeletePost(post.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
              {!filteredThreadPosts.length &&
                renderEmptyState({
                  icon: "CHAT",
                  title: search.trim() ? "No matching threads" : "No forum threads yet",
                  sub: search.trim()
                    ? `Nothing matched "${search.trim()}". Try another keyword.`
                    : "Start the first thread and spark the conversation.",
                  ctaLabel: search.trim() ? null : "Start first thread",
                  onCta: search.trim()
                    ? null
                    : () => {
                        const defaultForum =
                          activeForum ||
                          (forums[0]?.topic_slug ?? forumTracks[0]?.id ?? "");
                        setNewPostForum(defaultForum);
                        setCreatePostOpen(true);
                      }
                })}
            </div>
          )}

          {activeTab === "templates" && (
            <div className="community-panel">
              <div className="community-panel-title">Shared Templates</div>
              <div className="community-forum-topbar">
                <input
                  className="community-search"
                  placeholder="Search templates (e.g. protein balls, 20k training plan)"
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                />
                <button
                  className="studio-back community-cta-btn community-primary-btn"
                  type="button"
                  onClick={() => setCreateRecipeTemplateOpen(true)}
                >
                  Create recipe
                </button>
              </div>
              <div className="community-tabs community-topic-tabs">
                {templateTypeOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`community-tab ${templateTypeFilter === option.id ? "active" : ""}`}
                    type="button"
                    onClick={() => setTemplateTypeFilter(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="community-tabs community-topic-tabs">
                {templateFocusOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`community-tab ${templateFocusFilter === option.id ? "active" : ""}`}
                    type="button"
                    onClick={() => setTemplateFocusFilter(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="community-thread-toolbar">
                <div className="community-thread-toolbar-left">
                  <div className="community-thread-label">Sort</div>
                  <select
                    className="community-thread-select"
                    value={templateSort}
                    onChange={(event) => setTemplateSort(event.target.value)}
                  >
                    <option value="top">Top rated</option>
                    <option value="tried">Most tried</option>
                    <option value="newest">Newest</option>
                  </select>
                </div>
                <div className="community-thread-count">
                  {filteredTemplates.length} {filteredTemplates.length === 1 ? "template" : "templates"}
                </div>
              </div>
              <div className="community-tabs community-topic-tabs community-template-view-tabs">
                <button
                  className={`community-tab ${templateViewMode === "swipe" ? "active" : ""}`}
                  type="button"
                  onClick={() => setTemplateViewMode("swipe")}
                >
                  Swipe mode
                </button>
                <button
                  className={`community-tab ${templateViewMode === "forum" ? "active" : ""}`}
                  type="button"
                  onClick={() => setTemplateViewMode("forum")}
                >
                  Forum mode
                </button>
              </div>
              {templateViewMode === "swipe" && swipeTemplates.length > 0 && (
                <div className="community-template-deck-shell">
                  <div className="community-template-deck-head">
                    <div className="community-panel-title">Template Swipe Deck</div>
                    <div className="community-thread-count">
                      {Math.min(templateDeckIndex + 1, swipeTemplates.length)} / {swipeTemplates.length}
                    </div>
                  </div>
                  <div className="community-template-queue" role="list" aria-label="Template queue">
                    {swipeTemplates.map((template, queueIndex) => (
                      <button
                        key={`queue-${template.id}`}
                        type="button"
                        className={`community-template-queue-item ${queueIndex === templateDeckIndex ? "active" : ""}`}
                        onClick={() => {
                          setTemplateDeckIndex(queueIndex);
                          setTemplateDeckDragX(0);
                          setTemplateDeckAnimating(null);
                        }}
                      >
                        <span className="community-template-queue-title">{template.title}</span>
                        <span className="community-template-queue-type">{template.template_type.replace("_", " ")}</span>
                      </button>
                    ))}
                  </div>
                  <div className="community-template-stack-layer layer-back-2" aria-hidden="true" />
                  <div className="community-template-stack-layer layer-back-1" aria-hidden="true" />
                  {templateDeckIndex < swipeTemplates.length ? (
                    (() => {
                      const template = swipeTemplates[templateDeckIndex];
                      if (!template) return null;
                      const rating = templateRatings[template.id] || { sum: 0, count: 0, mine: null };
                      const avg = rating.count > 0 ? rating.sum / rating.count : 0;
                      const tryCount = Number(templateTryCounts[template.id] || 0);
                      const comments = templateComments[template.id] || [];
                      const author = profiles[template.created_by] || `User ${template.created_by}`;
                      const previewRows = getTemplatePreviewRows(template, true);
                      const metaBadges = getTemplateMetaBadges(template);
                      const payload = template.payload || {};
                      const workoutRows = Array.isArray(payload.exercises) ? payload.exercises : [];
                      const outlineRows = Array.isArray(payload.outline) ? payload.outline : [];
                      return (
                        <div
                          key={`deck-${template.id}`}
                          className={`community-feed-card community-template-swipe-card ${
                            templateDeckDragX > 24 ? "swipe-right" : templateDeckDragX < -24 ? "swipe-left" : ""
                          } ${templateDeckAnimating === "left" ? "animate-left" : ""} ${
                            templateDeckAnimating && templateDeckAnimating !== "left" ? "animate-right" : ""
                          }`}
                          style={{ transform: `translateX(${templateDeckDragX}px) rotate(${templateDeckDragX * 0.03}deg)` }}
                          onPointerDown={handleTemplateDeckPointerDown}
                          onPointerMove={handleTemplateDeckPointerMove}
                          onPointerUp={handleTemplateDeckPointerEnd}
                          onPointerCancel={handleTemplateDeckPointerEnd}
                          onPointerLeave={handleTemplateDeckPointerEnd}
                        >
                          {templateDeckDragX > 24 && (
                            <div className="community-swipe-indicator right">LIKE</div>
                          )}
                          {templateDeckDragX < -24 && (
                            <div className="community-swipe-indicator left">PASS</div>
                          )}
                          <div className="community-template-swipe-main">
                            <div className="community-feed-title">{template.title}</div>
                            <div className="community-thread-meta">
                              <span className="community-meta-pill community-meta-author">{author}</span>
                              <span className="community-meta-pill">{formatTime(template.created_at)}</span>
                              <span className="community-meta-pill">{template.template_type.replace("_", " ")}</span>
                            </div>
                            <div className="community-feed-sub">{template.summary || template.subtitle || "Shared template."}</div>
                            {metaBadges.length > 0 && (
                              <div className="community-template-meta-row">
                                {metaBadges.map((badge, index) => (
                                  <span key={`deck-${template.id}-meta-${index}`} className="community-template-meta-pill">
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            )}
                            {template.template_type === "workout_program" && workoutRows.length > 0 && (
                              <div className="community-template-program-report">
                                <div className="community-template-program-head">
                                  <span className="exercise">Exercise</span>
                                  <span>Sets</span>
                                  <span>Rep Range</span>
                                  <span>Weight (kg)</span>
                                </div>
                                <div className="community-template-program-body">
                                  {workoutRows.map((exercise, index) => (
                                    <div className="community-template-program-row" key={`deck-program-${template.id}-${index}`}>
                                      <span className="exercise">{exercise?.name || `Exercise ${index + 1}`}</span>
                                      <span>{Number(exercise?.sets) || 0}</span>
                                      <span>{exercise?.reps || "custom"}</span>
                                      <span>{Number(exercise?.weight) > 0 ? exercise.weight : "-"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {template.template_type === "training_plan" && outlineRows.length > 0 && (
                              <div className="community-template-outline">
                                <div className="community-template-preview-title">Full plan outline</div>
                                <div className="community-template-outline-list">
                                  {outlineRows.map((block, blockIndex) => {
                                    const sessions = Array.isArray(block?.sessions) ? block.sessions : [];
                                    return (
                                      <div key={`deck-outline-${template.id}-${blockIndex}`} className="community-template-outline-block">
                                        <div className="community-template-outline-week">{block?.week || `Week ${blockIndex + 1}`}</div>
                                        <div className="community-template-outline-sessions">
                                          {sessions.length
                                            ? sessions.map((item, itemIndex) => (
                                                <div key={`deck-outline-session-${template.id}-${blockIndex}-${itemIndex}`}>
                                                  {item}
                                                </div>
                                              ))
                                            : "No sessions"}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {template.template_type === "recipe" && previewRows.length > 0 && (
                              <div className="community-template-preview">
                                <div className="community-template-preview-title">Recipe preview</div>
                                <div className="community-template-preview-list">
                                  {previewRows.map((row, index) => (
                                    <div key={`deck-${template.id}-preview-${index}`} className="community-template-preview-item">
                                      {row}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="community-reaction-row">
                              <span className="community-meta-pill">Rating {avg.toFixed(1)} ({rating.count})</span>
                              <span className="community-meta-pill">Tried {tryCount}</span>
                              <span className="community-meta-pill">Comments {comments.length}</span>
                            </div>
                          </div>
                          <div className="community-template-swipe-actions community-template-hinge-actions">
                            <button
                              className="studio-back community-action-btn community-template-swipe-btn ghost hinge pass"
                              type="button"
                              onClick={() => handleTemplateDeckAction("left")}
                            >
                              Pass
                            </button>
                            <button
                              className="studio-back community-action-btn community-primary-btn community-template-swipe-btn hinge like"
                              type="button"
                              onClick={() => handleTemplateDeckAction("like")}
                            >
                              Like
                            </button>
                            <button
                              className="studio-back community-action-btn community-template-swipe-btn hinge add"
                              type="button"
                              onClick={() => handleTemplateDeckAction("add")}
                            >
                              Add to mine
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="community-empty community-empty-state">
                      <div className="community-empty-icon" aria-hidden="true">DONE</div>
                      <div className="community-empty-title">You reached the end of this deck</div>
                      <div className="community-empty-sub">Reset to swipe these templates again.</div>
                      <button
                        className="studio-back community-cta-btn community-primary-btn"
                        type="button"
                        onClick={() => setTemplateDeckIndex(0)}
                      >
                        Restart deck
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="community-liked-strip">
                <div className="community-panel-title">Liked Templates</div>
                {likedTemplates.length > 0 ? (
                  <div className="community-liked-list">
                    {likedTemplates.map((template) => (
                      <div key={`liked-${template.id}`} className="community-liked-item">
                        <div className="community-liked-main">
                          <div className="community-liked-title">{template.title}</div>
                          <div className="community-liked-sub">{template.template_type.replace("_", " ")}</div>
                        </div>
                        <div className="community-liked-actions">
                          <button
                            className="studio-back community-action-btn"
                            type="button"
                            onClick={() => {
                              const targetIndex = swipeTemplates.findIndex((item) => item.id === template.id);
                              if (targetIndex >= 0) {
                                setTemplateDeckIndex(targetIndex);
                                setTemplateDeckDragX(0);
                                setTemplateDeckAnimating(null);
                              }
                            }}
                          >
                            View
                          </button>
                          <button
                            className="studio-back community-action-btn community-primary-btn"
                            type="button"
                            onClick={() => handleAddTemplateToMine(template)}
                          >
                            Add to mine
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="community-liked-empty">No liked templates yet. Swipe right or tap Like to save them here.</div>
                )}
              </div>
              {!filteredTemplates.length &&
                renderEmptyState({
                  icon: "CHAT",
                  title: "No shared templates yet",
                  sub: "Share your best plan, program, or recipe and let others add it to their library."
                })}
              {(templateViewMode === "forum" || (templateViewMode === "swipe" && !swipeTemplates.length)) &&
                filteredTemplates.length > 0 && (
                <div className="community-thread-list">
                {filteredTemplates.map((template) => {
                  const rating = templateRatings[template.id] || { sum: 0, count: 0, mine: null };
                  const avg = rating.count > 0 ? rating.sum / rating.count : 0;
                  const myRating = Number(rating.mine || 0);
                  const tryCount = Number(templateTryCounts[template.id] || 0);
                  const comments = templateComments[template.id] || [];
                  const author = profiles[template.created_by] || `User ${template.created_by}`;
                  const previewRows = getTemplatePreviewRows(template);
                  const metaBadges = getTemplateMetaBadges(template);
                  return (
                    <div key={template.id} className="community-feed-card">
                      <div className="community-feed-title">{template.title}</div>
                      <div className="community-thread-meta">
                        <span className="community-meta-pill community-meta-author">{author}</span>
                        <span className="community-meta-pill">{formatTime(template.created_at)}</span>
                        <span className="community-meta-pill">{template.template_type.replace("_", " ")}</span>
                        {template.goal && <span className="community-meta-pill">{template.goal}</span>}
                      </div>
                      <div className="community-feed-sub">{template.summary || template.subtitle || "Shared template."}</div>
                      {metaBadges.length > 0 && (
                        <div className="community-template-meta-row">
                          {metaBadges.map((badge, index) => (
                            <span key={`${template.id}-meta-${index}`} className="community-template-meta-pill">
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                      {previewRows.length > 0 && (
                        <div className="community-template-preview">
                          <div className="community-template-preview-title">Preview</div>
                          <div className="community-template-preview-list">
                            {previewRows.map((row, index) => (
                              <div key={`${template.id}-preview-${index}`} className="community-template-preview-item">
                                {row}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="community-tags">
                        {(template.tags || []).slice(0, 6).map((tag, index) => (
                          <span key={`${template.id}-tag-${index}`}>{tag}</span>
                        ))}
                      </div>
                      <div className="community-reaction-row">
                        <span className="community-meta-pill">Rating {avg.toFixed(1)} ({rating.count})</span>
                        <span className="community-meta-pill">Tried {tryCount}</span>
                        <span className="community-meta-pill">Comments {comments.length}</span>
                      </div>
                      <div className="community-reaction-row">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={`${template.id}-rate-${value}`}
                            className={`community-reaction-btn ${myRating === value ? "active" : ""}`}
                            type="button"
                            onClick={() => handleRateTemplate(template.id, value)}
                          >
                            {value}★
                          </button>
                        ))}
                        <button
                          className={`community-reaction-btn ${templateTriedByMe[template.id] ? "active" : ""}`}
                          type="button"
                          onClick={() => handleTryTemplate(template.id)}
                        >
                          Tried it
                        </button>
                      </div>
                      <div className="community-thread-actions">
                        <button
                          className="studio-back community-action-btn community-primary-btn"
                          type="button"
                          onClick={() => handleAddTemplateToMine(template)}
                        >
                          Add to mine
                        </button>
                      </div>
                      <div className="community-template-commentbar">
                        <input
                          className="community-modal-input"
                          placeholder="Comment on this template"
                          value={templateCommentDrafts[template.id] || ""}
                          onChange={(event) =>
                            setTemplateCommentDrafts((prev) => ({
                              ...prev,
                              [template.id]: event.target.value
                            }))
                          }
                        />
                        <button
                          className="studio-back community-cta-btn"
                          type="button"
                          onClick={() => handleCommentTemplate(template.id)}
                        >
                          Comment
                        </button>
                      </div>
                      {comments.slice(0, 3).map((comment) => (
                        <div key={comment.id} className="community-reply-card">
                          <div className="community-reply-body">{comment.body}</div>
                          <div className="community-thread-meta">
                            <span className="community-meta-pill community-meta-author">
                              {profiles[comment.user_id] || `User ${comment.user_id}`}
                            </span>
                            <span className="community-meta-pill">{formatTime(comment.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          )}


          {/* groups discovery + joined sections */}
          {/* discover list comes first */}
          {/* joined groups are shown below */}
          {/* join routes into room immediately */}
          {activeTab === "groups" && (
            <div className="community-panel">
              <div className="community-panel-title">Find Groups</div>
              <input
                className="community-search"
                placeholder="Search groups (e.g. Keto Diet Group)"
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
              />

              <div className="community-panel-title">Discover Groups</div>
              <div className="community-scroll-list community-group-list community-group-square-grid">
                {discoverGroups.map((group) => {
                  const members = groupMemberCounts[group.id] || 0;
                  const lastActive = groupLastActive[group.id];
                  return (
                    <div key={group.id} className="community-forum-item community-group-square">
                      <div className="community-forum-title">{group.name}</div>
                      <div className="community-group-meta-line">
                        <span className="community-meta-pill">{members} members</span>
                        <span className="community-meta-pill">{groupPrivacyLabel(group.privacy)}</span>
                      </div>
                      <div className="community-forum-sub">{group.goal || "Community group"}</div>
                      <div className="community-group-activity-row">
                        <span className={`community-notification-dot mini ${lastActive ? "" : "idle"}`} />
                        <span>{lastActive ? `Active ${formatTime(lastActive)}` : "No chat activity yet"}</span>
                      </div>
                      <div className="community-group-item-actions">
                        <button
                          type="button"
                          className="studio-back community-cta-btn community-group-open-btn"
                          onClick={() => handleJoinGroup(group.id, true)}
                        >
                          Join group
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!discoverGroups.length &&
                renderEmptyState({
                  icon: "👥",
                  title: "No groups found",
                  sub: "Try a different search or create a new group.",
                  ctaLabel: "Create group",
                  onCta: () => setCreateGroupOpen(true)
                })}

              <div className="community-panel-title">Joined Groups</div>
              <div className="community-scroll-list community-group-list community-group-square-grid">
                {joinedGroups.map((group) => {
                  const members = groupMemberCounts[group.id] || 0;
                  const lastActive = groupLastActive[group.id];
                  return (
                    <div
                      key={group.id}
                      className={`community-forum-item community-group-square ${activeGroupId === group.id ? "active" : ""}`}
                    >
                      <div className="community-forum-title">{group.name}</div>
                      <div className="community-group-meta-line">
                        <span className="community-meta-pill">{members} members</span>
                        <span className="community-meta-pill">{groupPrivacyLabel(group.privacy)}</span>
                      </div>
                      <div className="community-forum-sub">{group.goal || "Community group"}</div>
                      <div className="community-group-activity-row">
                        <span className={`community-notification-dot mini ${lastActive ? "" : "idle"}`} />
                        <span>{lastActive ? `Active ${formatTime(lastActive)}` : "No chat activity yet"}</span>
                      </div>
                      <div className="community-group-item-actions">
                        <button
                          type="button"
                          className="studio-back community-cta-btn community-primary-btn community-group-open-btn"
                          onClick={() => {
                            setActiveGroupId(group.id);
                            navigate(groupRoomPath(group.id));
                          }}
                        >
                          Open room
                        </button>
                        <button
                          type="button"
                          className="studio-back community-cta-btn community-group-open-btn"
                          onClick={() => handleLeaveGroup(group.id)}
                        >
                          Leave
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!joinedGroups.length &&
                renderEmptyState({
                  icon: "👥",
                  title: "No joined groups yet",
                  sub: "Join a group above and it will appear here."
                })}
            </div>
          )}
          {/* challenge list panel with join CTAs, */}
          {/* shows challenge metadata and tags, */}
          {/* encourages participation via simple buttons, */}
          {/* and displays an empty state if none exist */}
          {activeTab === "challenges" && (
            <div className="community-panel">
              <div className="community-panel-title">Weekly Challenges</div>
              {challenges.map((challenge) => {
                const type = String(challenge.type || "distance").toLowerCase();
                const typeMeta = challengeTypeMeta[type] || { label: "Challenge", icon: "GO" };
                const participants = challengeParticipantCounts[challenge.id] || 0;
                const targetValue = Number(challenge.target_value || 0);
                const myProgress = Number(challengeMyProgress[challenge.id] || 0);
                const completion = targetValue > 0 ? Math.min((myProgress / targetValue) * 100, 100) : 0;
                const joined = joinedChallengeIds.has(Number(challenge.id));
                const createdAtMs = Date.parse(challenge.created_at || "");
                const durationDays = Number(challenge.duration_days || 7);
                const elapsedDays =
                  Number.isNaN(createdAtMs) ? 0 : Math.floor((Date.now() - createdAtMs) / 86400000);
                const daysRemaining = Math.max(durationDays - elapsedDays, 0);
                return (
                  <div key={challenge.id} className="community-feed-card community-challenge-card">
                    <div className="community-challenge-head">
                      <div className="community-challenge-type-icon" aria-hidden="true">{typeMeta.icon}</div>
                      <div>
                        <div className="community-feed-title">{challenge.title}</div>
                        <div className="community-feed-sub">
                          {typeMeta.label} challenge - target {challenge.target_value || "--"}
                        </div>
                      </div>
                    </div>
                    <div className="community-challenge-stats">
                      <span className="community-meta-pill">{participants} joined</span>
                      <span className="community-meta-pill">{daysRemaining} days left</span>
                      <span className="community-meta-pill">You: {myProgress || 0}</span>
                    </div>
                    <div className="community-challenge-progress">
                      <div className="community-challenge-progress-fill" style={{ width: `${completion}%` }} />
                    </div>
                    <div className="community-tags">
                      <span>{typeMeta.label}</span>
                      <span>{durationDays} days</span>
                    </div>
                    <button
                      className="studio-back community-cta-btn"
                      onClick={() => handleJoinChallenge(challenge.id)}
                      disabled={joined}
                    >
                      {joined ? "Joined" : "Join challenge"}
                    </button>
                  </div>
                );
              })}
              {!challenges.length &&
                renderEmptyState({
                  icon: "🏁",
                  title: "No challenges yet",
                  sub: "Create the first challenge and get people moving."
                })}
            </div>
          )}

          {/* your circle summary panel for social status, */}
          {/* highlights group + friend counts at a glance, */}
          {/* provides quick CTAs to create or add, */}
          {/* and anchors the friends list below */}
          {activeTab === "circle" && (
            <div className="community-panel">
              <div className="community-panel-title">Your Circle</div>
              <div className="community-circle-grid">
                <div className="community-circle-card">
                  <div className="community-circle-title">Accountability Groups</div>
                  <div className="community-circle-sub">{memberships.length} groups joined</div>
                  <button className="studio-back community-cta-btn" onClick={() => setCreateGroupOpen(true)}>
                    Create group
                  </button>
                </div>
                <div className="community-circle-card">
                  <div className="community-circle-title">
                    Friends List
                    {unreadCount > 0 && <span className="community-notification-pill">{unreadCount}</span>}
                  </div>
                  <div className="community-circle-sub">{friends.length} connections</div>
                  <button className="studio-back community-cta-btn" onClick={() => setAddFriendOpen(true)}>
                    Add friends
                  </button>
                </div>
              </div>
              {/* friends list with status + actions, */}
              {/* shows incoming/outgoing/accepted states, */}
              {/* exposes accept/reject/message buttons, */}
              {/* and renders an empty state when none exist */}
              <div className="community-friends-list">
                {friends.map((friend) => {
                  const status = getFriendStatus(friend);
                  const label = buildFriendLabel(friend);
                  const otherId = friend.user_id === Number(userId) ? friend.friend_user_id : friend.user_id;
                  const hasUnread = getFriendUnread(friend);
                  return (
                    <div key={friend.id} className="community-friend-card">
                      <div>
                        <div className="community-friend-title-row">
                          <div className="community-friend-title">{label}</div>
                          {hasUnread && <span className="community-notification-dot" />}
                        </div>
                        <div className="community-friend-sub">
                          {buildFriendMeta(friend)}
                        </div>
                        <div className="community-friend-sub">
                          {status === "accepted" ? "Connected" : status === "outgoing" ? "Request sent" : "Request received"}
                        </div>
                      </div>
                      <div className="community-friend-actions">
                        {status === "incoming" && (
                          <>
                            <button className="studio-back community-cta-btn" onClick={() => handleAcceptFriend(friend)}>
                              Accept
                            </button>
                            <button className="hud-secondary-btn danger" onClick={() => handleRejectFriend(friend)}>
                              Reject
                            </button>
                          </>
                        )}
                        {status === "accepted" && (
                          <>
                            <button
                              className="studio-back community-cta-btn"
                              onClick={() => {
                                setSelectedFriendId(otherId);
                                loadFriendMessages(otherId);
                              }}
                            >
                              Message
                              {hasUnread && <span className="community-notification-dot mini" />}
                            </button>
                            <button className="studio-back community-cta-btn" onClick={() => handleRemoveFriend(friend)}>
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!friends.length &&
                  renderEmptyState({
                    icon: "🤝",
                    title: "No connections yet",
                    sub: "Add a friend to start private chat."
                  })}
              </div>
              {/* private chat panel for the selected friend, */}
              {/* shows message history + composer, */}
              {/* updates in realtime via subscriptions, */}
              {/* can be closed to return to the list */}
              {selectedFriendId && (
                <div className="community-friend-chat">
                  <div className="community-panel-title">Private Chat</div>
                  <div className="community-friend-chat-head">
                    <div className="community-friend-title">
                      {profiles[selectedFriendId] || `User ${selectedFriendId}`}
                    </div>
                    <button
                      className="studio-back community-cta-btn"
                      onClick={() => {
                        setSelectedFriendId(null);
                        setFriendMessages([]);
                      }}
                    >
                      Close
                    </button>
                  </div>
                  <div className="community-friend-chat-list" ref={friendChatListRef}>
                    {friendMessages.map((msg) => {
                      const isSelf = Number(msg.user_id) === Number(userId);
                      const authorName = profiles[msg.user_id] || `User ${msg.user_id}`;
                      const initial = String(authorName).charAt(0).toUpperCase();
                      return (
                        <div key={msg.id} className={`community-friend-msg-row ${isSelf ? "self" : ""}`}>
                          <div className={`community-friend-chat-bubble ${isSelf ? "me" : "them"}`}>
                            <div className="community-friend-msg-head">
                              <span className="community-friend-msg-avatar" aria-hidden="true">{initial}</span>
                              <span className="community-friend-msg-author">{authorName}</span>
                              <span className="community-friend-msg-time">{formatTime(msg.created_at)}</span>
                            </div>
                            <div className="community-friend-msg-body">{msg.body}</div>
                          </div>
                        </div>
                      );
                    })}
                    {!friendMessages.length &&
                      renderEmptyState({
                        icon: "💬",
                        title: "No messages yet",
                        sub: "Say hello and kick things off."
                      })}
                  </div>
                  <div className="community-friend-chat-input">
                    <input
                      className="community-modal-input"
                      placeholder="Write a message"
                      value={friendMessageDraft}
                      onChange={(event) => setFriendMessageDraft(event.target.value)}
                    />
                    <button className="studio-back community-cta-btn community-primary-btn community-chat-send-btn" onClick={handleSendFriendMessage}>
                      Send
                    </button>
                  </div>
                  {friendMessageDraft.trim().length > 0 && (
                    <div className="community-typing-indicator">Typing...</div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
        </>
      )}

      {createRecipeTemplateOpen && (
        <div className="community-modal-backdrop">
          <div className="community-modal">
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
          </div>
        </div>
      )}

      {/* create group modal with name/goal/privacy fields, */}
      {/* opened from quick actions or group panel, */}
      {/* writes a new group and auto-joins the user, */}
      {/* closes on cancel or successful submit */}
      {createGroupOpen && (
        <div className="community-modal-backdrop">
          <div className="community-modal">
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
          </div>
        </div>
      )}

      {/* create challenge modal for weekly goals, */}
      {/* collects type/target/duration inputs, */}
      {/* inserts a new challenge and refreshes the list, */}
      {/* closes on cancel or submit */}
      {createChallengeOpen && (
        <div className="community-modal-backdrop">
          <div className="community-modal">
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
          </div>
        </div>
      )}

      {/* create forum post modal, */}
      {/* allows forum selection + title/body entry, */}
      {/* inserts a new post and reloads the active forum, */}
      {/* closes on cancel or successful post */}
      {createPostOpen && (
        <div className="community-modal-backdrop">
          <div className="community-modal">
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
              className="community-modal-input"
              placeholder="Post title"
              value={newPost.title}
              onChange={(event) => setNewPost((prev) => ({ ...prev, title: event.target.value }))}
            />
            <textarea
              className="community-modal-textarea"
              placeholder="Post body"
              value={newPost.body}
              onChange={(event) => setNewPost((prev) => ({ ...prev, body: event.target.value }))}
            />
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" onClick={() => setCreatePostOpen(false)}>
                Cancel
              </button>
              <button className="studio-back community-cta-btn" onClick={handleCreatePost}>
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* reply modal for forum threads, */}
      {/* supports replying to a post or nested reply, */}
      {/* posts the reply then refreshes the thread list, */}
      {/* closes on cancel or submit */}
      {createReplyOpen && !forceThreadPage && (
        <div className="community-modal-backdrop community-modal-backdrop-top">
          <div className="community-modal">
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
          </div>
        </div>
      )}

      {/* add friend modal using numeric user id, */}
      {/* validates the user and inserts a friend request, */}
      {/* refreshes the friends list after send, */}
      {/* closes on cancel or submit */}
      {addFriendOpen && (
        <div className="community-modal-backdrop">
          <div className="community-modal">
            <div className="community-modal-title">Add friend</div>
            <input
              className="community-modal-input"
              placeholder="Friend user id"
              value={newFriendId}
              onChange={(event) => setNewFriendId(event.target.value)}
            />
            <div className="community-modal-actions">
              <button className="studio-back community-cta-btn" onClick={() => setAddFriendOpen(false)}>
                Cancel
              </button>
              <button className="studio-back community-cta-btn" onClick={handleAddFriend}>
                Send request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
