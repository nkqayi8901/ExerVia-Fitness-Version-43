import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

jest.mock(
  "react-router-dom",
  () => {
    const ReactLib = require("react");
    return {
      BrowserRouter: ({ children }) => <>{children}</>,
      Routes: ({ children }) => {
        const pathname = globalThis.location?.pathname || "/";
        const matchPath = (pattern = "", path = "") => {
          if (pattern === "*") return true;
          if (!pattern) return false;
          const regexPattern = pattern
            .replace(/:[^/]+/g, "[^/]+")
            .replace(/\/\*$/, "(?:/.*)?");
          return new RegExp(`^${regexPattern}$`).test(path);
        };
        const routes = ReactLib.Children.toArray(children);
        const matched = routes.find((child) => matchPath(child?.props?.path, pathname));
        return matched?.props?.element || null;
      },
      Route: () => null,
    };
  },
  { virtual: true }
);

jest.mock("./components/LandingPage", () => () => <div>Landing Page</div>);
jest.mock("./FitnessProfileForm", () => () => <div>Auth/Profile Page</div>);
jest.mock("./components/GymMode", () => () => <div>Gym Mode Page</div>);
jest.mock("./components/AthleteMode", () => () => <div>Athlete Mode Page</div>);
jest.mock("./components/NutritionPage", () => () => <div>Nutrition Page</div>);
jest.mock("./components/JournalPage", () => () => <div>Journal Page</div>);
jest.mock("./components/ResetPasswordPage", () => () => <div>Reset Password Page</div>);
jest.mock("./components/NotFoundPage", () => () => <div>Not Found Page</div>);
jest.mock("./components/RequireAuth", () => ({ children }) => <>{children}</>);
jest.mock("./services/errorMonitoring", () => ({
  initErrorMonitoring: jest.fn(),
  captureAppError: jest.fn(),
}));

import App from "./App";

test("shows offline strip on offline event and hides on online event", () => {
  window.history.pushState({}, "", "/");
  render(<App />);

  expect(screen.queryByText(/You're offline/i)).not.toBeInTheDocument();
  fireEvent(window, new Event("offline"));
  expect(screen.getByText(/You're offline - data may be stale/i)).toBeInTheDocument();
  fireEvent(window, new Event("online"));
  expect(screen.queryByText(/You're offline - data may be stale/i)).not.toBeInTheDocument();
});

test("still renders routes while offline strip is visible", () => {
  window.history.pushState({}, "", "/");
  render(<App />);
  fireEvent(window, new Event("offline"));
  expect(screen.getByText("Landing Page")).toBeInTheDocument();
  expect(screen.getByText(/You're offline - data may be stale/i)).toBeInTheDocument();
});

test("renders offline strip immediately when navigator starts offline", () => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => false,
  });
  window.history.pushState({}, "", "/");
  render(<App />);
  expect(screen.getByText(/You're offline - data may be stale/i)).toBeInTheDocument();
  if (original) {
    Object.defineProperty(window.navigator, "onLine", original);
  }
});
