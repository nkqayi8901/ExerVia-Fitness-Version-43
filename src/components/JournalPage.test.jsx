import { render, screen, waitFor } from "@testing-library/react";
import JournalPage from "./JournalPage";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("../utils/toast", () => ({
  emitToast: jest.fn(),
}));

const mockFrom = jest.fn();

jest.mock("../supabaseClient", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  localStorage.setItem("exervia_user_id", "1");
  localStorage.setItem("exervia_active_mode", "athlete");

  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(async () => ({ data: [], error: null })),
  };
  mockFrom.mockReturnValue(query);

  global.fetch = jest.fn(async () => ({
    ok: false,
    json: async () => ({}),
  }));
});

afterEach(() => {
  delete global.fetch;
  console.error.mockRestore();
});

test("shows boot skeleton immediately before journal data hydrates", () => {
  const { container } = render(<JournalPage mode="athlete" />);
  expect(container.querySelector(".journal-loading-skeleton")).toBeInTheDocument();
});

test("shows warning banner when journal entries refresh fails", async () => {
  const failingQuery = {
    select: jest.fn(() => failingQuery),
    eq: jest.fn(() => failingQuery),
    order: jest.fn(() => failingQuery),
    limit: jest.fn(async () => {
      throw new Error("network down");
    }),
  };
  mockFrom.mockReturnValue(failingQuery);

  render(<JournalPage mode="athlete" />);

  await waitFor(() => {
    expect(screen.getByText(/could not refresh journal right now/i)).toBeInTheDocument();
  });
});
