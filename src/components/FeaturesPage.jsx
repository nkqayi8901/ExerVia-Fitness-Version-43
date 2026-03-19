import { useNavigate } from "react-router-dom";
import heroImage from "../assets/exervia-hero.webp";

export default function FeaturesPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-body" style={{ "--exervia-hero-bg": `url(${heroImage})` }}>
      <header className="landing-header">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center space-x-3">
              <div className="landing-logo">E</div>
              <h1 className="text-2xl font-bold text-white">ExerVia Features</h1>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => navigate("/")} className="landing-button-secondary">
                Home
              </button>
              <button onClick={() => navigate("/about")} className="landing-button-secondary">
                About
              </button>
              <button onClick={() => navigate("/auth")} className="landing-button-primary">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold text-white mb-6">
          What You Can Do <span className="landing-gradient-text">Inside ExerVia</span>
        </h1>
        <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
          ExerVia is not just one tracker. It combines gym progression, athlete training, daily logs, nutrition,
          journaling, and community so users can keep their whole training life in one place.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="landing-card text-left">
            <h3 className="text-2xl font-bold text-white mb-4">Gym Mode</h3>
            <p className="text-gray-300">
              Strength-focused training with workout programs, lift reports, stats, PR tracking, and progression.
            </p>
          </div>
          <div className="landing-card text-left">
            <h3 className="text-2xl font-bold text-white mb-4">Athlete Mode</h3>
            <p className="text-gray-300">
              Plans and sessions for performance work, endurance, hybrid training, and athlete-specific reporting.
            </p>
          </div>
          <div className="landing-card text-left">
            <h3 className="text-2xl font-bold text-white mb-4">Logs</h3>
            <p className="text-gray-300">
              Daily logging for training, meals, hydration, weight, supplements, and other signals that support
              consistency.
            </p>
          </div>
          <div className="landing-card text-left">
            <h3 className="text-2xl font-bold text-white mb-4">Journal</h3>
            <p className="text-gray-300">
              A place to track the mental side of training and keep a record of how days are actually feeling.
            </p>
          </div>
          <div className="landing-card text-left">
            <h3 className="text-2xl font-bold text-white mb-4">Community and Groups</h3>
            <p className="text-gray-300">
              Topic threads, groups, statuses, and shared templates that make the social side of the app more useful
              and accountable.
            </p>
          </div>
          <div className="landing-card text-left">
            <h3 className="text-2xl font-bold text-white mb-4">Nutrition</h3>
            <p className="text-gray-300">
              Meal discovery, favourites, custom recipes, and daily intake tracking that connect back to training.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
