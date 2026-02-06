// src/components/StrengthProgressTab.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// adapted from https://supabase.com/docs/guides/getting-started/tutorials/with-react
// this imports the Supabase client instance which was created in supabaseClient.js
import { supabase } from '../supabaseClient';
// Component: StrengthProgressTab - UI layout and interactions.
// This component renders the strengthprogresstab experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

const fallbackPrograms = [
  {
    id: 'classic-glute-day',
    name: 'Classic Glute Day',
    level: 'Beginner',
    focus: 'Lower Body',
    description: 'Glutes and posterior chain with clean fundamentals.',
    exercises: [
      { name: 'Barbell Hip Thrust', sets: 4, reps: 8, type: 'weights' },
      { name: 'Romanian Deadlift', sets: 3, reps: 10, type: 'weights' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: 10, type: 'weights' },
      { name: 'Glute Bridge', sets: 3, reps: 12, type: 'weights' },
    ],
  },
  {
    id: 'advanced-push',
    name: 'Advanced Push Day',
    level: 'Advanced',
    focus: 'Push',
    description: 'Heavy press focus with accessory volume.',
    exercises: [
      { name: 'Bench Press', sets: 5, reps: 5, type: 'weights' },
      { name: 'Overhead Press', sets: 4, reps: 6, type: 'weights' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 10, type: 'weights' },
      { name: 'Triceps Pushdown', sets: 3, reps: 12, type: 'weights' },
    ],
  },
  {
    id: 'beginner-shoulders-chest',
    name: 'Beginner Shoulders + Chest',
    level: 'Beginner',
    focus: 'Upper Body',
    description: 'Low-stress push session to build confidence.',
    exercises: [
      { name: 'Dumbbell Shoulder Press', sets: 3, reps: 10, type: 'weights' },
      { name: 'Incline Push-up', sets: 3, reps: 12, type: 'bodyweight' },
      { name: 'Cable Fly', sets: 3, reps: 12, type: 'weights' },
      { name: 'Lateral Raise', sets: 2, reps: 15, type: 'weights' },
    ],
  },
  {
    id: 'leg-day',
    name: 'Leg Day',
    level: 'Intermediate',
    focus: 'Lower Body',
    description: 'Squat, hinge, and pump to finish.',
    exercises: [
      { name: 'Back Squat', sets: 4, reps: 6, type: 'weights' },
      { name: 'Deadlift', sets: 3, reps: 5, type: 'weights' },
      { name: 'Leg Press', sets: 3, reps: 10, type: 'weights' },
      { name: 'Walking Lunge', sets: 2, reps: 12, type: 'weights' },
    ],
  },
  {
    id: 'glute-focused-legs',
    name: 'Glute Focused Legs',
    level: 'Intermediate',
    focus: 'Glutes',
    description: 'Glute bias with hip hinge and single-leg work.',
    exercises: [
      { name: 'Barbell Hip Thrust', sets: 4, reps: 8, type: 'weights' },
      { name: 'Romanian Deadlift', sets: 3, reps: 10, type: 'weights' },
      { name: 'Walking Lunge', sets: 3, reps: 12, type: 'weights' },
      { name: 'Cable Kickback', sets: 3, reps: 15, type: 'weights' },
    ],
  },
  {
    id: 'calf-focus-day',
    name: 'Calf Focus Day',
    level: 'Intermediate',
    focus: 'Lower Body',
    description: 'Calves and lower-leg resilience.',
    exercises: [
      { name: 'Standing Calf Raise', sets: 4, reps: 12, type: 'weights' },
      { name: 'Seated Calf Raise', sets: 4, reps: 15, type: 'weights' },
      { name: 'Tibialis Raise', sets: 3, reps: 15, type: 'weights' },
      { name: 'Farmer Carry', sets: 3, reps: 40, type: 'weights' },
    ],
  },
  {
    id: 'chest-back-day',
    name: 'Chest + Back Day',
    level: 'Intermediate',
    focus: 'Upper Body',
    description: 'Push-pull balance for strength and posture.',
    exercises: [
      { name: 'Bench Press', sets: 4, reps: 6, type: 'weights' },
      { name: 'Lat Pulldown', sets: 4, reps: 10, type: 'weights' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 10, type: 'weights' },
      { name: 'Seated Cable Row', sets: 3, reps: 12, type: 'weights' },
    ],
  },
  {
    id: 'pull-day',
    name: 'Pull Day',
    level: 'Advanced',
    focus: 'Pull',
    description: 'Back, rear delts, and biceps volume.',
    exercises: [
      { name: 'Deadlift', sets: 4, reps: 5, type: 'weights' },
      { name: 'Pull-up', sets: 3, reps: 8, type: 'bodyweight' },
      { name: 'Chest Supported Row', sets: 3, reps: 10, type: 'weights' },
      { name: 'Face Pull', sets: 3, reps: 15, type: 'weights' },
    ],
  },
  {
    id: 'upper-hypertrophy',
    name: 'Upper Hypertrophy',
    level: 'Intermediate',
    focus: 'Upper Body',
    description: 'Volume-focused upper body builder.',
    exercises: [
      { name: 'Incline Dumbbell Press', sets: 4, reps: 10, type: 'weights' },
      { name: 'Single-Arm Row', sets: 3, reps: 12, type: 'weights' },
      { name: 'Lateral Raise', sets: 3, reps: 15, type: 'weights' },
      { name: 'Biceps Curl', sets: 3, reps: 12, type: 'weights' },
    ],
  },
  {
    id: 'full-body-foundation',
    name: 'Full Body Foundation',
    level: 'Beginner',
    focus: 'Full Body',
    description: 'Balanced movements to build strength base.',
    exercises: [
      { name: 'Goblet Squat', sets: 3, reps: 10, type: 'weights' },
      { name: 'Push-up', sets: 3, reps: 10, type: 'bodyweight' },
      { name: 'Romanian Deadlift', sets: 3, reps: 10, type: 'weights' },
      { name: 'Plank', sets: 3, reps: 30, type: 'bodyweight' },
    ],
  },
  {
    id: 'bodyweight-strength',
    name: 'Bodyweight Strength',
    level: 'Beginner',
    focus: 'Bodyweight',
    description: 'No equipment, full-body control.',
    exercises: [
      { name: 'Push-up', sets: 3, reps: 12, type: 'bodyweight' },
      { name: 'Pull-up', sets: 3, reps: 6, type: 'bodyweight' },
      { name: 'Bodyweight Squat', sets: 3, reps: 15, type: 'bodyweight' },
      { name: 'Plank', sets: 3, reps: 30, type: 'bodyweight' },
    ],
  },
];

