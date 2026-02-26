import { fireEvent, render, screen } from "@testing-library/react";
import GroupRoomPanel from "./GroupRoomPanel";

function buildProps(overrides = {}) {
  return {
    isRouteMode: false,
    activeGroup: { id: 9, name: "Test Group", goal: "Consistency", privacy: "open" },
    groupRoomMembers: [{ id: 1, user_id: 11 }],
    groupRoomPosts: [{ id: "p1", created_by: 11, body: "Hello team", created_at: new Date().toISOString() }],
    groupRoomLoading: false,
    groupRoomVisiblePosts: [{ id: "p1", created_by: 11, body: "Hello team", created_at: new Date().toISOString() }],
    groupRoomChannel: "general",
    groupRoomQuestionRepliesByQuestionId: {},
    groupRoomQuestionPostById: {},
    groupRoomQuestionReplyTargetId: "",
    groupRoomDraft: "hey",
    groupRoomSending: false,
    groupRoomListRef: { current: null },
    userId: 11,
    profiles: { 11: "@tester" },
    groupPrivacyLabel: () => "Open",
    formatTime: () => "Just now",
    parseQuestionReplyPayload: () => null,
    normalizeGroupPostChannel: () => "general",
    isBlockedProfile: () => false,
    openUserProfile: jest.fn(),
    onBackToGroups: jest.fn(),
    onLeaveGroup: jest.fn(),
    onSwitchChannel: jest.fn(),
    onReplyToQuestion: jest.fn(),
    onReportContent: jest.fn(),
    onDeletePost: jest.fn(),
    onToggleBlockProfile: jest.fn(),
    onCancelQuestionReply: jest.fn(),
    onQuestionDraftChange: jest.fn(),
    onGeneralDraftChange: jest.fn(),
    onSend: jest.fn(),
    renderEmptyState: ({ title }) => <div>{title}</div>,
    groupQuestionPrefix: "[Q] ",
    ...overrides,
  };
}

test("switches to questions channel via channel button", () => {
  const props = buildProps();
  render(<GroupRoomPanel {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Questions" }));
  expect(props.onSwitchChannel).toHaveBeenCalledWith("questions");
});

test("sends message from input bar", () => {
  const props = buildProps();
  render(<GroupRoomPanel {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(props.onSend).toHaveBeenCalledTimes(1);
});

