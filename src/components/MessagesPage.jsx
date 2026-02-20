import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { parseBlockedIds, toggleBlockedId } from "../utils/moderation";

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
      minute: "2-digit"
    });
  } catch {
    return "";
  }
};

export default function MessagesPage({ userId, mode = "athlete" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [friends, setFriends] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationHeads, setConversationHeads] = useState({});
  const [lastSeenByFriend, setLastSeenByFriend] = useState({});
  const [newChatTargetId, setNewChatTargetId] = useState("");
  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState("");
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  const basePath = mode === "gym" ? `/gym/${userId}` : `/athlete/${userId}`;
  const communityPath = `${basePath}/community`;
  const seenStorageKey = `exervia_messages_seen_${userId || ""}`;
  const blockedStorageKey = `exervia_blocked_users_${userId || ""}`;

  useEffect(() => {
    if (!banner) return;
    const timeout = setTimeout(() => setBanner(""), 2400);
    return () => clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(seenStorageKey);
      setLastSeenByFriend(raw ? JSON.parse(raw) : {});
    } catch {
      setLastSeenByFriend({});
    }
  }, [seenStorageKey, userId]);

  useEffect(() => {
    if (!userId) return;
    setBlockedUserIds(parseBlockedIds(localStorage.getItem(blockedStorageKey)));
  }, [blockedStorageKey, userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(seenStorageKey, JSON.stringify(lastSeenByFriend));
    } catch {
      // no-op
    }
  }, [lastSeenByFriend, seenStorageKey, userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(blockedStorageKey, JSON.stringify(blockedUserIds));
    } catch {
      // no-op
    }
  }, [blockedStorageKey, blockedUserIds, userId]);

  const loadProfiles = async (ids) => {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("id,username,display_name")
      .in("id", uniqueIds);
    if (!data) return;
    const next = {};
    data.forEach((row) => {
      const username = String(row.username || "").trim().replace(/^@+/, "");
      next[row.id] = username ? `@${username}` : row.display_name || `User ${row.id}`;
    });
    setProfiles((prev) => ({ ...prev, ...next }));
  };

  const getFriendStatus = useCallback((row) => {
    if (row.status === "accepted") return "accepted";
    const currentId = Number(userId);
    const requesterId = row.status === "pending_low" ? row.user_id : row.friend_user_id;
    return currentId === requesterId ? "outgoing" : "incoming";
  }, [userId]);

  const otherIdFromRow = useCallback((row) => {
    const currentId = Number(userId);
    return Number(row.user_id) === currentId ? Number(row.friend_user_id) : Number(row.user_id);
  }, [userId]);

  const loadFriends = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("community_friends")
      .select("*")
      .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);
    const rows = data || [];
    setFriends(rows);
    const ids = rows.flatMap((row) => [row.user_id, row.friend_user_id]);
    loadProfiles(ids);
  };

  const loadMessages = async (friendId) => {
    if (!friendId || !userId) return;
    const currentId = Number(userId);
    const low = Math.min(currentId, Number(friendId));
    const high = Math.max(currentId, Number(friendId));
    const { data } = await supabase
      .from("community_friend_messages")
      .select("*")
      .or(`and(user_id.eq.${low},friend_user_id.eq.${high}),and(user_id.eq.${high},friend_user_id.eq.${low})`)
      .order("created_at", { ascending: true });
    const rows = data || [];
    setMessages(rows);
    return rows;
  };

  const markConversationSeen = useCallback((friendId, atTimestamp = null) => {
    const normalizedId = Number(friendId);
    if (!normalizedId) return;
    const seenTs = atTimestamp || new Date().toISOString();
    setLastSeenByFriend((prev) => ({ ...prev, [normalizedId]: seenTs }));
  }, []);

  const loadConversationHeads = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("community_friend_messages")
      .select("id,user_id,friend_user_id,body,created_at")
      .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(400);
    const latest = {};
    (data || []).forEach((row) => {
      const otherId =
        Number(row.user_id) === Number(userId) ? Number(row.friend_user_id) : Number(row.user_id);
      if (!latest[otherId]) latest[otherId] = row;
    });
    setConversationHeads(latest);
    await loadProfiles(
      Object.keys(latest)
        .map((id) => Number(id))
        .filter(Boolean)
    );
    return latest;
  };

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      setLoading(true);
      const heads = (await Promise.all([loadFriends(), loadConversationHeads()]))[1];
      if (!mounted) return;
      const preferredFriend = Number(searchParams.get("friend") || "");
      if (preferredFriend && heads?.[preferredFriend]) {
        setSelectedFriendId(preferredFriend);
        const rows = await loadMessages(preferredFriend);
        const lastRowTs =
          rows.length > 0 ? rows[rows.length - 1].created_at : new Date().toISOString();
        markConversationSeen(preferredFriend, lastRowTs);
      }
      setLoading(false);
    };
    boot();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markConversationSeen, userId, searchParams]);

  useEffect(() => {
    if (!userId) return () => {};
    const channel = supabase
      .channel(`messages-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_friend_messages" },
        (payload) => {
          const msg = payload.new;
          if (!msg) return;
          const current = Number(userId);
          if (Number(msg.user_id) !== current && Number(msg.friend_user_id) !== current) return;
          const otherId =
            Number(msg.user_id) === current ? Number(msg.friend_user_id) : Number(msg.user_id);
          setConversationHeads((prev) => ({ ...prev, [otherId]: msg }));
          if (Number(selectedFriendId) === otherId) {
            setMessages((prev) => [...prev, msg]);
            markConversationSeen(otherId, msg.created_at);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [markConversationSeen, selectedFriendId, userId]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages]);

  const acceptedByOtherId = useMemo(() => {
    const map = {};
    friends.forEach((row) => {
      if (getFriendStatus(row) !== "accepted") return;
      const otherId = otherIdFromRow(row);
      if (!map[otherId]) map[otherId] = row;
    });
    return map;
  }, [friends, getFriendStatus, otherIdFromRow]);

  const conversationRows = useMemo(() => {
    return Object.entries(acceptedByOtherId)
      .filter(([otherId]) => !blockedUserIds.includes(Number(otherId)))
      .filter(([otherId]) => Boolean(conversationHeads[otherId]))
      .map(([_, row]) => row)
      .sort((a, b) => {
        const aId = otherIdFromRow(a);
        const bId = otherIdFromRow(b);
        const aTs = new Date(conversationHeads[aId]?.created_at || 0).getTime();
        const bTs = new Date(conversationHeads[bId]?.created_at || 0).getTime();
        return bTs - aTs;
      });
  }, [acceptedByOtherId, conversationHeads, otherIdFromRow, blockedUserIds]);

  const incomingRequests = useMemo(() => {
    return friends.filter((row) => {
      if (getFriendStatus(row) !== "incoming") return false;
      const otherId = otherIdFromRow(row);
      return !blockedUserIds.includes(Number(otherId));
    });
  }, [friends, getFriendStatus, otherIdFromRow, blockedUserIds]);

  const hasUnreadConversation = useCallback((otherId) => {
    const head = conversationHeads[otherId];
    if (!head) return false;
    if (Number(head.user_id) === Number(userId)) return false;
    const seenTs = lastSeenByFriend[otherId];
    if (!seenTs) return true;
    return new Date(head.created_at).getTime() > new Date(seenTs).getTime();
  }, [conversationHeads, lastSeenByFriend, userId]);

  const startableFriends = useMemo(() => {
    return Object.entries(acceptedByOtherId)
      .filter(([otherId]) => !conversationHeads[otherId])
      .filter(([otherId]) => !blockedUserIds.includes(Number(otherId)))
      .map(([otherId, row]) => ({
        otherId: Number(otherId),
        row
      }))
      .sort((a, b) => {
        const aName = String(profiles[a.otherId] || `User ${a.otherId}`).toLowerCase();
        const bName = String(profiles[b.otherId] || `User ${b.otherId}`).toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [acceptedByOtherId, conversationHeads, profiles, blockedUserIds]);

  const isBlockedUser = useCallback(
    (targetId) => blockedUserIds.includes(Number(targetId)),
    [blockedUserIds]
  );

  const handleToggleBlock = (targetId, name) => {
    const normalizedId = Number(targetId);
    if (!normalizedId) return;
    const currentlyBlocked = isBlockedUser(normalizedId);
    setBlockedUserIds((prev) => toggleBlockedId(prev, normalizedId));
    if (!currentlyBlocked && Number(selectedFriendId) === normalizedId) {
      setSelectedFriendId(null);
      setMessages([]);
      setDraft("");
    }
    setBanner(currentlyBlocked ? `Unblocked ${name}.` : `Blocked ${name}.`);
  };

  const handleReport = async ({ targetUserId = null, targetMessageId = null, reason = "safety" }) => {
    if (!userId) return;
    const payload = {
      reporter_id: Number(userId),
      target_user_id: targetUserId ? Number(targetUserId) : null,
      message_id: targetMessageId || null,
      reason
    };
    const { error } = await supabase.from("community_reports").insert([payload]);
    if (error) {
      setBanner("Report noted locally. Backend report table not configured yet.");
      return;
    }
    setBanner("Report submitted.");
  };

  const handleApprove = async (row) => {
    const { error } = await supabase.from("community_friends").update({ status: "accepted" }).eq("id", row.id);
    if (error) {
      setBanner(error.message || "Could not approve request.");
      return;
    }
    setBanner("Friend request approved.");
    await Promise.all([loadFriends(), loadConversationHeads()]);
  };

  const handleReject = async (row) => {
    const { error } = await supabase.from("community_friends").delete().eq("id", row.id);
    if (error) {
      setBanner(error.message || "Could not reject request.");
      return;
    }
    setBanner("Friend request rejected.");
    await Promise.all([loadFriends(), loadConversationHeads()]);
  };

  const handleRemove = async (row) => {
    const { error } = await supabase.from("community_friends").delete().eq("id", row.id);
    if (error) {
      setBanner(error.message || "Could not remove connection.");
      return;
    }
    setBanner("Connection removed.");
    const removedId = otherIdFromRow(row);
    if (Number(selectedFriendId) === Number(removedId)) {
      setSelectedFriendId(null);
      setMessages([]);
      setDraft("");
    }
    await Promise.all([loadFriends(), loadConversationHeads()]);
  };

  const handleSend = async () => {
    if (!selectedFriendId || !draft.trim() || !userId) return;
    if (isBlockedUser(selectedFriendId)) {
      setBanner("Unblock this user before sending messages.");
      return;
    }
    const current = Number(userId);
    const other = Number(selectedFriendId);
    const low = Math.min(current, other);
    const high = Math.max(current, other);
    const { error } = await supabase.from("community_friend_messages").insert([
      {
        user_id: current,
        friend_user_id: other,
        body: draft.trim()
      }
    ]);
    if (error) {
      setBanner(error.message || "Could not send message.");
      return;
    }
    setDraft("");
    const { data } = await supabase
      .from("community_friend_messages")
      .select("*")
      .or(`and(user_id.eq.${low},friend_user_id.eq.${high}),and(user_id.eq.${high},friend_user_id.eq.${low})`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    await loadConversationHeads();
  };

  const handleStartNewChat = async () => {
    const targetId = Number(newChatTargetId);
    if (!targetId) return;
    if (isBlockedUser(targetId)) {
      setBanner("Unblock this user to start a chat.");
      return;
    }
    setSelectedFriendId(targetId);
    setMessages([]);
    setNewChatTargetId("");
  };

  return (
    <div className="page-shell messages-page">
      <div className="page-header">
        <div>
          <button className="studio-back messages-back-btn" type="button" onClick={() => navigate(communityPath)}>
            {"<- Back"}
          </button>
          <h2 className="page-title">Messages</h2>
          <p className="page-subtitle">Direct chats for approved connections.</p>
        </div>
      </div>
      {banner ? <div className="hud-card">{banner}</div> : null}
      <div className="community-grid messages-layout">
        <aside className="community-panel">
          <div className="community-panel-title">Requests</div>
          {!incomingRequests.length && <div className="community-empty">No incoming requests.</div>}
          {incomingRequests.map((row) => {
            const otherId = otherIdFromRow(row);
            return (
              <div key={row.id} className="community-friend-card">
                <div>
                  <button type="button" className="community-profile-link community-friend-title">
                    {profiles[otherId] || `User ${otherId}`}
                  </button>
                  <div className="community-friend-sub">Friend request received</div>
                </div>
                <div className="community-friend-actions">
                  <button className="studio-back community-cta-btn" type="button" onClick={() => handleApprove(row)}>
                    Approve
                  </button>
                  <button className="hud-secondary-btn danger" type="button" onClick={() => handleReject(row)}>
                    Reject
                  </button>
                  <button
                    className="studio-back community-cta-btn"
                    type="button"
                    onClick={() => handleToggleBlock(otherId, profiles[otherId] || `User ${otherId}`)}
                  >
                    {isBlockedUser(otherId) ? "Unblock" : "Block"}
                  </button>
                </div>
              </div>
            );
          })}
          <div className="community-panel-title mt-3">Conversations</div>
          <div className="messages-start-chat-row">
            <select
              className="community-modal-input messages-start-chat-select"
              value={newChatTargetId}
              onChange={(event) => setNewChatTargetId(event.target.value)}
            >
              <option value="">Start new chat...</option>
              {startableFriends.map((item) => (
                <option key={item.otherId} value={item.otherId}>
                  {profiles[item.otherId] || `User ${item.otherId}`}
                </option>
              ))}
            </select>
            <button
              className="studio-back community-cta-btn"
              type="button"
              onClick={handleStartNewChat}
              disabled={!newChatTargetId}
            >
              Start
            </button>
          </div>
          {!conversationRows.length && <div className="community-empty">No conversations yet.</div>}
          {conversationRows.map((row) => {
            const otherId = otherIdFromRow(row);
            const selected = Number(selectedFriendId) === Number(otherId);
            const latest = conversationHeads[otherId];
            return (
              <div key={row.id} className={`community-forum-item ${selected ? "active" : ""}`}>
                <button
                  type="button"
                  className="community-profile-link community-friend-title"
                  onClick={async () => {
                    setSelectedFriendId(otherId);
                    const rows = await loadMessages(otherId);
                    const lastRowTs =
                      rows.length > 0 ? rows[rows.length - 1].created_at : new Date().toISOString();
                    markConversationSeen(otherId, lastRowTs);
                  }}
                >
                  {profiles[otherId] || `User ${otherId}`}
                </button>
                {hasUnreadConversation(otherId) && (
                  <div className="messages-convo-unread">New</div>
                )}
                <div className="community-friend-sub">
                  {latest?.body || "No messages yet."}
                </div>
                <div className="community-friend-sub">{formatTime(latest?.created_at)}</div>
                <div className="community-group-item-actions">
                  <button className="studio-back community-cta-btn" type="button" onClick={() => handleRemove(row)}>
                    Remove
                  </button>
                  <button
                    className="studio-back community-cta-btn"
                    type="button"
                    onClick={() => handleToggleBlock(otherId, profiles[otherId] || `User ${otherId}`)}
                  >
                    {isBlockedUser(otherId) ? "Unblock" : "Block"}
                  </button>
                </div>
              </div>
            );
          })}
        </aside>
        <section className="community-panel">
          {!selectedFriendId && <div className="community-empty">Select a conversation to open messages.</div>}
          {selectedFriendId && (
            <div className="community-friend-chat">
              <div className="community-friend-chat-head">
                <div className="community-friend-title">{profiles[selectedFriendId] || "Athlete"}</div>
                <div className="messages-scroll-actions">
                  <button
                    className="studio-back community-cta-btn messages-scroll-btn"
                    type="button"
                    onClick={() =>
                      handleReport({
                        targetUserId: selectedFriendId,
                        reason: "dm_conversation"
                      })
                    }
                    title="Report user"
                  >
                    !
                  </button>
                  <button
                    className="studio-back community-cta-btn messages-scroll-btn"
                    type="button"
                    onClick={() =>
                      handleToggleBlock(
                        selectedFriendId,
                        profiles[selectedFriendId] || `User ${selectedFriendId}`
                      )
                    }
                    title={isBlockedUser(selectedFriendId) ? "Unblock user" : "Block user"}
                  >
                    {isBlockedUser(selectedFriendId) ? "U" : "B"}
                  </button>
                  <button
                    className="studio-back community-cta-btn messages-scroll-btn"
                    type="button"
                    onClick={() => {
                      const el = listRef.current;
                      if (!el) return;
                      el.scrollBy({ top: -220, behavior: "smooth" });
                    }}
                    title="Scroll up"
                  >
                    ↑
                  </button>
                  <button
                    className="studio-back community-cta-btn messages-scroll-btn"
                    type="button"
                    onClick={() => {
                      const el = listRef.current;
                      if (!el) return;
                      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                    }}
                    title="Jump to latest"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="community-friend-chat-list" ref={listRef}>
                {loading && <div className="community-empty">Loading chat...</div>}
                {!loading && !messages.length && <div className="community-empty">No messages yet.</div>}
                {messages.map((msg) => {
                  const isSelf = Number(msg.user_id) === Number(userId);
                  const authorName = profiles[msg.user_id] || "Athlete";
                  const initial = String(authorName).charAt(0).toUpperCase();
                  return (
                    <div key={msg.id} className={`community-friend-msg-row ${isSelf ? "self" : ""}`}>
                      <div className={`community-friend-chat-bubble ${isSelf ? "me" : "them"}`}>
                        <div className="community-friend-msg-head">
                          <span className="community-friend-msg-avatar" aria-hidden="true">{initial}</span>
                          <span className="community-friend-msg-author">{authorName}</span>
                          <span className="community-friend-msg-time">{formatTime(msg.created_at)}</span>
                          {!isSelf && (
                            <button
                              className="community-reply-btn"
                              type="button"
                              onClick={() =>
                                handleReport({
                                  targetUserId: msg.user_id,
                                  targetMessageId: msg.id,
                                  reason: "dm_message"
                                })
                              }
                            >
                              Report
                            </button>
                          )}
                        </div>
                        <div className="community-friend-msg-body">{msg.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="community-friend-chat-input">
                <input
                  className="community-modal-input"
                  placeholder={isBlockedUser(selectedFriendId) ? "User blocked" : "Write a message"}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={isBlockedUser(selectedFriendId)}
                />
                <button
                  className="studio-back community-cta-btn community-primary-btn community-chat-send-btn"
                  type="button"
                  onClick={handleSend}
                  disabled={isBlockedUser(selectedFriendId)}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
