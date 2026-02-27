import { fireEvent, render, screen } from "@testing-library/react";
import GroupsPanel from "./GroupsPanel";

function buildProps(overrides = {}) {
  return {
    groupSearch: "",
    setGroupSearch: jest.fn(),
    discoverGroups: [{ id: 1, name: "Alpha", goal: "Goal", privacy: "open" }],
    joinedGroups: [{ id: 2, name: "Bravo", goal: "Goal", privacy: "open" }],
    groupMemberCounts: { 1: 3, 2: 5 },
    groupLastActive: {},
    groupPrivacyLabel: () => "Open",
    formatTime: () => "Just now",
    groupRoomId: null,
    setActiveGroupId: jest.fn(),
    navigate: jest.fn(),
    groupRoomPath: (id) => `/community/group/${id}`,
    handleJoinGroup: jest.fn(),
    handleLeaveGroup: jest.fn(),
    isGroupOwner: (g) => Number(g.id) === 2,
    handleOpenEditGroup: jest.fn(),
    handleDeleteGroup: jest.fn(),
    renderEmptyState: ({ title }) => <div>{title}</div>,
    setCreateGroupOpen: jest.fn(),
    ...overrides,
  };
}

test("joins discover group", () => {
  const props = buildProps();
  render(<GroupsPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /join group/i }));
  expect(props.handleJoinGroup).toHaveBeenCalledWith(1, true);
});

test("opens joined group room", () => {
  const props = buildProps();
  render(<GroupsPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /open room/i }));
  expect(props.setActiveGroupId).toHaveBeenCalledWith(2);
  expect(props.navigate).toHaveBeenCalledWith("/community/group/2");
});

