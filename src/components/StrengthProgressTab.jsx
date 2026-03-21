// src/components/StrengthProgressTab.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emitToast } from '../utils/toast';
import exerciseGuideDefaults from '../data/exerciseGuides.json';
import PageWalkthroughModal from './PageWalkthroughModal';
// adapted from https://supabase.com/docs/guides/getting-started/tutorials/with-react
// this imports the Supabase client instance which was created in supabaseClient.js
import { supabase } from '../supabaseClient';
// Component: StrengthProgressTab - UI layout and interactions.
// This component renders the strengthprogresstab experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the strength progress tab which is a key part of the gym mode experience
// it shows users their progress in the gym mode and 
// allows them to track their strength gains over time
// the UI layout and styling was adapted from Tailwind card components 
// found on https://tailwindui.com/preview
// the data fetching and state management logic w
// as adapted from the patterns I learned in the SystemStatus and Navbar components

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
  'Flat Dumbbell Bench Press',
  'Incline Barbell Bench Press',
  'Decline Bench Press',
  'Decline Dumbbell Press',
  'Pec Deck',
  'Push-up (Feet Elevated)',
  'Svend Press',
  'Guillotine Press',
  'Overhead Press',
  'Dumbbell Shoulder Press',
  'Arnold Press',
  'Upright Row',
  'Cable Lateral Raise',
  'Rear Delt Fly (Dumbbell)',
  'Reverse Pec Deck',
  'Cuban Press',
  'Bradford Press',
  'Machine Shoulder Press',
  'Lateral Raise',
  'Front Raise',
  'Push-up',
  'Pull up',
  'Assisted Pull-up',
  'Chin-up',
  'Neutral-Grip Pull-up',
  'Lat Pulldown',
  'Straight-Arm Pulldown',
  'Seated Cable Row',
  'Chest Supported Row',
  'Single-Arm Row',
  'T Bar Row',
  'Pendlay Row',
  'Meadows Row',
  'Inverted Row',
  'Machine Row',
  'Rack Pull',
  'Barbell Row',
  'Deadlift',
  'Romanian Deadlift',
  'Good Morning',
  'Single Leg Romanian Deadlift',
  'Back Squat',
  'Front Squat',
  'Goblet Squat',
  'Hack Squat',
  'Smith Machine Squat',
  'Step Ups',
  'Reverse Lunge',
  'Curtsy Lunge',
  'Sissy Squat',
  'Box Squat',
  'Cyclist Squat',
  'Leg Press',
  'Leg Extension',
  'Walking Lunge',
  'Bulgarian Split Squat',
  'Lying Leg Curl',
  'Seated Leg Curl',
  'Nordic Hamstring Curl',
  'Glute-Ham Raise',
  'Hip Thrust',
  'Barbell Hip Thrust',
  'Glute Bridge',
  'Cable Kickback',
  'Standing Calf Raise',
  'Seated Calf Raise',
  'Donkey Calf Raise',
  'Single-Leg Calf Raise',
  'Calf Press (Leg Press)',
  'Tibialis Raise',
  'Plank',
  'Hanging Leg Raise',
  "Captain's Chair Leg Raise",
  'Cable Crunch',
  'Decline Sit-Up',
  'Ab Wheel Rollout',
  'Russian Twist',
  'Bicycle Crunch',
  'Dead Bug',
  'Pallof Press',
  'Face Pull',
  'Biceps Curl',
  'EZ-Bar Curl',
  'Preacher Curl',
  'Concentration Curl',
  'Incline Dumbbell Curl',
  'Cable Curl',
  'Spider Curl',
  'Reverse Curl',
  'Hammer Curl',
  'Triceps Pushdown',
  'Triceps Pulldown',
  'Triceps Overhead Extension',
  'Skull Crushers',
  'Close-Grip Bench Press',
  'Bench Dips',
  'Cable Overhead Triceps Extension',
  'JM Press',
  'Tate Press',
  'Cable Fly',
  'Dips',
  'Farmer Carry',
  'Sled Push',
  'Sled Pull',
  'Suitcase Carry',
  'Yoke Carry',
  'Kettlebell Swing',
  'Battle Ropes'
];

const exerciseGroups = {
  Chest: [
    'Bench Press',
    'Flat Dumbbell Bench Press',
    'Incline Dumbbell Press',
    'Incline Barbell Bench Press',
    'Decline Bench Press',
    'Decline Dumbbell Press',
    'Cable Fly',
    'Pec Deck',
    'Push-up',
    'Push-up (Feet Elevated)',
    'Svend Press',
    'Guillotine Press',
    'Dips'
  ],
  Back: [
    'Pull-up',
    'Assisted Pull-up',
    'Chin-up',
    'Neutral-Grip Pull-up',
    'Lat Pulldown',
    'Straight-Arm Pulldown',
    'Seated Cable Row',
    'Chest Supported Row',
    'Single-Arm Row',
    'Barbell Row',
    'T-Bar Row',
    'Pendlay Row',
    'Meadows Row',
    'Inverted Row',
    'Machine Row',
    'Rack Pull'
  ],
  Shoulders: [
    'Overhead Press',
    'Dumbbell Shoulder Press',
    'Arnold Press',
    'Machine Shoulder Press',
    'Lateral Raise',
    'Cable Lateral Raise',
    'Front Raise',
    'Rear Delt Fly (Dumbbell)',
    'Reverse Pec Deck',
    'Upright Row',
    'Cuban Press',
    'Bradford Press',
    'Face Pull'
  ],
  Biceps: [
    'Biceps Curl',
    'EZ-Bar Curl',
    'Preacher Curl',
    'Concentration Curl',
    'Incline Dumbbell Curl',
    'Cable Curl',
    'Spider Curl',
    'Reverse Curl',
    'Hammer Curl'
  ],
  Triceps: [
    'Triceps Pushdown',
    'Triceps Pulldown',
    'Triceps Overhead Extension',
    'Skull Crushers',
    'Close-Grip Bench Press',
    'Bench Dips',
    'Cable Overhead Triceps Extension',
    'JM Press',
    'Tate Press'
  ],
  'Legs - Quads & Glutes': [
    'Back Squat',
    'Front Squat',
    'Goblet Squat',
    'Hack Squat',
    'Smith Machine Squat',
    'Box Squat',
    'Cyclist Squat',
    'Leg Press',
    'Leg Extension',
    'Walking Lunge',
    'Reverse Lunge',
    'Curtsy Lunge',
    'Step-Ups',
    'Sissy Squat',
    'Bulgarian Split Squat',
    'Hip Thrust',
    'Barbell Hip Thrust',
    'Glute Bridge',
    'Cable Kickback'
  ],
  'Legs - Hamstrings': [
    'Deadlift',
    'Romanian Deadlift',
    'Single-Leg Romanian Deadlift',
    'Good Morning',
    'Lying Leg Curl',
    'Seated Leg Curl',
    'Nordic Hamstring Curl',
    'Glute-Ham Raise'
  ],
  Calves: [
    'Standing Calf Raise',
    'Seated Calf Raise',
    'Donkey Calf Raise',
    'Single-Leg Calf Raise',
    'Calf Press (Leg Press)',
    'Tibialis Raise'
  ],
  Core: [
    'Plank',
    'Hanging Leg Raise',
    "Captain's Chair Leg Raise",
    'Cable Crunch',
    'Decline Sit-Up',
    'Ab Wheel Rollout',
    'Russian Twist',
    'Bicycle Crunch',
    'Dead Bug',
    'Pallof Press'
  ],
  'Conditioning & Carries': [
    'Farmer Carry',
    'Suitcase Carry',
    'Yoke Carry',
    'Sled Push',
    'Sled Pull',
    'Kettlebell Swing',
    'Battle Ropes'
  ]
};

const REP_RANGE_OPTIONS = ['1-3', '4-6', '7-9', '10-12', '13-15', 'Failure'];
const WEIGHT_PICKER_OPTIONS = Array.from({ length: 121 }, (_, index) => {
  const value = Number((index * 2.5).toFixed(1));
  return Number.isInteger(value) ? String(value) : String(value);
});

