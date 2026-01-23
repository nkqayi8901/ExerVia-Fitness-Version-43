// src/components/AthleteTrainingTab.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
// adapted from https://supabase.com/docs/guides/getting-started/tutorials/with-react
// this imports the Supabase client instance which was created in supabaseClient.js
import { supabase } from '../supabaseClient';

// This is the Athlete Training Tab component that replaces the "Coming Soon" training tab
// It allows competitive athletes to log sport-specific training sessions with efficiency metrics
// Adapted from React state patterns and training log interfaces in fitness applications
const AthleteTrainingTab = ({ userId }) => {
  // State management for tracking whether user is in beginner or advanced mode
  // beginner mode logs basic session data, advanced mode includes efficiency metrics
  // adapted from React useState documentation: https://react.dev/learn/state-a-components-memory
  const [isAdvanced, setIsAdvanced] = useState(false);
  
  // Rate of Perceived Exertion (RPE) tracking from 1-10 scale
  const [effort, setEffort] = useState(5);
  
  // Session data object storing all user inputs for training log
  // adapted from rendering lists in React: https://react.dev/learn/rendering-lists
  const [session, setSession] = useState({
    sport: 'running',
    duration: '',
    distance: '',
    heartRate: '',
    mood: '😊',
    notes: ''
  });
  
  // // Array to store recent lifts fetched from database  
// displays the user's most recent training sessions
// adapted from rendering lists in React: https://react.dev/learn/rendering-lists
  const [recentSessions, setRecentSessions] = useState([]);
  
  // Loading state to prevent duplicate form submissions
// shows loading feedback during database operations
// adapted from conditional rendering patterns: https://react.dev/learn/conditional-rendering
  const [isLoading, setIsLoading] = useState(false);
  
  // Calculated aerobic efficiency score for performance tracking
  // Efficiency = Pace (min/km) ÷ Heart Rate (BPM)
  // Lower scores indicate better cardiovascular efficiency
  // adapted from efficiency metrics in endurance training literature
  const [efficiencyScore, setEfficiencyScore] = useState(null);

  // Sports configuration data with icons and labels
  // adapted from sport selection UIs in fitness applications
  const sports = [
    { value: 'running', label: 'Running', icon: '🏃‍♂️' },
    { value: 'cycling', label: 'Cycling', icon: '🚴‍♂️' },
    { value: 'swimming', label: 'Swimming', icon: '🏊‍♂️' },
    { value: 'strength', label: 'Strength', icon: '💪' },
    { value: 'yoga', label: 'Yoga', icon: '🧘‍♂️' },
    { value: 'hiking', label: 'Hiking', icon: '🥾' },
  ];

  // Calculates aerobic efficiency factor: Pace (min/km) ÷ Heart Rate (BPM)
  // provides feedback based on efficiency score
  // adapted from endurance training efficiency metrics
  const calculateEfficiency = (distance, time, heartRate) => {
    if (!distance || !time || !heartRate) return null;
    
    const paceMinutesPerKm = parseFloat(time) / parseFloat(distance);
    const efficiency = paceMinutesPerKm / parseFloat(heartRate);
    
    let insight = '';
    if (efficiency < 0.02) insight = '🔥 Elite Efficiency!';
    else if (efficiency < 0.03) insight = '💪 Very Efficient';
    else if (efficiency < 0.04) insight = '👍 Good Efficiency';
    else if (efficiency < 0.05) insight = '📊 Average Efficiency';
    else insight = '🔄 Room for Improvement';
    
    return {
      value: efficiency.toFixed(4),
      insight: insight,
      pace: paceMinutesPerKm.toFixed(2)
    };
  };

  // Automatically recalculates efficiency when inputs change
  // adapted from React useEffect documentation: https://react.dev/learn/synchronizing-with-effects
  // watches distance, duration, heartRate, and isAdvanced state
  useEffect(() => {
    if (isAdvanced && session.distance && session.duration && session.heartRate) {
      const efficiency = calculateEfficiency(session.distance, session.duration, session.heartRate);
      setEfficiencyScore(efficiency);
    } else {
      setEfficiencyScore(null);
    }
  }, [session.distance, session.duration, session.heartRate, isAdvanced]);

  // Main function to handle training session logging
  // validates inputs, calculates efficiency, and stores data in Supabase
  const handleLogSession = async () => {
    if (!session.duration || !session.sport) {
      alert('Please fill in at least duration and sport');
      return;
    }

    setIsLoading(true);
    let efficiencyData = null;
    
    if (isAdvanced && session.distance && session.duration && session.heartRate) {
      efficiencyData = calculateEfficiency(session.distance, session.duration, session.heartRate);
    }

    const sessionData = {
      user_id: userId,
      sport: session.sport,
      level: isAdvanced ? 'advanced' : 'beginner',
      duration_minutes: parseInt(session.duration),
      effort_level: effort,
      mood_emoji: session.mood,
      notes: session.notes,
      metrics: {
        distance: session.distance ? parseFloat(session.distance) : null,
        heart_rate: session.heartRate ? parseInt(session.heartRate) : null,
        efficiency_factor: efficiencyData ? efficiencyData.value : null
      },
      efficiency_factor: efficiencyData ? efficiencyData.value : null,
    };
// eslint-disable-next-line
    const { data, error } = await supabase
      .from('training_sessions')
      .insert([sessionData])
      .select()
      .single();

    if (!error) {
      // Success message 
      if (efficiencyData && parseFloat(efficiencyData.value) < 0.03) {
        alert('🎯 Great efficiency score! Your cardiovascular fitness is improving!');
      }

      setSession({
        sport: 'running',
        duration: '',
        distance: '',
        heartRate: '',
        mood: '😊',
        notes: ''
      });
      setEffort(5);
      setEfficiencyScore(null);
      fetchRecentSessions();
    } else {
      console.error('Error logging session:', error);
    }
    
    setIsLoading(false);
  };

  // Function to fetch recent training sessions from database
  // displays the latest 3 sessions for user reference
  // adapted from Supabase data fetching examples
  const fetchRecentSessions = async () => {
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    if (!error && data) {
      setRecentSessions(data);
    }
  };

  // Load recent sessions when component mounts
  // adapted from React useEffect documentation: https://react.dev/learn/synchronizing-with-effects
  useEffect(() => {
    if (userId) {
      fetchRecentSessions();
    }
  }, [userId]);
// The main JSX return for the Athlete Training Tab UI
// includes sport selection, effort slider, input fields, and recent sessions display
// adapted from React component structure patterns
  return (
    <div className="athlete-training-container p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Log Your Training</h2>
          <p className="text-gray-400">Every session counts towards your goals</p>
        </div>
        <button 
          onClick={() => setIsAdvanced(!isAdvanced)}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            isAdvanced 
              ? 'bg-orange-500 text-white border border-orange-500' 
              : 'text-orange-500 border border-orange-500/30 hover:bg-orange-500/10'
          }`}
        >
          {isAdvanced ? 'Simple Mode' : 'Advanced Mode'}
        </button>
      </div>
       
      {efficiencyScore && (
        <div className="mb-6 p-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-3xl border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">🏃‍♂️ Aerobic Efficiency</h3>
              <p className="text-sm text-gray-400">Pace ÷ Heart Rate (Lower = Better)</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-blue-400">{efficiencyScore.value}</div>
              <div className="text-sm font-bold text-green-400">{efficiencyScore.insight}</div>
            </div>
          </div>
        </div>
      )}
{/* Sport/Activity selector — lets the user choose the sport for the session. 
Renders a responsive grid of sport options using sports.map(). 
Each option shows an icon + label and updates session.sport on click. 
Applies highlighted gradient + border styling to the currently selected sport, 
with neutral styling for unselected options. */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-3xl p-8 mb-8 border border-gray-700">
        <div className="mb-8">
          <label className="block text-sm font-bold text-gray-400 mb-4">SPORT / ACTIVITY</label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {sports.map((sport) => (
              <button
                key={sport.value}
                onClick={() => setSession({...session, sport: sport.value})}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all ${
                  session.sport === sport.value
                    ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-2 border-orange-500'
                    : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className="text-2xl mb-2">{sport.icon}</span>
                <span className="text-xs font-medium text-white">{sport.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 bg-gray-800/30 p-6 rounded-2xl border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-bold text-gray-400">HOW HARD WAS IT?</label>
            <div className="text-2xl font-bold text-orange-500">{effort}/10</div>
          </div>
          <input 
            type="range" 
            min="1" 
            max="10" 
            value={effort} 
            onChange={(e) => setEffort(parseInt(e.target.value))}
            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500"
          />
          <div className="flex justify-between text-xs mt-2 text-gray-500">
            <span>Easy Recovery</span>
            <span>Maximum Effort</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">DURATION (MINUTES)</label>
            <input 
              type="number" 
              placeholder="45" 
              value={session.duration}
              onChange={(e) => setSession({...session, duration: e.target.value})}
              className="w-full p-4 bg-gray-800 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none transition text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">
              {isAdvanced ? 'HEART RATE (BPM)' : 'DISTANCE (KM)'}
            </label>
            <input 
              type="number" 
              placeholder={isAdvanced ? "145" : "5.2"} 
              value={isAdvanced ? session.heartRate : session.distance}
              onChange={(e) => isAdvanced 
                ? setSession({...session, heartRate: e.target.value})
                : setSession({...session, distance: e.target.value})
              }
              className="w-full p-4 bg-gray-800 rounded-2xl border-2 border-transparent focus:border-orange-500 outline-none transition text-white"
            />
          </div>
        </div>
  {/*  Log Session button — triggers handleLogSession to save the workout.
  Shows a loading state while the session is being logged.
  Uses disabled + visual feedback patterns for async actions. */}
        <button 
          onClick={handleLogSession}
          disabled={isLoading}
          className="w-full py-6 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl font-black text-xl shadow-lg shadow-orange-900/30 hover:shadow-orange-900/50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'LOGGING...' : 'LOG SESSION'}
        </button>
      </div>
{/* Recent Sessions list — displays the user's latest logged workouts. 
Renders each session with sport icon, name, and metadata. 
Applies conditional styling when efficiency_factor indicates a high‑efficiency session. 
Uses React list‑rendering patterns (mapping over recentSessions) and 
conditional UI for empty vs. populated states. */}
      <div className="bg-gray-800/30 rounded-3xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Recent Sessions</h3>
        {recentSessions.length > 0 ? (
          <div className="space-y-4">
            {recentSessions.map((sess) => (
              <div 
                key={sess.id} 
                className={`p-4 rounded-2xl border ${
                  sess.efficiency_factor && parseFloat(sess.efficiency_factor) < 0.03
                    ? 'border-green-500/30 bg-green-500/10'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {sports.find(s => s.value === sess.sport)?.icon || '🏃‍♂️'}
                    </span>
                    <div>
                      <h4 className="font-bold text-white capitalize">
                        {sess.sport}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{sess.duration_minutes} mins</span>
                        <span>RPE: {sess.effort_level}/10</span>
                        <span>{sess.mood_emoji}</span>
                      </div>
                    </div>
                  </div>
                  {sess.efficiency_factor && (
                    <div className="text-right">
                      <div className="text-sm text-blue-400 font-bold">
                        EF: {parseFloat(sess.efficiency_factor).toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-gray-400">No sessions logged yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AthleteTrainingTab;