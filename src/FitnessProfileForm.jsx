//watched https://www.youtube.com/watch?v=4PATisReKcQ to understand base of react websites
//video to get inspiration

// adapted from https://react.dev/reference/react/useState and https://react.dev/reference/react/useEffect
// using these hooks for the state and lifecycle control 
import { useState, useEffect } from 'react';
// adapted from https://supabase.com/docs/guides/getting-started/tutorials/with-react
// this imports the Supabase client instance which was created in supabaseClient.js
import { supabase } from './supabaseClient';
// adapted from https://reactrouter.com/en/main/hooks/use-navigate
// this is used for navigating between various pages
import { useNavigate } from 'react-router-dom';
// Component: FitnessProfileForm - UI layout and interactions.
// This component renders the fitnessprofileform experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

//adapted this with https://www.youtube.com/watch?v=4PATisReKcQ
// this is a custom component for creating, updating, and managing user fitness profiles
// and the one below that stores profile data, form inputs adapted from same video
export default function FitnessProfileForm() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [fullName, setFullName] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('Beginner');
  const [primaryGoal, setPrimaryGoal] = useState('Build Muscle');
  const [editingId, setEditingId] = useState(null);

//adapted from https://react.dev/reference/react/useEffect to fetch profiles set up
//below that is adapted from https://supabase.com/docs/reference/javascript/select (to select profile)
//https://supabase.com/docs/reference/javascript/insert (to insert a new profile)
//https://supabase.com/docs/reference/javascript/update (to update an existing profile)
//https://supabase.com/docs/reference/javascript/delete (to delete a curent profile)
//
  useEffect(() => {
    fetchProfiles();
  }, []);

// fetchProfiles manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('id', { ascending: true });
    if (!error) setProfiles(data);
  };

// see line 27 above for link for reference to insert a profile
  const saveProfile = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([
      {
        full_name: fullName,
        fitness_level: fitnessLevel,
        primary_goal: primaryGoal
      }
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    return;
  }

  // ✅ STEP 2A: STORE USER ID GLOBALLY
  localStorage.setItem('exervia_user_id', data.id);

  resetForm();
  fetchProfiles();

  // ✅ SEND USER INTO THE SYSTEM
  navigate(`/gym/${data.id}`);
};

//see line 28 above for link for reference to update a profile
  const updateProfile = async () => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ full_name: fullName, fitness_level: fitnessLevel, primary_goal: primaryGoal })
      .eq('id', editingId);

    if (!error) {
      resetForm();
      fetchProfiles();
    }
  };
//see line 29 above for link for reference to delete a profile
  const deleteProfile = async (id) => {
    await supabase.from('user_profiles').delete().eq('id', id);
    fetchProfiles();
  };

//function to edit fitness profile got by replacing constants above with editProfile
//with help from the referenced video aswell https://www.youtube.com/watch?v=4PATisReKcQ 
//and https://supabase.com/docs/reference/javascript/
  const editProfile = (profile) => {
    setEditingId(profile.id);
    setFullName(profile.full_name);
    setFitnessLevel(profile.fitness_level);
    setPrimaryGoal(profile.primary_goal);
  };
//similar to the one above but this resets the profile rather than editing it
//also adapted from the referenced video https://www.youtube.com/watch?v=4PATisReKcQ
//and https://supabase.com/docs/reference/javascript/
  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setFitnessLevel('Beginner');
    setPrimaryGoal('Build Muscle');
  };
