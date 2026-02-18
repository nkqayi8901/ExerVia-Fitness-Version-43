// src/components/StrengthProgressTab.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from 'react';
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

const exerciseGuideDefaults = {
  'Bulgarian Split Squat': [
    'Set rear foot on a bench and find a stable stance.',
    'Lower until front thigh is near parallel with a tall chest.',
    'Drive through the front heel and keep knee tracking over toes.'
  ],
  'Flat Dumbbell Bench Press': [
    'Set shoulder blades and keep feet planted.',
    'Lower dumbbells with control to chest level.',
    'Press up and keep wrists stacked over elbows.'
  ],
  'Incline Barbell Bench Press': [
    'Set the bench to a slight incline and brace.',
    'Lower the bar to upper chest with steady control.',
    'Press up while keeping your upper back tight.'
  ],
  'Decline Bench Press': [
    'Secure your feet and brace your core.',
    'Lower the bar to the lower chest with control.',
    'Press up without bouncing off the chest.'
  ],
  'Pec Deck': [
    'Set the seat so handles align with mid chest.',
    'Bring elbows together without shrugging.',
    'Control the return and keep tension on the chest.'
  ],
  'Back Squat': [
    'Brace your core and keep the bar over mid foot.',
    'Sit down and back while keeping your chest up.',
    'Drive up by pushing the floor and keeping knees aligned.'
  ],
  'Deadlift': [
    'Set your hips, grip the bar, and brace hard.',
    'Push the floor away and keep the bar close to the body.',
    'Lock out with hips and glutes, then lower with control.'
  ],
  'Rack Pull': [
    'Set bar at knee height and brace hard.',
    'Drive hips forward and keep bar close.',
    'Lower under control to the pins.'
  ],
  'T-Bar Row': [
    'Hinge at the hips and keep a flat back.',
    'Row the handle toward lower ribs.',
    'Lower with control and keep tension.'
  ],
  'Pendlay Row': [
    'Start with a strong hinge and flat back.',
    'Pull bar from floor to lower chest.',
    'Reset on the floor each rep.'
  ],
  'Inverted Row': [
    'Set body in a straight line under the bar.',
    'Pull chest to the bar with elbows down.',
    'Lower under control without sagging.'
  ],
  'Straight-Arm Pulldown': [
    'Set hips back and keep arms straight.',
    'Pull the bar to your thighs using lats.',
    'Return with control without bending elbows.'
  ],
  'Bench Press': [
    'Set your shoulder blades and plant your feet.',
    'Lower the bar to mid chest with elbows at a steady angle.',
    'Press up while keeping your upper back tight.'
  ],
  'Overhead Press': [
    'Brace your core and stack ribs over hips.',
    'Press straight up and move head through at the top.',
    'Lower under control to the upper chest.'
  ],
  'Dumbbell Shoulder Press': [
    'Start with dumbbells at shoulder height and brace.',
    'Press up without flaring ribs.',
    'Lower to a controlled stop at shoulder height.'
  ],
  'Arnold Press': [
    'Start with palms facing you at chest level.',
    'Press up while rotating palms forward.',
    'Lower back down and rotate under control.'
  ],
  'Upright Row': [
    'Grip bar just inside shoulder width.',
    'Pull elbows up and out to upper chest.',
    'Lower under control without shrugging.'
  ],
  'Pull-up': [
    'Start from a dead hang with shoulders engaged.',
    'Pull chest toward the bar with elbows down.',
    'Lower under control to full extension.'
  ],
  'Assisted Pull-up': [
    'Use band or machine for support.',
    'Pull chest toward the bar with control.',
    'Lower slowly to full extension.'
  ],
  'Chin-up': [
    'Use an underhand grip and brace.',
    'Pull chin over the bar with elbows down.',
    'Lower under control to full extension.'
  ],
  'Push-up': [
    'Set hands under shoulders and keep a tight plank.',
    'Lower with elbows at a steady angle.',
    'Press up while keeping hips level.'
  ],
  'Leg Press': [
    'Set feet shoulder width on the platform.',
    'Lower until knees are at a strong angle.',
    'Press through the mid foot to lockout.'
  ],
  'Hack Squat': [
    'Set feet mid platform and brace core.',
    'Lower with control keeping back flat.',
    'Drive up through the heels.'
  ],
  'Smith Machine Squat': [
    'Set feet slightly forward and brace.',
    'Lower with control and keep torso steady.',
    'Drive up through the mid foot.'
  ],
  'Step-Ups': [
    'Use a stable box and plant full foot.',
    'Drive up through the lead leg.',
    'Lower under control without collapsing.'
  ],
  'Reverse Lunge': [
    'Step back and drop the rear knee.',
    'Keep front knee tracking over toes.',
    'Drive up through the front heel.'
  ],
  'Lying Leg Curl': [
    'Set the pad just above the heels.',
    'Curl up without lifting hips.',
    'Lower with control and keep tension.'
  ],
  'Seated Leg Curl': [
    'Set pad above the ankles and brace.',
    'Curl down using hamstrings only.',
    'Return with control to full extension.'
  ],
  'Nordic Hamstring Curl': [
    'Brace core and keep hips extended.',
    'Lower slowly using hamstrings to resist.',
    'Push up lightly if needed to reset.'
  ],
  'Standing Calf Raise': [
    'Place toes on the edge and keep legs straight.',
    'Rise onto the balls of your feet.',
    'Lower with control for a full stretch.'
  ],
  'Seated Calf Raise': [
    'Set pad on thighs and keep feet planted.',
    'Rise onto the balls of your feet.',
    'Lower with control to full stretch.'
  ],
  'Hip Thrust': [
    'Set upper back on a bench and brace core.',
    'Drive hips up and squeeze glutes at the top.',
    'Lower with control without losing tension.'
  ],
  'Barbell Hip Thrust': [
    'Set the bar over hips with padding.',
    'Drive through heels and lock out hips.',
    'Lower with control and keep ribs down.'
  ],
  'Glute Bridge': [
    'Plant feet hip width and brace core.',
    'Drive hips up and squeeze glutes.',
    'Lower with control without arching.'
  ],
  'Walking Lunge': [
    'Step forward and drop the back knee.',
    'Keep front knee aligned over the foot.',
    'Drive through the front heel to step forward.'
  ],
  'Donkey Calf Raise': [
    'Hinge at hips and keep knees soft.',
    'Rise onto the balls of your feet.',
    'Lower slowly for a full stretch.'
  ],
  'Single-Leg Calf Raise': [
    'Stand tall and keep balance.',
    'Rise onto the ball of one foot.',
    'Lower with control and repeat.'
  ],
  'Kettlebell Swing': [
    'Hinge at hips with a flat back.',
    'Snap hips forward to drive the bell.',
    'Let the bell swing back under control.'
  ],
  'Decline Dumbbell Press': [
    'Set the bench to a decline and brace.',
    'Lower dumbbells to chest level with control.',
    'Press up and keep wrists stacked.'
  ],
  'Push-up (Feet Elevated)': [
    'Place feet on a stable platform and brace.',
    'Lower with elbows at a steady angle.',
    'Press up while keeping hips level.'
  ],
  'Svend Press': [
    'Press plates together at chest height.',
    'Push straight out while maintaining squeeze.',
    'Return with control and keep tension.'
  ],
  'Guillotine Press': [
    'Use a light load and keep shoulders set.',
    'Lower the bar to the upper chest/neck line.',
    'Press up smoothly without flaring elbows.'
  ],
  'Meadows Row': [
    'Set a strong hinge and brace your core.',
    'Row the bar toward the hip with control.',
    'Lower slowly and keep your back flat.'
  ],
  'Neutral-Grip Pull-up': [
    'Grip handles with palms facing in.',
    'Pull chest toward the bar with control.',
    'Lower under control to full extension.'
  ],
  'Machine Row': [
    'Set chest support and brace core.',
    'Row handles toward your ribs.',
    'Return under control and keep tension.'
  ],
  'Cable Lateral Raise': [
    'Stand tall and keep slight elbow bend.',
    'Raise the cable to shoulder height.',
    'Lower slowly without swinging.'
  ],
  'Rear Delt Fly (Dumbbell)': [
    'Hinge forward with a flat back.',
    'Raise dumbbells out to the sides.',
    'Lower slowly and keep tension.'
  ],
  'Reverse Pec Deck': [
    'Set seat to shoulder height.',
    'Pull handles back with elbows slightly bent.',
    'Return under control without shrugging.'
  ],
  'Cuban Press': [
    'Raise elbows to shoulder height.',
    'Externally rotate forearms upward.',
    'Press overhead with control.'
  ],
  'Bradford Press': [
    'Start with bar at the front rack position.',
    'Press up and move bar behind the head.',
    'Press again to return to the front.'
  ],
  'Machine Shoulder Press': [
    'Set the seat so handles align with shoulders.',
    'Press up without flaring ribs.',
    'Lower with control to a full stop.'
  ],
  'EZ-Bar Curl': [
    'Keep elbows tucked by your sides.',
    'Curl the bar up without swinging.',
    'Lower slowly and keep tension.'
  ],
  'Preacher Curl': [
    'Set upper arms on the pad.',
    'Curl up without lifting shoulders.',
    'Lower slowly to full extension.'
  ],
  'Concentration Curl': [
    'Brace elbow against inner thigh.',
    'Curl with a slow, controlled tempo.',
    'Lower without losing tension.'
  ],
  'Incline Dumbbell Curl': [
    'Set bench to an incline and brace.',
    'Curl with elbows behind the torso.',
    'Lower slowly to full extension.'
  ],
  'Cable Curl': [
    'Stand tall and keep elbows pinned.',
    'Curl the handle up with control.',
    'Lower slowly without swinging.'
  ],
  'Spider Curl': [
    'Lie chest down on an incline bench.',
    'Curl with elbows forward and stable.',
    'Lower under control to full extension.'
  ],
  'Reverse Curl': [
    'Use an overhand grip and brace.',
    'Curl up without swinging.',
    'Lower slowly and keep tension.'
  ],
  'Skull Crushers': [
    'Keep elbows tucked and upper arms still.',
    'Lower the bar toward the forehead.',
    'Extend back up without flaring elbows.'
  ],
  'Close-Grip Bench Press': [
    'Grip the bar just inside shoulder width.',
    'Lower to mid chest with control.',
    'Press up while keeping elbows tucked.'
  ],
  'Bench Dips': [
    'Set hands on a bench and brace core.',
    'Lower hips with elbows back.',
    'Press up without shrugging.'
  ],
  'Cable Overhead Triceps Extension': [
    'Keep elbows high and close together.',
    'Extend the rope upward with control.',
    'Return slowly to full stretch.'
  ],
  'JM Press': [
    'Lower the bar in a hybrid press path.',
    'Stop above the chest with elbows tucked.',
    'Press back up with control.'
  ],
  'Tate Press': [
    'Start with dumbbells over the chest.',
    'Lower toward the chest with elbows out.',
    'Press back up without flaring.'
  ],
  'Curtsy Lunge': [
    'Step back and across behind the lead leg.',
    'Lower with control and keep torso upright.',
    'Drive up through the front heel.'
  ],
  'Sissy Squat': [
    'Stay tall and let knees travel forward.',
    'Lower with control while keeping hips open.',
    'Drive up through the quads.'
  ],
  'Box Squat': [
    'Sit back to a box with control.',
    'Pause briefly without relaxing.',
    'Drive up through the mid foot.'
  ],
  'Cyclist Squat': [
    'Keep heels elevated and torso upright.',
    'Lower with knees forward and control.',
    'Drive up through the quads.'
  ],
  'Good Morning': [
    'Set bar on upper back and brace core.',
    'Hinge at hips with a flat back.',
    'Return by driving hips forward.'
  ],
  'Single-Leg Romanian Deadlift': [
    'Hinge on one leg and keep hips square.',
    'Lower with control and keep back flat.',
    'Drive up through the standing heel.'
  ],
  'Glute-Ham Raise': [
    'Set the machine and brace core.',
    'Lower slowly with hamstrings controlling.',
    'Pull back up without jerking.'
  ],
  'Calf Press (Leg Press)': [
    'Set feet on the bottom edge of the platform.',
    'Press through the balls of the feet.',
    'Lower slowly for a full stretch.'
  ],
  'Hanging Leg Raise': [
    'Brace your core and keep legs straight.',
    'Raise legs without swinging.',
    'Lower slowly with control.'
  ],
  "Captain's Chair Leg Raise": [
    'Brace your core and keep back flat.',
    'Raise knees toward the chest.',
    'Lower slowly without swinging.'
  ],
  'Cable Crunch': [
    'Kneel and brace core.',
    'Crunch down by rounding the spine.',
    'Return slowly to full stretch.'
  ],
  'Decline Sit-Up': [
    'Brace core and keep feet locked.',
    'Sit up with controlled tempo.',
    'Lower slowly without bouncing.'
  ],
  'Ab Wheel Rollout': [
    'Brace core and keep hips locked.',
    'Roll out slowly without sagging.',
    'Pull back using abs and lats.'
  ],
  'Russian Twist': [
    'Sit tall with core braced.',
    'Rotate smoothly side to side.',
    'Keep movement controlled.'
  ],
  'Bicycle Crunch': [
    'Keep lower back pressed down.',
    'Rotate elbow toward opposite knee.',
    'Move with steady control.'
  ],
  'Dead Bug': [
    'Press lower back into the floor.',
    'Extend opposite arm and leg slowly.',
    'Return with control and repeat.'
  ],
  'Pallof Press': [
    'Brace core and stand tall.',
    'Press the handle straight out.',
    'Resist rotation and return slowly.'
  ],
  'Sled Push': [
    'Set a strong forward lean and brace.',
    'Drive through legs with short steps.',
    'Keep hands firm and torso stable.'
  ],
  'Sled Pull': [
    'Lean back slightly and brace core.',
    'Pull with steady steps and control.',
    'Keep shoulders down and back.'
  ],
  'Suitcase Carry': [
    'Hold the load at your side and brace.',
    'Walk with tall posture and steady steps.',
    'Avoid leaning toward the weight.'
  ],
  'Yoke Carry': [
    'Brace core and set the frame.',
    'Walk with short, steady steps.',
    'Keep chest tall and breathing controlled.'
  ],
  'Battle Ropes': [
    'Set an athletic stance and brace.',
    'Drive the ropes with steady rhythm.',
    'Keep shoulders down and core tight.'
  ]
};

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
  const [pinnedProgramIds, setPinnedProgramIds] = useState([]);
  const [programSearch, setProgramSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [showProgramLibrary, setShowProgramLibrary] = useState(true);
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [isProgramSaving, setIsProgramSaving] = useState(false);
  const [deletingProgramId, setDeletingProgramId] = useState(null);
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
  const pinnedProgramsStorageKey = userId ? `exervia_pinned_programs_${userId}` : null;

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

// buildExerciseTemplate manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const buildExerciseTemplate = (name, sets, reps) => ({
    name,
    type: getExerciseTypeForName(name),
    sets: sets || 3,
    reps: reps || 10,
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

  const handleRemixProgram = (program) => {
    if (!program) return;
    const remixedExercises = (program.exercises || []).map((exercise) => ({
      name: exercise.name || '',
      sets: Number(exercise.sets) || 3,
      reps: Number(exercise.reps) || 10,
      type: exercise.type || getExerciseTypeForName(exercise.name)
    }));

    setNewProgram({
      name: `Remix · ${program.name || 'Custom Program'}`,
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

  const shareProgramToCommunity = async (program = selectedProgram) => {
    if (!userId || !program) return;
    const sourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(program.id || '')
    )
      ? String(program.id)
      : null;
    const tags = [
      program.focus || '',
      program.level || '',
      (program.exercises || []).length ? `${(program.exercises || []).length}-exercises` : ''
    ]
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
    const payload = {
      name: program.name,
      level: program.level || 'All levels',
      focus: program.focus || 'Mixed',
      description: program.description || '',
      exercises: Array.isArray(program.exercises) ? program.exercises : []
    };
    const { error } = await supabase.from('shared_templates').insert([{
      template_type: 'workout_program',
      source_id: sourceId,
      title: program.name,
      subtitle: program.focus || 'Workout program',
      goal: program.focus || '',
      summary: program.description || '',
      level: program.level || null,
      focus: program.focus || null,
      tags,
      payload,
      created_by: Number(userId)
    }]);
    if (error) {
      setBanner({ type: 'error', message: 'Could not share program.' });
      return;
    }
    setBanner({ type: 'success', message: 'Program shared to Community Templates.' });
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

    const localMatches = searchLocalExercises(query).map(name =>
      buildExerciseTemplate(
        name,
        sessionQueue[swapIndex]?.sets || 3,
        sessionQueue[swapIndex]?.reps || 10
      )
    );
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
        .map(name =>
          buildExerciseTemplate(
            name,
            sessionQueue[swapIndex]?.sets || 3,
            sessionQueue[swapIndex]?.reps || 10
          )
        );
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
      const localMatches = searchLocalExercises(query).map(name =>
        buildExerciseTemplate(
          name,
          newProgram.exercises[creatorFocusedIndex]?.sets || 3,
          newProgram.exercises[creatorFocusedIndex]?.reps || 10
        )
      );
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
        .map(name =>
          buildExerciseTemplate(
            name,
            newProgram.exercises[creatorFocusedIndex]?.sets || 3,
            newProgram.exercises[creatorFocusedIndex]?.reps || 10
          )
        );
      const merged = [...localMatches, ...remoteResults].filter(
        (item, index, arr) => arr.findIndex(other => other.name === item.name) === index
      );
      setCreatorResults(merged.length > 0 ? merged : localMatches);
    } catch (error) {
      console.error('Creator exercise search failed:', error);
      setCreatorResults(searchLocalExercises(query).map(name =>
        buildExerciseTemplate(
          name,
          newProgram.exercises[creatorFocusedIndex]?.sets || 3,
          newProgram.exercises[creatorFocusedIndex]?.reps || 10
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
  const totalSessionsLogged = recentLifts.length;
  const totalPrs = prList.length;
  const uniqueExercisesTracked = new Set(recentLifts.map((lift) => lift.exercise_name)).size;
  const topEstimatedOneRm = prList[0]?.one_rm_est ? `${prList[0].one_rm_est.toFixed(1)}kg` : 'No 1RM yet';

  const filteredPrograms = programs.filter(program => {
    const query = programSearch.toLowerCase();
    return (
      program.name.toLowerCase().includes(query) ||
      (program.focus || '').toLowerCase().includes(query) ||
      (program.description || '').toLowerCase().includes(query)
    );
  });
  const pinnedPrograms = programs.filter((program) => pinnedProgramIds.includes(program.id));
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

  const normalizeExerciseName = (value) => String(value || '').trim().toLowerCase();
  const isExerciseInDraft = (name) =>
    newProgram.exercises.some((exercise) => normalizeExerciseName(exercise.name) === normalizeExerciseName(name));

// updateNewExercise manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const updateNewExercise = (index, field, value) => {
    const next = [...newProgram.exercises];
    next[index] = { ...next[index], [field]: value };
    setNewProgram(prev => ({ ...prev, exercises: next }));
  };

  const addExerciseFromPick = (name, typeOverride) => {
    if (!name) return;
    if (isExerciseInDraft(name)) {
      setCreatorFeedback(`Already added: ${name}`);
      return;
    }
    const newExercise = buildExerciseTemplate(name, 3, 10);
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
        exercises: [...prev.exercises, { name: '', sets: 3, reps: 10, type: 'weights' }]
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
        exercises: []
      });
      fetchPrograms();
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
    const confirmed = window.confirm(`Delete "${program.name}" from your library?`);
    if (!confirmed) return;

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
    setDeletingProgramId(null);
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
              onClick={() => setView('stats')}
              className={`studio-toggle-btn ${view === 'stats' ? 'active' : ''}`}
            >
              Stats
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
                      onClick={() =>
                        navigate(`/gym/${userId}/program/${selectedProgram.id}`, {
                          state: {
                            program: {
                              id: selectedProgram.id,
                              name: selectedProgram.name,
                              focus: selectedProgram.goal || selectedProgram.description || 'Strength session',
                              duration: selectedProgram.duration || '',
                              exercises: selectedProgram.exercises || []
                            }
                          }
                        })
                      }
                      type="button"
                    >
                      Start session queue
                    </button>
                    <button
                      className="studio-queue-btn ghost"
                      onClick={() => handleRemixProgram(selectedProgram)}
                      type="button"
                    >
                      Remix plan
                    </button>
                    <button
                      className="studio-queue-btn ghost"
                      onClick={() => shareProgramToCommunity(selectedProgram)}
                      type="button"
                    >
                      Share to community
                    </button>
                  </div>
                </>
              ) : (
                <div className="studio-empty">Select a program to preview the session.</div>
              )}
            </section>
          </div>
        ) : (
          <div className="studio-story">
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
        <div className="studio-swap-backdrop">
          <div className="studio-swap-panel studio-create-program-panel">
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Create Program</div>
                <div className="studio-swap-sub">Build your own template and save it.</div>
              </div>
              <button
                className="studio-swap-close"
                onClick={() => {
                  setShowCreateProgram(false);
                  setCreatorSearch('');
                  setCreatorResults([]);
                }}
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
                      <span>Reps</span>
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
                        <input
                          className="studio-create-mini"
                          type="number"
                          min="1"
                          value={exercise.reps}
                          onChange={(event) => updateNewExercise(index, 'reps', event.target.value)}
                        />
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
                        onClick={() =>
                          handleSwapSelect(
                            buildExerciseTemplate(
                              item,
                              sessionQueue[swapIndex]?.sets || 3,
                              sessionQueue[swapIndex]?.reps || 10
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
                                          sessionQueue[swapIndex]?.reps || 10
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

      {/* exercise guide modal for quick learning, */}
      {/* opens from session preview exercise names, */}
      {/* shows a short description without leaving the page, */}
      {/* closes with the standard modal close button */}
      {guideOpen && (
        <div className="studio-swap-backdrop">
          <div className="studio-swap-panel">
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Exercise Guide</div>
                <div className="studio-swap-sub">Quick overview before you start.</div>
              </div>
              <button
                className="studio-swap-close"
                onClick={() => {
                  setGuideOpen(false);
                  setGuideDetails(null);
                }}
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
                  {guideLoading ? (
                    <div className="studio-empty">Loading guide...</div>
                  ) : (
                    <div className="studio-guide-text">
                      {guideDetails?.description || 'No guide yet. Focus on control and form.'}
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
    </div>
  );
};

export default StrengthProgressTab;


