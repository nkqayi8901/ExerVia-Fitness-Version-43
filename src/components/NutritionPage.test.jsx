import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NutritionPage from "./NutritionPage";

const mockNavigate = jest.fn();
const mockFetchDailyLogs = jest.fn();
let mockLocalStore = { byDate: {} };

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock("./Navbar", () => () => <div>Navbar</div>);

jest.mock("../services/logsApi", () => ({
  emptyDay: () => ({ meals: [], supplements: [], extraActivities: [] }),
  fetchDailyLogs: (...args) => mockFetchDailyLogs(...args),
  saveMealToLibrary: jest.fn(async () => ({})),
  upsertDailyLog: jest.fn(async () => ({})),
}));

jest.mock("../services/logsStorage", () => ({
  getLogsStore: () => mockLocalStore,
  getTodayLogKey: () => "2026-02-23",
  saveLogsStore: jest.fn(),
}));

const mockFrom = jest.fn();

function createQuery(result = { data: null, error: null }) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => result),
    insert: jest.fn(async () => ({ data: null, error: null })),
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
  mockLocalStore = { byDate: {} };
  localStorage.clear();
  localStorage.setItem("exervia_user_id", "1");
  localStorage.setItem("exervia_active_mode", "athlete");

  mockFrom.mockImplementation((table) => {
    if (table === "user_profiles") {
      return createQuery({ data: { fitness_level: "beginner", primary_goal: "fat loss" }, error: null });
    }
    if (table === "user_state") {
      return createQuery({ data: { level: 2 }, error: null });
    }
    return createQuery({ data: null, error: null });
  });

  mockFetchDailyLogs
    .mockRejectedValueOnce(new Error("Failed to fetch"))
    .mockResolvedValueOnce({});

  global.fetch = jest.fn(async (url) => {
    const endpoint = String(url || "");
    if (endpoint.includes("/random.php")) {
      return {
        ok: true,
        json: async () => ({
          meals: [{ idMeal: "r1", strMeal: "Chicken Bowl", strMealThumb: "" }],
        }),
      };
    }
    if (endpoint.includes("/filter.php") || endpoint.includes("/search.php")) {
      return { ok: true, json: async () => ({ meals: [] }) };
    }
    if (endpoint.includes("dummyjson.com")) {
      return { ok: true, json: async () => ({ recipes: [] }) };
    }
    if (endpoint.includes("openfoodfacts")) {
      return { ok: true, json: async () => ({ products: [] }) };
    }
    return { ok: true, json: async () => ({ meals: [] }) };
  });
});

afterEach(() => {
  delete global.fetch;
});

test("shows logs sync error and retries successfully", async () => {
  render(<NutritionPage />);

  await waitFor(() => {
    expect(screen.getByText(/network issue detected/i)).toBeInTheDocument();
  });

  const retryButton = screen.getByRole("button", { name: /retry sync/i });
  fireEvent.click(retryButton);

  await waitFor(() => {
    expect(mockFetchDailyLogs).toHaveBeenCalledTimes(2);
  });

  await waitFor(() => {
    expect(screen.queryByText(/network issue detected/i)).not.toBeInTheDocument();
  });
});

test("keeps showing fallback error and renders local meals when cloud retry also fails", async () => {
  mockLocalStore = {
    byDate: {
      "2026-02-23": {
        meals: [
          {
            id: "local-1",
            text: "Local fallback meal",
            calories: 420,
            protein: 35,
            carbs: 40,
            fat: 12,
          },
        ],
      },
    },
  };
  mockFetchDailyLogs.mockReset();
  mockFetchDailyLogs
    .mockRejectedValueOnce(new Error("Failed to fetch"))
    .mockRejectedValueOnce(new Error("Failed to fetch"));

  render(<NutritionPage />);

  await waitFor(() => {
    expect(screen.getByText(/network issue detected/i)).toBeInTheDocument();
  });
  expect(screen.getByText("Local fallback meal")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /retry sync/i }));

  await waitFor(() => {
    expect(mockFetchDailyLogs).toHaveBeenCalledTimes(2);
  });
  await waitFor(() => {
    expect(screen.getByText(/network issue|could not sync/i)).toBeInTheDocument();
  });
  expect(screen.getByText("Local fallback meal")).toBeInTheDocument();
});