// below is the universal header section for the website which includes a 
// back button to return to the previous page 
// which was adapted from the referenced video https://www.youtube.com/watch?v=4PATisReKcQ aroudnd
// the and https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header/blob/main/src/layout/header.js
   // Render
   return (
    <div className="profile-body">
      <div className="profile-container">
        {/* This is the Header section */}
        <header className="profile-header">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="landing-logo">E</div>
              <h1 className="text-2xl font-bold text-white">Exervia Fitness</h1>
            </div>
            <button 
              onClick={() => window.history.back()}
              className="text-gray-300 hover:text-white transition-colors"
            >
              ← Back
            </button>
          </div>
        </header>

        {/* below is form section adapted from the standard React controlled form pattern
            and uses the referenced github 
            https://react.dev/learn/sharing-state-between-components#reacting-to-input-with-state
            and https://github.com/DevyaniMarathe/fitness-app/blob/main/components/profile-setup.tsx
            Section for creating or editing a user’s fitness profile
            from name to fitness level to primary goals */}
        <div className="profile-section">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">
            {editingId ? 'Edit Profile' : 'Create Fitness Profile'}
          </h2>
          <p className="text-gray-400 text-center mb-8">Choose your fitness journey</p>
          
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <div>
              <label className="block text-white mb-3 font-medium">Full Name</label>
              <input
                className="profile-input"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-white mb-3 font-medium">Fitness Level</label>
              <select
                className="profile-select"
                value={fitnessLevel}
                onChange={(e) => setFitnessLevel(e.target.value)}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-white mb-3 font-medium">Primary Goal</label>
              <select
                className="profile-select"
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
              >
                <option>Build Muscle</option>
                <option>Lose Weight</option>
                <option>Improve Endurance</option>
                <option>General Fitness</option>
              </select>
            </div>
              {/* below was adapted from React event handling:
                https://react.dev/learn/responding-to-events and 
                https://github.com/Manav2311/React-FormHandling-using-UseState_and_Props/blob/main/src/Components/Signup.jsx
                The Buttons below handle create profile, update profile, 
                and cancel any unfinshed actions */}
            <div className="flex gap-3 items-end">
              <button
                className={editingId ? 'profile-button-update' : 'profile-button-primary'}
                onClick={editingId ? updateProfile : saveProfile}
              >
                {editingId ? 'Update Profile' : 'Create Profile'}
              </button>

              {editingId && (
                <button
                  className="profile-button-secondary"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Below is adapted from Supabase CRUD display pattern and React conditional rendering:
            https://react.dev/learn/conditional-rendering and 
            https://github.com/minnukota381/Fitness-Tracking-App-UI-React/tree/main
            This displays all profiles or a message if there are no profiles*/}
        <div className="profile-section">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">Your Profiles</h2>
          <p className="text-gray-400 text-center mb-8">Manage your fitness profiles</p>
          
          {profiles.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💪</div>
              <p className="text-gray-400 text-lg">No profiles yet. Create your first fitness profile!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="profile-card">
                  <div className="text-center mb-4">
                    <div className="profile-avatar">
                      <span className="text-white font-bold text-xl">
                        {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <h3 className="font-bold text-xl text-white mb-1">{profile.full_name}</h3>
                    <div className="flex justify-center gap-2">
                      <span className="profile-badge">
                        {profile.fitness_level}
                      </span>
                      <span className="profile-badge profile-badge-green">
                        {profile.primary_goal}
                      </span>
                    </div>
                  </div>
                  {/* this below is similarly to ones previously is adapted from 
                  React event handling and CRUD management:
                      https://react.dev/learn/responding-to-events and
                      https://github.com/minnukota381/Fitness-Tracking-App-UI-React/tree/main
                      This allows for on button click viewing, editing, and deleting profiles */}

                  <div className="flex gap-2">
                    <button
                      className="profile-button-view"
                      onClick={() => {
  localStorage.setItem('exervia_user_id', profile.id);
  navigate(`/gym/${profile.id}`);
}}

                    >
                      View
                    </button>
                    <button
                      className="profile-button-edit"
                      onClick={() => editProfile(profile)}
                    >
                      Edit
                    </button>
                    <button
                      className="profile-button-delete"
                      onClick={() => deleteProfile(profile.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// References:
// OnlineITtuts Tutorials (2025). Build a Gym Website Using React JS and Tailwind CSS. [online] YouTube. Available at: https://www.youtube.com/watch?v=4PATisReKcQ .
// React Documentation. (2024). React Dev. [online] Available at: https://react.dev/.
// Supabase Documentation. (2024). Supabase Docs. [online] Available at: https://supabase.com/docs.
// React Router Documentation. (2024). React Router. [online] Available at: https://reactrouter.com/.
// GitHub - kbuika/React-TailwindCSS-starter-with-responsive-header: A starter template for React with TailwindCSS and a responsive header. (2023). GitHub. [online] 
// Available at:https://github.com/kbuika/React-TailwindCSS-starter-with-responsive-header/blob/main/src/layout/header.js
// GitHub - devyanimarathe/fitness-app: A fitness application to track workouts and nutrition. (2024).
// Available at:https://github.com/DevyaniMarathe/fitness-app/blob/main/components/profile-setup.tsx
// Github - manav2311/react-formhandling-using-usestate_and_props: A React application demonstrating form handling using useState and props. (2023). GitHub. [online]
// Available at: https://github.com/Manav2311/React-FormHandling-using-UseState_and_Props/blob/main/src/Components/Signup.jsx
// GitHub - minnukota381/Fitness-Tracking-App-UI-React: A fitness tracking application UI built with React. (2024). GitHub. [online]
// Available at: https://github.com/minnukota381/Fitness-Tracking-App-UI-React/tree/main