const exerciseLibrary = [
  'Bench Press',
  'Incline Dumbbell Press',
  'Overhead Press',
  'Dumbbell Shoulder Press',
  'Lateral Raise',
  'Front Raise',
  'Push-up',
  'Pull-up',
  'Lat Pulldown',
  'Seated Cable Row',
  'Chest Supported Row',
  'Single-Arm Row',
  'Barbell Row',
  'Deadlift',
  'Romanian Deadlift',
  'Back Squat',
  'Front Squat',
  'Goblet Squat',
  'Leg Press',
  'Walking Lunge',
  'Bulgarian Split Squat',
  'Hip Thrust',
  'Barbell Hip Thrust',
  'Glute Bridge',
  'Cable Kickback',
  'Standing Calf Raise',
  'Seated Calf Raise',
  'Tibialis Raise',
  'Plank',
  'Face Pull',
  'Biceps Curl',
  'Hammer Curl',
  'Triceps Pushdown',
  'Triceps Pulldown',
  'Triceps Overhead Extension',
  'Cable Fly',
  'Dips',
  'Farmer Carry'
];

// StrengthProgressTab manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
const StrengthProgressTab = ({ userId }) => {
  const navigate = useNavigate();
  const [view, setView] = useState('log');
  const [banner, setBanner] = useState(null);
  const [profile, setProfile] = useState(null);

  const [personalRecords, setPersonalRecords] = useState({});
  const [recentLifts, setRecentLifts] = useState([]);

  const [programs, setPrograms] = useState([]);
  const [programSearch, setProgramSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [showProgramLibrary, setShowProgramLibrary] = useState(true);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [isProgramSaving, setIsProgramSaving] = useState(false);
  const [newProgram, setNewProgram] = useState({
    name: '',
    level: 'Beginner',
    focus: 'Full Body',
    description: '',
    exercises: [
      { name: '', sets: 3, reps: 10, type: 'weights' }
    ]
  });
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorResults, setCreatorResults] = useState([]);
  const [creatorFocusedIndex, setCreatorFocusedIndex] = useState(0);

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapMode, setSwapMode] = useState('swap');
  const [swapIndex, setSwapIndex] = useState(null);
  const [swapQuery, setSwapQuery] = useState('');
  const [swapResults, setSwapResults] = useState([]);
  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const weightExercises = [
    { value: 'squat', label: 'Squat', icon: '' },
    { value: 'bench_press', label: 'Bench Press', icon: '' },
    { value: 'deadlift', label: 'Deadlift', icon: '' },
    { value: 'overhead_press', label: 'Overhead Press', icon: '' },
    { value: 'barbell_row', label: 'Barbell Row', icon: '' },
  ];

  const bodyweightExercises = [
    { value: 'pushups', label: 'Push-ups', icon: '' },
    { value: 'pullups', label: 'Pull-ups', icon: '' },
    { value: 'squats', label: 'Bodyweight Squats', icon: '' },
    { value: 'plank', label: 'Plank', icon: '' },
    { value: 'lunges', label: 'Lunges', icon: '' },
  ];

// normalizeQuery manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const normalizeQuery = (value) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

