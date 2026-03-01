import { render, screen, waitFor } from "@testing-library/react";
import LogsPage from "./LogsPage";
import { getLogsStore } from "../services/logsStorage";
import { fetchDailyLogs } from "../services/logsApi";

const mockNavigate = jest.fn();
const mockFrom = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "1" }),
    useSearchParams: () => [new URLSearchParams(""), jest.fn()],
  }),
  { virtual: true }
);

jest.mock("../utils/toast", () => ({
  emitToast: jest.fn(),
}));

jest.mock("../utils/banner", () => ({
  isErrorBanner: jest.fn(() => false),
}));

jest.mock("../services/stateEngine", () => ({
  recalcUserState: jest.fn(async () => ({})),
}));

jest.mock("../services/activityTracker", () => ({
  trackDailyActivity: jest.fn(async () => ({})),
}));

jest.mock("../services/xpEvents", () => ({
  grantXpEventSafe: jest.fn(async () => ({ awardedXp: 0, error: null })),
}));

jest.mock("../services/logsStorage", () => ({
  addSavedMeal: jest.fn(),
  consumeLogsTrainingPrefill: jest.fn(() => null),
  getLogsStore: jest.fn(() => ({
    byDate: {
      "2026-02-28": {
        weightValue: "",
        weightUnit: "kg",
        waterAmount: "",
        waterUnit: "ml",
        meals: [{ id: "m1", text: "Local meal" }],
        supplementsTaken: [],
        extraActivities: [],
      },
    },
    savedMeals: [{ name: "Local meal", source: "manual" }],
    supplementLibrary: ["Creatine"],
  })),
  getTodayLogKey: jest.fn(() => "2026-02-28"),
  saveLogsStore: jest.fn(),
}));

jest.mock("../services/logsApi", () => ({
  addSupplementToLibrary: jest.fn(async () => true),
  emptyDay: jest.fn(() => ({
    weightValue: "",
    weightUnit: "kg",
    waterAmount: "",
    waterUnit: "ml",
    meals: [],
    supplementsTaken: [],
    extraActivities: [],
  })),
  fetchDailyLogs: jest.fn(async () => {
    throw new Error("cloud down");
  }),
  fetchSavedMeals: jest.fn(async () => {
    throw new Error("cloud down");
  }),
  fetchSupplementLibrary: jest.fn(async () => {
    throw new Error("cloud down");
  }),
  saveMealToLibrary: jest.fn(async () => true),
  upsertDailyLog: jest.fn(async () => true),
}));

function createThenableQuery(result = { data: [], error: null }) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    delete: jest.fn(() => query),
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
  mockFrom.mockImplementation(() => createThenableQuery({ data: [], error: null }));
});

test("falls back to local logs when cloud bootstrap fails", async () => {
  render(<LogsPage mode="gym" />);

  await waitFor(() => {
    expect(fetchDailyLogs).toHaveBeenCalled();
    expect(getLogsStore).toHaveBeenCalled();
  });

  expect(screen.getByText(/day in a glance/i)).toBeInTheDocument();
});
