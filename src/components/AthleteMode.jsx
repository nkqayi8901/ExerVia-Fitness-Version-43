// As Athlete Mode is similar in structure to Gym Mode, you might see the same references
//watched https://www.youtube.com/watch?v=4PATisReKcQ to understand base of react websites
//video to get inspiration
// adapted from https://reactrouter.com/en/main/hooks/use-navigate
// this is used for navigating between various pages
import { useParams, useNavigate } from 'react-router-dom';
// adapted from https://react.dev/reference/react/useState and https://react.dev/reference/react/useEffect
// using these hooks for the state and lifecycle control 
import { useState, useEffect } from 'react';
// adapted from https://supabase.com/docs/guides/getting-started/tutorials/with-react
// this imports the Supabase client instance which was created in supabaseClient.js
import { supabase } from '../supabaseClient';
// similarly with FitnessProfileForm.jsx was able to adapt 
// with https://www.youtube.com/watch?v=4PATisReKcQ 
// this is a custom component for the Athlete Mode interface that builds dashboards and features
// tailored for athletic performance tracking and training plans
export default function AthleteMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

//adapted from https://react.dev/reference/react/useEffect to fetch profiles set up
//and that is adapted from https://supabase.com/docs/reference/javascript/select which selected profile
//es listed the fetchProfile as got an error from terminal that 
//it was used before being defined and the vs code terminal gave me the soulution line 29
  useEffect(() => {
    fetchProfile();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async () => {
    const { data } = await supabase.from('user_profiles').select('*').eq('id', id).single();
    setProfile(data);
  };

// Was able to adapt https://react.dev/learn/conditional-rendering to create a
// quick loading state, If profile data is not yet loaded within the useEffect above
  if (!profile) return (
    <div className="athlete-body flex items-center justify-center text-white">
      Loading...
    </div>
  );
// below is the universal header section for the website which includes a 
// back button to return to the previous page 
// which was adapted from the referenced video https://www.youtube.com/watch?v=4PATisReKcQ aroudnd
// and https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header/blob/main/src/layout/header.js
// this header includes navigation buttons to the AI Companion and Gym Mode ,
// adapted from https://react.dev/learn/responding-to-events
  return (
    <div className="athlete-body">
      {/* This is the Header section */}
      <header className="athlete-header">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="athlete-logo">E</div>
              <h1 className="text-2xl font-bold text-white">Exervia Fitness</h1>
              <span className="athlete-badge">Athlete Mode</span>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/companion')}
                className="athlete-button-primary"
              >
                AI Companion
              </button>
              <button 
                onClick={() => navigate(`/gym/${id}`)}
                className="athlete-button-secondary"
              >
                Gym Mode
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* This is a welcome Section adapted from card layouts and user dashboard designs seen on 
      https://tailwindui.com/components/application-ui/headings, specifically inspired by the
       dashboard header cards with user welcome messages and status badges , 
       which connects to supabase and showcases name , primary goal and fitness level */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="athlete-card p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Welcome, {profile.full_name}</h2>
              <p className="text-gray-400 mb-4">Ready to optimize your athletic performance?</p>
              <div className="flex gap-3">
                <span className="athlete-badge">{profile.fitness_level}</span>
                <span className="athlete-badge athlete-badge-red">{profile.primary_goal}</span>
              </div>
            </div>
          </div>
        </div>

        {/* This is tabs navigation section adapted from tab component patterns 
        seen on https://tailwindui.com/components/application-ui/navigation/tabs, and 
        https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header , 
        which renders tabs and highlights current active tabs */}
        <div className="athlete-tab-container mb-8">
          <div className="flex space-x-2">
            {['dashboard', 'training', 'nutrition', 'performance'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`athlete-tab ${
                  activeTab === tab ? 'athlete-tab-active' : 'athlete-tab-inactive'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* This is the content section also adapted from ones seen on 
         https://tailwindui.com/components/application-ui/cards and https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header , 
        including feature cards which creates a dashboard style layout*/}
        <div className="athlete-card p-8">
          {activeTab === 'dashboard' && (
            <div className="grid gap-6 md:grid-cols-3">
              <div 
                className="athlete-feature-card"
                onClick={() => setActiveTab('training')}
              >
                <h3 className="text-xl font-bold text-white mb-3">Today's Training</h3>
                <p className="text-gray-400 mb-4">Endurance & Speed Work</p>
                <span className="text-orange-400 text-sm font-medium">Ready to start</span>
              </div>

              <div 
                className="athlete-feature-card"
                onClick={() => setActiveTab('performance')}
              >
                <h3 className="text-xl font-bold text-white mb-3">Performance</h3>
                <p className="text-gray-400 mb-4">Track your metrics</p>
                <span className="text-red-400 text-sm font-medium">View stats</span>
              </div>

              <div 
                className="athlete-feature-card"
                onClick={() => navigate('/companion')}
              >
                <h3 className="text-xl font-bold text-white mb-3">AI Companion</h3>
                <p className="text-gray-400 mb-4">Get sport-specific advice</p>
                <span className="text-purple-400 text-sm font-medium">Ask AI</span>
              </div>
            </div>
          )}
          {/* Below is an empty state placeholder for non-dashboard tabs. 
          Adapted from the Tailwind UI's empty state and feature-under-development patterns website
          https://tailwindui.com/components/application-ui/empty-states
          which uses emoji iconography, bold headings to indicate upcoming features.*/}

          {activeTab !== 'dashboard' && (
  <div className="text-center py-12">
    <div className="text-6xl mb-6">
      {activeTab === 'workouts' ? '💪' : 
       activeTab === 'nutrition' ? '🥗' : '📊'}
    </div>
    <h3 className="text-2xl font-bold text-white mb-4">
      {activeTab === 'nutrition' ? 'Nutrition Tracker' : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Coming Soon`}
    </h3>
    <p className="text-gray-400 mb-8 max-w-md mx-auto">
      {activeTab === 'nutrition' 
        ? 'Access our full nutrition database to search for foods and track your intake' 
        : `This feature is under development. Your AI companion can help with ${activeTab} advice in the meantime.`
      }
    </p>
    <button 
      onClick={() => activeTab === 'nutrition' ? navigate('/nutrition') : navigate('/companion')}
      className="gym-button-primary py-3 px-6"
    >
      {activeTab === 'nutrition' ? 'Open Nutrition Tracker' : 'Ask Companion'}
    </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}