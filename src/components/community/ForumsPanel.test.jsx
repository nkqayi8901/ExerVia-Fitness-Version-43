import { fireEvent, render, screen } from "@testing-library/react";
import ForumsPanel from "./ForumsPanel";

function buildProps(overrides = {}) {
  return {
    search: "",
    setSearch: jest.fn(),
    activeForum: "hyrox",
    forums: [{ id: 1, topic_slug: "hyrox", title: "Hyrox" }],
    filteredForums: [{ id: 1, topic_slug: "hyrox", title: "Hyrox" }],
    forumThreadCountsBySlug: { hyrox: 1 },
    threadSort: "newest",
    setThreadSort: jest.fn(),
    filteredThreadPosts: [
      { id: "p1", title: "Thread 1", body: "Body", created_by: 11, created_at: new Date().toISOString(), forum_id: 1 },
    ],
    globalPostReplies: {},
    postReplies: { p1: [] },
    profiles: { 11: "@tester" },
    forumTitleById: { 1: "Hyrox" },
    mostActiveId: "p1",
    expandedPostIds: {},
    setExpandedPostIds: jest.fn(),
    pinnedThreadIds: {},
    recentThreadIds: {},
    userId: 11,
    isBlockedProfile: () => false,
    openUserProfile: jest.fn(),
    openThreadPage: jest.fn(),
    setActiveThreadId: jest.fn(),
    setNewReply: jest.fn(),
    setCreateReplyOpen: jest.fn(),
    togglePinnedThread: jest.fn(),
    handleDeletePost: jest.fn(),
    handleReportContent: jest.fn(),
    handleToggleBlockProfile: jest.fn(),
    renderEmptyState: ({ title }) => <div>{title}</div>,
    setNewPostForum: jest.fn(),
    setCreatePostOpen: jest.fn(),
    setActiveForum: jest.fn(),
    loadForumPosts: jest.fn(),
    formatTime: () => "Just now",
    ...overrides,
  };
}

test("new post button opens composer", () => {
  const props = buildProps();
  render(<ForumsPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /new post/i }));
  expect(props.setCreatePostOpen).toHaveBeenCalledWith(true);
});

test("clicking forum tab switches active forum", () => {
  const props = buildProps();
  render(<ForumsPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /hyrox/i }));
  expect(props.setActiveForum).toHaveBeenCalledWith("hyrox");
  expect(props.loadForumPosts).toHaveBeenCalledWith("hyrox");
});

