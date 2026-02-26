import { fireEvent, render, screen } from "@testing-library/react";
import ActivityFeedPanel from "./ActivityFeedPanel";

function buildProps(overrides = {}) {
  return {
    statusDraft: "status",
    statusPosting: false,
    onStatusDraftChange: jest.fn(),
    onCreateStatusPost: jest.fn(),
    activityFeedLoading: false,
    activityFeedItems: [
      {
        id: "a1",
        type: "activity",
        activityType: "training_session",
        activityDate: "2026-02-24",
        actor_id: 11,
        title: "logged a training session",
        sub: "on 2026-02-24",
        created_at: new Date().toISOString(),
      },
    ],
    profiles: { 11: "@tester" },
    routePrefix: "athlete",
    userId: 11,
    navigate: jest.fn(),
    setActiveTab: jest.fn(),
    setGroupRoomId: jest.fn(),
    setActiveGroupId: jest.fn(),
    groupRoomPath: (id) => `/athlete/11/community/group/${id}`,
    openThreadPage: jest.fn(),
    openUserProfile: jest.fn(),
    formatTime: () => "Just now",
    renderEmptyState: ({ title }) => <div>{title}</div>,
    ...overrides,
  };
}

test("posts status from composer", () => {
  const props = buildProps();
  render(<ActivityFeedPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /post status/i }));
  expect(props.onCreateStatusPost).toHaveBeenCalledTimes(1);
});

test("opens training log action from activity card", () => {
  const props = buildProps();
  render(<ActivityFeedPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /open training log/i }));
  expect(props.navigate).toHaveBeenCalledWith("/athlete/11/logs?day=2026-02-24");
});

