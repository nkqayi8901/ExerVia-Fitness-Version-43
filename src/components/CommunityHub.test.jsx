import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommunityHub from "./CommunityHub";

const mockNavigate = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
  }),
  { virtual: true }
);

function createResolvedQuery(result = { data: [], error: null }) {
  const query = {
    select: jest.fn(() => query),
    order: jest.fn(() => query),
    eq: jest.fn(() => query),
    or: jest.fn(() => query),
    in: jest.fn(() => query),
    limit: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    insert: jest.fn(async () => ({ data: null, error: null })),
    upsert: jest.fn(async () => ({ data: null, error: null })),
    maybeSingle: jest.fn(async () => ({ data: null, error: null })),
    single: jest.fn(async () => ({ data: null, error: null })),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

jest.mock("../supabaseClient", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
    channel: (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.history.pushState({}, "", "/athlete/1/community");

  mockRpc.mockResolvedValue({ data: [], error: null });
  const channelApi = {
    on: jest.fn(() => channelApi),
    subscribe: jest.fn(() => channelApi),
  };
  mockChannel.mockReturnValue(channelApi);

  mockFrom.mockImplementation((table) => {
    const query = createResolvedQuery();
    if (table === "community_forums") {
      query.upsert.mockRejectedValue(new Error("Failed to fetch"));
    }
    return query;
  });
});

test("shows network failure banner with retry action when community boot load fails", async () => {
  render(<CommunityHub userId={1} />);

  await waitFor(() => {
    expect(screen.getByText(/network issue detected/i)).toBeInTheDocument();
  });

  const retryButton = screen.getByRole("button", { name: /retry/i });
  expect(retryButton).toBeInTheDocument();

  fireEvent.click(retryButton);

  await waitFor(() => {
    expect(mockFrom).toHaveBeenCalled();
  });
});