// searchLocalExercises manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const searchLocalExercises = (query) => {
    const cleaned = normalizeQuery(query);
    if (!cleaned) return [];
    return exerciseLibrary
      .filter(name => normalizeQuery(name).includes(cleaned))
      .slice(0, 12);
  };

// saveFavorites manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const saveFavorites = (items) => {
    setFavorites(items);
    localStorage.setItem('exervia_favorite_exercises', JSON.stringify(items));
  };

// toggleFavorite manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const toggleFavorite = (name) => {
    const normalized = name.trim();
    if (!normalized) return;
    if (favorites.includes(normalized)) {
      saveFavorites(favorites.filter(item => item !== normalized));
    } else {
      saveFavorites([...favorites, normalized]);
    }
  };

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (!banner) return undefined;
    const timeout = setTimeout(() => setBanner(null), 3200);
    // Render
    return () => clearTimeout(timeout);
  }, [banner]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('companion_hint', {
        detail: { text: 'Strength Studio: pick a program or log a lift.' }
      })
    );
  }, []);

// mapSupabaseProgram manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const mapSupabaseProgram = (program, source) => ({
    id: program.id || program.slug || program.name,
    name: program.name,
    level: program.level || 'All levels',
    focus: program.focus || 'Mixed',
    description: program.description || 'Curated routine',
    exercises: Array.isArray(program.exercises)
      ? program.exercises
      : [],
    source
  });

// fetchProfile manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchProfile = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  };

// fetchPrograms manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchPrograms = async () => {
    const collected = fallbackPrograms.map(program => ({ ...program, source: 'fallback' }));
    const { data: templateData } = await supabase
      .from('program_templates')
      .select('*')
      .limit(30);

    if (templateData && templateData.length > 0) {
      templateData.forEach(template => collected.unshift(mapSupabaseProgram(template, 'template')));
    }

    const { data: userProgramData } = await supabase
      .from('user_programs')
      .select('*')
      .eq('user_id', userId)
      .limit(20);

    if (userProgramData && userProgramData.length > 0) {
      userProgramData.forEach(program => collected.unshift(mapSupabaseProgram(program, 'user')));
    }

    setPrograms(collected);
  };

// handleSelectProgram manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleSelectProgram = (program) => {
    setSelectedProgram(program);
    setSessionQueue(program.exercises || []);
    setShowProgramLibrary(false);
  };

// closeSwap manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const closeSwap = () => {
    setSwapOpen(false);
    setSwapIndex(null);
    setSwapQuery('');
    setSwapResults([]);
  };

// fetchExerciseSearch manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchExerciseSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setSwapResults([]);
      return;
    }

    const localMatches = searchLocalExercises(query).map(name => ({
      name,
      type: 'weights',
      sets: sessionQueue[swapIndex]?.sets || 3,
      reps: sessionQueue[swapIndex]?.reps || 10,
    }));
    setSwapResults(localMatches);

    setIsSwapLoading(true);
    try {
      const response = await fetch(
        `https://wger.de/api/v2/exerciseinfo/?language=2&limit=20&name=${encodeURIComponent(query)}`
      );
      const payload = await response.json();
// remoteResults manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
      const remoteResults = (payload.results || [])
        .map(item => item.name)
        .filter(Boolean)
        .map(name => ({
          name,
          type: 'weights',
          sets: sessionQueue[swapIndex]?.sets || 3,
          reps: sessionQueue[swapIndex]?.reps || 10,
        }));
      const merged = [...localMatches, ...remoteResults].filter(
        (item, index, arr) => arr.findIndex(other => other.name === item.name) === index
      );
      setSwapResults(merged.length > 0 ? merged : localMatches);
    } catch (error) {
      console.error('Exercise search failed:', error);
      setSwapResults(localMatches);
    }
    setIsSwapLoading(false);
  };

// fetchCreatorSearch manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchCreatorSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setCreatorResults([]);
      return;
    }

    try {
      const localMatches = searchLocalExercises(query).map(name => ({
        name,
        type: 'weights',
        sets: newProgram.exercises[creatorFocusedIndex]?.sets || 3,
        reps: newProgram.exercises[creatorFocusedIndex]?.reps || 10,
      }));
      setCreatorResults(localMatches);
      const response = await fetch(
        `https://wger.de/api/v2/exerciseinfo/?language=2&limit=20&name=${encodeURIComponent(query)}`
      );
      const payload = await response.json();
// remoteResults manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
      const remoteResults = (payload.results || [])
        .map(item => item.name)
        .filter(Boolean)
        .map(name => ({
          name,
          type: 'weights',
          sets: newProgram.exercises[creatorFocusedIndex]?.sets || 3,
          reps: newProgram.exercises[creatorFocusedIndex]?.reps || 10,
        }));
      const merged = [...localMatches, ...remoteResults].filter(
        (item, index, arr) => arr.findIndex(other => other.name === item.name) === index
      );
      setCreatorResults(merged.length > 0 ? merged : localMatches);
    } catch (error) {
      console.error('Creator exercise search failed:', error);
      setCreatorResults(searchLocalExercises(query).map(name => ({
        name,
        type: 'weights',
        sets: newProgram.exercises[creatorFocusedIndex]?.sets || 3,
        reps: newProgram.exercises[creatorFocusedIndex]?.reps || 10,
      })));
    }
  };

