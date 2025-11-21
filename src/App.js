// // The main structure was referenced from examples found in:
// https://reactrouter.com/en/main/components/routes
// watched https://www.youtube.com/watch?v=4PATisReKcQ to understand base of react websites
// video to get inspiration
// The is also adapted from official React Router documentation: 
// https://reactrouter.com/en/main/start/overview
// Overall, this file provides the global navigation layout for the ExerVia Fitness

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import FitnessProfileForm from './FitnessProfileForm';
import GymMode from './components/GymMode';
import AthleteMode from './components/AthleteMode';
import CompanionChat from './components/CompanionChat';
import NutritionPage from './components/NutritionPage';
// This App component is the one that 
// defines all routes for the web app, acting kinda as 
//  the root component.
function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          {/* This is route for the Landing Page */}
          <Route path="/" element={<LandingPage />} />
          {/*This is route for Profile Creation */}
          <Route path="/create-profile" element={<FitnessProfileForm />} />
          {/* This is the route after profile creation, user is directed to Gym Mode */}
          <Route path="/gym/:id" element={<GymMode />} />
          {/* This is the alternative Athlete Mode route */}
          <Route path="/athlete/:id" element={<AthleteMode />} />
          {/* This is the Companion Chat route */}
          <Route path="/companion" element={<CompanionChat />} />
          <Route path="/nutrition" element={<NutritionPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;