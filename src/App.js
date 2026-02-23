// App.js
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

function App() {
  const withRouteBoundary = (element) => <ErrorBoundary>{element}</ErrorBoundary>;

  return (
    <Router>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </Router>
  );
}

export default App;
