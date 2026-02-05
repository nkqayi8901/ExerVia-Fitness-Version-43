// App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import FitnessProfileForm from "./FitnessProfileForm";
import GymMode from "./components/GymMode";
import AthleteMode from "./components/AthleteMode";
import CompanionChat from "./components/CompanionChat";
import CompanionOrb from "./components/CompanionOrb";
import NutritionPage from "./components/NutritionPage";
import JournalPage from "./components/JournalPage";

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create-profile" element={<FitnessProfileForm />} />

          {/* ✅ IMPORTANT: allow nested pages */}
          <Route path="/gym/:id/*" element={<GymMode />} />
          <Route path="/athlete/:id/*" element={<AthleteMode />} />

          <Route path="/companion" element={<CompanionChat />} />
          <Route path="/nutrition" element={<NutritionPage />} />

          {/* optional standalone journal route */}
          <Route path="/journal" element={<JournalPage />} />
        </Routes>
        <CompanionOrb />
      </div>
    </Router>
  );
}

export default App;
