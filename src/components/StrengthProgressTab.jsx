// src/components/StrengthProgressTab.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
// adapted from https://supabase.com/docs/guides/getting-started/tutorials/with-react
// this imports the Supabase client instance which was created in supabaseClient.js
import { supabase } from '../supabaseClient';

// This is the Strength Progress Tab component that replaces the "Coming Soon" progress tab
// It allows weightlifters to log lifts, track personal records, and calculate 1RM
// Adapted from strength tracking patterns in fitness apps and React state management
const StrengthProgressTab = ({ userId }) => {
  // State for tracking whether user is logging weights or bodyweight exercises
  const [mode, setMode] = useState('weights');
  
  // Lift data object storing all user inputs for strength log
  // adapted from rendering lists in React: https://react.dev/learn/rendering-lists
  const [log, setLog] = useState({
    exercise: 'squat',
    reps: '',
    weight: '',
    sets: 1,
    effort: 5,
    mood: '💪',
    notes: ''
  });
  
 // Object to store personal records fetched from database
// used for displaying PR Hall of Fame and checking for new personal bests
// adapted from state management patterns in React: https://react.dev/learn/state-a-components-memory
  const [personalRecords, setPersonalRecords] = useState({});
  
// // Array to store recent lifts fetched from database  
// displays the user's most recent strength training sessions
// adapted from rendering lists in React: https://react.dev/learn/rendering-lists
  const [recentLifts, setRecentLifts] = useState([]);
  
  // Loading state to prevent duplicate form submissions
// shows loading feedback during database operations
// adapted from conditional rendering patterns: https://react.dev/learn/conditional-rendering
  const [isLoading, setIsLoading] = useState(false);
  
  // // Calculated 1RM (One Rep Max) for performance tracking
// uses Epley formula: weight × (1 + reps/30)
// standard formula from strength training literature: https://en.wikipedia.org/wiki/One-repetition_maximum
  const [oneRM, setOneRM] = useState(null);

  
// Weight exercises configuration with icons
// primary compound lifts commonly tracked in strength training
// inspired by strength training apps and exercise databases
  const weightExercises = [
    { value: 'squat', label: 'Squat', icon: '🏋️' },
    { value: 'bench_press', label: 'Bench Press', icon: '💪' },
    { value: 'deadlift', label: 'Deadlift', icon: '🔥' },
    { value: 'overhead_press', label: 'Overhead Press', icon: '⬆️' },
    { value: 'barbell_row', label: 'Barbell Row', icon: '🚣‍♂️' },
  ];

  // Bodyweight exercises configuration with icons
// fundamental calisthenics movements for strength without equipment
// similar to bodyweight exercise categorization in fitness applications
  const bodyweightExercises = [
    { value: 'pushups', label: 'Push-ups', icon: '🤸‍♂️' },
    { value: 'pullups', label: 'Pull-ups', icon: '🧗' },
    { value: 'squats', label: 'Bodyweight Squats', icon: '🦵' },
    { value: 'plank', label: 'Plank', icon: '🛡️' },
    { value: 'lunges', label: 'Lunges', icon: '👟' },
  ];

  // Current exercises based on selected mode
  const currentExercises = mode === 'weights' ? weightExercises : bodyweightExercises;

  // Calculates 1RM using Epley formula: weight × (1 + reps/30)
  const calculateOneRM = (weight, reps) => {
    if (!weight || !reps || reps < 1) return 0;
    const w = parseFloat(weight);
    const r = parseInt(reps);
    return w * (1 + r / 30); // Epley formula
  };

  // Automatically calculate 1RM when inputs change
  useEffect(() => {
    if (mode === 'weights' && log.weight && log.reps) {
      setOneRM(calculateOneRM(log.weight, log.reps));
    } else {
      setOneRM(null);
    }
  }, [log.weight, log.reps, mode]);

  // Main function to handle lift logging
  const handleLogLift = async () => {
    if (!log.reps || !log.exercise) {
      alert('Please fill in at least reps and exercise');
      return;
    }

    setIsLoading(true);
    const currentOneRM = calculateOneRM(log.weight, log.reps);
    
    // Check if this is a personal record
    const { data: bestRecord } = await supabase
      .from('personal_records')
      .select('one_rm_est')
      .eq('user_id', userId)
      .eq('exercise_name', log.exercise)
      .single();

    const isPR = !bestRecord || currentOneRM > bestRecord.one_rm_est;

    const liftData = {
      user_id: userId,
      exercise_name: log.exercise,
      exercise_type: mode,
      weight: mode === 'weights' ? parseFloat(log.weight) || 0 : 0,
      reps: parseInt(log.reps),
      sets: parseInt(log.sets),
      effort_level: log.effort,
      mood_emoji: log.mood,
      notes: log.notes,
      is_personal_best: isPR,
    };
// eslint-disable-next-line
    const { data, error } = await supabase
      .from('strength_logs')
      .insert([liftData])
      .select()
      .single();

    if (!error) {
      // If this is a PR, save it and show success message
      if (isPR) {
        const prData = {
          user_id: userId,
          exercise_name: log.exercise,
          exercise_type: mode,
          weight: mode === 'weights' ? parseFloat(log.weight) || 0 : 0,
          reps: parseInt(log.reps),
          is_bodyweight: mode === 'bodyweight',
          one_rm_est: currentOneRM
        };

        // Save PR to database
        await supabase.from('personal_records').upsert(prData, { 
          onConflict: 'user_id,exercise_name,exercise_type' 
        });

        // Show success message instead of confetti
        alert(`🏆 NEW PERSONAL RECORD! ${currentOneRM.toFixed(1)}kg estimated 1RM!`);
      } else {
        alert('✅ Lift logged successfully! Keep going!');
      }

      // Reset form after successful submission
      setLog({
        exercise: mode === 'weights' ? 'squat' : 'pushups',
        reps: '',
        weight: '',
        sets: 1,
        effort: 5,
        mood: '💪',
        notes: ''
      });
      setOneRM(null);

      // Refresh data displays
      fetchPersonalRecords();
      fetchRecentLifts();
    } else {
      console.error('Error logging lift:', error);
      alert('Error logging lift. Please try again.');
    }

    setIsLoading(false);
  };

  // Function to fetch personal records from database
  const fetchPersonalRecords = async () => {
    const { data, error } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId);

    if (!error && data) {
      const prs = {};
      data.forEach(record => {
        prs[record.exercise_name] = record;
      });
      setPersonalRecords(prs);
    }
  };

  // Function to fetch recent lifts from database
  const fetchRecentLifts = async () => {
    const { data, error } = await supabase
      .from('strength_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    if (!error && data) {
      setRecentLifts(data);
    }
  };

  // Helper function to get exercise label from value
  const getExerciseLabel = (exerciseName) => {
    const allExercises = [...weightExercises, ...bodyweightExercises];
    return allExercises.find(e => e.value === exerciseName)?.label || exerciseName;
  };

  // Load data when component mounts
  useEffect(() => {
    if (userId) {
      fetchPersonalRecords();
      fetchRecentLifts();
    }
  }, [userId]);

  // Reset exercise when mode changes
  useEffect(() => {
    setLog(prev => ({
      ...prev,
      exercise: mode === 'weights' ? 'squat' : 'pushups',
      weight: ''
    }));
  }, [mode]);

  return (
    <div className="strength-progress-container p-4 max-w-4xl mx-auto">
      {/* 1RM Calculator Display */}
      {oneRM && oneRM > 0 && (
        <div className="mb-6 p-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-3xl border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">🏋️‍♂️ Estimated 1RM</h3>
              <p className="text-sm text-gray-400">Based on Epley Formula</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-yellow-400">{oneRM.toFixed(1)}kg</div>
              <div className="text-sm font-bold text-yellow-400">ESTIMATED MAX</div>
            </div>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Strength Training</h2>
        <p className="text-gray-400">Log your lifts and watch your power grow</p>
      </div>

      {/* Mode toggle buttons - weights vs bodyweight */}
      <div className="flex bg-gray-800/50 p-1 rounded-2xl mb-8 max-w-md mx-auto">
        <button 
          onClick={() => setMode('weights')}
          className={`flex-1 py-4 rounded-xl text-lg font-bold transition-all ${
            mode === 'weights' 
              ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-500 border border-yellow-500/30' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          🏋️‍♂️ Weights
        </button>
        <button 
          onClick={() => setMode('bodyweight')}
          className={`flex-1 py-4 rounded-xl text-lg font-bold transition-all ${
            mode === 'bodyweight' 
              ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-500 border border-blue-500/30' 
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          🤸‍♂️ Bodyweight
        </button>
      </div>

      {/* Main logging card */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-3xl p-8 mb-8 border border-gray-700">
        {/* Exercise selection */}
        <div className="mb-8">
          <label className="block text-sm font-bold text-gray-400 mb-4">SELECT EXERCISE</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {currentExercises.map((exercise) => (
              <button
                key={exercise.value}
                onClick={() => setLog({...log, exercise: exercise.value})}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all ${
                  log.exercise === exercise.value
                    ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-2 border-orange-500'
                    : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className="text-2xl mb-2">{exercise.icon}</span>
                <span className="text-xs font-medium text-white text-center">{exercise.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/*  Strength exercise input grid for reps, weight, and sets
  handles user input for strength training sessions and calculates 1RM
  adapted from form handling in React: https://react.dev/learn/responding-to-events
  and input management patterns: https://react.dev/reference/react-dom/components/inpu */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
            <label className="text-xs font-bold text-gray-400 mb-3 block uppercase">Reps</label>
            <input 
              type="number" 
              placeholder="0" 
              value={log.reps}
              onChange={(e) => setLog({...log, reps: e.target.value})}
              className="bg-transparent text-5xl font-black w-full text-center outline-none text-white"
            />
            <div className="text-xs text-gray-500 mt-2">How many reps?</div>
          </div>

          {mode === 'weights' && (
            <div className="text-center p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
              <label className="text-xs font-bold text-gray-400 mb-3 block uppercase">Weight (kg)</label>
              <input 
                type="number" 
                placeholder="0" 
                value={log.weight}
                onChange={(e) => setLog({...log, weight: e.target.value})}
                className="bg-transparent text-5xl font-black w-full text-center outline-none text-white"
              />
              <div className="text-xs text-gray-500 mt-2">How much weight?</div>
            </div>
          )}

          <div className="text-center p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
            <label className="text-xs font-bold text-gray-400 mb-3 block uppercase">Sets</label>
            <input 
              type="number" 
              placeholder="1" 
              value={log.sets}
              onChange={(e) => setLog({...log, sets: e.target.value})}
              className="bg-transparent text-5xl font-black w-full text-center outline-none text-white"
              min="1"
            />
            <div className="text-xs text-gray-500 mt-2">How many sets?</div>
          </div>
        </div>

        {/*  Log button for submitting strength training sessions
  triggers database insertion and personal record checks
  adapted from button submission patterns in React forms */}
        <button 
          onClick={handleLogLift}
          disabled={isLoading}
          className="w-full py-6 bg-gradient-to-r from-yellow-500 to-orange-600 text-black rounded-2xl font-black text-xl shadow-lg shadow-yellow-900/20 hover:shadow-yellow-900/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'LOGGING...' : '💥 LOG THE WIN'}
        </button>
      </div>

      {/*  PR Hall of Fame section displaying personal strength records
  shows user's all-time best lifts across different exercises
  adapted from list rendering patterns in React: https://react.dev/learn/rendering-lists
  and conditional rendering for empty states: https://react.dev/learn/conditional-rendering */}
      <div className="bg-gray-800/30 rounded-3xl p-6 mb-8 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">🏆 Personal Records</h3>
          <span className="text-sm text-gray-400">
            {Object.keys(personalRecords).length} records
          </span>
        </div>
        
        {Object.keys(personalRecords).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(personalRecords).slice(0, 4).map((pr) => (
              <div 
                key={pr.id} 
                className="p-4 bg-gray-800/50 rounded-2xl border border-gray-700 hover:border-yellow-500/50 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white capitalize">
                      {getExerciseLabel(pr.exercise_name)}
                    </h4>
                    <div className="text-sm text-gray-400">
                      {pr.is_bodyweight ? 'Bodyweight' : 'Weighted'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-yellow-500">
                      {pr.weight > 0 ? `${pr.weight}kg × ` : ''}{pr.reps}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(pr.achieved_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-400">No records yet. Log your first lift to start your PR journey!</p>
          </div>
        )}
      </div>

      {/* Recent Lifts section showing latest strength training sessions
  displays chronological history of logged lifts with personal best indicators
  adapted from mapping over arrays in React: https://react.dev/learn/rendering-lists
  and dynamic styling based on state: https://react.dev/learn/conditional-rendering  */}
      <div className="bg-gray-800/30 rounded-3xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-6">Recent Lifts</h3>
        {recentLifts.length > 0 ? (
          <div className="space-y-4">
            {recentLifts.map((lift) => (
              <div 
                key={lift.id} 
                className={`p-4 rounded-2xl border transition-all ${
                  lift.is_personal_best
                    ? 'border-yellow-500/50 bg-yellow-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {currentExercises.find(e => e.value === lift.exercise_name)?.icon || '💪'}
                    </span>
                    <div>
                      <h4 className="font-bold text-white capitalize">
                        {getExerciseLabel(lift.exercise_name)}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{lift.reps} reps</span>
                        {lift.weight > 0 && <span>{lift.weight}kg</span>}
                        <span>{lift.sets} sets</span>
                        <span>{lift.mood_emoji}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {new Date(lift.created_at).toLocaleDateString()}
                    </div>
                    {lift.is_personal_best && (
                      <div className="text-xs text-yellow-400 font-bold mt-1">🏆 PR!</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">💪</div>
            <p className="text-gray-400">No lifts logged yet. Start building your strength!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrengthProgressTab;