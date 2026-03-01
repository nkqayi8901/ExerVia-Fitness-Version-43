// App.js
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import RequireAuth from "./components/RequireAuth";
import ToastHost from "./components/ToastHost";
import { captureAppError, initErrorMonitoring } from "./services/errorMonitoring";

const isTestEnv = process.env.NODE_ENV === "test";
const resolveEagerModule = (loader) => {
  const mod = loader();
  return mod?.default || mod;
};

const LandingPage = isTestEnv
  ? resolveEagerModule(() => require("./components/LandingPage"))
  : lazy(() => import("./components/LandingPage"));
const FitnessProfileForm = isTestEnv
  ? resolveEagerModule(() => require("./FitnessProfileForm"))
  : lazy(() => import("./FitnessProfileForm"));
const GymMode = isTestEnv
  ? resolveEagerModule(() => require("./components/GymMode"))
  : lazy(() => import("./components/GymMode"));
const AthleteMode = isTestEnv
  ? resolveEagerModule(() => require("./components/AthleteMode"))
  : lazy(() => import("./components/AthleteMode"));
const NutritionPage = isTestEnv
  ? resolveEagerModule(() => require("./components/NutritionPage"))
  : lazy(() => import("./components/NutritionPage"));
const JournalPage = isTestEnv
  ? resolveEagerModule(() => require("./components/JournalPage"))
  : lazy(() => import("./components/JournalPage"));
const ResetPasswordPage = isTestEnv
  ? resolveEagerModule(() => require("./components/ResetPasswordPage"))
  : lazy(() => import("./components/ResetPasswordPage"));
const NotFoundPage = isTestEnv
  ? resolveEagerModule(() => require("./components/NotFoundPage"))
  : lazy(() => import("./components/NotFoundPage"));

function App() {
  const withRouteBoundary = (element) => (
    <ErrorBoundary>
      <Suspense fallback={<div className="full-center">Loading...</div>}>{element}</Suspense>
    </ErrorBoundary>
  );
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  useEffect(() => {
    initErrorMonitoring();
  }, []);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    const onUnhandledRejection = (event) => {
      captureAppError(event?.reason || new Error("Unhandled promise rejection"), {
        type: "unhandledrejection",
      });
    };
    const onWindowError = (event) => {
      captureAppError(event?.error || new Error(event?.message || "Window error"), {
        type: "error",
      });
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onWindowError);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onWindowError);
    };
  }, []);

  return (
    <Router>
      <ErrorBoundary>
        {isOffline ? (
          <div className="exervia-offline-strip">You're offline - data may be stale until connection returns.</div>
        ) : null}
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={withRouteBoundary(<LandingPage />)} />
            <Route path="/auth" element={withRouteBoundary(<FitnessProfileForm />)} />
            <Route
              path="/settings"
              element={withRouteBoundary(
                <RequireAuth>
                  <FitnessProfileForm settingsOnly />
                </RequireAuth>
              )}
            />
            <Route path="/create-profile" element={withRouteBoundary(<FitnessProfileForm />)} />
            <Route path="/reset-password" element={withRouteBoundary(<ResetPasswordPage />)} />

            {/* IMPORTANT: allow nested pages */}
            <Route
              path="/gym/:id/*"
              element={withRouteBoundary(
                <RequireAuth>
                  <GymMode />
                </RequireAuth>
              )}
            />
            <Route
              path="/athlete/:id/*"
              element={withRouteBoundary(
                <RequireAuth>
                  <AthleteMode />
                </RequireAuth>
              )}
            />

            <Route
              path="/nutrition"
              element={withRouteBoundary(
                <RequireAuth>
                  <NutritionPage />
                </RequireAuth>
              )}
            />

            {/* optional standalone journal route */}
            <Route
              path="/journal"
              element={withRouteBoundary(
                <RequireAuth>
                  <JournalPage />
                </RequireAuth>
              )}
            />
            <Route path="*" element={withRouteBoundary(<NotFoundPage />)} />
          </Routes>
        </div>
        <ToastHost />
      </ErrorBoundary>
    </Router>
  );
}

export default App;
