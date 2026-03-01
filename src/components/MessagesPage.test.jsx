import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MessagesPage from "./MessagesPage";

const mockNavigate = jest.fn();
const mockFrom = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(""), jest.fn()],
  }),
  { virtual: true }
);

function createThenableQuery(result = { data: [], error: null }) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    or: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    in: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    insert: jest.fn(async () => ({ data: null, error: null })),
    maybeSingle: jest.fn(async () => result),
    single: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

jest.mock("../supabaseClient", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  const now = new Date().toISOString();

  const channelApi = {
    on: jest.fn(() => channelApi),
    subscribe: jest.fn(() => channelApi),
  };
  mockChannel.mockReturnValue(channelApi);

  mockFrom.mockImplementation((table) => {
    if (table === "community_friends") {
      return createThenableQuery({
        data: [{ id: 101, user_id: 1, friend_user_id: 2, status: "accepted" }],
        error: null,
      });
    }
    if (table === "community_friend_messages") {
      return createThenableQuery({
        data: [
          { id: 9001, user_id: 2, friend_user_id: 1, body: "hello there", created_at: now },
          { id: 9002, user_id: 1, friend_user_id: 2, body: "yo", created_at: now },
        ],
        error: null,
      });
    }
    if (table === "user_profiles") {
      return createThenableQuery({
        data: [
          { id: 1, username: "owner", display_name: "Owner" },
          { id: 2, username: "buddy", display_name: "Buddy" },
        ],
        error: null,
      });
    }
    if (table === "community_reports") {
      return createThenableQuery({ data: null, error: null });
    }
    return createThenableQuery();
  });
});

test("loads conversation list and opens selected conversation", async () => {
  render(<MessagesPage userId={1} mode="athlete" />);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "@buddy" })).toBeInTheDocument();
  });

  expect(screen.getByText(/select a conversation/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "@buddy" }));

  await waitFor(() => {
    expect(screen.getByPlaceholderText(/write a message/i)).toBeInTheDocument();
  });
});

