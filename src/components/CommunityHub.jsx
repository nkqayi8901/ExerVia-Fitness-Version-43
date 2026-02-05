import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const forumTracks = [
  { id: "hyrox", title: "Hyrox", subtitle: "Race prep, stations, engine" },
  { id: "running", title: "Running", subtitle: "Tempo, pacing, endurance" },
  { id: "nutrition", title: "Nutrition", subtitle: "Fueling, recovery, habits" },
  { id: "strength", title: "Strength", subtitle: "Progressions, form, PRs" },
  { id: "mindset", title: "Mindset", subtitle: "Consistency, discipline, recovery" }
];

const communitySections = [
  {
    id: "groups",
    title: "Accountability Groups",
    sub: "Small crews with shared goals.",
    cta: "Create group"
  }
];

const reactionOptions = [
  { id: "like", label: "Like" },
  { id: "fire", label: "Fire" },
  { id: "insight", label: "Insight" }
];

const formatTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
};

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

export default function CommunityHub({ userId }) {
  const navigate = useNavigate();
  const storedMode = localStorage.getItem("exervia_active_mode") || "athlete";
  const backPath = storedMode === "gym" ? `/gym/${userId || ""}` : `/athlete/${userId || ""}`;
  const [activeTab, setActiveTab] = useState("forums");
  const [activeForum, setActiveForum] = useState("hyrox");
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [search, setSearch] = useState("");
  const [forums, setForums] = useState([]);
  const [groups, setGroups] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [forumPosts, setForumPosts] = useState([]);
  const [groupPosts, setGroupPosts] = useState([]);
  const [postReplies, setPostReplies] = useState({});
  const [profiles, setProfiles] = useState({});
  const [friendStats, setFriendStats] = useState({});
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [friendMessages, setFriendMessages] = useState([]);
  const [friendMessageDraft, setFriendMessageDraft] = useState("");
  const [friendLastSeen, setFriendLastSeen] = useState({});
  const [friendLatest, setFriendLatest] = useState({});
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadSort, setThreadSort] = useState("newest");
  const [collapsedThreads, setCollapsedThreads] = useState({});
  const [memberships, setMemberships] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState("");

  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChallengeOpen, setCreateChallengeOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createGroupPostOpen, setCreateGroupPostOpen] = useState(false);
  const [createReplyOpen, setCreateReplyOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);

  const [newGroup, setNewGroup] = useState({ name: "", goal: "", privacy: "invite" });
  const [newChallenge, setNewChallenge] = useState({
    title: "",
    type: "distance",
    target: "",
    durationDays: "7"
  });
  const [newPost, setNewPost] = useState({ title: "", body: "" });
  const [newPostForum, setNewPostForum] = useState(activeForum);
  const [newGroupPost, setNewGroupPost] = useState({ body: "" });
  const [newReply, setNewReply] = useState({ body: "", parentId: null });
  const [reactionCounts, setReactionCounts] = useState({});
  const [userReactions, setUserReactions] = useState({});
  const [newFriendId, setNewFriendId] = useState("");

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

  const getFriendStatus = (friendRow) => {
    if (friendRow.status === "accepted") return "accepted";
    const currentId = Number(userId);
    const requesterId =
      friendRow.status === "pending_low" ? friendRow.user_id : friendRow.friend_user_id;
    if (currentId === requesterId) return "outgoing";
    return "incoming";
  };

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

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
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
      const [forumRes, groupRes, challengeRes, membershipRes, friendRes] = await Promise.all([
        supabase.from("community_forums").select("*").order("created_at", { ascending: true }),
        supabase.from("community_groups").select("*").order("created_at", { ascending: false }),
        supabase.from("community_challenges").select("*").order("created_at", { ascending: false }),
        supabase.from("community_group_members").select("*").eq("user_id", userId),
        supabase
          .from("community_friends")
          .select("*")
          .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`)
      ]);
      if (!mounted) return;
      setForums(forumRes.data || []);
      setGroups(groupRes.data || []);
      setChallenges(challengeRes.data || []);
      setMemberships(membershipRes.data || []);
      const friendList = friendRes.data || [];
      setFriends(friendList);
      const friendIds = friendList.flatMap((row) => [row.user_id, row.friend_user_id]);
      loadProfiles(friendIds);
      loadFriendStats(friendIds);
      loadFriendMessageSummaries();
      const defaultForum = activeForum || forumTracks[0].id;
      setActiveForum(defaultForum);
      await loadForumPosts(defaultForum, forumRes.data || []);
      setLoading(false);
    };
    fetchCommunity();
    return () => {
      mounted = false;
    };
  }, [userId]);

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

  const filteredForums = useMemo(() => {
    const source = forums.length ? forums : forumTracks;
    if (!search) return source;
    const query = search.toLowerCase();
    return source.filter(
      (forum) =>
        (forum.title || "").toLowerCase().includes(query) ||
        (forum.subtitle || "").toLowerCase().includes(query)
    );
  }, [forums, search]);

  const forumSelectOptions = useMemo(() => {
    return forums.length ? forums : forumTracks;
  }, [forums]);

  useEffect(() => {
    if (!createPostOpen) {
      setNewPostForum(activeForum);
    }
  }, [activeForum, createPostOpen]);

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
    setActiveTab("groups");
    if (data?.id) {
      setActiveGroupId(data.id);
      loadGroupPosts(data.id);
      setCreateGroupPostOpen(true);
    }
  };

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
  };

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
    loadForumPosts(forumSlug);
  };

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
    setNewReply({ body: "", parentId: null });
    loadForumPosts(activeForum);
  };

  const handleCreateGroupPost = async () => {
    if (!newGroupPost.body.trim()) return;
    if (!activeGroupId) {
      setBanner("Select a group first.");
      return;
    }
    const { error } = await supabase.from("community_group_posts").insert([
      {
        group_id: activeGroupId,
        body: newGroupPost.body.trim(),
        created_by: userId
      }
    ]);
    if (error) {
      setBanner(error.message || "Could not post in group.");
      return;
    }
    setCreateGroupPostOpen(false);
    setNewGroupPost({ body: "" });
    const { data } = await supabase
      .from("community_group_posts")
      .select("*")
      .eq("group_id", activeGroupId)
      .order("created_at", { ascending: false });
    setGroupPosts(data || []);
  };

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

  const handleJoinGroup = async (groupId) => {
    if (!userId) {
      setBanner("Sign in to join a group.");
      return;
    }
    const { error } = await supabase.from("community_group_members").insert([
      {
        group_id: groupId,
        user_id: userId,
        role: "member"
      }
    ]);
    if (error) {
      setBanner(error.message || "Could not join group.");
      return;
    }
    setBanner("Joined group.");
    const { data: membershipData } = await supabase
      .from("community_group_members")
      .select("*")
      .eq("user_id", userId);
    setMemberships(membershipData || []);
    setActiveGroupId(groupId);
    loadGroupPosts(groupId);
  };

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

  const buildFriendLabel = (friendRow) => {
    const currentId = Number(userId);
    const otherId = friendRow.user_id === currentId ? friendRow.friend_user_id : friendRow.user_id;
    return profiles[otherId] || `User ${otherId}`;
  };

  const buildFriendMeta = (friendRow) => {
    const currentId = Number(userId);
    const otherId = friendRow.user_id === currentId ? friendRow.friend_user_id : friendRow.user_id;
    const stats = friendStats[otherId];
    if (!stats) return "Rank -- · Level --";
    return `Rank ${stats.rank || "--"} · Level ${stats.level ?? "--"}`;
  };

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
    loadForumPosts(activeForum);
  };

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
    loadForumPosts(activeForum);
  };

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
    if (error) {
      setBanner(error.message || "Could not join challenge.");
      return;
    }
    setBanner("Challenge joined.");
  };

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

  const sortedForumPosts = useMemo(() => {
    if (!forumPosts.length) return [];
    const copy = [...forumPosts];
    if (threadSort === "newest") {
      return copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    if (threadSort === "top") {
      return copy.sort((a, b) => {
        const aCount = (postReplies[a.id] || []).length;
        const bCount = (postReplies[b.id] || []).length;
        return bCount - aCount;
      });
    }
    if (threadSort === "active") {
      return copy.sort((a, b) => {
        const aLatest = (postReplies[a.id] || []).slice(-1)[0]?.created_at || a.created_at;
        const bLatest = (postReplies[b.id] || []).slice(-1)[0]?.created_at || b.created_at;
        return new Date(bLatest) - new Date(aLatest);
      });
    }
    return copy;
  }, [forumPosts, postReplies, threadSort]);

  const unreadCount = useMemo(() => {
    return friends.reduce((count, friend) => (getFriendUnread(friend) ? count + 1 : count), 0);
  }, [friends, friendLatest, friendLastSeen, userId]);

  const threadPulse = useMemo(() => {
    if (!forumPosts.length) return [];
    return [...forumPosts]
      .map((post) => ({
        post,
        count: (postReplies[post.id] || []).length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [forumPosts, postReplies]);

  const mostActiveId = useMemo(() => {
    if (!threadPulse.length) return null;
    return threadPulse[0].post.id;
  }, [threadPulse]);

  const toggleCollapse = (postId) => {
    setCollapsedThreads((prev) => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

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
  };

  const loadGroupPosts = async (groupId) => {
    const { data } = await supabase
      .from("community_group_posts")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    setGroupPosts(data || []);
    if (data?.length) {
      loadProfiles(data.map((post) => post.created_by));
    }
  };

  const renderReplies = (replyNodes, level = 0, rootPostId = null) => {
    if (!replyNodes?.length) return null;
    return replyNodes.map((reply) => {
      const author = profiles[reply.created_by] || reply.created_by || "Anonymous";
      const replyKeyPrefix = `reply:${reply.id}`;
      return (
        <div key={reply.id} className={`community-reply-card ${level > 0 ? "nested" : ""}`}>
          <div className="community-reply-body">{reply.body}</div>
          <div className="community-thread-meta">
            {author} - {formatTime(reply.created_at)}
          </div>
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
                  {option.label} {count}
                </button>
              );
            })}
          </div>
          <button
            className="community-reply-btn"
            onClick={() => {
              setActiveThreadId(reply.post_id);
              setNewReply({ body: "", parentId: reply.id });
              setCreateReplyOpen(true);
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
          {reply.children?.length > 0 && (
            <div className="community-replies">
              {renderReplies(reply.children, level + 1, rootPostId || reply.post_id)}
            </div>
          )}
        </div>
      );
    });
  };

  const activeGroup = groups.find((group) => group.id === activeGroupId) || null;
  const isMember = activeGroupId
    ? memberships.some((membership) => membership.group_id === activeGroupId)
    : false;

  return (
    <div className="community-shell" data-user={userId || ""}>
      <div className="community-header">
        <div>
          <div className="community-kicker">COMMUNITY</div>
          <h2 className="community-title">Train With Others</h2>
          <p className="community-sub">
            Accountability, forums, and challenges built for serious athletes.
          </p>
        </div>
        <div className="community-cta-row">
          <button className="hud-secondary-btn" onClick={() => navigate(backPath)}>
            Back
          </button>
          <button className="hud-secondary-btn" onClick={() => setCreateGroupOpen(true)}>
            Create group
          </button>
          <button className="hud-secondary-btn" onClick={() => setAddFriendOpen(true)}>
            Add friend
          </button>
        </div>
      </div>
      <div className="community-tabs">
        <button
          className={`community-tab ${activeTab === "forums" ? "active" : ""}`}
          onClick={() => setActiveTab("forums")}
          type="button"
        >
          Forums
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
      </div>
      {banner && <div className="studio-banner info">{banner}</div>}
      {loading && <div className="community-empty">Loading community...</div>}

      <div className="community-grid">
        <aside className="community-sidebar">
          {activeTab === "forums" && (
            <div className="community-panel">
              <div className="community-panel-title">Forums</div>
              <input
                className="community-search"
                placeholder="Search forums"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="community-forum-actions">
                <button
                  className="hud-secondary-btn"
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
              <div className="community-forum-list">
                {filteredForums.map((forum) => (
                  <button
                    key={forum.id}
                    className={`community-forum-item ${activeForum === (forum.topic_slug || forum.id) ? "active" : ""}`}
                    onClick={() => {
                      const slug = forum.topic_slug || forum.id;
                      setActiveForum(slug);
                      loadForumPosts(slug);
                    }}
                    type="button"
                  >
                    <div className="community-forum-title">{forum.title}</div>
                    <div className="community-forum-sub">{forum.subtitle}</div>
                  </button>
                ))}
                {!filteredForums.length && (
                  <div className="community-empty">No forums match that search.</div>
                )}
              </div>
              <div className="community-thread-pulse">
                <div className="community-panel-title">Thread Pulse</div>
                {threadPulse.map(({ post, count }) => (
                  <button
                    key={post.id}
                    className={`community-thread-row ${activeThreadId === post.id ? "active" : ""}`}
                    onClick={() => setActiveThreadId(post.id)}
                    type="button"
                  >
                    <div className="community-thread-row-main">
                      <div className="community-thread-row-title">{post.title}</div>
                      <div className="community-thread-row-sub">{count} replies</div>
                    </div>
                    {post.id === mostActiveId && (
                      <span className="community-thread-badge">Most active</span>
                    )}
                  </button>
                ))}
                {!threadPulse.length && (
                  <div className="community-empty">No threads yet.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "groups" && (
            <div className="community-panel">
              <div className="community-panel-title">Groups</div>
              <div className="community-group-list">
                {groups.map((group) => {
                  const joined = memberships.some((item) => item.group_id === group.id);
                  return (
                    <button
                      key={group.id}
                      className={`community-forum-item ${activeGroupId === group.id ? "active" : ""}`}
                      onClick={() => {
                        setActiveGroupId(group.id);
                        loadGroupPosts(group.id);
                      }}
                      type="button"
                    >
                      <div className="community-forum-title">{group.name}</div>
                      <div className="community-forum-sub">{joined ? "Joined" : "Not joined"}</div>
                    </button>
                  );
                })}
                {!groups.length && <div className="community-empty">No groups yet.</div>}
              </div>
              <div className="community-forum-actions">
                <button className="hud-secondary-btn" onClick={() => setCreateGroupOpen(true)}>
                  Create group
                </button>
              </div>
            </div>
          )}

          {activeTab === "challenges" && (
            <div className="community-panel">
              <div className="community-panel-title">Challenges</div>
              <div className="community-group-list">
                {challenges.map((challenge) => (
                  <div key={challenge.id} className="community-feed-card">
                    <div className="community-feed-title">{challenge.title}</div>
                    <div className="community-feed-sub">
                      {challenge.type || "challenge"} - {challenge.duration_days || 7} days
                    </div>
                    <button className="hud-secondary-btn" onClick={() => handleJoinChallenge(challenge.id)}>
                      Join
                    </button>
                  </div>
                ))}
                {!challenges.length && <div className="community-empty">No challenges yet.</div>}
              </div>
              <div className="community-forum-actions">
                <button className="hud-secondary-btn" onClick={() => setCreateChallengeOpen(true)}>
                  Create challenge
                </button>
              </div>
            </div>
          )}

        </aside>

        <main className="community-feed">
          {activeTab === "forums" && (
            <div className="community-panel">
              <div className="community-panel-title">Forum Threads</div>
              <div className="community-thread-toolbar">
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
              {sortedForumPosts.map((post) => {
                const replies = postReplies[post.id] || [];
                const replyTree = buildReplyTree(replies);
                const author = profiles[post.created_by] || post.created_by || "Anonymous";
                const isCollapsed = collapsedThreads[post.id];
                const isMostActive = post.id === mostActiveId;
                return (
                  <div key={post.id} className="community-feed-card">
                    <div className="community-feed-title">
                      {post.title}
                      {isMostActive && <span className="community-thread-badge">Most active</span>}
                    </div>
                    <div className="community-feed-sub">{post.body || "No details yet."}</div>
                    <div className="community-thread-meta">
                      {author} - {formatTime(post.created_at)} - {replies.length} replies
                    </div>
                    <div className="community-thread-actions">
                      <button
                        className="hud-secondary-btn"
                        onClick={() => {
                          setActiveThreadId(post.id);
                          setNewReply({ body: "", parentId: null });
                          setCreateReplyOpen(true);
                        }}
                      >
                        Reply
                      </button>
                      <button className="hud-secondary-btn" onClick={() => toggleCollapse(post.id)}>
                        {isCollapsed ? "Expand" : "Collapse"}
                      </button>
                      {Number(userId) === Number(post.created_by) && (
                        <button className="hud-secondary-btn danger" onClick={() => handleDeletePost(post.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                    <div className="community-reaction-row">
                      {reactionOptions.map((option) => {
                        const key = `post:${post.id}-${option.id}`;
                        const count = reactionCounts[key] || 0;
                        const active = Boolean(userReactions[key]);
                        return (
                          <button
                            key={option.id}
                            className={`community-reaction-btn ${active ? "active" : ""}`}
                            onClick={() => handleReact({ postId: post.id, reaction: option.id })}
                          >
                            {option.label} {count}
                          </button>
                        );
                      })}
                    </div>
                    {!isCollapsed && replyTree.length > 0 && (
                      <div className="community-replies">{renderReplies(replyTree, 0, post.id)}</div>
                    )}
                    {isCollapsed && <div className="community-empty">Thread collapsed.</div>}
                  </div>
                );
              })}
              {!forumPosts.length && (
                <div className="community-empty">No posts yet. Start the first thread.</div>
              )}
            </div>
          )}

          {activeTab === "groups" && (
            <div className="community-panel">
              <div className="community-panel-title">
                {activeGroup?.name ? `Group Chat - ${activeGroup.name}` : "Group Chat"}
              </div>
              {activeGroupId ? (
                <>
                  {!isMember && (
                    <div className="community-chat-actions">
                      <button className="hud-secondary-btn" onClick={() => handleJoinGroup(activeGroupId)}>
                        Join group
                      </button>
                    </div>
                  )}
                  {isMember && (
                    <div className="community-chat-actions">
                      <button className="hud-secondary-btn" onClick={() => setCreateGroupPostOpen(true)}>
                        Send message
                      </button>
                    </div>
                  )}
                  <div className="community-chat-list">
                    {groupPosts.map((post) => (
                      <div key={post.id} className="community-chat-message">
                        <div className="community-chat-body">{post.body}</div>
                        <div className="community-chat-meta">
                          {profiles[post.created_by] || post.created_by || "Anonymous"} - {formatTime(post.created_at)}
                        </div>
                      </div>
                    ))}
                    {!groupPosts.length && (
                      <div className="community-empty">
                        {isMember ? "No messages yet. Start the chat." : "Join the group to see the chat."}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="community-empty">Select a group to open the chat.</div>
              )}
              <div className="community-panel-title" style={{ marginTop: 16 }}>
                Perks
              </div>
              <div className="community-perks">
                <div>Weekly accountability pings</div>
                <div>Shared goal tracking</div>
                <div>Group-only challenges</div>
              </div>
            </div>
          )}

          {activeTab === "challenges" && (
            <div className="community-panel">
              <div className="community-panel-title">Weekly Challenges</div>
              {challenges.map((challenge) => (
                <div key={challenge.id} className="community-feed-card">
                  <div className="community-feed-title">{challenge.title}</div>
                  <div className="community-feed-sub">
                    {challenge.type || "challenge"} - {challenge.duration_days || 7} days - Target{" "}
                    {challenge.target_value || "--"}
                  </div>
                  <div className="community-tags">
                    <span>{challenge.type || "challenge"}</span>
                    <span>{challenge.duration_days || 7} days</span>
                  </div>
                  <button className="hud-secondary-btn" onClick={() => handleJoinChallenge(challenge.id)}>
                    Join challenge
                  </button>
                </div>
              ))}
              {!challenges.length && (
                <div className="community-empty">No challenges yet. Create the first one.</div>
              )}
            </div>
          )}

          <div className="community-panel">
            <div className="community-panel-title">Your Circle</div>
            <div className="community-circle-grid">
              <div className="community-circle-card">
                <div className="community-circle-title">Accountability Groups</div>
                <div className="community-circle-sub">{memberships.length} groups joined</div>
                <button className="hud-secondary-btn" onClick={() => setCreateGroupOpen(true)}>
                  Create group
                </button>
              </div>
              <div className="community-circle-card">
                <div className="community-circle-title">
                  Friends List
                  {unreadCount > 0 && <span className="community-notification-pill">{unreadCount}</span>}
                </div>
                <div className="community-circle-sub">{friends.length} connections</div>
                <button className="hud-secondary-btn" onClick={() => setAddFriendOpen(true)}>
                  Add friends
                </button>
              </div>
              <div className="community-circle-card">
                <div className="community-circle-title">Group Chats</div>
                <div className="community-circle-sub">Make a private chat for your crew.</div>
                <button className="hud-secondary-btn">Coming soon</button>
              </div>
            </div>
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
                          <button className="hud-secondary-btn" onClick={() => handleAcceptFriend(friend)}>
                            Accept
                          </button>
                          <button className="hud-secondary-btn danger" onClick={() => handleRejectFriend(friend)}>
                            Reject
                          </button>
                        </>
                      )}
                      {status === "accepted" && (
                        <button
                          className="hud-secondary-btn"
                          onClick={() => {
                            setSelectedFriendId(otherId);
                            loadFriendMessages(otherId);
                          }}
                        >
                          Message
                          {hasUnread && <span className="community-notification-dot mini" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!friends.length && (
                <div className="community-empty">No connections yet. Add a friend to start.</div>
              )}
            </div>
            {selectedFriendId && (
              <div className="community-friend-chat">
                <div className="community-panel-title">Private Chat</div>
                <div className="community-friend-chat-head">
                  <div className="community-friend-title">
                    {profiles[selectedFriendId] || `User ${selectedFriendId}`}
                  </div>
                  <button
                    className="hud-secondary-btn"
                    onClick={() => {
                      setSelectedFriendId(null);
                      setFriendMessages([]);
                    }}
                  >
                    Close
                  </button>
                </div>
                <div className="community-friend-chat-list">
                  {friendMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`community-friend-chat-bubble ${
                        Number(msg.user_id) === Number(userId) ? "me" : "them"
                      }`}
                    >
                      <div>{msg.body}</div>
                      <div className="community-chat-meta">{formatTime(msg.created_at)}</div>
                    </div>
                  ))}
                  {!friendMessages.length && (
                    <div className="community-empty">No messages yet. Say hello.</div>
                  )}
                </div>
                <div className="community-friend-chat-input">
                  <input
                    className="community-modal-input"
                    placeholder="Write a message"
                    value={friendMessageDraft}
                    onChange={(event) => setFriendMessageDraft(event.target.value)}
                  />
                  <button className="hud-secondary-btn" onClick={handleSendFriendMessage}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

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
              <button className="hud-secondary-btn" onClick={() => setCreateGroupOpen(false)}>
                Cancel
              </button>
              <button className="hud-secondary-btn" onClick={handleCreateGroup}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button className="hud-secondary-btn" onClick={() => setCreateChallengeOpen(false)}>
                Cancel
              </button>
              <button className="hud-secondary-btn" onClick={handleCreateChallenge}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button className="hud-secondary-btn" onClick={() => setCreatePostOpen(false)}>
                Cancel
              </button>
              <button className="hud-secondary-btn" onClick={handleCreatePost}>
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {createReplyOpen && (
        <div className="community-modal-backdrop">
          <div className="community-modal">
            <div className="community-modal-title">Reply</div>
            <textarea
              className="community-modal-textarea"
              placeholder="Write a reply"
              value={newReply.body}
              onChange={(event) => setNewReply((prev) => ({ ...prev, body: event.target.value }))}
            />
            <div className="community-modal-actions">
              <button className="hud-secondary-btn" onClick={() => setCreateReplyOpen(false)}>
                Cancel
              </button>
              <button className="hud-secondary-btn" onClick={handleCreateReply}>
                Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {createGroupPostOpen && (
        <div className="community-modal-backdrop">
          <div className="community-modal">
            <div className="community-modal-title">Send group message</div>
            <textarea
              className="community-modal-textarea"
              placeholder="Message"
              value={newGroupPost.body}
              onChange={(event) => setNewGroupPost((prev) => ({ ...prev, body: event.target.value }))}
            />
            <div className="community-modal-actions">
              <button className="hud-secondary-btn" onClick={() => setCreateGroupPostOpen(false)}>
                Cancel
              </button>
              <button className="hud-secondary-btn" onClick={handleCreateGroupPost}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button className="hud-secondary-btn" onClick={() => setAddFriendOpen(false)}>
                Cancel
              </button>
              <button className="hud-secondary-btn" onClick={handleAddFriend}>
                Send request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
