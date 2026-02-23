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

import App from "./App";

jest.mock("./components/LandingPage", () => () => <div>Landing Page</div>);
jest.mock("./FitnessProfileForm", () => () => <div>Auth/Profile Page</div>);
jest.mock("./components/GymMode", () => () => <div>Gym Mode Page</div>);
jest.mock("./components/AthleteMode", () => () => <div>Athlete Mode Page</div>);
jest.mock("./components/NutritionPage", () => () => <div>Nutrition Page</div>);
jest.mock("./components/JournalPage", () => () => <div>Journal Page</div>);
jest.mock("./components/ResetPasswordPage", () => () => <div>Reset Password Page</div>);
jest.mock("./components/ErrorBoundary", () => ({ children }) => <>{children}</>);
jest.mock("./components/NotFoundPage", () => () => <div>Not Found Page</div>);
jest.mock("./components/RequireAuth", () => ({ children }) => <>{children}</>);

function renderAt(pathname) {
  window.history.pushState({}, "", pathname);
  return render(<App />);
}

test("renders landing route", () => {
  renderAt("/");
  expect(screen.getByText("Landing Page")).toBeInTheDocument();
});

test("renders auth route", () => {
  renderAt("/auth");
  expect(screen.getByText("Auth/Profile Page")).toBeInTheDocument();
});

test("renders gym protected route shell", () => {
  renderAt("/gym/123");
  expect(screen.getByText("Gym Mode Page")).toBeInTheDocument();
});

test("renders athlete protected route shell", () => {
  renderAt("/athlete/123");
  expect(screen.getByText("Athlete Mode Page")).toBeInTheDocument();
});

test("renders standalone nutrition route", () => {
  renderAt("/nutrition");
  expect(screen.getByText("Nutrition Page")).toBeInTheDocument();
});

test("renders standalone journal route", () => {
  renderAt("/journal");
  expect(screen.getByText("Journal Page")).toBeInTheDocument();
});

test("renders not found route", () => {
  renderAt("/random-missing-page");
  expect(screen.getByText("Not Found Page")).toBeInTheDocument();
});