// handleSwapSelect manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleSwapSelect = (exercise) => {
    if (swapMode === 'add') {
      const nextQueue = [...sessionQueue, exercise];
      setSessionQueue(nextQueue);
      closeSwap();
      return;
    }

    if (swapIndex === null) return;
    const nextQueue = [...sessionQueue];
    nextQueue[swapIndex] = exercise;
    setSessionQueue(nextQueue);
    closeSwap();
  };


// fetchPersonalRecords manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
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

// fetchRecentLifts manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchRecentLifts = async () => {
    const { data, error } = await supabase
      .from('strength_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4);

    if (!error && data) {
      setRecentLifts(data);
    }
  };

// getExerciseLabel manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const getExerciseLabel = (exerciseName) => {
    const allExercises = [...weightExercises, ...bodyweightExercises];
    return allExercises.find(e => e.value === exerciseName)?.label || exerciseName;
  };

// getExerciseIcon manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const getExerciseIcon = (exerciseName, exerciseType) => {
    const list = exerciseType === 'bodyweight' ? bodyweightExercises : weightExercises;
    return list.find(e => e.value === exerciseName)?.icon || '';
  };

  const prList = Object.values(personalRecords).sort((a, b) => {
    const aScore = a.one_rm_est || 0;
    const bScore = b.one_rm_est || 0;
    return bScore - aScore;
  });
  const topPrs = prList.slice(0, 2);
  const bestLift = recentLifts.reduce((best, lift) => {
    const reps = Number(lift.reps) || 0;
    const sets = Number(lift.sets) || 0;
    const weight = Number(lift.weight) || 0;
    const score = weight > 0 ? weight * reps * sets : reps * sets;
    if (!best || score > best.score) {
      return { lift, score };
    }
    return best;
  }, null);

  const filteredPrograms = programs.filter(program => {
    const query = programSearch.toLowerCase();
    return (
      program.name.toLowerCase().includes(query) ||
      (program.focus || '').toLowerCase().includes(query) ||
      (program.description || '').toLowerCase().includes(query)
    );
  });
  const visiblePrograms = showAllPrograms ? filteredPrograms : filteredPrograms.slice(0, 6);

// scoreProgram manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const scoreProgram = (program) => {
    let score = 0;
    if (!profile) return score;
// level manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const level = (program.level || '').toLowerCase();
// focus manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const focus = (program.focus || '').toLowerCase();
// goal manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const goal = (profile.primary_goal || '').toLowerCase();
// fitnessLevel manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const fitnessLevel = (profile.fitness_level || '').toLowerCase();

    if (level.includes(fitnessLevel)) score += 2;
    if (goal.includes('muscle') && (focus.includes('push') || focus.includes('upper') || focus.includes('lower'))) {
      score += 2;
    }
    if (goal.includes('weight') && (focus.includes('full') || focus.includes('conditioning'))) {
      score += 2;
    }
    if (goal.includes('endurance') && (focus.includes('full') || focus.includes('bodyweight'))) {
      score += 2;
    }
    if (goal.includes('fitness') && focus.includes('full')) score += 1;

    if (recentLifts.length > 0) {
      const recentTypes = new Set(recentLifts.map(lift => lift.exercise_type));
      if (recentTypes.has('bodyweight') && focus.includes('bodyweight')) score += 1;
      if (recentTypes.has('weights') && (focus.includes('push') || focus.includes('pull') || focus.includes('lower') || focus.includes('upper'))) {
        score += 1;
      }
    }

    return score;
  };

  const recommendedPrograms = [...programs]
    .sort((a, b) => scoreProgram(b) - scoreProgram(a))
    .slice(0, 3);

// updateNewExercise manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const updateNewExercise = (index, field, value) => {
    const next = [...newProgram.exercises];
    next[index] = { ...next[index], [field]: value };
    setNewProgram(prev => ({ ...prev, exercises: next }));
  };

// addNewExercise manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const addNewExercise = () => {
    setNewProgram(prev => ({
      ...prev,
      exercises: [...prev.exercises, { name: '', sets: 3, reps: 10, type: 'weights' }]
    }));
  };

// removeNewExercise manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const removeNewExercise = (index) => {
    setNewProgram(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, idx) => idx !== index)
    }));
  };

