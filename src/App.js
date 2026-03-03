// App.js
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import RequireAuth from "./components/RequireAuth";
import ToastHost from "./components/ToastHost";
import { captureAppError, initErrorMonitoring } from "./services/errorMonitoring";
import { supabase } from "./supabaseClient";
import { getStoredProfileId } from "./utils/authStorage";

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

function RouteResumeTracker() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    if (!path) return;
    if (
      path === "/" ||
      path.startsWith("/auth") ||
      path.startsWith("/reset-password") ||
      path.startsWith("/create-profile")
    ) {
      return;
    }
    try {
      localStorage.setItem("exervia_last_path", path);
    } catch {
      // ignore storage failures
    }
  }, [location.pathname, location.search, location.hash]);

  return null;
}

function HomeEntryRoute() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const hasSession = Boolean(data?.session?.user?.id);
        if (!active) return;
        if (!hasSession) {
          setReady(true);
          return;
        }

        const lastPath = String(localStorage.getItem("exervia_last_path") || "").trim();
        const resumeable =
          lastPath.startsWith("/gym/") ||
          lastPath.startsWith("/athlete/") ||
          lastPath.startsWith("/nutrition") ||
          lastPath.startsWith("/journal") ||
          lastPath.startsWith("/settings");
        if (resumeable) {
          navigate(lastPath, { replace: true });
          return;
        }

        const profileId = getStoredProfileId();
        if (profileId) {
          const mode = localStorage.getItem("exervia_active_mode") || "gym";
          navigate(mode === "athlete" ? `/athlete/${profileId}` : `/gym/${profileId}`, {
            replace: true,
          });
          return;
        }

        navigate("/create-profile", { replace: true });
      } catch {
        setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (!ready) return <div className="full-center">Loading...</div>;
  return <LandingPage />;
}

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
        <RouteResumeTracker />
        {isOffline ? (
          <div className="exervia-offline-strip">You're offline - data may be stale until connection returns.</div>
        ) : null}
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={withRouteBoundary(<HomeEntryRoute />)} />
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
