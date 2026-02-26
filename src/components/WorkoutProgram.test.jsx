import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import WorkoutProgram from "./WorkoutProgram";

const mockNavigate = jest.fn();
const mockPath = { value: "" };
const mockLocation = { state: null };

jest.mock(
  "react-router-dom",
  () => {
    const ReactLib = require("react");
    const isMatch = (pattern = "", path = "") => {
      if (pattern === "") return path === "";
      if (!pattern) return false;
      const regexPattern = pattern
        .replace(/:[^/]+/g, "[^/]+")
        .replace(/\/\*$/, "(?:/.*)?");
      return new RegExp(`^${regexPattern}$`).test(path);
    };
    return {
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocation,
      useParams: () => {
        const current = String(mockPath.value || "");
        const parts = current.split("/").filter(Boolean);
        return {
          id: "1",
          programId: parts[0] || undefined,
        };
      },
      Routes: ({ children }) => {
        const routes = ReactLib.Children.toArray(children);
        const matched = routes.find((child) => isMatch(child?.props?.path || "", mockPath.value));
        return matched?.props?.element || null;
      },
      Route: () => null,
    };
  },
  { virtual: true }
);

jest.mock("../services/logsStorage", () => ({
  queueLogsTrainingPrefill: jest.fn(),
}));

jest.mock("../services/xpEvents", () => ({
  grantXpEventSafe: jest.fn(async () => ({ awardedXp: 0, error: null })),
}));

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock("../supabaseClient", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPath.value = "";
  mockLocation.state = null;
  mockFrom.mockReturnValue({
    insert: jest.fn(() => ({
      select: jest.fn(async () => ({ data: [], error: null })),
    })),
  });
  mockRpc.mockResolvedValue({ data: 0, error: null });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ results: [] }),
  }));
});

afterEach(() => {
  delete global.fetch;
});

test("renders workout program list route", () => {
  mockPath.value = "";
  render(<WorkoutProgram mode="gym" />);
  expect(screen.getByText("Workout Programs")).toBeInTheDocument();
  expect(screen.getByText("Strength Foundation")).toBeInTheDocument();
});

test("renders preview route for selected program", () => {
  mockPath.value = "strength-foundation";
  render(<WorkoutProgram mode="gym" />);
  expect(screen.getByText("Program Overview")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start program/i })).toBeInTheDocument();
});

test("start program triggers navigation to session route", () => {
  mockPath.value = "strength-foundation";
  render(<WorkoutProgram mode="gym" />);
  fireEvent.click(screen.getByRole("button", { name: /Start program/i }));
  expect(mockNavigate).toHaveBeenCalledWith("./session", expect.any(Object));
});

test("shows guide retry banner when exercise guide request fails", async () => {
  mockPath.value = "strength-foundation";
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn(async () => {
    throw new Error("Guide fetch failed");
  });
  render(<WorkoutProgram mode="gym" />);
  fireEvent.click(screen.getByRole("button", { name: "Deadlift" }));
  await waitFor(() => {
    expect(screen.getByText(/Could not load guide details right now/i)).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  consoleErrorSpy.mockRestore();
});