const normalizeRepRange = (value) => {
  if (value === null || value === undefined) return '10-12';
  const raw = String(value).trim();
  if (!raw) return '10-12';
  if (/failure/i.test(raw)) return 'Failure';
  if (REP_RANGE_OPTIONS.includes(raw)) return raw;
  if (/^\d+$/.test(raw)) {
    const parsed = Number(raw);
    if (parsed <= 3) return '1-3';
    if (parsed <= 6) return '4-6';
    if (parsed <= 9) return '7-9';
    if (parsed <= 12) return '10-12';
    return '13-15';
  }
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const first = Number(range[1]);
    if (first <= 3) return '1-3';
    if (first <= 6) return '4-6';
    if (first <= 9) return '7-9';
    if (first <= 12) return '10-12';
    return '13-15';
  }
  return '10-12';
};

const toLiftDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WEIGHT_EXERCISES = [
  { value: 'squat', label: 'Squat', icon: '' },
  { value: 'bench_press', label: 'Bench Press', icon: '' },
  { value: 'deadlift', label: 'Deadlift', icon: '' },
  { value: 'overhead_press', label: 'Overhead Press', icon: '' },
  { value: 'barbell_row', label: 'Barbell Row', icon: '' },
];

const BODYWEIGHT_EXERCISES = [
  { value: 'pushups', label: 'Push-ups', icon: '' },
  { value: 'pullups', label: 'Pull-ups', icon: '' },
  { value: 'squats', label: 'Bodyweight Squats', icon: '' },
  { value: 'plank', label: 'Plank', icon: '' },
  { value: 'lunges', label: 'Lunges', icon: '' },
];

const EXERCISE_LABEL_BY_VALUE = [...WEIGHT_EXERCISES, ...BODYWEIGHT_EXERCISES].reduce((acc, entry) => {
  acc[entry.value] = entry.label;
  return acc;
}, {});

const PROGRESS_WALKTHROUGH_STEPS = [
  {
    id: 'pick_program',
    title: 'Pick a Workout Program',
    what: 'Use Program Library to choose a ready-made routine matched to your focus and level.',
    why: 'Starting from a structured plan keeps your logging consistent and measurable.',
    firstAction: 'Select one recommended program.',
  },
  {
    id: 'edit_program',
    title: 'Edit Existing Program',
    what: 'Use swap/add/remove controls to tailor exercises, sets, reps, and weights.',
    why: 'Small edits keep plans realistic so you stick to them.',
    firstAction: 'Swap one exercise in your selected program.',
  },
  {
    id: 'create_program',
    title: 'Create Your Own Program',
    what: 'Open Create program and build a custom structure from scratch.',
    why: 'Custom plans let you train exactly for your goal and equipment.',
    firstAction: 'Create a program with at least 4 exercises.',
  },
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
  const [statsBootLoading, setStatsBootLoading] = useState(false);

  const [programs, setPrograms] = useState([]);
  const [pinnedProgramIds, setPinnedProgramIds] = useState([]);
  const [programSearch, setProgramSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [showProgramLibrary, setShowProgramLibrary] = useState(true);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [lastWorkoutOpen, setLastWorkoutOpen] = useState(false);
  const [isProgramSaving, setIsProgramSaving] = useState(false);
  const [deletingProgramId, setDeletingProgramId] = useState(null);
  const [pendingProgramDelete, setPendingProgramDelete] = useState(null);
  const [newProgram, setNewProgram] = useState({
    name: '',
    level: 'Beginner',
    focus: 'Full Body',
    description: '',
    exercises: []
  });
  const [lastAddedExerciseIndex, setLastAddedExerciseIndex] = useState(null);
  const [creatorFeedback, setCreatorFeedback] = useState('');
  const lastAddedTimeoutRef = useRef(null);
  const lastRowTapRef = useRef({ index: null, time: 0 });
  const prVerificationRef = useRef(new Set());
  const swapSearchRequestRef = useRef(0);
  const creatorSearchRequestRef = useRef(0);
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorResults, setCreatorResults] = useState([]);
  const [creatorFocusedIndex, setCreatorFocusedIndex] = useState(0);

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapMode] = useState('swap');
  const [swapIndex, setSwapIndex] = useState(null);
  const [swapQuery, setSwapQuery] = useState('');
  const [swapResults, setSwapResults] = useState([]);
  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideExercise, setGuideExercise] = useState(null);
  const [guideDetails, setGuideDetails] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const pinnedProgramsStorageKey = userId ? `exervia_pinned_programs_${userId}` : null;
  const exerciseWeightsStorageKey = userId ? `exervia_exercise_weights_${userId}` : null;
  const [exerciseWeightMemory, setExerciseWeightMemory] = useState({});
  const [selectedStrengthTrendDay, setSelectedStrengthTrendDay] = useState('');
  const [selectedProgressExercise, setSelectedProgressExercise] = useState('');

  const handleWalkthroughAction = (step) => {
    const stepId = String(step?.id || '');
    if (stepId === 'create_program') {
      setShowCreateProgram(true);
      return;
    }
    if (stepId === 'pick_program' || stepId === 'edit_program') {
      setShowProgramLibrary(true);
    }
  };

// normalizeQuery manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const normalizeQuery = (value) => value.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

// getExerciseGuideDefaults manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const getExerciseGuideDefaults = (name) => {
    const key = name?.trim();
    return key ? exerciseGuideDefaults[key] || [] : [];
  };

// getExerciseTypeForName manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const getExerciseTypeForName = (name) => {
    const normalized = name?.toLowerCase() || '';
    if (normalized.includes('push-up') || normalized.includes('pull-up') || normalized.includes('chin-up')) {
      return 'bodyweight';
    }
    if ([
      'plank',
      'dead bug',
      'pallof press',
      'bicycle crunch',
      'russian twist',
      'ab wheel rollout',
      'hanging leg raise',
      "captain's chair leg raise",
      'decline sit-up',
      'cable crunch'
    ].includes(normalized)) {
      return 'bodyweight';
    }
    if (normalized.includes('carry') || normalized.includes('sled') || normalized.includes('battle ropes')) {
      return 'conditioning';
    }
    return 'weights';
  };

  const normalizeExerciseName = (value) => String(value || '').trim().toLowerCase();
  const getDefaultRestForType = (type) => {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'bodyweight') return '60s';
    if (normalized === 'conditioning') return '75s';
    return '90s';
  };
  const normalizeExerciseRest = (rest, type) => {
    const raw = String(rest || '').trim();
    if (!raw) return getDefaultRestForType(type);
    return raw;
  };
  const getSavedWeightForExercise = (name) => {
    const key = normalizeExerciseName(name);
    const remembered = Number(exerciseWeightMemory[key] || 0);
    return remembered > 0 ? remembered : '';
  };
  const saveExerciseWeightMemory = (nextMemory) => {
    setExerciseWeightMemory(nextMemory);
    if (exerciseWeightsStorageKey) {
      localStorage.setItem(exerciseWeightsStorageKey, JSON.stringify(nextMemory));
    }
  };

// buildExerciseTemplate manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const buildExerciseTemplate = (name, sets, reps) => ({
    name,
    type: getExerciseTypeForName(name),
    sets: sets || 3,
    reps: normalizeRepRange(reps || '10-12'),
    weight: getSavedWeightForExercise(name),
    rest: normalizeExerciseRest('', getExerciseTypeForName(name)),
  });


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

// saveFavorites manages a focused piece
// of logic,
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

