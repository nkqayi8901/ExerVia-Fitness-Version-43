//watched https://www.youtube.com/watch?v=4PATisReKcQ to understand base of react websites
//video to get inspiration

// adapted from https://reactrouter.com/en/main/hooks/use-navigate
// this is used for navigating between various pages
import { useNavigate } from 'react-router-dom';
// this is the landing page component which will act like a home page for the app
// where users can pick between the gym mode or athlete mode and go on to create their profiles
// adapted general layout style and structure from Tailwind landing page examples 
// I found on https://tailwindui.com/preview
export default function LandingPage() {
  const navigate = useNavigate();
// below is the universal header section for the website which includes a 
// back button to return to the previous page 
// which was adapted from the referenced video https://www.youtube.com/watch?v=4PATisReKcQ
// and https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header/blob/main/src/layout/header.js
  return (
    <div className="landing-body">
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

      {/* below is a hero section which is styled like hero headers found in Tailwind templates
      https://tailwindui.com/preview ,I used large headings and gradient text which i got from there
    Gradient styling adapted from visual patterns seen on https://gradienty.codes/ */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold text-white mb-6">
          Dual-Mode <span className="landing-gradient-text">Fitness Assistant</span>
        </h1>
        <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
          Choose your path: Gym strength training or athletic performance. Smart guidance for every goal.
        </p>

        {/* below is a Dual Mode Cards designed i got inspiration and 
        adapted for while on https://tailwindui.com/preview ,buttons were created
        and adapted from https://react.dev/learn/responding-to-events ,
        clicking any of the cards brings user to the create profile page so 
        essentially one button flow across entire screen */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          {/* This is the Gym Mode card */}
          <div 
            className="landing-card landing-card-gym"
            onClick={() => navigate('/auth')}
          >
            <div className="text-4xl mb-4">💪</div>
            <h3 className="text-2xl font-bold text-white mb-4">Gym Mode</h3>
            <p className="text-gray-300 mb-4">Strength training & muscle building</p>
            <ul className="text-gray-400 space-y-2 text-left">
              <li>• Progressive overload tracking</li>
              <li>• Workout plan generation</li>
              <li>• Strength metrics analysis</li>
            </ul>
          </div>

          {/* This is the Athlete Mode Card , 
          same exact stuructre as Gym Mode Card above so both adapted and inspired from
           https://tailwindui.com/preview and https://react.dev/learn/responding-to-events ,*/}
          <div 
            className="landing-card landing-card-athlete"
            onClick={() => navigate('/auth')}
          >
            <div className="text-4xl mb-4">🏃‍♂️</div>
            <h3 className="text-2xl font-bold text-white mb-4">Athlete Mode</h3>
            <p className="text-gray-300 mb-4">Sport performance & endurance</p>
            <ul className="text-gray-400 space-y-2 text-left">
              <li>• Sport-specific training</li>
              <li>• Performance analytics</li>
              <li>• Competition preparation</li>
            </ul>
          </div>
        </div>
        {/* As mentioned above button similarly this button is  adapted and created from 
        https://react.dev/learn/responding-to-events, */}
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
// References:
// OnlineITtuts Tutorials (2025). Build a Gym Website Using React JS and Tailwind CSS. [online] YouTube. Available at: https://www.youtube.com/watch?v=4PATisReKcQ .
// Tailwind UI (2024). Tailwind UI - Beautiful UI Components Built with Tailwind CSS. [online] Tailwindui.com. Available at: https://tailwindui.com/preview .
// React Documentation (2024). Responding to Events – React. [online] React.dev. Available at: https://react.dev/learn/responding-to-events .
// React Router Documentation (2024). useNavigate – React Router. [online] Reactrouter.com. Available at: https://reactrouter.com/en/main/hooks/use-navigate .
// Gradienty Codes (2024). Gradienty.codes - Beautiful Color Gradients for Your Designs. [online] Gradienty.codes. Available at: https://gradienty.codes/ .
// GitHub - kbuika/React-TailwindCSS-starter-with-responsive-header: A Simple React and Tailwind CSS Starter Template with a Responsive Header. [online] 
// Available at:https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header/blob/main/src/layout/header.js
