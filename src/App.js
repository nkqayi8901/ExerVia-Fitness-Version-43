// App.js
import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import FitnessProfileForm from "./FitnessProfileForm";
import GymMode from "./components/GymMode";
import AthleteMode from "./components/AthleteMode";
import NutritionPage from "./components/NutritionPage";
import JournalPage from "./components/JournalPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import ErrorBoundary from "./components/ErrorBoundary";
import RequireAuth from "./components/RequireAuth";
import NotFoundPage from "./components/NotFoundPage";
import ToastHost from "./components/ToastHost";
import { captureAppError, initErrorMonitoring } from "./services/errorMonitoring";

function App() {
  const withRouteBoundary = (element) => <ErrorBoundary>{element}</ErrorBoundary>;
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
