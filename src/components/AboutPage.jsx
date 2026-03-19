import { useNavigate } from "react-router-dom";
import heroImage from "../assets/exervia-hero.webp";

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-body" style={{ "--exervia-hero-bg": `url(${heroImage})` }}>
      <header className="landing-header">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center space-x-3">
              <div className="landing-logo">E</div>
              <h1 className="text-2xl font-bold text-white">About ExerVia</h1>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => navigate("/")} className="landing-button-secondary">
                Home
              </button>
              <button onClick={() => navigate("/features")} className="landing-button-secondary">
                Features
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
          Who We Are <span className="landing-gradient-text">And Where ExerVia Is Going</span>
        </h1>
        <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
          ExerVia was built around a simple idea: people who lift and people who train like athletes should not need to
          force their work into the same generic fitness app. The goal is to make training feel clearer, more
          structured, and more connected.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
          <div className="landing-card text-left">
            <h3 className="text-2xl font-bold text-white mb-4">What ExerVia is about</h3>
            <p className="text-gray-300 mb-4">
              The product is built for users who want proper structure around training, logging, recovery signals,
              nutrition, and accountability. Gym Mode and Athlete Mode exist because different training styles deserve
              different context.
            </p>
            <ul className="text-gray-400 space-y-2">
              <li>Clearer training identity</li>
              <li>Better progress visibility</li>
              <li>Stronger daily consistency</li>
            </ul>
          </div>

          <div className="landing-card text-left">
            <h3 className="text-2xl font-bold text-white mb-4">What I intend to keep improving</h3>
            <p className="text-gray-300 mb-4">
              The direction is to keep sharpening the core loop first: cleaner mobile experience, stronger reports,
              better session intelligence, and more meaningful social accountability instead of noise.
            </p>
            <ul className="text-gray-400 space-y-2">
              <li>Better mobile polish across all screens</li>
              <li>Deeper athlete tracking and session reporting</li>
              <li>More refined community and coaching features</li>
            </ul>
          </div>
        </div>

        <button onClick={() => navigate("/auth")} className="landing-button-primary text-lg py-3 px-8">
          Start Your Journey
        </button>
      </section>
    </div>
  );
}
