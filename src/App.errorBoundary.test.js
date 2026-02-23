import { render, screen } from "@testing-library/react";
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
jest.mock("./components/NutritionPage", () => {
  return function BrokenNutritionPage() {
    throw new Error("Intentional test crash");
  };
});
jest.mock("./components/JournalPage", () => () => <div>Journal Page</div>);
jest.mock("./components/ResetPasswordPage", () => () => <div>Reset Password Page</div>);
jest.mock("./components/NotFoundPage", () => () => <div>Not Found Page</div>);
jest.mock("./components/RequireAuth", () => ({ children }) => <>{children}</>);

import App from "./App";

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

test("shows ErrorBoundary fallback when a routed page crashes", () => {
  window.history.pushState({}, "", "/nutrition");
  render(<App />);
  expect(screen.getByText("Something broke")).toBeInTheDocument();
  expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
});