// saveNewProgram manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const saveNewProgram = async () => {
    if (!newProgram.name.trim()) {
      setBanner({ type: 'warn', message: 'Add a program name to continue.' });
      return;
    }
    const cleanedExercises = newProgram.exercises
      .map(ex => ({
        name: ex.name.trim(),
        sets: Number(ex.sets) || 3,
        reps: Number(ex.reps) || 10,
        type: ex.type || 'weights'
      }))
      .filter(ex => ex.name.length > 0);

    if (cleanedExercises.length === 0) {
      setBanner({ type: 'warn', message: 'Add at least one exercise.' });
      return;
    }

    setIsProgramSaving(true);
    const { error } = await supabase.from('user_programs').insert([{
      user_id: userId,
      name: newProgram.name.trim(),
      level: newProgram.level,
      focus: newProgram.focus,
      description: newProgram.description.trim(),
      exercises: cleanedExercises
    }]);

    if (!error) {
      setBanner({ type: 'success', message: 'Program saved to your library.' });
      setShowCreateProgram(false);
      setNewProgram({
        name: '',
        level: 'Beginner',
        focus: 'Full Body',
        description: '',
        exercises: [{ name: '', sets: 3, reps: 10, type: 'weights' }]
      });
      fetchPrograms();
    } else {
      console.error('Error saving program:', error);
      setBanner({ type: 'error', message: 'Could not save program.' });
    }
    setIsProgramSaving(false);
  };

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchPersonalRecords();
      fetchRecentLifts();
      fetchPrograms();
    }
  }, [userId]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    const stored = localStorage.getItem('exervia_favorite_exercises');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setFavorites(parsed);
      } catch (error) {
        console.error('Failed to parse favorites', error);
      }
    }
  }, []);

  return (
    <div className="studio-shell">
      <div className="studio-wrap">
        {/* Header section */}
        {/* Layout grouping for readability. */}
        {/* Interactive elements live inside this block. */}
        {/* This is a structural UI container. */}
        <header className="studio-header">
          <div>
            <button
              className="studio-back"
              onClick={() => {
                if (userId) {
                  navigate(`/gym/${userId}`);
                } else {
                  navigate(-1);
                }
              }}
              type="button"
            >
              {'<- Back'}
            </button>
            <div className="studio-kicker">STRENGTH STUDIO</div>
            <h2 className="studio-title">Progress Ritual</h2>
            <p className="studio-subtitle">Less noise. More intent. Every set matters.</p>
          </div>
          <div className="studio-toggle">
            <button
              onClick={() => setView('log')}
              className={`studio-toggle-btn ${view === 'log' ? 'active' : ''}`}
            >
              Log
            </button>
            <button
              onClick={() => setView('story')}
              className={`studio-toggle-btn ${view === 'story' ? 'active' : ''}`}
            >
              Story
            </button>
          </div>
        </header>

        {banner && (
          <div className={`studio-banner ${banner.type}`}>
            {banner.message}
          </div>
        )}

        {view === 'log' ? (
          <div className="studio-grid">
            {/* Section block */}
            {/* Layout grouping for readability. */}
            {/* Interactive elements live inside this block. */}
            {/* This is a structural UI container. */}
            <section className="studio-panel studio-reveal">
              <div className="studio-panel-row">
              <div className="studio-panel-title">Program Library</div>
              <button
                className="studio-mini-btn ghost"
                onClick={() => setShowProgramLibrary((prev) => !prev)}
                type="button"
              >
                {showProgramLibrary ? 'Collapse list' : 'Show programs'}
              </button>
              <button
                className="studio-mini-btn"
                onClick={() => {
                    setNewProgram({
                      name: '',
                      level: 'Beginner',
                      focus: 'Full Body',
                      description: '',
                      exercises: [{ name: '', sets: 3, reps: 10, type: 'weights' }]
                    });
                    setShowCreateProgram(true);
                  }}
                  type="button"
                >
                  Create program
                </button>
              </div>
              {showProgramLibrary ? (
                <>
                  <input
                    className="studio-search"
                    placeholder="Search programs"
                    value={programSearch}
                    onChange={(event) => setProgramSearch(event.target.value)}
                  />
                  {recommendedPrograms.length > 0 && (
                    <>
                      <div className="studio-panel-title">Recommended</div>
                      <div className="studio-program-grid">
                        {recommendedPrograms.map((program) => (
                          <button
                            key={program.id}
                            className="studio-program-card"
                            onClick={() => handleSelectProgram(program)}
                            type="button"
                          >
                            <div className="studio-program-title">{program.name}</div>
                            <div className="studio-program-sub">{program.focus || 'Strength'}</div>
                            <div className="studio-program-meta">{program.level || 'All levels'}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="studio-panel-row">
                    <div className="studio-panel-title">All Programs</div>
                    {filteredPrograms.length > 6 && (
                      <button
                        className="studio-mini-btn"
                        onClick={() => setShowAllPrograms((prev) => !prev)}
                        type="button"
                      >
                        {showAllPrograms ? 'Collapse list' : 'Show all'}
                      </button>
                    )}
                  </div>
                  {filteredPrograms.length > 0 ? (
                    <div className="studio-program-grid">
                      {visiblePrograms.map((program) => (
                        <button
                          key={program.id}
                          className={`studio-program-card ${selectedProgram?.id === program.id ? 'active' : ''}`}
                          onClick={() => handleSelectProgram(program)}
                          type="button"
                        >
                          <div className="studio-program-title">{program.name}</div>
                          <div className="studio-program-sub">{program.focus || 'Strength'}</div>
                          <div className="studio-program-meta">{program.level || 'All levels'}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="studio-empty">No programs yet.</div>
                  )}
                </>
              ) : (
                <div className="studio-empty">Program list collapsed to reduce scroll.</div>
              )}
            </section>

            {/* Section block */}
            {/* Layout grouping for readability. */}
            {/* Interactive elements live inside this block. */}
            {/* This is a structural UI container. */}
            <section className="studio-panel studio-reveal">
              <div className="studio-panel-row">
                <div className="studio-panel-title">Session Preview</div>
                {selectedProgram && (
                  <button
                    className="studio-mini-btn ghost"
                    onClick={() => {
                      setSelectedProgram(null);
                      setSessionQueue([]);
                      setShowProgramLibrary(true);
                    }}
                    type="button"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              {selectedProgram ? (
                <>
                  <div className="studio-plan-preview">
                    <div className="studio-plan-preview-title">{selectedProgram.name}</div>
                    <div className="studio-plan-preview-sub">
                      {selectedProgram.description || selectedProgram.goal || 'Custom strength flow'}
                    </div>
                    <div className="studio-plan-preview-list">
                      {(selectedProgram.exercises || []).slice(0, 3).map((exercise, index) => (
                        <div key={`${exercise.name}-${index}`} className="studio-plan-preview-row">
                          <span>{exercise.name}</span>
                          <span>{exercise.sets} x {exercise.reps}</span>
                        </div>
                      ))}
                      {(selectedProgram.exercises || []).length > 3 && (
                        <div className="studio-plan-preview-more">
                          + {(selectedProgram.exercises || []).length - 3} more exercises
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className="studio-queue-btn"
                    onClick={() =>
                      navigate(`/gym/${userId}/program/${selectedProgram.id}`, {
                        state: {
                          program: {
                            id: selectedProgram.id,
                            name: selectedProgram.name,
                            focus: selectedProgram.goal || selectedProgram.description || 'Strength session',
                            duration: selectedProgram.duration || '45 min',
                            exercises: selectedProgram.exercises || []
                          }
                        }
                      })
                    }
                    type="button"
                  >
                    Open session queue
                  </button>
                  <div className="studio-panel-title" style={{ marginTop: 16 }}>
                    Recent Lifts
                  </div>
                  {recentLifts.length > 0 ? (
                    <div className="studio-recent-list">
                      {recentLifts.slice(0, 2).map((lift) => (
                        <div
                          key={lift.id}
                          className={`studio-recent-row ${lift.is_personal_best ? 'pr' : ''}`}
                        >
                          <div className="studio-recent-main">
                            <div className="studio-recent-title">
                              {getExerciseIcon(lift.exercise_name, lift.exercise_type) && (
                                <span className="studio-recent-icon">
                                  {getExerciseIcon(lift.exercise_name, lift.exercise_type)}
                                </span>
                              )}
                              {getExerciseLabel(lift.exercise_name)}
                            </div>
                            <div className="studio-recent-sub">
                              {lift.reps} reps
                              {lift.weight > 0 ? ` · ${lift.weight}kg` : ''}
                              · {lift.sets} sets · {lift.mood_emoji}
                            </div>
                          </div>
                          <div className="studio-recent-meta">
                            {new Date(lift.created_at).toLocaleDateString()}
                            {lift.is_personal_best && <span className="studio-recent-badge">PR</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="studio-empty">No lifts logged yet. Start with one clean set.</div>
                  )}
                </>
              ) : (
                <div className="studio-empty">Select a program to preview the session.</div>
              )}
            </section>
          </div>
        ) : (
          <div className="studio-story">
            {/* Section block */}
            {/* Layout grouping for readability. */}
            {/* Interactive elements live inside this block. */}
            {/* This is a structural UI container. */}
            <section className="studio-panel studio-reveal">
              <div className="studio-panel-title">Personal Records</div>
              {prList.length > 0 ? (
                <div className="studio-pr-grid">
                  {prList.slice(0, 4).map((pr) => (
                    <div key={pr.id} className="studio-pr-card">
                      <div className="studio-pr-top">
                        <div className="studio-pr-title">{getExerciseLabel(pr.exercise_name)}</div>
                        {getExerciseIcon(pr.exercise_name, pr.exercise_type) && (
                          <div className="studio-pr-icon">{getExerciseIcon(pr.exercise_name, pr.exercise_type)}</div>
                        )}
                      </div>
                      <div className="studio-pr-value">
                        {pr.weight > 0 ? `${pr.weight}kg × ` : ''}{pr.reps}
                      </div>
                      <div className="studio-pr-sub">
                        {pr.one_rm_est ? `${pr.one_rm_est.toFixed(1)}kg est. 1RM` : 'Personal best'}
                      </div>
                      <div className="studio-pr-date">
                        {new Date(pr.achieved_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="studio-empty">
                  No records yet. Your first lift starts the story.
                </div>
              )}
            </section>

            {/* Section block */}
            {/* Layout grouping for readability. */}
            {/* Interactive elements live inside this block. */}
            {/* This is a structural UI container. */}
            <section className="studio-panel studio-reveal">
              <div className="studio-panel-title">Weekly Highlights</div>
              {topPrs.length > 0 || bestLift ? (
                <div className="studio-pr-grid">
                  {topPrs.map((pr) => (
                    <div key={`highlight-${pr.id}`} className="studio-pr-card">
                      <div className="studio-pr-top">
                        <div className="studio-pr-title">{getExerciseLabel(pr.exercise_name)}</div>
                      </div>
                      <div className="studio-pr-value">
                        {pr.weight > 0 ? `${pr.weight}kg × ` : ''}{pr.reps}
                      </div>
                      <div className="studio-pr-sub">Top PR this week</div>
                      <div className="studio-pr-date">
                        {new Date(pr.achieved_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {bestLift && (
                    <div className="studio-pr-card">
                      <div className="studio-pr-top">
                        <div className="studio-pr-title">Best recent lift</div>
                      </div>
                      <div className="studio-pr-value">
                        {getExerciseLabel(bestLift.lift.exercise_name)}
                      </div>
                      <div className="studio-pr-sub">
                        {bestLift.lift.reps} reps
                        {bestLift.lift.weight > 0 ? ` · ${bestLift.lift.weight}kg` : ''}
                        · {bestLift.lift.sets} sets
                      </div>
                      <div className="studio-pr-date">
                        {new Date(bestLift.lift.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="studio-empty">No highlights yet. Your next lift creates one.</div>
              )}
            </section>

          </div>
        )}
      </div>

      {showCreateProgram && (
        <div className="studio-swap-backdrop">
          <div className="studio-swap-panel">
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Create Program</div>
                <div className="studio-swap-sub">Build your own template and save it.</div>
              </div>
              <button
                className="studio-swap-close"
                onClick={() => setShowCreateProgram(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="studio-swap-body">
              <div className="studio-form-grid">
                <label className="studio-form-field">
                  <span className="studio-input-label">Program name</span>
                  <input
                    className="studio-search"
                    placeholder="Classic Pull Day"
                    value={newProgram.name}
                    onChange={(event) => setNewProgram(prev => ({ ...prev, name: event.target.value }))}
                  />
                </label>
                <label className="studio-form-field">
                  <span className="studio-input-label">Level</span>
                  <select
                    className="studio-select"
                    value={newProgram.level}
                    onChange={(event) => setNewProgram(prev => ({ ...prev, level: event.target.value }))}
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </label>
                <label className="studio-form-field">
                  <span className="studio-input-label">Focus</span>
                  <select
                    className="studio-select"
                    value={newProgram.focus}
                    onChange={(event) => setNewProgram(prev => ({ ...prev, focus: event.target.value }))}
                  >
                    <option>Full Body</option>
                    <option>Upper Body</option>
                    <option>Lower Body</option>
                    <option>Push</option>
                    <option>Pull</option>
                    <option>Glutes</option>
                    <option>Bodyweight</option>
                    <option>Conditioning</option>
                  </select>
                </label>
              </div>

              <label className="studio-form-field">
                <span className="studio-input-label">Description</span>
                <textarea
                  className="studio-textarea"
                  placeholder="Short ritual description"
                  value={newProgram.description}
                  onChange={(event) => setNewProgram(prev => ({ ...prev, description: event.target.value }))}
                />
              </label>

              <div className="studio-panel-title">Exercises</div>
              <div className="studio-create-search">
                {favorites.length > 0 && (
                  <div className="studio-pinned">
                    <div className="studio-panel-title">Pinned Favorites</div>
                    <div className="studio-favorite-row">
                      {favorites.map(item => (
                        <button
                          key={`creator-fav-${item}`}
                          className="studio-favorite-chip"
                          onClick={() => {
                            updateNewExercise(creatorFocusedIndex, 'name', item);
                            updateNewExercise(creatorFocusedIndex, 'type', 'weights');
                          }}
                          type="button"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <input
                  className="studio-search"
                  placeholder="Search exercise library"
                  value={creatorSearch}
                  onChange={(event) => {
                    const next = event.target.value;
                    setCreatorSearch(next);
                    fetchCreatorSearch(next);
                  }}
                />
                {creatorResults.length > 0 && (
                  <div className="studio-creator-results">
                    {creatorResults.map(result => (
                      <div
                        key={`creator-${result.name}`}
                        className="studio-swap-result"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          updateNewExercise(creatorFocusedIndex, 'name', result.name);
                          updateNewExercise(creatorFocusedIndex, 'type', result.type);
                          setCreatorResults([]);
                          setCreatorSearch('');
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            updateNewExercise(creatorFocusedIndex, 'name', result.name);
                            updateNewExercise(creatorFocusedIndex, 'type', result.type);
                            setCreatorResults([]);
                            setCreatorSearch('');
                          }
                        }}
                      >
                        <div className="studio-swap-name">{result.name}</div>
                        <div className="studio-swap-meta">{result.sets} sets · {result.reps} reps</div>
                        <div className="studio-swap-actions">
                          <button
                            className={`studio-queue-swap ${favorites.includes(result.name) ? 'active' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavorite(result.name);
                            }}
                            type="button"
                          >
                            {favorites.includes(result.name) ? 'Pinned' : 'Pin'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="studio-create-list">
                {newProgram.exercises.map((exercise, index) => (
                  <div key={`new-ex-${index}`} className="studio-create-row">
                    <input
                      className="studio-create-name"
                      placeholder="Exercise name"
                      value={exercise.name}
                      onFocus={() => setCreatorFocusedIndex(index)}
                      onChange={(event) => updateNewExercise(index, 'name', event.target.value)}
                    />
                    <input
                      className="studio-create-mini"
                      type="number"
                      min="1"
                      value={exercise.sets}
                      onChange={(event) => updateNewExercise(index, 'sets', event.target.value)}
                    />
                    <input
                      className="studio-create-mini"
                      type="number"
                      min="1"
                      value={exercise.reps}
                      onChange={(event) => updateNewExercise(index, 'reps', event.target.value)}
                    />
                    <select
                      className="studio-create-mini"
                      value={exercise.type}
                      onChange={(event) => updateNewExercise(index, 'type', event.target.value)}
                    >
                      <option value="weights">Weights</option>
                      <option value="bodyweight">Bodyweight</option>
                    </select>
                    <div className="studio-create-order">
                      <button
                        className="studio-order-btn"
                        onClick={() => {
                          if (index === 0) return;
                          const next = [...newProgram.exercises];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          setNewProgram(prev => ({ ...prev, exercises: next }));
                        }}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        className="studio-order-btn"
                        onClick={() => {
                          if (index === newProgram.exercises.length - 1) return;
                          const next = [...newProgram.exercises];
                          [next[index + 1], next[index]] = [next[index], next[index + 1]];
                          setNewProgram(prev => ({ ...prev, exercises: next }));
                        }}
                        type="button"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      className="studio-remove-btn"
                      onClick={() => removeNewExercise(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="studio-create-actions">
                <button className="studio-queue-btn ghost" onClick={addNewExercise} type="button">
                  Add exercise
                </button>
                <button
                  className="studio-queue-btn"
                  onClick={saveNewProgram}
                  type="button"
                  disabled={isProgramSaving}
                >
                  {isProgramSaving ? 'Saving...' : 'Save program'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {swapOpen && (
        <div className="studio-swap-backdrop">
          <div className="studio-swap-panel">
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">
                  {swapMode === 'add' ? 'Add Exercise' : 'Swap Exercise'}
                </div>
                <div className="studio-swap-sub">
                  {swapMode === 'add'
                    ? 'Search the library and add it to your session.'
                    : 'Search the library and replace this slot.'}
                </div>
              </div>
              <button className="studio-swap-close" onClick={closeSwap} type="button">
                Close
              </button>
            </div>
            <div className="studio-swap-body">
              {favorites.length > 0 && (
                <div className="studio-pinned">
                  <div className="studio-panel-title">Pinned Favorites</div>
                  <div className="studio-favorite-row">
                    {favorites.map(item => (
                      <button
                        key={`swap-fav-${item}`}
                        className="studio-favorite-chip"
                        onClick={() => handleSwapSelect({
                          name: item,
                          type: 'weights',
                          sets: sessionQueue[swapIndex]?.sets || 3,
                          reps: sessionQueue[swapIndex]?.reps || 10,
                        })}
                        type="button"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                className="studio-search"
                placeholder="Search exercises"
                value={swapQuery}
                onChange={(event) => {
                  const next = event.target.value;
                  setSwapQuery(next);
                  fetchExerciseSearch(next);
                }}
              />
              {isSwapLoading ? (
                <div className="studio-empty">Searching...</div>
              ) : (
                <div className="studio-swap-results">
                  {swapResults.length > 0 ? (
                    swapResults.map(result => (
                      <div
                        key={result.name}
                        className="studio-swap-result"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSwapSelect(result)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            handleSwapSelect(result);
                          }
                        }}
                      >
                        <div className="studio-swap-name">{result.name}</div>
                        <div className="studio-swap-meta">
                          {result.sets} sets · {result.reps} reps
                        </div>
                        <div className="studio-swap-actions">
                          <button
                            className={`studio-queue-swap ${favorites.includes(result.name) ? 'active' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavorite(result.name);
                            }}
                            type="button"
                          >
                            {favorites.includes(result.name) ? 'Pinned' : 'Pin'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="studio-empty">No results yet. Try another search.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrengthProgressTab;