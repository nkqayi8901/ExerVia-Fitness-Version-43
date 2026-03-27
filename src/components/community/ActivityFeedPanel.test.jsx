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
    openRunPage: jest.fn(),
    openTrainingWorld: jest.fn(),
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

test("opens status action from activity card", () => {
  const props = buildProps();
  render(<ActivityFeedPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /open status/i }));
  expect(props.openThreadPage).toHaveBeenCalledTimes(1);
});

test("opens run detail from run feed card", () => {
  const props = buildProps({
    activityFeedItems: [
      {
        id: "run1",
        type: "run_post",
        actor_id: 11,
        title: "Run logged",
        sub: "Running logged · 5.00 km in 24:10 · pace 04:50/km",
        entityLabel: "Docklands Tempo Loop",
        runId: "88",
        runPreview: {
          distanceKm: 5,
          elapsedSeconds: 1450,
          pacePerKmSeconds: 290,
          routePoints: [
            { lat: 51.89, lng: -8.47 },
            { lat: 51.891, lng: -8.471 },
          ],
        },
        created_at: new Date().toISOString(),
        postId: "post88",
      },
    ],
  });
  render(<ActivityFeedPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /view run/i }));
  expect(props.openRunPage).toHaveBeenCalledWith("88", 11);
});

test("opens training world from training feed card", () => {
  const props = buildProps({
    activityFeedItems: [
      {
        id: "training1",
        type: "training_post",
        actor_id: 11,
        title: "Workout logged",
        sub: "Logged a tempo session · 42 min",
        entityLabel: "Velocity Lab",
        trainingMeta: {
          sport: "running",
          focus: "Tempo",
          durationLabel: "42 min",
        },
        trainingStory: {
          world: { title: "Velocity Lab" },
          highlights: ["Velocity Lab", "Tempo block"],
          summary: "Tempo session flowing through Velocity Lab.",
        },
        created_at: new Date().toISOString(),
        postId: "post99",
      },
    ],
  });
  render(<ActivityFeedPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /open world/i }));
  expect(props.openTrainingWorld).toHaveBeenCalledWith("running");
});
