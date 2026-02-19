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

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<FitnessProfileForm />} />
            <Route path="/create-profile" element={<FitnessProfileForm />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* IMPORTANT: allow nested pages */}
            <Route path="/gym/:id/*" element={<GymMode />} />
            <Route path="/athlete/:id/*" element={<AthleteMode />} />

            <Route path="/nutrition" element={<NutritionPage />} />

            {/* optional standalone journal route */}
            <Route path="/journal" element={<JournalPage />} />
          </Routes>
        </div>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
