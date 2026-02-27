import React from "react";
import { forumTracks } from "./communityHelpers";

export default function ForumsPanel({
  search,
  setSearch,
  activeForum,
  forums,
  filteredForums,
  forumThreadCountsBySlug,
  threadSort,
  setThreadSort,
  filteredThreadPosts,
  globalPostReplies,
  postReplies,
  profiles,
  forumTitleById,
  mostActiveId,
  expandedPostIds,
  setExpandedPostIds,
  pinnedThreadIds,
  recentThreadIds,
  userId,
  isBlockedProfile,
  openUserProfile,
  openThreadPage,
  setActiveThreadId,
  setNewReply,
  setCreateReplyOpen,
  togglePinnedThread,
  handleDeletePost,
  handleReportContent,
  handleToggleBlockProfile,
  renderEmptyState,
  setNewPostForum,
  setCreatePostOpen,
  setActiveForum,
  loadForumPosts,
  formatTime,
}) {
  return (
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
            const defaultForum = activeForum || (forums[0]?.topic_slug ?? forumTracks[0]?.id ?? "");
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
        {filteredThreadPosts
          .filter((post) => !isBlockedProfile(post.created_by))
          .map((post) => {
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
              <div key={post.id} className={`community-feed-card community-thread-card ${isRecent ? "new-thread" : ""}`}>
                <div className="community-feed-title">
                  <button className="community-thread-open-link" type="button" onClick={() => openThreadPage(post.id)}>
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
                    onClick={() => setExpandedPostIds((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                  >
                    {isExpanded ? "Show less" : "Read more"}
                  </button>
                )}
                <div className="community-thread-meta">
                  <button
                    type="button"
                    className="community-meta-pill community-meta-author community-profile-link"
                    onClick={() => openUserProfile(post.created_by)}
                  >
                    {author}
                  </button>
                  <span className="community-meta-pill">{formatTime(post.created_at)}</span>
                  <span className="community-meta-pill">{replies.length} replies</span>
                  {usingGlobalForumSearch && forumTitle && <span className="community-meta-pill">{forumTitle}</span>}
                </div>
                <div className="community-thread-actions">
                  <button className="studio-back community-action-btn" type="button" onClick={() => openThreadPage(post.id)}>
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
                  <button className="studio-back community-action-btn" type="button" onClick={() => togglePinnedThread(post.id)}>
                    {isPinned ? "Unpin" : "Pin"}
                  </button>
                  {Number(userId) === Number(post.created_by) && (
                    <button className="hud-secondary-btn danger" type="button" onClick={() => handleDeletePost(post.id)}>
                      Delete
                    </button>
                  )}
                  <button
                    className="studio-back community-action-btn"
                    type="button"
                    onClick={() =>
                      handleReportContent({
                        targetType: "thread",
                        targetId: post.id,
                        targetUserId: post.created_by,
                      })
                    }
                  >
                    Report
                  </button>
                  {Number(post.created_by) !== Number(userId) && (
                    <button
                      className="studio-back community-action-btn"
                      type="button"
                      onClick={() => handleToggleBlockProfile(post.created_by)}
                    >
                      {isBlockedProfile(post.created_by) ? "Unblock" : "Block"}
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
                const defaultForum = activeForum || (forums[0]?.topic_slug ?? forumTracks[0]?.id ?? "");
                setNewPostForum(defaultForum);
                setCreatePostOpen(true);
              },
        })}
    </div>
  );
}

