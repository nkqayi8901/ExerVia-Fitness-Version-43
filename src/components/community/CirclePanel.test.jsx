import { fireEvent, render, screen } from "@testing-library/react";
import CirclePanel from "./CirclePanel";

function buildProps(overrides = {}) {
  return {
    memberships: [{ id: 1 }],
    unreadCount: 1,
    incomingRequestCount: 1,
    friends: [{ id: 10, user_id: 99, friend_user_id: 7 }],
    setCreateGroupOpen: jest.fn(),
    setAddFriendOpen: jest.fn(),
    navigate: jest.fn(),
    messagesPath: (id) => (id ? `/messages?friend=${id}` : "/messages"),
    getFriendStatus: () => "accepted",
    buildFriendLabel: () => "@friend",
    buildFriendMeta: () => "LV 1",
    getFriendUnread: () => true,
    openUserProfile: jest.fn(),
    handleAcceptFriend: jest.fn(),
    handleRejectFriend: jest.fn(),
    handleRemoveFriend: jest.fn(),
    userId: 99,
    renderEmptyState: ({ title }) => <div>{title}</div>,
    ...overrides,
  };
}

test("opens add friend flow", () => {
  const props = buildProps();
  render(<CirclePanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /add friend/i }));
  expect(props.setAddFriendOpen).toHaveBeenCalledWith(true);
});

test("navigates to friend messages", () => {
  const props = buildProps();
  render(<CirclePanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /friends list/i }));
  fireEvent.click(screen.getByRole("button", { name: /message/i }));
  expect(props.navigate).toHaveBeenCalledWith("/messages?friend=7");
});
