import { render, screen, waitFor } from "@testing-library/react";
import PublicProfilePage from "./PublicProfilePage";

const mockNavigate = jest.fn();
const mockFrom = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "1", targetId: "2" }),
  }),
  { virtual: true }
);

function createThenableQuery(result = { data: [], error: null }) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    limit: jest.fn(() => query),
    order: jest.fn(() => query),
    maybeSingle: jest.fn(async () => result),
    single: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

jest.mock("../supabaseClient", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();

  mockFrom.mockImplementation((table) => {
    if (table === "user_profiles") {
      return createThenableQuery({
        data: {
          id: 2,
          full_name: "Alex Carter",
          display_name: "Alex Carter",
          username: "alex",
          fitness_level: "Intermediate",
          primary_goal: "Build Muscle",
        },
        error: null,
      });
    }
    if (table === "user_state") {
      return createThenableQuery({
        data: { user_id: 2, rank: "D", level: 4, streak_days: 5 },
        error: null,
      });
    }
    if (table === "community_group_members") {
      return createThenableQuery({
        data: [{ group_id: 10, role: "member", community_groups: { name: "Crew Alpha" } }],
        error: null,
      });
    }
    if (table === "training_sessions") {
      return createThenableQuery({
        data: [{ id: 501, sport: "run", duration_minutes: 42, created_at: new Date().toISOString() }],
        error: null,
      });
    }
    if (table === "strength_logs") {
      return createThenableQuery({
        data: [{ id: 801, exercise_name: "Bench Press", sets: 4, reps: 6, weight: 90, created_at: new Date().toISOString() }],
        error: null,
      });
    }
    if (table === "community_friends") {
      return createThenableQuery({ data: null, error: null });
    }
    return createThenableQuery();
  });
});

test("renders public profile summary and recent sessions", async () => {
  render(<PublicProfilePage mode="athlete" viewerId={1} />);

  await waitFor(() => {
    expect(screen.getByText("@alex")).toBeInTheDocument();
  });

  expect(screen.getByText(/recent training/i)).toBeInTheDocument();
  expect(screen.getAllByText(/view session/i).length).toBeGreaterThan(0);
});

