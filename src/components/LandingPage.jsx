import { useNavigate } from 'react-router-dom';
import heroImage from "../assets/exervia-hero.webp";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-body" style={{ "--exervia-hero-bg": `url(${heroImage})` }}>
      {/* This is the Header section */}
      <header className="landing-header">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="landing-logo">E</div>
              <h1 className="text-2xl font-bold text-white">Exervia Fitness</h1>
            </div>
            <button 
              onClick={() => navigate('/auth')}
              className="landing-button-primary"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold text-white mb-6">
          Dual-Mode <span className="landing-gradient-text">Fitness Social Platform</span>
        </h1>
        <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
          Choose your path: Gym strength training or athletic performance. A community driven fitness journey.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          <div 
            className="landing-card landing-card-gym"
            onClick={() => navigate('/auth')}
          >
            <div className="text-4xl mb-4">💪</div>
            <h3 className="text-2xl font-bold text-white mb-4">Gym Mode</h3>
            <p className="text-gray-300 mb-4">Strength training & muscle building</p>
            <ul className="text-gray-400 space-y-2 text-left">
              <li>• Progressive overload tracking</li>
              <li>• Workout plan optimisation</li>
              <li>• Strength metrics analysis</li>
            </ul>
          </div>

          <div 
            className="landing-card landing-card-athlete"
            onClick={() => navigate('/auth')}
          >
            <div className="text-4xl mb-4">🏃‍♂️</div>
            <h3 className="text-2xl font-bold text-white mb-4">Athlete Mode</h3>
            <p className="text-gray-300 mb-4">Sport performance & endurance</p>
            <ul className="text-gray-400 space-y-2 text-left">
              <li>• Training-specific training</li>
              <li>• Performance analytics</li>
              <li>• Competition preparation</li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => navigate('/auth')}
          className="landing-button-primary text-lg py-3 px-8"
        >
          Start Your Journey
        </button>
      </section>
    </div>
  );
}