// handleExerciseGuide manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleExerciseGuide = async (exercise) => {
    if (!exercise?.name) return;
    setGuideExercise(exercise);
    setGuideOpen(true);
    setGuideLoading(true);
    setGuideDetails(null);
    try {
      const response = await fetch(
        `https://wger.de/api/v2/exerciseinfo/?language=2&limit=1&name=${encodeURIComponent(exercise.name)}`
      );
      const data = await response.json();
      const result = data?.results?.[0];
      const description = result?.description
        ? result.description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        : '';
      const muscles = (result?.muscles || []).map((item) => item.name).filter(Boolean);
      const equipment = (result?.equipment || []).map((item) => item.name).filter(Boolean);
      const apiSteps = description
        ? description.split('.').map((part) => part.trim()).filter(Boolean).slice(0, 4)
        : [];
      const fallbackSteps = getExerciseGuideDefaults(exercise.name);
      const steps = apiSteps.length > 0 ? apiSteps : fallbackSteps;
      setGuideDetails({
        description,
        muscles,
        equipment,
        steps
      });
    } catch (error) {
      console.error('Guide fetch failed:', error);
    } finally {
      setGuideLoading(false);
    }
  };

  const guideHasCoachCues = useMemo(() => {
    if (!guideDetails || typeof guideDetails !== 'object') return false;
    if (Array.isArray(guideDetails.steps) && guideDetails.steps.length > 0) return true;
    if (String(guideDetails.description || '').trim()) return true;
    return false;
  }, [guideDetails]);

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

  useEffect(() => {
    if (!banner?.message) return;
    const type = banner.type === 'error' ? 'error' : banner.type || 'info';
    emitToast(String(banner.message), type, type === 'error' ? 3600 : 3200);
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

  useEffect(() => {
    return () => {
      if (lastAddedTimeoutRef.current) clearTimeout(lastAddedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!creatorFeedback) return undefined;
    const timeout = setTimeout(() => setCreatorFeedback(''), 1500);
    return () => clearTimeout(timeout);
  }, [creatorFeedback]);

  useEffect(() => {
    if (!userId) return () => {};
    const verifyPrForLog = async (lift) => {
      if (!lift?.id) return;
      const idempotencyKey = `pr:${lift.id}:user:${Number(userId)}`;
      if (prVerificationRef.current.has(idempotencyKey)) return;

      const { error } = await supabase.rpc('verify_pr_and_award_xp', {
        p_log_id: String(lift.id),
        p_user_id: Number(userId),
        p_exercise_name: String(lift.exercise_name || ''),
        p_weight: Number(lift.weight || 0),
        p_reps: Number(lift.reps || 0),
        p_sets: Number(lift.sets || 0),
        p_idempotency_key: idempotencyKey,
      });
      if (error) {
        console.error('verify_pr_and_award_xp failed:', error);
        return;
      }
      prVerificationRef.current.add(idempotencyKey);
      window.dispatchEvent(new Event('user_state_updated'));
    };

    const channel = supabase
      .channel(`strength-pr-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'strength_logs' },
        async (payload) => {
          const lift = payload?.new;
          if (!lift || Number(lift.user_id) !== Number(userId)) return;
          setRecentLifts((prev) => [lift, ...prev].slice(0, 120));
          await verifyPrForLog(lift);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!exerciseWeightsStorageKey) return;
    const stored = localStorage.getItem(exerciseWeightsStorageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        setExerciseWeightMemory(parsed);
      }
    } catch (error) {
      console.error('Failed to parse exercise weight memory', error);
    }
  }, [exerciseWeightsStorageKey]);

  useEffect(() => {
    if (!Object.keys(exerciseWeightMemory || {}).length) return;
    setPrograms((prev) =>
      prev.map((program) => mapSupabaseProgram(program, program.source || 'user'))
    );
  }, [exerciseWeightMemory]);

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
      ? program.exercises.map((exercise) => {
          const name = String(exercise?.name || '').trim();
          const resolvedType = exercise?.type || getExerciseTypeForName(name);
          const fallbackWeight = getSavedWeightForExercise(name);
          const parsedWeight = Number(exercise?.weight || 0);
          return {
            ...exercise,
            name,
            sets: Number(exercise?.sets) || 3,
            reps: normalizeRepRange(exercise?.reps),
            weight: parsedWeight > 0 ? parsedWeight : fallbackWeight
            ,
            type: resolvedType,
            rest: normalizeExerciseRest(exercise?.rest, resolvedType),
          };
        })
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
    const collected = fallbackPrograms.map(program => mapSupabaseProgram(program, 'fallback'));
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

  const savePinnedPrograms = (items) => {
    setPinnedProgramIds(items);
    if (pinnedProgramsStorageKey) {
      localStorage.setItem(pinnedProgramsStorageKey, JSON.stringify(items));
    }
  };

  const toggleProgramPin = (programId) => {
    if (!programId) return;
    if (pinnedProgramIds.includes(programId)) {
      savePinnedPrograms(pinnedProgramIds.filter((id) => id !== programId));
    } else {
      savePinnedPrograms([...pinnedProgramIds, programId]);
      setShowAllPrograms(false);
    }
  };

  const handleEditProgram = (program) => {
    if (!program) return;
    const remixedExercises = (program.exercises || []).map((exercise) => ({
      name: exercise.name || '',
      sets: Number(exercise.sets) || 3,
      reps: normalizeRepRange(exercise.reps),
      weight: Number(exercise.weight) > 0 ? Number(exercise.weight) : getSavedWeightForExercise(exercise.name),
      type: exercise.type || getExerciseTypeForName(exercise.name),
      rest: normalizeExerciseRest(exercise.rest, exercise.type || getExerciseTypeForName(exercise.name)),
    }));

    setNewProgram({
      name: `Edit - ${program.name || 'Custom Program'}`,
      level: program.level || 'Beginner',
      focus: program.focus || 'Full Body',
      description: program.description || '',
      exercises: remixedExercises
    });
    setCreatorSearch('');
    setCreatorResults([]);
    setCreatorFocusedIndex(0);
    setShowCreateProgram(true);
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

  const closeCreateProgramModal = () => {
    setShowCreateProgram(false);
    setCreatorSearch('');
    setCreatorResults([]);
  };

  const closeGuideModal = () => {
    setGuideOpen(false);
    setGuideDetails(null);
  };

  useEffect(() => {
    if (!showCreateProgram && !swapOpen && !guideOpen && !lastWorkoutOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (showCreateProgram) {
        closeCreateProgramModal();
        return;
      }
      if (swapOpen) {
        closeSwap();
        return;
      }
      if (guideOpen) {
        closeGuideModal();
        return;
      }
      if (lastWorkoutOpen) {
        setLastWorkoutOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [guideOpen, lastWorkoutOpen, showCreateProgram, swapOpen]);

// fetchExerciseSearch manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchExerciseSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      swapSearchRequestRef.current += 1;
      setSwapResults([]);
      setIsSwapLoading(false);
      return;
    }
    const requestId = swapSearchRequestRef.current + 1;
    swapSearchRequestRef.current = requestId;

    const localMatches = searchLocalExercises(query).map(name =>
      buildExerciseTemplate(
        name,
        sessionQueue[swapIndex]?.sets || 3,
        sessionQueue[swapIndex]?.reps || '10-12'
      )
    );
    setSwapResults(localMatches);

    setIsSwapLoading(true);
    try {
      const response = await fetch(
        `https://wger.de/api/v2/exerciseinfo/?language=2&limit=20&name=${encodeURIComponent(query)}`
      );
      const payload = await response.json();
      if (swapSearchRequestRef.current !== requestId) return;
// remoteResults manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
      const remoteResults = (payload.results || [])
        .map(item => item.name)
        .filter(Boolean)
        .map(name =>
          buildExerciseTemplate(
            name,
            sessionQueue[swapIndex]?.sets || 3,
            sessionQueue[swapIndex]?.reps || '10-12'
          )
        );
      const merged = [...localMatches, ...remoteResults].filter(
        (item, index, arr) => arr.findIndex(other => other.name === item.name) === index
      );
      setSwapResults(merged.length > 0 ? merged : localMatches);
    } catch (error) {
      if (swapSearchRequestRef.current !== requestId) return;
      console.error('Exercise search failed:', error);
      setSwapResults(localMatches);
    } finally {
      if (swapSearchRequestRef.current === requestId) {
        setIsSwapLoading(false);
      }
    }
  };

// fetchCreatorSearch manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchCreatorSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      creatorSearchRequestRef.current += 1;
      setCreatorResults([]);
      return;
    }
    const requestId = creatorSearchRequestRef.current + 1;
    creatorSearchRequestRef.current = requestId;

    try {
      const localMatches = searchLocalExercises(query).map(name =>
        buildExerciseTemplate(
          name,
          newProgram.exercises[creatorFocusedIndex]?.sets || 3,
          newProgram.exercises[creatorFocusedIndex]?.reps || '10-12'
        )
      );
      setCreatorResults(localMatches);
      const response = await fetch(
        `https://wger.de/api/v2/exerciseinfo/?language=2&limit=20&name=${encodeURIComponent(query)}`
      );
      const payload = await response.json();
      if (creatorSearchRequestRef.current !== requestId) return;
// remoteResults manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
      const remoteResults = (payload.results || [])
        .map(item => item.name)
        .filter(Boolean)
        .map(name =>
          buildExerciseTemplate(
            name,
            newProgram.exercises[creatorFocusedIndex]?.sets || 3,
            newProgram.exercises[creatorFocusedIndex]?.reps || '10-12'
          )
        );
      const merged = [...localMatches, ...remoteResults].filter(
        (item, index, arr) => arr.findIndex(other => other.name === item.name) === index
      );
      setCreatorResults(merged.length > 0 ? merged : localMatches);
    } catch (error) {
      if (creatorSearchRequestRef.current !== requestId) return;
      console.error('Creator exercise search failed:', error);
      setCreatorResults(searchLocalExercises(query).map(name =>
        buildExerciseTemplate(
          name,
          newProgram.exercises[creatorFocusedIndex]?.sets || 3,
          newProgram.exercises[creatorFocusedIndex]?.reps || '10-12'
        )
      ));
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
      .limit(60);

    if (!error && data) {
      setRecentLifts(data);
    }
  };

// getExerciseLabel manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const getExerciseLabel = (exerciseName) => EXERCISE_LABEL_BY_VALUE[exerciseName] || exerciseName;

// getExerciseIcon manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const getExerciseIcon = (exerciseName, exerciseType) => {
    const list = exerciseType === 'bodyweight' ? BODYWEIGHT_EXERCISES : WEIGHT_EXERCISES;
    return list.find(e => e.value === exerciseName)?.icon || '';
  };

  const prList = useMemo(
    () =>
      Object.values(personalRecords).sort((a, b) => {
        const aScore = a.one_rm_est || 0;
        const bScore = b.one_rm_est || 0;
        return bScore - aScore;
      }),
    [personalRecords]
  );
  const topPrs = useMemo(() => prList.slice(0, 2), [prList]);
  const bestLift = useMemo(
    () =>
      recentLifts.reduce((best, lift) => {
        const reps = Number(lift.reps) || 0;
        const sets = Number(lift.sets) || 0;
        const weight = Number(lift.weight) || 0;
        const score = weight > 0 ? weight * reps * sets : reps * sets;
        if (!best || score > best.score) {
          return { lift, score };
        }
        return best;
      }, null),
    [recentLifts]
  );
  const totalSessionsLogged = recentLifts.length;

  const latestWorkoutSummary = useMemo(() => {
    if (!recentLifts.length) return null;
    const latestDate = new Date(recentLifts[0]?.created_at || 0);
    if (Number.isNaN(latestDate.getTime())) return null;
    const dayKey = latestDate.toISOString().slice(0, 10);
    const rows = recentLifts.filter((lift) => {
      const liftDate = new Date(lift?.created_at || 0);
      if (Number.isNaN(liftDate.getTime())) return false;
      const key = liftDate.toISOString().slice(0, 10);
      return key === dayKey;
    });
    if (!rows.length) return null;
    return {
      dayKey,
      rows,
      timestamp: rows[0]?.created_at || recentLifts[0]?.created_at || null,
    };
  }, [recentLifts]);
  const totalPrs = prList.length;
  const uniqueExercisesTracked = useMemo(
    () => new Set(recentLifts.map((lift) => lift.exercise_name)).size,
    [recentLifts]
  );
  const topEstimatedOneRm = useMemo(
    () => (prList[0]?.one_rm_est ? `${prList[0].one_rm_est.toFixed(1)}kg` : 'No 1RM yet'),
    [prList]
  );
  const recentLiftVolumeByDay = useMemo(() => {
    const totals = new Map();
    recentLifts.forEach((lift) => {
      const dayKey = toLiftDayKey(lift.created_at);
      const label = new Date(lift.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      const sets = Number(lift.sets) || 0;
      const reps = Number(lift.reps) || 0;
      const weight = Number(lift.weight) || 0;
      const volume = sets > 0 && reps > 0 && weight > 0 ? sets * reps * weight : sets * reps;
      if (!totals.has(dayKey)) {
        totals.set(dayKey, { dayKey, label, volume: 0 });
      }
      const row = totals.get(dayKey);
      row.volume += volume;
    });

    return Array.from(totals.values())
      .slice(0, 7)
      .reverse();
  }, [recentLifts]);
  const maxRecentLiftVolume = useMemo(
    () => Math.max(1, ...recentLiftVolumeByDay.map((item) => item.volume || 0)),
    [recentLiftVolumeByDay]
  );
  const exerciseCountTrend = useMemo(() => {
    const counts = {};
    recentLifts.forEach((lift) => {
      const key = getExerciseLabel(lift.exercise_name);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [recentLifts]);
  const maxExerciseCount = useMemo(
    () => Math.max(1, ...exerciseCountTrend.map((item) => item.count || 0)),
    [exerciseCountTrend]
  );
  const exerciseProgressOptions = useMemo(() => {
    const counts = new Map();
    recentLifts.forEach((lift) => {
      const key = String(lift.exercise_name || '').trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [recentLifts]);
  useEffect(() => {
    if (selectedProgressExercise) return;
    if (!exerciseProgressOptions.length) return;
    setSelectedProgressExercise(exerciseProgressOptions[0].name);
  }, [exerciseProgressOptions, selectedProgressExercise]);
  const exerciseProgressSeries = useMemo(() => {
    if (!selectedProgressExercise) return [];
    return recentLifts
      .filter((lift) => String(lift.exercise_name || '').trim() === selectedProgressExercise)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-10)
      .map((lift) => {
        const reps = Number(lift.reps) || 0;
        const sets = Number(lift.sets) || 0;
        const weight = Number(lift.weight) || 0;
        const oneRm = weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;
        return {
          id: lift.id,
          label: new Date(lift.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          reps,
          sets,
          weight,
          oneRm,
        };
      });
  }, [recentLifts, selectedProgressExercise]);
  const maxExerciseProgressWeight = useMemo(
    () => Math.max(1, ...exerciseProgressSeries.map((item) => item.weight || 0)),
    [exerciseProgressSeries]
  );
  const selectedTrendDay = selectedStrengthTrendDay || recentLiftVolumeByDay[recentLiftVolumeByDay.length - 1]?.dayKey || '';
  const selectedTrendDayLifts = useMemo(
    () =>
      recentLifts
        .filter((lift) => toLiftDayKey(lift.created_at) === selectedTrendDay)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [recentLifts, selectedTrendDay]
  );

  const filteredPrograms = useMemo(() => {
    const query = programSearch.toLowerCase();
    return programs.filter((program) => (
      program.name.toLowerCase().includes(query) ||
      (program.focus || '').toLowerCase().includes(query) ||
      (program.description || '').toLowerCase().includes(query)
    ));
  }, [programSearch, programs]);
  const pinnedPrograms = useMemo(
    () => programs.filter((program) => pinnedProgramIds.includes(program.id)),
    [pinnedProgramIds, programs]
  );
  const visiblePrograms = useMemo(
    () => (showAllPrograms ? filteredPrograms : filteredPrograms.slice(0, 6)),
    [filteredPrograms, showAllPrograms]
  );
  const recentExerciseTypes = useMemo(
    () => new Set(recentLifts.map((lift) => lift.exercise_type)),
    [recentLifts]
  );

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
      if (recentExerciseTypes.has('bodyweight') && focus.includes('bodyweight')) score += 1;
      if (recentExerciseTypes.has('weights') && (focus.includes('push') || focus.includes('pull') || focus.includes('lower') || focus.includes('upper'))) {
        score += 1;
      }
    }

    return score;
  };

  const recommendedPrograms = useMemo(
    () =>
      [...programs]
        .sort((a, b) => scoreProgram(b) - scoreProgram(a))
        .slice(0, 3),
    [programs, profile, recentExerciseTypes, recentLifts]
  );

  const isExerciseInDraft = (name) =>
    newProgram.exercises.some((exercise) => normalizeExerciseName(exercise.name) === normalizeExerciseName(name));

// updateNewExercise manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const updateNewExercise = (index, field, value) => {
    const next = [...newProgram.exercises];
    const current = { ...next[index], [field]: value };
    if (field === 'name') {
      current.type = getExerciseTypeForName(value);
      current.rest = normalizeExerciseRest(current.rest, current.type);
      const remembered = getSavedWeightForExercise(value);
      if (!Number(current.weight) && remembered) {
        current.weight = remembered;
      }
    }
    if (field === 'reps') {
      current.reps = normalizeRepRange(value);
    }
    if (field === 'weight') {
      const normalizedWeight = Number(value);
      current.weight = Number.isFinite(normalizedWeight) && normalizedWeight > 0 ? normalizedWeight : '';
    }
    next[index] = current;
    setNewProgram(prev => ({ ...prev, exercises: next }));
  };

  const handleExerciseWeightBlur = (index) => {
    const exercise = newProgram.exercises[index];
    if (!exercise?.name) return;
    const weight = Number(exercise.weight || 0);
    if (!weight) return;
    const key = normalizeExerciseName(exercise.name);
    let shouldSave = false;
    setExerciseWeightMemory((prev) => {
      const previous = Number(prev[key] || 0);
      if (previous === weight) return prev;
      shouldSave = true;
      const next = { ...prev, [key]: weight };
      if (exerciseWeightsStorageKey) {
        localStorage.setItem(exerciseWeightsStorageKey, JSON.stringify(next));
      }
      return next;
    });
    if (!shouldSave) return;
    setCreatorFeedback(`Saved default weight for ${exercise.name}: ${weight}kg`);
  };

  const addExerciseFromPick = (name, typeOverride) => {
    if (!name) return;
    if (isExerciseInDraft(name)) {
      setCreatorFeedback(`Already added: ${name}`);
      return;
    }
    const newExercise = buildExerciseTemplate(name, 3, '10-12');
    if (typeOverride) newExercise.type = typeOverride;
    setNewProgram(prev => {
      const nextIndex = prev.exercises.length;
      setLastAddedExerciseIndex(nextIndex);
      if (lastAddedTimeoutRef.current) clearTimeout(lastAddedTimeoutRef.current);
      lastAddedTimeoutRef.current = setTimeout(() => setLastAddedExerciseIndex(null), 1600);
      return {
        ...prev,
        exercises: [...prev.exercises, newExercise]
      };
    });
    setCreatorResults([]);
    setCreatorSearch('');
    setCreatorFeedback(`Added: ${name}`);
  };

// addNewExercise manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const addNewExercise = () => {
    setNewProgram(prev => {
      const nextIndex = prev.exercises.length;
      setLastAddedExerciseIndex(nextIndex);
      if (lastAddedTimeoutRef.current) clearTimeout(lastAddedTimeoutRef.current);
      lastAddedTimeoutRef.current = setTimeout(() => setLastAddedExerciseIndex(null), 1600);
      return {
        ...prev,
        exercises: [
          ...prev.exercises,
          { name: '', sets: 3, reps: '10-12', weight: '', type: 'weights', rest: getDefaultRestForType('weights') }
        ]
      };
    });
    setCreatorFeedback('Added blank row');
  };

  const removeExerciseFromDraft = (index, exerciseName) => {
    removeNewExercise(index);
    setBanner({ type: 'success', message: `${exerciseName || 'Exercise'} removed.` });
  };

  const handleProgramRowTouchEnd = (index, exerciseName) => {
    const now = Date.now();
    const previous = lastRowTapRef.current;
    const isDoubleTap = previous.index === index && now - previous.time <= 320;
    if (isDoubleTap) {
      removeExerciseFromDraft(index, exerciseName);
      lastRowTapRef.current = { index: null, time: 0 };
      return;
    }
    lastRowTapRef.current = { index, time: now };
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
        reps: normalizeRepRange(ex.reps),
        weight: Number(ex.weight) > 0 ? Number(ex.weight) : '',
        type: ex.type || 'weights',
        rest: normalizeExerciseRest(ex.rest, ex.type || 'weights')
      }))
      .filter(ex => ex.name.length > 0);

    if (cleanedExercises.length === 0) {
      setBanner({ type: 'warn', message: 'Add at least one exercise.' });
      return;
    }

    setIsProgramSaving(true);
    const { data: insertedProgram, error } = await supabase.from('user_programs').insert([{
      user_id: userId,
      name: newProgram.name.trim(),
      level: newProgram.level,
      focus: newProgram.focus,
      description: newProgram.description.trim(),
      exercises: cleanedExercises
    }]).select('*').single();

    if (!error) {
      const nextWeights = { ...exerciseWeightMemory };
      cleanedExercises.forEach((exercise) => {
        if (Number(exercise.weight) > 0) {
          nextWeights[normalizeExerciseName(exercise.name)] = Number(exercise.weight);
        }
      });
      saveExerciseWeightMemory(nextWeights);
      setBanner({ type: 'success', message: 'Program saved to your library.' });
      setShowCreateProgram(false);
      if (insertedProgram) {
        const mapped = mapSupabaseProgram(insertedProgram, 'user');
        setSelectedProgram(mapped);
        setSessionQueue(mapped.exercises || []);
      }
      setNewProgram({
        name: '',
        level: 'Beginner',
        focus: 'Full Body',
        description: '',
        exercises: []
      });
      await fetchPrograms();
    } else {
      console.error('Error saving program:', error);
      setBanner({ type: 'error', message: 'Could not save program.' });
    }
    setIsProgramSaving(false);
  };

// deleteUserProgram manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const deleteUserProgram = async (program, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!program || program.source !== 'user' || !program.id) return;
    if (!pendingProgramDelete || pendingProgramDelete.id !== program.id) {
      setPendingProgramDelete({
        id: program.id,
        name: program.name || 'this program',
      });
      return;
    }

    setDeletingProgramId(program.id);
    const { error } = await supabase
      .from('user_programs')
      .delete()
      .eq('id', program.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting program:', error);
      setBanner({ type: 'error', message: 'Could not delete program.' });
      setDeletingProgramId(null);
      return;
    }

    setPrograms((prev) => prev.filter((item) => item.id !== program.id));
    if (selectedProgram?.id === program.id) {
      setSelectedProgram(null);
      setSessionQueue([]);
      setShowProgramLibrary(true);
    }
    setBanner({ type: 'success', message: 'Program removed.' });
    setPendingProgramDelete(null);
    setDeletingProgramId(null);
  };

  const handleConfirmProgramDelete = async () => {
    if (!pendingProgramDelete?.id) return;
    const match = programs.find((item) => item.id === pendingProgramDelete.id);
    if (!match) {
      setPendingProgramDelete(null);
      return;
    }
    await deleteUserProgram(match);
  };

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchPrograms();
      setStatsBootLoading(true);
      let settled = false;
      const settleStatsBoot = () => {
        if (settled) return;
        settled = true;
        setStatsBootLoading(false);
      };
      fetchPersonalRecords()
        .catch(() => {
          // keep UI responsive; banner messaging is handled by callers where needed
        })
        .finally(settleStatsBoot);
      fetchRecentLifts()
        .catch(() => {
          // keep UI responsive; banner messaging is handled by callers where needed
        })
        .finally(settleStatsBoot);
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

  useEffect(() => {
    if (!pinnedProgramsStorageKey) return;
    const stored = localStorage.getItem(pinnedProgramsStorageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setPinnedProgramIds(parsed);
        if (parsed.length > 0) setShowAllPrograms(false);
      }
    } catch (error) {
      console.error('Failed to parse pinned programs', error);
    }
  }, [pinnedProgramsStorageKey]);

  useEffect(() => {
    if (programs.length === 0 || pinnedProgramIds.length === 0) return;
    const validProgramIds = new Set(programs.map((program) => program.id));
    const nextPinned = pinnedProgramIds.filter((id) => validProgramIds.has(id));
    if (nextPinned.length !== pinnedProgramIds.length) {
      savePinnedPrograms(nextPinned);
    }
  }, [programs, pinnedProgramIds]);

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
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate("/auth");
                  }
                }
              }}
              type="button"
            >
              {'Back'}
            </button>
            <div className="studio-kicker">STRENGTH STUDIO</div>
            <h2 className="studio-title">Progress Ritual</h2>
            <p className="studio-subtitle">Less noise. More intent. Every set matters.</p>
          </div>
          <div className="studio-header-actions">
            <button
              className="studio-back studio-header-action-btn"
              type="button"
              onClick={() => setWalkthroughOpen(true)}
            >
              Walkthrough
            </button>
            <button
              className="studio-back studio-gym-link-btn studio-header-action-btn"
              type="button"
              onClick={() => setLastWorkoutOpen(true)}
              disabled={!latestWorkoutSummary}
            >
              Last workout
            </button>
            <div className="studio-toggle">
              <button
                type="button"
                onClick={() => setView('log')}
                className={`studio-toggle-btn studio-header-action-btn ${view === 'log' ? 'active' : ''}`}
              >
                Log
              </button>
              <button
                type="button"
                onClick={() => setView('stats')}
                className={`studio-toggle-btn studio-header-action-btn ${view === 'stats' ? 'active' : ''}`}
              >
                Stats
              </button>
            </div>
          </div>
        </header>

        {banner && (
          <div className={`exervia-banner studio-banner ${banner.type}`}>
            {banner.message}
          </div>
        )}
        {pendingProgramDelete && (
          <div className="exervia-banner warn">
            <div>Delete "{pendingProgramDelete.name}" from your library?</div>
            <div className="exervia-banner-actions">
              <button
                type="button"
                className="studio-back exervia-banner-btn"
                onClick={() => setPendingProgramDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hud-primary-btn exervia-banner-btn"
                onClick={handleConfirmProgramDelete}
                disabled={deletingProgramId === pendingProgramDelete.id}
              >
                {deletingProgramId === pendingProgramDelete.id ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
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
                      exercises: []
                    });
                    setCreatorSearch('');
                    setCreatorResults([]);
                    setLastAddedExerciseIndex(null);
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
                  {!programSearch.trim() && pinnedPrograms.length > 0 && (
                    <>
                      <div className="studio-panel-title">Pinned Programs</div>
                      <div className="studio-program-grid">
                        {pinnedPrograms.map((program) => (
                          <button
                            key={`pinned-${program.id}`}
                            className={`studio-program-card ${selectedProgram?.id === program.id ? 'active' : ''}`}
                            onClick={() => handleSelectProgram(program)}
                            type="button"
                          >
                            <span
                              className={`studio-program-pin ${pinnedProgramIds.includes(program.id) ? 'active' : ''}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                toggleProgramPin(program.id);
                              }}
                              role="button"
                              aria-label={pinnedProgramIds.includes(program.id) ? `Unpin ${program.name}` : `Pin ${program.name}`}
                              title={pinnedProgramIds.includes(program.id) ? `Unpin ${program.name}` : `Pin ${program.name}`}
                            >
                              {pinnedProgramIds.includes(program.id) ? '★' : '☆'}
                            </span>
                            {program.source === 'user' && (
                              <span
                                className="studio-program-delete"
                                onClick={(event) => deleteUserProgram(program, event)}
                                role="button"
                                aria-label={`Delete ${program.name}`}
                                title={`Delete ${program.name}`}
                              >
                                {deletingProgramId === program.id ? '...' : 'x'}
                              </span>
                            )}
                            <div className="studio-program-title">{program.name}</div>
                            <div className="studio-program-sub">{program.focus || 'Strength'}</div>
                            <div className="studio-program-meta">{program.level || 'All levels'}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {!programSearch.trim() && recommendedPrograms.length > 0 && (
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
                            <span
                              className={`studio-program-pin ${pinnedProgramIds.includes(program.id) ? 'active' : ''}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                toggleProgramPin(program.id);
                              }}
                              role="button"
                              aria-label={pinnedProgramIds.includes(program.id) ? `Unpin ${program.name}` : `Pin ${program.name}`}
                              title={pinnedProgramIds.includes(program.id) ? `Unpin ${program.name}` : `Pin ${program.name}`}
                            >
                              {pinnedProgramIds.includes(program.id) ? '★' : '☆'}
                            </span>
                            {program.source === 'user' && (
                              <span
                                className="studio-program-delete"
                                onClick={(event) => deleteUserProgram(program, event)}
                                role="button"
                                aria-label={`Delete ${program.name}`}
                                title={`Delete ${program.name}`}
                              >
                                {deletingProgramId === program.id ? '...' : 'x'}
                              </span>
                            )}
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
                          <span
                            className={`studio-program-pin ${pinnedProgramIds.includes(program.id) ? 'active' : ''}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleProgramPin(program.id);
                            }}
                            role="button"
                            aria-label={pinnedProgramIds.includes(program.id) ? `Unpin ${program.name}` : `Pin ${program.name}`}
                            title={pinnedProgramIds.includes(program.id) ? `Unpin ${program.name}` : `Pin ${program.name}`}
                          >
                            {pinnedProgramIds.includes(program.id) ? '★' : '☆'}
                          </span>
                          {program.source === 'user' && (
                            <span
                              className="studio-program-delete"
                              onClick={(event) => deleteUserProgram(program, event)}
                              role="button"
                              aria-label={`Delete ${program.name}`}
                              title={`Delete ${program.name}`}
                            >
                              {deletingProgramId === program.id ? '...' : 'x'}
                            </span>
                          )}
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
                          <button
                            className="studio-exercise-link"
                            onClick={() => handleExerciseGuide(exercise)}
                            type="button"
                          >
                            {exercise.name}
                          </button>
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
                  <div className="studio-queue-actions studio-session-preview-actions">
                    <button
                      className="studio-queue-btn"
                      onClick={() => {
                        const normalizedExercises = (selectedProgram.exercises || []).map((exercise) => {
                          const resolvedType = exercise.type || getExerciseTypeForName(exercise.name);
                          return {
                            ...exercise,
                            sets: Number(exercise.sets) || 3,
                            reps: normalizeRepRange(exercise.reps),
                            weight:
                              Number(exercise.weight) > 0
                                ? Number(exercise.weight)
                                : getSavedWeightForExercise(exercise.name),
                            type: resolvedType,
                            rest: normalizeExerciseRest(exercise.rest, resolvedType),
                          };
                        });
                        navigate(`/gym/${userId}/program/${selectedProgram.id}`, {
                          state: {
                            program: {
                              id: selectedProgram.id,
                              name: selectedProgram.name,
                              focus: selectedProgram.goal || selectedProgram.description || 'Strength session',
                              duration: selectedProgram.duration || '',
                              exercises: normalizedExercises
                            }
                          }
                        });
                      }}
                      type="button"
                    >
                      Start session queue
                    </button>
                    <button
                      className="studio-queue-btn ghost"
                      onClick={() => handleEditProgram(selectedProgram)}
                      type="button"
                    >
                      Edit program
                    </button>
                  </div>
                </>
              ) : (
                <div className="studio-empty">Select a program to preview the session.</div>
              )}
            </section>
          </div>
        ) : (
          <div className="studio-stats">
            <section className="studio-panel studio-reveal">
              <div className="studio-panel-title">Stats Snapshot</div>
              <div className="studio-pr-grid">
                <div className="studio-pr-card">
                  <div className="studio-pr-title">Sessions Logged</div>
                  <div className="studio-pr-value">{totalSessionsLogged}</div>
                  <div className="studio-pr-sub">Recent logged lifts</div>
                </div>
                <div className="studio-pr-card">
                  <div className="studio-pr-title">Personal Records</div>
                  <div className="studio-pr-value">{totalPrs}</div>
                  <div className="studio-pr-sub">Tracked PR entries</div>
                </div>
                <div className="studio-pr-card">
                  <div className="studio-pr-title">Exercises Tracked</div>
                  <div className="studio-pr-value">{uniqueExercisesTracked}</div>
                  <div className="studio-pr-sub">Unique exercise names</div>
                </div>
                <div className="studio-pr-card">
                  <div className="studio-pr-title">Top Est. 1RM</div>
                  <div className="studio-pr-value">{topEstimatedOneRm}</div>
                  <div className="studio-pr-sub">Best current estimate</div>
                </div>
              </div>
            </section>
            <section className="studio-panel studio-reveal">
              <div className="studio-panel-title">Progress Trends</div>
              <div className="studio-progress-grid">
                <div className="studio-progress-card">
                  <div className="studio-progress-title">7-Day Training Volume</div>
                  <div className="studio-progress-list">
                    {recentLiftVolumeByDay.length ? (
                      recentLiftVolumeByDay.map((item) => (
                        <button
                          type="button"
                          className={`studio-progress-row studio-progress-row-btn${selectedTrendDay === item.dayKey ? ' active' : ''}`}
                          key={`vol-${item.dayKey}`}
                          onClick={() => setSelectedStrengthTrendDay(item.dayKey)}
                        >
                          <div className="studio-progress-label">{item.label}</div>
                          <div className="studio-progress-bar-shell">
                            <div
                              className="studio-progress-bar"
                              style={{ width: `${Math.max(6, (item.volume / maxRecentLiftVolume) * 100)}%` }}
                            />
                          </div>
                          <div className="studio-progress-value">{Math.round(item.volume)}</div>
                        </button>
                      ))
                    ) : (
                      <div className="studio-empty">Log sessions to unlock your 7-day volume trend.</div>
                    )}
                  </div>
                </div>
                <div className="studio-progress-card">
                  <div className="studio-progress-title">Most Trained Exercises</div>
                  <div className="studio-progress-list">
                    {exerciseCountTrend.length ? (
                      exerciseCountTrend.map((item) => (
                        <div className="studio-progress-row" key={`freq-${item.name}`}>
                          <div className="studio-progress-label">{item.name}</div>
                          <div className="studio-progress-bar-shell">
                            <div
                              className="studio-progress-bar alt"
                              style={{ width: `${Math.max(8, (item.count / maxExerciseCount) * 100)}%` }}
                            />
                          </div>
                          <div className="studio-progress-value">{item.count}x</div>
                        </div>
                      ))
                    ) : (
                      <div className="studio-empty">No frequency trend yet.</div>
                    )}
                  </div>
                </div>
              </div>
              {selectedTrendDayLifts.length > 0 && (
                <div className="studio-progress-drilldown">
                  <div className="studio-progress-drilldown-top">
                    <div className="studio-progress-title">Day Breakdown</div>
                    <div className="studio-progress-value">
                      {new Date(selectedTrendDay).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="studio-progress-list">
                    {selectedTrendDayLifts.map((lift) => (
                      <div className="studio-progress-row" key={`lift-${lift.id}`}>
                        <div className="studio-progress-label">{lift.exercise_name}</div>
                        <div className="studio-progress-bar-shell">
                          <div className="studio-progress-bar alt" style={{ width: '100%' }} />
                        </div>
                        <div className="studio-progress-value">
                          {Number(lift.sets) || 0}x{Number(lift.reps) || 0}
                          {Number(lift.weight) > 0 ? ` · ${lift.weight}kg` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="studio-progress-drilldown">
                <div className="studio-progress-drilldown-top">
                  <div className="studio-progress-title">Lift Progress By Exercise</div>
                </div>
                {statsBootLoading ? (
                  <div className="studio-empty">Loading strength stats...</div>
                ) : exerciseProgressOptions.length > 0 ? (
                  <>
                    <div className="studio-chip-row">
                      {exerciseProgressOptions.map((item) => (
                        <button
                          key={`prog-opt-${item.name}`}
                          type="button"
                          className={`studio-chip ${selectedProgressExercise === item.name ? 'active' : ''}`}
                          onClick={() => setSelectedProgressExercise(item.name)}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                    <div className="studio-progress-list">
                      {exerciseProgressSeries.map((item) => (
                        <div className="studio-progress-row" key={`prog-row-${item.id}`}>
                          <div className="studio-progress-label">{item.label}</div>
                          <div className="studio-progress-bar-shell">
                            <div
                              className="studio-progress-bar"
                              style={{
                                width: `${item.weight > 0 ? Math.max(6, (item.weight / maxExerciseProgressWeight) * 100) : 6}%`,
                              }}
                            />
                          </div>
                          <div className="studio-progress-value">
                            {item.weight > 0 ? `${item.weight}kg` : `${item.reps} reps`}
                            {item.oneRm > 0 ? ` · ${item.oneRm.toFixed(1)} 1RM` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="studio-empty">No exercise progression yet. Keep logging lifts.</div>
                )}
              </div>
            </section>
            {/* Section block */}
            {/* Layout grouping for readability. */}
            {/* Interactive elements live inside this block. */}
            {/* This is a structural UI container. */}
            <section className="studio-panel studio-reveal">
              <div className="studio-panel-title">Personal Records</div>
                {statsBootLoading ? (
                  <div className="studio-empty">Loading personal records...</div>
                ) : prList.length > 0 ? (
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
                  No records yet. Your first lift starts your stats.
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
{/* CreateProgram is used to create the program template, User may opt to use this CreateProgram 
feature if they think they'll benefit from it. as various user's have differeent needs
the createPRogram helps resolve this problem  */}
      {showCreateProgram && (
        <div className="studio-swap-backdrop" onClick={(event) => event.target === event.currentTarget && closeCreateProgramModal()}>
          <div className="studio-swap-panel studio-create-program-panel" onClick={(event) => event.stopPropagation()}>
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Create Program</div>
                <div className="studio-swap-sub">Build your own template and save it.</div>
              </div>
              <button
                className="studio-swap-close"
                onClick={closeCreateProgramModal}
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
                    className="studio-form-input"
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

              <div className="studio-panel-title">
                Exercises {newProgram.exercises.length > 0 && `(${newProgram.exercises.length})`}
              </div>
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
                            addExerciseFromPick(item, getExerciseTypeForName(item));
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
                {creatorResults.length === 0 && !creatorSearch.trim() && (
                  <div className="studio-exercise-groups">
                    {Object.entries(exerciseGroups).map(([group, items]) => (
                      <div key={group} className="studio-exercise-group">
                        <div className="studio-exercise-group-title">{group}</div>
                        <div className="studio-exercise-group-list">
                          {items.map((item) => {
                            const alreadyAdded = isExerciseInDraft(item);
                            return (
                              <button
                                key={`group-${group}-${item}`}
                                className={`studio-exercise-chip ${alreadyAdded ? 'selected' : ''}`}
                                onClick={() => {
                                  addExerciseFromPick(item, getExerciseTypeForName(item));
                                }}
                                type="button"
                              >
                                {item}
                                {alreadyAdded && <span className="studio-exercise-chip-state">Added</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {creatorResults.length > 0 && (
                  <div className="studio-creator-results">
                    {creatorResults.map(result => (
                      <div
                        key={`creator-${result.name}`}
                        className={`studio-swap-result ${isExerciseInDraft(result.name) ? 'selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          addExerciseFromPick(result.name, result.type);
                          setCreatorResults([]);
                          setCreatorSearch('');
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            addExerciseFromPick(result.name, result.type);
                            setCreatorResults([]);
                            setCreatorSearch('');
                          }
                        }}
                      >
                        <div className="studio-swap-name">
                          {result.name}
                          {isExerciseInDraft(result.name) && <span className="studio-swap-selected-pill">Added</span>}
                        </div>
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
                {creatorFeedback && <div className="studio-inline-feedback">{creatorFeedback}</div>}
              </div>
              <div className="studio-create-list">
                {newProgram.exercises.length > 0 ? (
                  <>
                    <div className="studio-create-head">
                      <span>Exercise</span>
                      <span>Sets</span>
                      <span>Rep Range</span>
                      <span>Weight (kg)</span>
                      <span>Remove</span>
                    </div>
                    {newProgram.exercises.map((exercise, index) => (
                      <div
                        key={`new-ex-${index}`}
                        className={`studio-create-row ${lastAddedExerciseIndex === index ? 'studio-pulse' : ''}`}
                        onDoubleClick={() => removeExerciseFromDraft(index, exercise.name)}
                        onDoubleClickCapture={() => removeExerciseFromDraft(index, exercise.name)}
                        onTouchEnd={() => handleProgramRowTouchEnd(index, exercise.name)}
                        title="Double tap to remove this exercise"
                      >
                        <input
                          className="studio-create-name"
                          placeholder="Exercise name"
                          value={exercise.name}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeExerciseFromDraft(index, exercise.name);
                          }}
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
                        <select
                          className="studio-create-mini"
                          value={normalizeRepRange(exercise.reps)}
                          onChange={(event) => updateNewExercise(index, 'reps', event.target.value)}
                        >
                          {REP_RANGE_OPTIONS.map((range) => (
                            <option key={`${index}-range-${range}`} value={range}>
                              {range}
                            </option>
                          ))}
                        </select>
                        <select
                          className="studio-create-mini"
                          value={
                            exercise.weight === '' || exercise.weight === null || exercise.weight === undefined
                              ? ''
                              : String(exercise.weight)
                          }
                          onChange={(event) => updateNewExercise(index, 'weight', event.target.value)}
                          onBlur={() => handleExerciseWeightBlur(index)}
                        >
                          <option value="">-</option>
                          {WEIGHT_PICKER_OPTIONS.map((weightOption) => (
                            <option key={`${index}-weight-${weightOption}`} value={weightOption}>
                              {weightOption}
                            </option>
                          ))}
                          {exercise.weight !== '' &&
                            exercise.weight !== null &&
                            exercise.weight !== undefined &&
                            !WEIGHT_PICKER_OPTIONS.includes(String(exercise.weight)) && (
                              <option value={String(exercise.weight)}>{String(exercise.weight)}</option>
                            )}
                        </select>
                        <button
                          className="studio-remove-btn"
                          onClick={() => removeNewExercise(index)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="studio-empty">Add your first exercise to start building the plan.</div>
                )}
              </div>
              <div className="studio-create-actions">
                <button className="studio-queue-btn ghost" onClick={addNewExercise} type="button">
                  + Add blank row
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
        <div className="studio-swap-backdrop" onClick={(event) => event.target === event.currentTarget && closeSwap()}>
          <div className="studio-swap-panel" onClick={(event) => event.stopPropagation()}>
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
                        onClick={() =>
                          handleSwapSelect(
                            buildExerciseTemplate(
                              item,
                              sessionQueue[swapIndex]?.sets || 3,
                              sessionQueue[swapIndex]?.reps || '10-12'
                            )
                          )
                        }
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
                    <>
                      {swapQuery.trim() ? (
                        <div className="studio-empty">No results yet. Try another search.</div>
                      ) : (
                        <div className="studio-exercise-groups">
                          {Object.entries(exerciseGroups).map(([group, items]) => (
                            <div key={`swap-${group}`} className="studio-exercise-group">
                              <div className="studio-exercise-group-title">{group}</div>
                              <div className="studio-exercise-group-list">
                                {items.map((item) => (
                                  <button
                                    key={`swap-${group}-${item}`}
                                    className="studio-exercise-chip"
                                    onClick={() =>
                                      handleSwapSelect(
                                        buildExerciseTemplate(
                                          item,
                                          sessionQueue[swapIndex]?.sets || 3,
                                          sessionQueue[swapIndex]?.reps || '10-12'
                                        )
                                      )
                                    }
                                    type="button"
                                  >
                                    {item}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lastWorkoutOpen && (
        <div
          className="studio-swap-backdrop"
          onClick={(event) => event.target === event.currentTarget && setLastWorkoutOpen(false)}
        >
          <div className="studio-swap-panel studio-last-workout-panel" onClick={(event) => event.stopPropagation()}>
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Last Workout</div>
                <div className="studio-swap-sub">{latestWorkoutSummary?.dayKey || "No recent workout"}</div>
              </div>
              <button className="studio-swap-close" onClick={() => setLastWorkoutOpen(false)} type="button">
                Close
              </button>
            </div>
            <div className="studio-swap-body studio-last-workout-body">
              {!latestWorkoutSummary?.rows?.length ? (
                <div className="studio-empty">No workout data yet.</div>
              ) : (
                <div className="studio-guide-content studio-last-workout-list">
                  {latestWorkoutSummary.rows.slice(0, 24).map((lift, index) => (
                    <div key={`${lift.id || "lift"}-${index}`} className="studio-program-preview-row studio-last-workout-row">
                      <span className="studio-last-workout-exercise">{lift.exercise_name || "Exercise"}</span>
                      <span className="studio-last-workout-meta">
                        {Number(lift.sets || 0)} sets · {lift.reps || 0} reps
                        {Number(lift.weight || 0) > 0 ? ` · ${lift.weight} kg` : ""}
                      </span>
                    </div>
                  ))}
                  <div className="community-modal-actions">
                    <button
                      className="studio-back community-cta-btn"
                      type="button"
                      onClick={() => {
                        setLastWorkoutOpen(false);
                        if (userId && latestWorkoutSummary?.dayKey) {
                          navigate(`/gym/${userId}/logs?day=${encodeURIComponent(latestWorkoutSummary.dayKey)}`);
                        }
                      }}
                    >
                      Open full logs
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* exercise guide modal for quick learning, */}
      {/* opens from session preview exercise names, */}
      {/* shows a short description without leaving the page, */}
      {/* closes with the standard modal close button */}
      {guideOpen && (
        <div className="studio-swap-backdrop" onClick={(event) => event.target === event.currentTarget && closeGuideModal()}>
          <div className="studio-swap-panel" onClick={(event) => event.stopPropagation()}>
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Exercise Guide</div>
                <div className="studio-swap-sub">Quick overview before you start.</div>
              </div>
              <button
                className="studio-swap-close"
                onClick={closeGuideModal}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="studio-swap-body">
              {guideExercise ? (
                <div className="studio-guide-content">
                  <div className="studio-guide-title">{guideExercise.name}</div>
                  <div className="studio-guide-meta">
                    {guideExercise.sets} sets · {guideExercise.reps} reps
                  </div>
                  {!guideLoading && (
                    <div className={`studio-guide-status ${guideHasCoachCues ? 'ready' : 'fallback'}`}>
                      <span className={`studio-guide-status-icon ${guideHasCoachCues ? 'ready' : 'fallback'}`}>
                        {guideHasCoachCues ? '✓' : '!'}
                      </span>
                      <span>
                        {guideHasCoachCues
                          ? 'Coach cues loaded'
                          : 'Standard movement reminders loaded.'}
                      </span>
                    </div>
                  )}
                  {guideLoading ? (
                    <div className="studio-empty">Loading guide...</div>
                  ) : (
                    <div className="studio-guide-text">
                      {guideDetails?.description || 'No movement-specific cues yet. Keep tempo controlled and prioritize clean form.'}
                    </div>
                  )}
                  {!guideLoading && (
                    <div className="studio-guide-sections">
                      <div className="studio-guide-section">
                        <div className="studio-guide-label">Muscles</div>
                        <div className="studio-guide-chips">
                          {(guideDetails?.muscles?.length ? guideDetails.muscles : ['Full body']).map((item) => (
                            <span key={`muscle-${item}`} className="studio-guide-chip">{item}</span>
                          ))}
                        </div>
                      </div>
                      <div className="studio-guide-section">
                        <div className="studio-guide-label">Equipment</div>
                        <div className="studio-guide-chips">
                          {(guideDetails?.equipment?.length ? guideDetails.equipment : ['Bodyweight']).map((item) => (
                            <span key={`equip-${item}`} className="studio-guide-chip">{item}</span>
                          ))}
                        </div>
                      </div>
                      <div className="studio-guide-section">
                        <div className="studio-guide-label">Step by step</div>
                        <ol className="studio-guide-steps">
                          {(guideDetails?.steps?.length
                            ? guideDetails.steps
                            : ['Set your stance and brace core.', 'Move with control through full range.', 'Keep form tight and breathe steadily.']
                          ).map((item, idx) => (
                            <li key={`step-${idx}`}>{item}</li>
                          ))}
                        </ol>
                      </div>
                      <div className="studio-guide-section">
                        <div className="studio-guide-label">Common mistakes</div>
                        <ul className="studio-guide-steps">
                          <li>Rushing reps or bouncing at the bottom.</li>
                          <li>Shortening range of motion.</li>
                          <li>Letting form break as fatigue builds.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="studio-empty">No exercise selected.</div>
              )}
            </div>
          </div>
        </div>
      )}
      <PageWalkthroughModal
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        mode="gym"
        userId={userId}
        pageKey="progress"
        title="Progress Walkthrough"
        steps={PROGRESS_WALKTHROUGH_STEPS}
        onStepAction={handleWalkthroughAction}
      />
    </div>
  );
};

export default StrengthProgressTab;



