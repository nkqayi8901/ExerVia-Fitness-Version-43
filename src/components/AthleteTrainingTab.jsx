// src/components/AthleteTrainingTab.jsx
// this component powers the Athlete Training area,
// it manages plans, sessions, timers, and reflections,
// and coordinates UI state with Supabase data,
// comments below explain each major block
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { recalcUserState } from '../services/stateEngine';
import { trackDailyActivity } from '../services/activityTracker';
// Component: AthleteTrainingTab - UI layout and interactions.
// This component renders the athletetrainingtab experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// the Athlete Training Tab is the core of the athlete mode experience,
// it allows users to browse training plans, log sessions, and track their progress,
// it integrates with Supabase to fetch and store plans and sessions,
// it also includes timers and countdowns for session execution,
// the UI layout and styling was adapted from Tailwind
// components found on https://tailwindui.com/preview
// the data fetching and state management logic was 
// adapted from the patterns I learned in the SystemStatus and Navbar components,

// fallbackPlans provide a local default when the API is empty,
// they ensure the UI has content for new users,
// each plan includes a summary + weekly outline,
// and these are used only if no remote plans exist
const fallbackPlans = [
  {
    id: 'hyrox-foundation',
    name: 'Hyrox Foundation',
    sport: 'hybrid',
    goal: 'Hybrid engine + strength endurance',
    summary: '4-week build blending running, sled work, and stations.',
    defaultFocus: 'Race Prep',
    durationTarget: 60,
    distanceTarget: 8,
    outline: [
      { week: 'Week 1', sessions: ['Run 40 min', 'Sled push/pull technique', 'Burpee broad jumps'] },
      { week: 'Week 2', sessions: ['Tempo 20 min', 'Wall balls + farmer carry', 'Row intervals'] },
      { week: 'Week 3', sessions: ['Mixed station circuit', 'Run 50 min', 'Ski erg intervals'] },
      { week: 'Week 4', sessions: ['Race simulation', 'Recovery 30 min', 'Mobility reset'] },
    ],
    source: 'fallback'
  },
  {
    id: 'hybrid-endurance',
    name: 'Hybrid Endurance',
    sport: 'hybrid',
    goal: 'Strength base + endurance conditioning',
    summary: 'Balanced week with strength intervals and longer cardio blocks.',
    defaultFocus: 'Base',
    durationTarget: 55,
    distanceTarget: 6,
    outline: [
      { week: 'Week 1', sessions: ['Strength density 30 min', 'Zone 2 35 min', 'Recovery 25 min'] },
      { week: 'Week 2', sessions: ['Tempo 15 min', 'Carry + sled circuit', 'Endurance 50 min'] },
      { week: 'Week 3', sessions: ['Speed ladder', 'Zone 2 45 min', 'Mobility reset'] },
      { week: 'Week 4', sessions: ['Test day', 'Recovery 30 min', 'Endurance 60 min'] },
    ],
    source: 'fallback'
  },
  {
    id: 'running-pace-builder',
    name: 'Running Pace Builder',
    sport: 'running',
    goal: 'Build aerobic base and controlled speed',
    summary: '4-week progression for pacing confidence and recovery balance.',
    defaultFocus: 'Base',
    durationTarget: 50,
    distanceTarget: 8,
    outline: [
      { week: 'Week 1', sessions: ['Base run 40 min', 'Tempo 15 min', 'Recovery jog 25 min'] },
      { week: 'Week 2', sessions: ['Intervals 6x2 min', 'Base run 45 min', 'Mobility + strides'] },
      { week: 'Week 3', sessions: ['Tempo 20 min', 'Long run 60 min', 'Recovery jog 30 min'] },
      { week: 'Week 4', sessions: ['Test 5K effort', 'Easy run 35 min', 'Reset + mobility'] },
    ],
    source: 'fallback'
  },
  {
    id: 'cycling-power-base',
    name: 'Cycling Power Base',
    sport: 'cycling',
    goal: 'Raise threshold while keeping endurance volume',
    summary: 'Balanced cadence, hill, and recovery work over 4 weeks.',
    defaultFocus: 'Tempo',
    durationTarget: 60,
    distanceTarget: 22,
    outline: [
      { week: 'Week 1', sessions: ['Zone 2 ride 60 min', 'Cadence drill 40 min', 'Recovery spin 25 min'] },
      { week: 'Week 2', sessions: ['Hill repeats 6x3 min', 'Tempo ride 30 min', 'Easy spin 30 min'] },
      { week: 'Week 3', sessions: ['Power intervals 5x4 min', 'Zone 2 ride 75 min', 'Mobility reset'] },
      { week: 'Week 4', sessions: ['Threshold test ride', 'Easy spin 35 min', 'Recovery day'] },
    ],
    source: 'fallback'
  },
  {
    id: 'swim-tech-endurance',
    name: 'Swim Tech Endurance',
    sport: 'swimming',
    goal: 'Improve efficiency and repeatable pace',
    summary: 'Technique-first blocks with steady endurance progression.',
    defaultFocus: 'Base',
    durationTarget: 45,
    distanceTarget: 2,
    outline: [
      { week: 'Week 1', sessions: ['Drill set 30 min', 'Steady swim 25 min', 'Kick + pull mix'] },
      { week: 'Week 2', sessions: ['Tempo 12x50m', 'Technique 30 min', 'Recovery easy laps'] },
      { week: 'Week 3', sessions: ['Pace set 8x100m', 'Steady swim 35 min', 'Breath control set'] },
      { week: 'Week 4', sessions: ['400m time trial', 'Easy technique swim', 'Mobility + recovery'] },
    ],
    source: 'fallback'
  },
  {
    id: 'trail-climb-engine',
    name: 'Trail Climb Engine',
    sport: 'trail',
    goal: 'Climbing strength and downhill control',
    summary: 'Trail-focused build with elevation, tempo, and durability work.',
    defaultFocus: 'Race Prep',
    durationTarget: 65,
    distanceTarget: 10,
    outline: [
      { week: 'Week 1', sessions: ['Hill reps 8x60s', 'Easy trail 35 min', 'Hike strength 40 min'] },
      { week: 'Week 2', sessions: ['Tempo trail 25 min', 'Long trail 70 min', 'Recovery walk + mobility'] },
      { week: 'Week 3', sessions: ['Climb repeats 6x3 min', 'Trail endurance 80 min', 'Easy trail 30 min'] },
      { week: 'Week 4', sessions: ['Simulation run', 'Recovery 30 min', 'Mobility reset'] },
    ],
    source: 'fallback'
  },
];

// emptyPlan is the template used when creating a new plan,
// it keeps form state consistent and avoids undefined fields,
// outline starts with a single editable week,
// and values get replaced as the user fills the form
const emptyPlan = {
  name: '',
  sport: 'running',
  goal: '',
  summary: '',
  defaultFocus: 'Base',
  durationTarget: '',
  distanceTarget: '',
  outline: [{ week: 'Week 1', sessions: [''] }]
};

// AthleteTrainingTab is the main training hub for athlete mode,
// it manages selection, creation, and execution of plans,
// it controls countdowns, timers, and session logging,
// and renders the full training UI for this section
const AthleteTrainingTab = ({ userId, onBack }) => {
  const navigate = useNavigate();
  const [banner, setBanner] = useState(null);
  const [pulsePanel, setPulsePanel] = useState(false);
  const [session, setSession] = useState({
    sport: 'running',
    duration: '',
    distance: '',
    heartRate: '',
    mood: 'Focused',
    notes: ''
  });
  const [sessionFocus, setSessionFocus] = useState('Base');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [planSportFilter, setPlanSportFilter] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [isPlanSaving, setIsPlanSaving] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [showPlanLibrary, setShowPlanLibrary] = useState(true);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [floorUiHidden, setFloorUiHidden] = useState(false);
  const [finishHold, setFinishHold] = useState(0);
  const [isHoldingFinish, setIsHoldingFinish] = useState(false);
  const [sessionIntention, setSessionIntention] = useState('');
  const [sessionReflection, setSessionReflection] = useState('');
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [lastLoggedSessionId, setLastLoggedSessionId] = useState(null);
  const [lastLoggedNotes, setLastLoggedNotes] = useState('');
  const [completedSessionLabel, setCompletedSessionLabel] = useState('');
  const [planFavorites, setPlanFavorites] = useState([]);
  const [pinnedOrder, setPinnedOrder] = useState([]);
  const [draggingPin, setDraggingPin] = useState(null);
  const [newPlan, setNewPlan] = useState({ ...emptyPlan });
  const [apiStatus, setApiStatus] = useState('idle');
  const [congratsOpen, setCongratsOpen] = useState(false);
  const [sessionLoggedPulseOpen, setSessionLoggedPulseOpen] = useState(false);

  // focusOptions and sports drive filters + dropdowns,
  // trainingWorlds define the themed entry points,
  // these labels are used across the plan library,
  // and keep the UI copy consistent
  const focusOptions = ['Base', 'Tempo', 'Speed', 'Recovery', 'Race Prep'];
  const sports = ['running', 'cycling', 'swimming', 'hybrid', 'trail'];
  const trainingWorlds = [
    { id: 'hybrid', title: 'Hybrid Arena', subtitle: 'Carry, sled, engine', sport: 'hybrid' },
    { id: 'running', title: 'Velocity Lab', subtitle: 'Tempo and pace craft', sport: 'running' },
    { id: 'cycling', title: 'Torque Studio', subtitle: 'Cadence and climbs', sport: 'cycling' },
    { id: 'swimming', title: 'Flow Pool', subtitle: 'Form and oxygen', sport: 'swimming' },
    { id: 'trail', title: 'Trail Forge', subtitle: 'Elevation resilience', sport: 'trail' }
  ];
  // outlinePresets provide quick session templates by sport,
  // they accelerate plan creation with curated weeks,
  // keys align to focusOptions and sports,
  // and are used when users select a focus
  const outlinePresets = {
    running: {
      Base: ['Base run 40 min', 'Tempo 20 min', 'Recovery 30 min'],
      Tempo: ['Tempo 20 min', 'Intervals 6x2', 'Easy run 35 min'],
      Speed: ['Strides 10x20s', 'Intervals 8x400', 'Recovery 25 min'],
      Recovery: ['Easy run 30 min', 'Mobility reset', 'Recovery walk 20 min'],
      'Race Prep': ['Race simulation', 'Tempo 25 min', 'Easy run 30 min']
    },
    cycling: {
      Base: ['Zone 2 60 min', 'Cadence 45 min', 'Recovery spin 30 min'],
      Tempo: ['Tempo 20 min', 'Hill repeats 6x2', 'Easy spin 30 min'],
      Speed: ['Power sprints 8x30s', 'Intervals 5x3', 'Recovery 25 min'],
      Recovery: ['Easy spin 30 min', 'Mobility reset', 'Core reset'],
      'Race Prep': ['Test ride 45 min', 'Tempo 30 min', 'Easy spin 35 min']
    },
    swimming: {
      Base: ['Technique 30 min', 'Steady 25 min', 'Kick set 20 min'],
      Tempo: ['Tempo 20 min', 'Intervals 10x50', 'Recovery 20 min'],
      Speed: ['Sprints 12x25', 'Pull buoy 25 min', 'Recovery 20 min'],
      Recovery: ['Easy swim 25 min', 'Mobility reset', 'Breath control'],
      'Race Prep': ['Test 400m', 'Tempo 25 min', 'Easy 20 min']
    },
    hybrid: {
      Base: ['Carry ladder 20 min', 'Zone 2 35 min', 'Recovery 25 min'],
      Tempo: ['Mixed circuit 30 min', 'Tempo run 25 min', 'Mobility reset'],
      Speed: ['Sled push 6x20m', 'Row 5x500', 'Recovery 25 min'],
      Recovery: ['Easy run 25 min', 'Mobility reset', 'Breathwork'],
      'Race Prep': ['Simulation day', 'Tempo 20 min', 'Recovery 30 min']
    },
    trail: {
      Base: ['Hills 6x60s', 'Easy run 30 min', 'Strength hike 40 min'],
      Tempo: ['Tempo trail 25 min', 'Long trail 75 min', 'Mobility reset'],
      Speed: ['Hill sprints 10x20', 'Easy run 30 min', 'Recovery 25 min'],
      Recovery: ['Easy trail 30 min', 'Mobility reset', 'Recovery walk'],
      'Race Prep': ['Trail simulation', 'Tempo 25 min', 'Recovery 30 min']
    }
  };

  // calculateEfficiency computes a simple pacing efficiency score,
  // it returns value, pace, and a readable insight label,
  // used to give immediate feedback on logged sessions,
  // returns null when required inputs are missing
  const calculateEfficiency = (distance, time, heartRate) => {
    if (!distance || !time || !heartRate) return null;
    const paceMinutesPerKm = parseFloat(time) / parseFloat(distance);
    const efficiency = paceMinutesPerKm / parseFloat(heartRate);

    let insight = '';
    if (efficiency < 0.02) insight = 'Elite efficiency';
    else if (efficiency < 0.03) insight = 'Very efficient';
    else if (efficiency < 0.04) insight = 'Good efficiency';
    else if (efficiency < 0.05) insight = 'Average efficiency';
    else insight = 'Room for improvement';

    return {
      value: efficiency.toFixed(4),
      insight,
      pace: paceMinutesPerKm.toFixed(2)
    };
  };

  // mapPlan normalizes remote plan data into local shape,
  // converts sport names into supported categories,
  // adds defaults for missing fields to keep UI stable,
  // returns null for unsupported plan types
  const mapPlan = (plan, source) => {
// rawSport manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const rawSport = (plan.sport || 'running').toLowerCase();
    const normalizedSport = ['hyrox', 'functional', 'hybrid'].includes(rawSport) ? 'hybrid' : rawSport;
    if (normalizedSport === 'row') return null;
    return {
      id: plan.id || plan.slug || plan.name,
      name: plan.name,
      sport: normalizedSport,
      rawSport,
      goal: plan.goal || 'Custom plan',
      summary: plan.summary || 'Custom plan overview.',
      defaultFocus: plan.defaultFocus || plan.default_focus || 'Base',
      durationTarget: plan.durationTarget ?? plan.duration_target ?? '',
      distanceTarget: plan.distanceTarget ?? plan.distance_target ?? '',
      outline: Array.isArray(plan.outline) ? plan.outline : [],
      source
    };
  };

  // dedupePlans removes repeated plans coming from multiple sources.
  // It dedupes by normalized sport+name (not id), because the same plan
  // can arrive with different ids from template/api/live sources.
  // When duplicates collide, it keeps the higher-priority source.
  const dedupePlans = (list) => {
    const sourceRank = { user: 4, template: 3, api: 2, fallback: 1 };
    const bucket = new Map();

    list.forEach((plan) => {
      if (!plan) return;
      const source = String(plan.source || '').toLowerCase();
      const sportKey = String(plan.sport || '').trim().toLowerCase();
      const nameKey = String(plan.name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      const key = `${sportKey}::${nameKey}`;
      if (!sportKey || !nameKey) return;

      const existing = bucket.get(key);
      if (!existing) {
        bucket.set(key, plan);
        return;
      }

      const currentRank = sourceRank[source] || 0;
      const existingRank = sourceRank[String(existing.source || '').toLowerCase()] || 0;

      if (currentRank > existingRank) {
        bucket.set(key, plan);
      }
    });

    return Array.from(bucket.values());
  };

  // loadFavorites pulls pinned plan ids from local storage,
  // keeps user preferences persistent across sessions,
  // safely handles malformed storage data,
  // used to initialize the favorites state
  const loadFavorites = () => {
    const stored = localStorage.getItem('exervia_plan_favorites');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  };

  // loadPinnedOrder restores the custom plan ordering,
  // this keeps the library layout stable for the user,
  // safely parses stored order or returns an empty list,
  // used when rendering the pinned plans list
  const loadPinnedOrder = () => {
    const stored = localStorage.getItem('exervia_plan_pinned_order');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  };

  // saveFavorites writes the favorites list to state + storage,
  // keeps the UI updated immediately after changes,
  // persists plan pins across reloads,
  // used by favorite toggle interactions
  const saveFavorites = (items) => {
    setPlanFavorites(items);
    localStorage.setItem('exervia_plan_favorites', JSON.stringify(items));
  };

  // savePinnedOrder stores the custom ordering of pinned plans,
  // ensures the pinned list renders in the user’s order,
  // persists the ordering in local storage,
  // used when dragging or reordering pins
  const savePinnedOrder = (items) => {
    setPinnedOrder(items);
    localStorage.setItem('exervia_plan_pinned_order', JSON.stringify(items));
  };

  // togglePlanFavorite adds or removes a plan from favorites,
  // keeps pinned order in sync with favorites,
  // handles both add and remove flows,
  // prevents invalid plans from being processed
  const togglePlanFavorite = (plan) => {
    if (!plan?.name) return;
    if (planFavorites.includes(plan.name)) {
      const next = planFavorites.filter(item => item !== plan.name);
      saveFavorites(next);
      savePinnedOrder(pinnedOrder.filter(item => item !== plan.name));
    } else {
      saveFavorites([...planFavorites, plan.name]);
      if (!pinnedOrder.includes(plan.name)) {
        savePinnedOrder([...pinnedOrder, plan.name]);
      }
    }
  };

  // buildOutline generates a 4-week outline from presets,
  // blends focus, duration, and distance into sessions,
  // applies week intensity labels for readability,
  // returns a normalized outline array for new plans
  const buildOutline = (sport, focus, duration, distance) => {
    const durationTag = duration ? `${duration} min` : null;
    const distanceTag = distance ? `${distance} km` : null;
    const tag = [durationTag, distanceTag].filter(Boolean).join(' · ');
    const weekFocus = [
      focus,
      focus === 'Base' ? 'Tempo' : 'Base',
      focus === 'Speed' ? 'Tempo' : 'Speed',
      'Recovery'
    ];
    const weekIntensity = ['70%', '85%', '95%', '60%'];
    return weekFocus.map((weekFocusLabel, idx) => {
      const template = outlinePresets[sport]?.[weekFocusLabel] || outlinePresets[sport]?.Base;
      const baseSessions = template || ['Session 1', 'Session 2', 'Session 3'];
      const sessions = baseSessions.map((item, index) => {
        if (!tag) return item;
        if (index === 0) return `${item} · ${tag}`;
        return item;
      });
      return {
        week: `Week ${idx + 1}`,
        intensity: weekIntensity[idx] || '70%',
        focus: weekFocusLabel,
        sessions
      };
    });
  };

  // fetchExternalPlans loads plans from a public endpoint,
  // handles API errors and sets the apiStatus flag,
  // maps external payloads into the local plan shape,
  // returns a normalized list for aggregation
  const fetchExternalPlans = async () => {
    const endpoint = process.env.REACT_APP_TRAINING_PLANS_API || '/data/training-plans.json';
    setApiStatus('loading');
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        setApiStatus('error');
        return [];
      }
      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : payload?.plans || payload?.data || [];
      setApiStatus('ready');
      return list.map(item => mapPlan(item, 'api'));
    } catch (error) {
      console.error('Plan API error:', error);
      setApiStatus('error');
      return [];
    }
  };

  // fetchPlans aggregates all plan sources,
  // merges API, templates, and user-created plans,
  // falls back to local defaults when empty,
  // and updates the plan list state
  const fetchPlans = async () => {
    const collected = [];
    const apiPlans = await fetchExternalPlans();

    if (apiPlans.length > 0) {
      apiPlans.forEach(plan => {
        if (plan) collected.push(plan);
      });
    }

    const { data: templateData } = await supabase
      .from('training_plan_templates')
      .select('*')
      .limit(40);

    if (templateData && templateData.length > 0) {
      templateData.forEach(template => {
        const mapped = mapPlan(template, 'template');
        if (mapped) collected.unshift(mapped);
      });
    }

    if (userId) {
      const { data: userPlanData } = await supabase
        .from('user_training_plans')
        .select('*')
        .eq('user_id', userId)
        .limit(30);

      if (userPlanData && userPlanData.length > 0) {
        userPlanData.forEach(plan => {
          const mapped = mapPlan(plan, 'user');
          if (mapped) collected.unshift(mapped);
        });
      }
    }

    if (collected.length === 0) {
      collected.push(...fallbackPlans);
    }

    setPlans(dedupePlans(collected));
  };

  // startPlan applies a selected plan to session state,
  // sets focus, duration, distance, and notes,
  // closes the plan panel and opens the pulse view,
  // and shows a banner confirming the selection
  const startPlan = (plan) => {
    setSelectedPlan(plan);
    setSessionFocus(plan.defaultFocus || 'Base');
    setSession(prev => ({
      ...prev,
      sport: plan.sport,
      // Keep duration user-driven to avoid logging auto-filled defaults.
      duration: prev.duration || '',
      distance: plan.distanceTarget ? String(plan.distanceTarget) : '',
      notes: `Plan: ${plan.name} - ${plan.summary}`
    }));
    setPlanOpen(false);
    setPulsePanel(true);
    setBanner({ type: 'info', message: `${plan.name} loaded. Focus set to ${plan.defaultFocus || 'Base'}.` });
  };

  // openFocusLock triggers the 3-2-1 lock-in flow,
  // optionally starts the plan before countdown,
  // resets timer state for the session run,
  // and sets the banner to guide the user
  const openFocusLock = (plan) => {
    if (plan) {
      startPlan(plan);
    }
    setCountdown(3);
    setCountdownOpen(true);
    setTimerSeconds(0);
    setBanner({ type: 'info', message: 'Session starting. Lock in.' });
  };

  // prefillPlanEditor loads a plan into the edit form,
  // supports editing only for user-owned plans,
  // populates all fields including outline weeks,
  // opens the create/edit modal for changes
  const prefillPlanEditor = (plan) => {
    setEditingPlanId(plan.source === 'user' ? plan.id : null);
    setNewPlan({
      name: plan.name,
      sport: plan.sport || 'running',
      goal: plan.goal || '',
      summary: plan.summary || '',
      defaultFocus: plan.defaultFocus || 'Base',
      durationTarget: plan.durationTarget || '',
      distanceTarget: plan.distanceTarget || '',
      outline: (plan.outline || []).length > 0 ? plan.outline : [{ week: 'Week 1', sessions: [''] }]
    });
    setShowCreatePlan(true);
  };

  // savePlan validates and persists the current plan draft,
  // updates user plans in Supabase when applicable,
  // refreshes the plan list on success,
  // and handles error feedback via banner
  const savePlan = async () => {
    if (!newPlan.name.trim()) {
      setBanner({ type: 'warn', message: 'Add a plan name to continue.' });
      return;
    }

    setIsPlanSaving(true);
    const payload = {
      user_id: userId,
      name: newPlan.name.trim(),
      sport: newPlan.sport,
      goal: newPlan.goal.trim(),
      summary: newPlan.summary.trim(),
      default_focus: newPlan.defaultFocus,
      duration_target: newPlan.durationTarget ? parseInt(newPlan.durationTarget, 10) : null,
      distance_target: newPlan.distanceTarget ? parseFloat(newPlan.distanceTarget) : null,
      outline: newPlan.outline
    };

    const { error } = editingPlanId
      ? await supabase
        .from('user_training_plans')
        .update(payload)
        .eq('id', editingPlanId)
      : await supabase
        .from('user_training_plans')
        .insert([payload]);

    if (!error) {
      setBanner({
        type: 'success',
        message: editingPlanId ? 'Plan updated in your library.' : 'Plan saved to your library.'
      });
      setShowCreatePlan(false);
      setEditingPlanId(null);
      setNewPlan({ ...emptyPlan });
      fetchPlans();
    } else {
      console.error('Error saving plan:', error);
      setBanner({ type: 'error', message: 'Could not save plan.' });
    }

    setIsPlanSaving(false);
  };

  // deletePlan removes a user-owned plan from Supabase,
  // only runs for user plans (not templates or API),
  // resets selection + closes panels after delete,
  // and refreshes the plan list on success
  const deletePlan = async () => {
    if (!selectedPlan || selectedPlan.source !== 'user') return;
    const { error } = await supabase
      .from('user_training_plans')
      .delete()
      .eq('id', selectedPlan.id);

    if (error) {
      console.error('Error deleting plan:', error);
      setBanner({ type: 'error', message: 'Could not delete plan.' });
      return;
    }

    setBanner({ type: 'success', message: 'Plan deleted.' });
    setSelectedPlan(null);
    setPlanOpen(false);
    fetchPlans();
  };

  const sharePlanToCommunity = async (plan = selectedPlan) => {
    if (!userId || !plan) return;
    const sourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(plan.id || '')
    )
      ? String(plan.id)
      : null;
    const tags = [
      plan.sport || '',
      plan.defaultFocus || '',
      plan.goal || ''
    ]
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
    const payload = {
      name: plan.name,
      sport: plan.sport || 'running',
      goal: plan.goal || '',
      summary: plan.summary || '',
      defaultFocus: plan.defaultFocus || 'Base',
      durationTarget: plan.durationTarget ?? null,
      distanceTarget: plan.distanceTarget ?? null,
      outline: Array.isArray(plan.outline) ? plan.outline : []
    };
    const { error } = await supabase.from('shared_templates').insert([{
      template_type: 'training_plan',
      source_id: sourceId,
      title: plan.name,
      subtitle: plan.goal || 'Training plan',
      goal: plan.goal || '',
      summary: plan.summary || '',
      sport: plan.sport || null,
      duration_target: plan.durationTarget ? Number(plan.durationTarget) : null,
      distance_target: plan.distanceTarget ? Number(plan.distanceTarget) : null,
      tags,
      payload,
      created_by: Number(userId)
    }]);
    if (error) {
      setBanner({ type: 'error', message: 'Could not share plan.' });
      return;
    }
    setBanner({ type: 'success', message: 'Plan shared to Community Templates.' });
  };

  // auto-dismiss banner after a short delay,
  // keeps notifications visible but non-blocking,
  // clears timeout on re-render,
  // prevents banners from stacking
  useEffect(() => {
    if (!banner) return undefined;
    const timeout = setTimeout(() => setBanner(null), 3200);
    // Render
    return () => clearTimeout(timeout);
  }, [banner]);

  // pulse panel effect for a quick visual cue,
  // auto-closes the pulse after a short duration,
  // prevents repeated pulses from lingering,
  // resets on each activation
  useEffect(() => {
    if (!pulsePanel) return undefined;
    const timeout = setTimeout(() => setPulsePanel(false), 800);
    return () => clearTimeout(timeout);
  }, [pulsePanel]);

  // session timer tick loop,
  // runs while timerRunning is true,
  // increments seconds every 1s,
  // cleans up interval on stop/unmount
  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // hides the floor UI after timer starts,
  // gives users a few seconds before hiding,
  // resets when timer opens,
  // clears timeout on unmount
  useEffect(() => {
    if (!timerOpen) return undefined;
    setFloorUiHidden(false);
    const timeout = setTimeout(() => {
      setFloorUiHidden(true);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [timerOpen]);

  // 3-2-1 countdown flow before session timer,
  // transitions into timer mode when countdown hits 0,
  // resets countdown state for next run,
  // runs only while countdownOpen is true
  useEffect(() => {
    if (!countdownOpen) return undefined;
    if (countdown <= 0) {
      setCountdownOpen(false);
      setTimerOpen(true);
      setTimerRunning(true);
      setTimerSeconds(0);
      setCountdown(3);
      return undefined;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdownOpen, countdown]);

  // handleLogSession writes the session to Supabase,
  // computes efficiency metrics when available,
  // attaches plan info + intention to notes,
  // resets form state and refreshes user stats
  const handleLogSession = async () => {
    const typedDuration = parseInt(session.duration, 10);
    const timerDerivedDuration = timerSeconds > 0 ? Math.max(1, Math.round(timerSeconds / 60)) : 0;
    const planDurationTarget = Number(selectedPlan?.durationTarget || 0);
    const resolvedDuration =
      (Number.isFinite(typedDuration) && typedDuration > 0 ? typedDuration : 0) ||
      timerDerivedDuration ||
      (planDurationTarget > 0 ? planDurationTarget : 0);

    if (!resolvedDuration || !session.sport) {
      setBanner({ type: 'warn', message: 'Please add a duration source and sport before logging.' });
      return;
    }

    let efficiencyData = null;

    if (session.distance && session.duration && session.heartRate) {
      efficiencyData = calculateEfficiency(session.distance, session.duration, session.heartRate);
    }

    const combinedNotes = [
      session.notes.trim(),
      sessionIntention.trim() ? `Intention: ${sessionIntention.trim()}` : ''
    ].filter(Boolean).join('\n');
    const loggedLabel = selectedPlan?.name || `${String(session.sport || 'training').toUpperCase()} session`;

    const sessionData = {
      user_id: userId,
      sport: session.sport,
      level: 'advanced',
      duration_minutes: resolvedDuration,
      effort_level: null,
      mood_emoji: session.mood,
      notes: combinedNotes,
      metrics: {
        distance: session.distance ? parseFloat(session.distance) : null,
        heart_rate: session.heartRate ? parseInt(session.heartRate, 10) : null,
        efficiency_factor: efficiencyData ? efficiencyData.value : null,
        focus: sessionFocus,
        plan_id: selectedPlan ? selectedPlan.id : null,
        plan_name: selectedPlan ? selectedPlan.name : null
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
      const durationBaseXp = resolvedDuration || 0;
      if (data?.id && durationBaseXp > 0) {
        const { error: xpError } = await supabase.rpc('grant_xp_event', {
          p_user_id: Number(userId),
          p_event_type: 'training_session',
          p_base_xp: durationBaseXp,
          p_idempotency_key: `training_session:${data.id}`,
          p_source_table: 'training_sessions',
          p_source_id: String(data.id),
          p_meta: {
            sport: session.sport,
            focus: sessionFocus,
            duration_minutes: durationBaseXp,
            plan_id: selectedPlan ? selectedPlan.id : null,
            plan_name: selectedPlan ? selectedPlan.name : null,
          },
        });
        if (xpError) {
          console.error('grant_xp_event failed:', xpError);
        }
      }
      try {
        await trackDailyActivity(userId, 'training_session');
      } catch (activityError) {
        console.error('trackDailyActivity failed:', activityError);
      }
      try {
        await recalcUserState(userId);
      } catch (stateError) {
        console.error('recalcUserState failed:', stateError);
      }
      window.dispatchEvent(new Event('user_state_updated'));

      if (efficiencyData && parseFloat(efficiencyData.value) < 0.03) {
        setBanner({ type: 'success', message: 'Great efficiency score. Cardiovascular fitness is improving.' });
      } else {
        setBanner({ type: 'info', message: 'Session logged. Keep building.' });
      }

      setSession({
        sport: 'running',
        duration: '',
        distance: '',
        heartRate: '',
        mood: 'Focused',
        notes: ''
      });
      setSessionIntention('');
      setSessionReflection('');
      setLastLoggedSessionId(data?.id || null);
      setLastLoggedNotes(combinedNotes);
      setCompletedSessionLabel(loggedLabel);
      setSessionFocus('Base');
      setSelectedPlan(null);
      setCongratsOpen(false);
      setSessionLoggedPulseOpen(true);
      if (sessionLoggedPulseTimerRef.current) {
        clearTimeout(sessionLoggedPulseTimerRef.current);
      }
      sessionLoggedPulseTimerRef.current = setTimeout(() => {
        setSessionLoggedPulseOpen(false);
        navigate(`/athlete/${userId}/logs`);
      }, 1100);
    } else {
      console.error('Error logging session:', error);
      setBanner({ type: 'error', message: 'Could not log session. Try again.' });
    }

  };

  // finishSession ends the active timer flow,
  // stops the timer and closes the timer UI,
  // then delegates to handleLogSession,
  // keeps session completion in one path
  const finishSession = () => {
    setTimerRunning(false);
    setTimerOpen(false);
    handleLogSession();
  };

  // saveReflection appends a reflection to the last session,
  // requires a logged session id to update notes,
  // posts the update to Supabase and shows feedback,
  // closes the congrats modal after completion
  const saveReflection = async () => {
    const reflection = sessionReflection.trim();
    if (!reflection || !lastLoggedSessionId) {
      setCongratsOpen(false);
      return;
    }
    setReflectionSaving(true);
    const updatedNotes = [lastLoggedNotes, `Reflection: ${reflection}`]
      .filter(Boolean)
      .join('\n');
    const { error } = await supabase
      .from('training_sessions')
      .update({ notes: updatedNotes })
      .eq('id', lastLoggedSessionId);
    if (error) {
      console.error('Error saving reflection:', error);
      setBanner({ type: 'error', message: 'Could not save reflection.' });
    } else {
      setBanner({ type: 'success', message: 'Reflection saved.' });
    }
    setReflectionSaving(false);
    setCongratsOpen(false);
  };

  // startFinishHold begins the hold-to-finish interaction,
  // increments progress until it reaches the threshold,
  // calls finishSession when complete,
  // ignores repeated starts while active
  const startFinishHold = () => {
    if (isHoldingFinish || holdTimerRef.current) return;
    setIsHoldingFinish(true);
    setFinishHold(0);
    const duration = 900;
    const step = 50;
    let elapsed = 0;
    holdTimerRef.current = setInterval(() => {
      elapsed += step;
      const progress = Math.min(elapsed / duration, 1);
      setFinishHold(progress);
      if (progress >= 1) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
        setIsHoldingFinish(false);
        setFinishHold(0);
        finishSession();
      }
    }, step);
  };

  // endFinishHold cancels the hold interaction,
  // clears the interval and resets progress state,
  // prevents accidental completion,
  // called on pointer/touch release
  const endFinishHold = () => {
    if (!holdTimerRef.current) return;
    clearInterval(holdTimerRef.current);
    holdTimerRef.current = null;
    setIsHoldingFinish(false);
    setFinishHold(0);
  };

  // initial data load for plans + local prefs,
  // recent sessions are user-specific,
  // plan sources still load without a signed-in user,
  // runs once per userId change
  useEffect(() => {
    fetchPlans();
    setPlanFavorites(loadFavorites());
    setPinnedOrder(loadPinnedOrder());
  }, [userId]);

  // filteredPlans applies search + sport filter,
  // keeps the library list focused by user input,
  // matches on name/goal/summary/sport fields,
  // used to render the program list
  const filteredPlans = plans.filter(plan => {
    const query = planSearch.toLowerCase();
    const sportMatch = planSportFilter ? plan.sport === planSportFilter : false;
    return (
      sportMatch && (
        plan.name.toLowerCase().includes(query) ||
        plan.goal.toLowerCase().includes(query) ||
        plan.summary.toLowerCase().includes(query) ||
        plan.sport.toLowerCase().includes(query) ||
        plan.rawSport?.toLowerCase().includes(query)
      )
    );
  });

  // recommendedPlans picks a small subset for quick access,
  // based on current session sport or focus,
  // keeps the highlight area concise,
  // used in the pinned/recommended strip
  const recommendedPlans = plans
    .filter(plan => plan.sport === session.sport || plan.defaultFocus === sessionFocus)
    .slice(0, 3);

  // companion hint uses session + plan context,
  // crafts a short tip to guide the user,
  // dispatches a custom event for the orb,
  // runs when sport or plan selection changes
  useEffect(() => {
    const companionPlan = selectedPlan || recommendedPlans[0];
    const planText = companionPlan ? `${companionPlan.name} could be a strong start today.` : 'Choose a plan to begin.';
    const tips = [];
    if (sessionFocus === 'Recovery') tips.push('Keep it light. Let the system reset.');
    else if (sessionFocus === 'Speed') tips.push('Short reps, full recovery.');
    else tips.push('Hold steady effort for clean volume.');
    if (session.duration) tips.push(`Aim for ${session.duration} min today.`);
    const tipText = tips.length ? `Tip: ${tips[0]}` : '';
    const text = `You have selected ${session.sport}. ${planText} ${tipText}`.trim();
    window.dispatchEvent(
      new CustomEvent('companion_hint', {
        detail: { text }
      })
    );
  }, [session.sport, selectedPlan, recommendedPlans]);

  // displayPlans limits visible plans for performance,
  // respects the showAll toggle and search state,
  // avoids overwhelming the user with long lists,
  // used by the plan library view
  const displayPlans = (planSportFilter ? filteredPlans : []).slice(
    0,
    showAllPlans || planSearch ? filteredPlans.length : 8
  );

  // aggregate plan state for summary cards,
  // derive pinned plan ordering and selection,
  // and prepare timeline context for the UI
  const sortedPins = [
    ...pinnedOrder.filter(item => planFavorites.includes(item)),
    ...planFavorites.filter(item => !pinnedOrder.includes(item))
  ];
  const pinnedPlans = sortedPins
    .map((item) => plans.find(plan => plan.name === item))
    .filter(Boolean);
  const pinnedPlan = pinnedPlans[0] || null;
  const timelinePlan = selectedPlan || pinnedPlan || recommendedPlans[0];
  const holdTimerRef = useRef(null);
  const sessionLoggedPulseTimerRef = useRef(null);

  // timer values are derived from session or plan,
  // targetSeconds drives the progress ring,
  // progress is clamped to 0-1 for UI safety,
  // used by the lock-in session screen
  const targetMinutes = session.duration || timelinePlan?.durationTarget || '';
  const targetSeconds = parseInt(targetMinutes, 10) * 60;
  const safeTargetSeconds = Number.isFinite(targetSeconds) ? targetSeconds : 0;
  const timerProgress = safeTargetSeconds ? Math.min(timerSeconds / safeTargetSeconds, 1) : 0;

  // formatTime renders mm:ss for the timer,
  // keeps the session display clean,
  // pads with zeros for consistency,
  // used across timer and countdown UI
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // breath phase cues during the first minute,
  // used to guide the user into rhythm,
  // labels switch based on elapsed time,
  // only active while timer is open
  const isBreathPhase = timerSeconds <= 60 && timerOpen;
  const breathLabel = timerSeconds <= 30 ? 'Inhale' : 'Exhale';
  const breathHint = timerSeconds <= 30 ? '4 seconds in · 4 seconds hold' : '6 seconds out · reset';
  const activeWorldSport = planSportFilter || selectedPlan?.sport || '';

  // handleBack returns to the parent view,
  // uses onBack if provided by the container,
  // falls back to router navigation otherwise,
  // keeps navigation logic centralized
  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    }
  };

  // remixPlan clones an existing plan into the editor,
  // prefixes the name to signal it is a remix,
  // resets editing id to avoid overwriting originals,
  // opens the create plan modal with prefilled values
  const remixPlan = (plan) => {
    if (!plan) return;
    setEditingPlanId(null);
    setNewPlan({
      name: `Remix · ${plan.name}`,
      sport: plan.sport || 'running',
      goal: plan.goal || '',
      summary: plan.summary || '',
      defaultFocus: plan.defaultFocus || 'Base',
      durationTarget: plan.durationTarget || '',
      distanceTarget: plan.distanceTarget || '',
      outline: (plan.outline || []).length > 0 ? plan.outline : [{ week: 'Week 1', sessions: [''] }]
    });
    setShowCreatePlan(true);
  };

  // cleanup effect for hold-to-finish timer,
  // clears any active intervals on unmount,
  // prevents stray timers from running in background,
  // keeps component lifecycle tidy
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }
      if (sessionLoggedPulseTimerRef.current) {
        clearTimeout(sessionLoggedPulseTimerRef.current);
      }
    };
  }, []);

  // getPlanStory builds a short narrative summary,
  // tailors the text to focus + sport,
  // used in the plan preview story block,
  // keeps tone consistent across the UI
  const getPlanStory = (plan) => {
    const focus = plan?.defaultFocus || 'Base';
    const sport = plan?.sport || 'training';
    if (focus === 'Speed') return `Short, sharp reps to lift your ${sport} pace.`;
    if (focus === 'Recovery') return `Low strain, clean rhythm, full system reset.`;
    if (focus === 'Race Prep') return `Precision blocks to peak for your next event.`;
    if (focus === 'Tempo') return `Sustained tempo to build durable engine.`;
    return `Foundational volume to grow your ${sport} capacity.`;
  };

  // render the athlete training experience,
  // combines plan library, session preview, and logging,
  // conditionally shows modals and overlays,
  // and wires up all interactive panels
  return (
    <div className="studio-shell" data-world={activeWorldSport}>
      <div className="studio-wrap">
        {/* top header with title + back action, */}
        {/* anchors the page context for the user, */}
        {/* keeps navigation consistent with other tabs, */}
        {/* and exposes the back control */}
        <header className="studio-header">
          <div>
            <button
              className="studio-back"
              onClick={handleBack}
              type="button"
            >
              {'Back'}
            </button>
            <div className="studio-kicker">ATHLETE STUDIO</div>
            <h2 className="studio-title">Training Ritual</h2>
            <p className="studio-subtitle">Precision sessions. Clean metrics. No noise.</p>
          </div>
        </header>

        {/* banner for inline feedback messages, */}
        {/* shows success/warn/error/info status, */}
        {/* auto-dismisses via effect above, */}
        {/* kept near the top for visibility */}
        {banner && (
          <div className={`studio-banner ${banner.type}`}>
            {banner.message}
          </div>
        )}

        {/* main content grid for library + preview, */}
        {/* left panel focuses on plan discovery, */}
        {/* right panel focuses on session preview, */}
        {/* layout stays consistent across states */}
        <div className="studio-grid">
          {/* plan library panel with filters + actions, */}
          {/* controls create/collapse and search behaviors, */}
          {/* renders pinned and available plans, */}
          {/* keeps selection logic in one place */}
          <section className="studio-panel studio-reveal">
              <div className="studio-panel-row">
                <div className="studio-panel-title">Plan Library</div>
                <div className="studio-panel-actions">
                  <button
                    className="studio-mini-btn ghost"
                    onClick={() => setShowPlanLibrary((prev) => !prev)}
                    type="button"
                  >
                    {showPlanLibrary ? 'Collapse list' : 'Show plans'}
                  </button>
                  <button
                    className="studio-mini-btn"
                    onClick={() => {
                      setEditingPlanId(null);
                      setNewPlan({ ...emptyPlan });
                      setShowCreatePlan(true);
                    }}
                    type="button"
                  >
                    Create plan
                  </button>
                </div>
              </div>

            {/* training worlds act as sport filters, */}
            {/* selecting a world activates its plan list, */}
            {/* clicking again clears the filter, */}
            {/* provides a fast entry into plan browsing */}
            <div className="studio-worlds">
              <div className="studio-panel-title">Training Worlds</div>
              <div className="studio-world-grid">
                {trainingWorlds.map((world) => (
                  <div
                    key={world.id}
                    className={`studio-world-card ${activeWorldSport === world.sport ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedPlan(null);
                      setPlanSearch('');
                      setShowAllPlans(false);
                      setPlanSportFilter(planSportFilter === world.sport ? '' : world.sport);
                    }}
                  >
                    <div className="studio-world-title">{world.title}</div>
                    <div className="studio-world-sub">{world.subtitle}</div>
                  </div>
                ))}
              </div>
            </div>

            {showPlanLibrary ? (
              <>
                <input
                  className="studio-search"
                  placeholder={planSportFilter ? 'Search plans' : 'Select a training world to unlock plans'}
                  value={planSearch}
                  onChange={(event) => setPlanSearch(event.target.value)}
                  disabled={!planSportFilter}
                />
                {apiStatus === 'loading' && (
                  <div className="studio-empty">Syncing plan sources...</div>
                )}
                {apiStatus === 'error' && (
                  <div className="studio-empty">Plan source offline. Showing your library.</div>
                )}
                {planSportFilter && planFavorites.length > 0 && (
                  <div className="studio-programs-block">
                    <div className="studio-panel-title">Pinned Plans</div>
                    <div className="studio-favorite-row">
                      {sortedPins.map((item, index) => (
                        <button
                          key={`fav-${item}`}
                          className="studio-favorite-chip"
                          draggable
                          onDragStart={() => setDraggingPin(index)}
                          onDragEnd={() => setDraggingPin(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (draggingPin === null || draggingPin === index) return;
                            const next = [...sortedPins];
                            const [moved] = next.splice(draggingPin, 1);
                            next.splice(index, 0, moved);
                            savePinnedOrder(next);
                            setDraggingPin(null);
                          }}
                      onClick={() => {
                        const match = plans.find(plan => plan.name === item);
                        if (match) {
                          setSelectedPlan(match);
                        }
                      }}
                          type="button"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!planSportFilter && (
                  <div className="studio-empty">
                    <div>Select a Training World to see curated plans.</div>
                    <button
                      className="studio-queue-btn ghost"
                      onClick={() => {
                        if (trainingWorlds[0]) {
                          setPlanSportFilter(trainingWorlds[0].sport);
                        }
                      }}
                      type="button"
                    >
                      Choose a world
                    </button>
                  </div>
                )}

                <div className="studio-programs">
                  {displayPlans.map((plan) => (
                    <button
                      key={plan.id}
                      className={`studio-program-card ${selectedPlan?.id === plan.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedPlan(plan);
                  }}
                    >
                      <div className="studio-program-head">
                        <div className="studio-program-name">{plan.name}</div>
                        <div className="studio-program-level">
                          {plan.sport.toUpperCase()} {plan.source === 'api' ? '- LIVE' : ''}
                        </div>
                      </div>
                      <div className="studio-program-sub">{plan.goal}</div>
                      <div className="studio-program-desc">{plan.summary}</div>
                      <div className="studio-program-story">{getPlanStory(plan)}</div>
                      <div className="studio-plan-favorite">
                        <button
                          className={`studio-queue-swap ${planFavorites.includes(plan.name) ? 'active' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePlanFavorite(plan);
                          }}
                          type="button"
                        >
                          {planFavorites.includes(plan.name) ? 'Pinned' : 'Pin'}
                        </button>
                      </div>
                      <div className="studio-plan-actions">
                        <button
                          className="studio-queue-btn ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                        setSelectedPlan(plan);
                        setPlanOpen(true);
                          }}
                          type="button"
                        >
                          View plan
                        </button>
                      </div>
                    </button>
                  ))}
                </div>

                {planSportFilter && planSearch && filteredPlans.length === 0 && (
                  <div className="studio-empty">No plans found for "{planSearch}".</div>
                )}
              </>
            ) : (
              <div className="studio-empty">Plan list collapsed to reduce scroll.</div>
            )}

            {planSportFilter && planSearch && filteredPlans.length === 0 && (
              <div className="studio-empty">No plans found for "{planSearch}".</div>
            )}
            {planSportFilter && !planSearch && filteredPlans.length === 0 && (
              <div className="studio-empty">No plans yet for {planSportFilter}.</div>
            )}
            {planSportFilter && !planSearch && !showAllPlans && filteredPlans.length > 8 && (
              <button
                className="studio-mini-btn"
                onClick={() => setShowAllPlans(true)}
                type="button"
              >
                Show more
              </button>
            )}
          </section>

          {/* session preview panel for the selected plan, */}
          {/* shows a brief outline + start actions, */}
          {/* includes recent session history below, */}
          {/* displays empty state when nothing is selected */}
          <section className="studio-panel studio-reveal">
            <div className="studio-panel-title">Session Preview</div>
            {selectedPlan ? (
              <>
                <div className="studio-plan-preview">
                  <div className="studio-plan-preview-title">{selectedPlan.name}</div>
                  <div className="studio-plan-preview-sub">{selectedPlan.goal}</div>
                <div className="studio-plan-preview-list">
                  {(selectedPlan.outline || []).slice(0, 2).map((block) => (
                    <div key={block.week} className="studio-plan-preview-row">
                      <div className="studio-plan-preview-week">{block.week}</div>
                      <div className="studio-plan-preview-sessions">
                        {(block.sessions || []).slice(0, 3).map((sessionItem, sessionIndex) => (
                          <span
                            key={`${block.week}-${sessionItem}-${sessionIndex}`}
                            className="studio-plan-preview-session-pill"
                          >
                            {sessionItem}
                          </span>
                        ))}
                        {(block.sessions || []).length > 3 && (
                          <span className="studio-plan-preview-session-more">
                            + {(block.sessions || []).length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                    {(selectedPlan.outline || []).length > 2 && (
                      <div className="studio-plan-preview-more">
                        + {(selectedPlan.outline || []).length - 2} more weeks
                      </div>
                    )}
                  </div>
                </div>
                <div className="studio-queue-actions studio-session-preview-actions">
                  <button
                    className="studio-queue-btn"
                    onClick={() => openFocusLock(selectedPlan)}
                    type="button"
                  >
                    Start session
                  </button>
                  <button
                    className="studio-queue-btn ghost"
                    onClick={() => setPlanOpen(true)}
                    type="button"
                  >
                    View plan
                  </button>
                  <button
                    className="studio-queue-btn ghost"
                    onClick={() => sharePlanToCommunity(selectedPlan)}
                    type="button"
                  >
                    Share to community
                  </button>
                </div>
              </>
            ) : (
              <div className="studio-empty">Select a plan to preview the session.</div>
            )}
          </section>
        </div>
      </div>

      {/* plan detail modal with full outline, */}
      {/* appears when a plan is opened from the list, */}
      {/* includes actions to start, pin, remix, delete, */}
      {/* closes to return to the main layout */}
      {planOpen && selectedPlan && (
        <div className="studio-swap-backdrop">
          <div className="studio-swap-panel">
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Plan Details</div>
                <div className="studio-swap-sub">{selectedPlan.name}</div>
              </div>
              <button
                className="studio-swap-close"
                onClick={() => setPlanOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
              <div className="studio-swap-body">
                <div className="studio-plan-detail">{selectedPlan.summary}</div>
                <div className="studio-plan-timeline">
                  {(selectedPlan.outline || []).map((block) => (
                    <div key={block.week} className="studio-plan-week">
                      <div className="studio-plan-week-title">
                        {block.week}
                        {block.intensity && (
                          <span className="studio-week-pill">{block.intensity}</span>
                        )}
                        {block.focus && (
                          <span className="studio-week-chip">{block.focus}</span>
                        )}
                      </div>
                      {block.intensity && (
                        <div className="studio-week-progress">
                          <div
                            className="studio-week-fill"
                            style={{ width: block.intensity }}
                          />
                        </div>
                      )}
                      <ul className="studio-plan-week-list">
                        {(block.sessions || []).map((item, itemIndex) => (
                          <li key={`${block.week}-${item}-${itemIndex}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <button
                  className="studio-primary-btn"
                  onClick={() => {
                    setPlanOpen(false);
                    openFocusLock(selectedPlan);
                  }}
                  type="button"
                >
                  Start session
                </button>
                <div className="studio-plan-actions">
                  <button
                    className={`studio-queue-btn ghost ${planFavorites.includes(selectedPlan.name) ? 'active' : ''}`}
                    onClick={() => togglePlanFavorite(selectedPlan)}
                    type="button"
                  >
                    {planFavorites.includes(selectedPlan.name) ? 'Pinned' : 'Pin'}
                  </button>
                  <button
                    className="studio-queue-btn ghost"
                    onClick={() => {
                      setPlanOpen(false);
                      remixPlan(selectedPlan);
                    }}
                    type="button"
                  >
                    Remix plan
                  </button>
                  <button
                    className="studio-queue-btn ghost"
                    onClick={() => sharePlanToCommunity(selectedPlan)}
                    type="button"
                  >
                    Share to community
                  </button>
                </div>
                {selectedPlan.source === 'user' ? (
                  <div className="studio-plan-actions">
                    <button
                      className="studio-queue-btn ghost"
                      onClick={() => {
                        setPlanOpen(false);
                        prefillPlanEditor(selectedPlan);
                      }}
                      type="button"
                    >
                      Edit plan
                    </button>
                    <button
                      className="studio-queue-btn ghost danger"
                      onClick={deletePlan}
                      type="button"
                    >
                      Delete plan
                    </button>
                  </div>
                ) : (
                  <div className="studio-plan-actions">
                    <button
                      className="studio-queue-btn ghost"
                      onClick={() => {
                        setPlanOpen(false);
                        prefillPlanEditor(selectedPlan);
                      }}
                      type="button"
                    >
                      Save as my plan
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
      )}

      {/* create/edit plan modal for custom plans, */}
      {/* collects plan metadata and weekly outline, */}
      {/* supports auto-fill and week management, */}
      {/* saves to Supabase on submit */}
      {showCreatePlan && (
        <div className="studio-swap-backdrop">
          <div className="studio-swap-panel">
            <div className="studio-swap-header">
              <div>
                <div className="studio-panel-title">Create Plan</div>
                <div className="studio-swap-sub">Build or customize your plan.</div>
              </div>
              <button
                className="studio-swap-close"
                onClick={() => {
                  setShowCreatePlan(false);
                  setEditingPlanId(null);
                  setNewPlan({ ...emptyPlan });
                }}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="studio-swap-body studio-create-program-panel">
              <div className="studio-form-grid">
                <label className="studio-form-field">
                  <span className="studio-input-label">Plan name</span>
                  <input
                    className="studio-search"
                    value={newPlan.name}
                    onChange={(event) => setNewPlan(prev => ({ ...prev, name: event.target.value }))}
                    placeholder="Hybrid Build"
                  />
                </label>
                <label className="studio-form-field">
                  <span className="studio-input-label">Sport</span>
                  <select
                    className="studio-select"
                    value={newPlan.sport}
                    onChange={(event) => setNewPlan(prev => ({ ...prev, sport: event.target.value }))}
                  >
                    {sports.map((sport) => (
                      <option key={sport} value={sport}>
                        {sport.charAt(0).toUpperCase() + sport.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="studio-form-field">
                  <span className="studio-input-label">Default focus</span>
                  <select
                    className="studio-select"
                    value={newPlan.defaultFocus}
                    onChange={(event) => setNewPlan(prev => ({ ...prev, defaultFocus: event.target.value }))}
                  >
                    {focusOptions.map((focus) => (
                      <option key={focus} value={focus}>{focus}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="studio-form-field">
                <span className="studio-input-label">Goal</span>
                <input
                  className="studio-search"
                  value={newPlan.goal}
                  onChange={(event) => setNewPlan(prev => ({ ...prev, goal: event.target.value }))}
                  placeholder="Endurance + strength blend"
                />
              </label>

              <label className="studio-form-field">
                <span className="studio-input-label">Summary</span>
                <textarea
                  className="studio-textarea"
                  value={newPlan.summary}
                  onChange={(event) => setNewPlan(prev => ({ ...prev, summary: event.target.value }))}
                  placeholder="What makes this plan unique"
                />
              </label>

              <div className="studio-form-grid">
                <label className="studio-form-field">
                  <span className="studio-input-label">Target duration</span>
                  <input
                    className="studio-search"
                    value={newPlan.durationTarget}
                    onChange={(event) => setNewPlan(prev => ({ ...prev, durationTarget: event.target.value }))}
                    placeholder="60"
                  />
                </label>
                <label className="studio-form-field">
                  <span className="studio-input-label">Target distance</span>
                  <input
                    className="studio-search"
                    value={newPlan.distanceTarget}
                    onChange={(event) => setNewPlan(prev => ({ ...prev, distanceTarget: event.target.value }))}
                    placeholder="8"
                  />
                </label>
              </div>

              <div className="studio-panel-title">Outline</div>
              <div className="studio-create-list studio-outline-editor">
                {newPlan.outline.map((block, idx) => (
                  <div key={`${block.week}-${idx}`} className="studio-outline-week-card">
                    <div className="studio-outline-week-head">
                      <label className="studio-form-field">
                        <span className="studio-input-label">Week title</span>
                        <input
                          className="studio-form-input studio-outline-week-input"
                          value={block.week}
                          onChange={(event) => {
                            const next = [...newPlan.outline];
                            next[idx] = { ...next[idx], week: event.target.value };
                            setNewPlan(prev => ({ ...prev, outline: next }));
                          }}
                          placeholder="Week 1"
                        />
                      </label>
                      {newPlan.outline.length > 1 && (
                        <button
                          className="studio-queue-btn ghost danger"
                          onClick={() => {
                            setNewPlan((prev) => ({
                              ...prev,
                              outline: prev.outline.filter((_, outlineIndex) => outlineIndex !== idx)
                            }));
                          }}
                          type="button"
                        >
                          Remove week
                        </button>
                      )}
                    </div>
                    <label className="studio-form-field">
                      <span className="studio-input-label">Session objectives</span>
                      <textarea
                        className="studio-textarea studio-outline-sessions"
                        value={(block.sessions || []).join('\n')}
                        onChange={(event) => {
                          const next = [...newPlan.outline];
                          next[idx] = {
                            ...next[idx],
                            sessions: event.target.value
                              .split('\n')
                              .map((sessionLine) => sessionLine.trim())
                              .filter(Boolean)
                          };
                          setNewPlan(prev => ({ ...prev, outline: next }));
                        }}
                        placeholder={'One objective per line\nTempo run 20 min\nMobility reset'}
                      />
                    </label>
                    {(block.sessions || []).length > 0 && (
                      <div className="studio-outline-preview">
                        {(block.sessions || []).map((sessionLine, sessionIndex) => (
                          <span
                            key={`${block.week}-${sessionLine}-${sessionIndex}`}
                            className="studio-outline-preview-pill"
                          >
                            {sessionLine}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="studio-create-actions">
                <button
                  className="studio-queue-btn ghost"
                  onClick={() => setNewPlan(prev => ({
                    ...prev,
                    outline: [...prev.outline, { week: `Week ${prev.outline.length + 1}`, sessions: [''] }]
                  }))}
                  type="button"
                >
                  Add week
                </button>
                <button
                  className="studio-queue-btn ghost"
                  onClick={() => setNewPlan(prev => ({
                    ...prev,
                    outline: buildOutline(prev.sport, prev.defaultFocus, prev.durationTarget, prev.distanceTarget)
                  }))}
                  type="button"
                >
                  Auto-fill 4 weeks
                </button>
                <button
                  className="studio-queue-btn"
                  onClick={savePlan}
                  type="button"
                  disabled={isPlanSaving}
                >
                  {isPlanSaving ? 'Saving...' : 'Save plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* floor mode timer overlay for active sessions, */}
      {/* shows live timer, progress bar, and cues, */}
      {/* allows pausing/resuming and hidden UI mode, */}
      {/* closes cleanly back to the main view */}
      {timerOpen && (
        <div
          className={`studio-floor-overlay ${floorUiHidden ? 'hidden-ui' : ''}`}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            setFloorUiHidden((prev) => !prev);
          }}
        >
          <div className="studio-floor-top">
            <div>
              <div className="studio-kicker">FLOOR MODE</div>
              <div className="studio-floor-title">
                {timelinePlan ? timelinePlan.name : 'Focused Session'}
              </div>
              <div className="studio-floor-sub">
                {sessionFocus} · {session.sport.toUpperCase()}
              </div>
            </div>
            <button
              className="studio-swap-close"
              onClick={() => {
                setTimerRunning(false);
                setTimerOpen(false);
              }}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="studio-floor-center">
            <div className="studio-floor-clock">{formatTime(timerSeconds)}</div>
            <div className="studio-floor-target">Target {formatTime(safeTargetSeconds)}</div>
            <div className="studio-floor-bar">
              <div
                className="studio-floor-progress"
                style={{ width: `${timerProgress * 100}%` }}
              />
            </div>
            {isBreathPhase && (
              <div className="studio-breath">
                <div className="studio-breath-ring" />
                <div className="studio-breath-label">{breathLabel}</div>
                <div className="studio-breath-sub">{breathHint}</div>
              </div>
            )}
          </div>
          <div className="studio-floor-actions">
            <button
              className="studio-queue-btn ghost"
              onClick={() => setTimerRunning(!timerRunning)}
              type="button"
            >
              {timerRunning ? 'Pause session' : 'Resume session'}
            </button>
            <button
              className="studio-primary-btn studio-hold-btn"
              onMouseDown={startFinishHold}
              onMouseUp={endFinishHold}
              onMouseLeave={endFinishHold}
              onTouchStart={startFinishHold}
              onTouchEnd={endFinishHold}
              onTouchCancel={endFinishHold}
              type="button"
            >
              <span className="studio-hold-fill" style={{ width: `${finishHold * 100}%` }} />
              {isHoldingFinish ? 'Holding...' : 'Hold to finish'}
            </button>
          </div>
          <div
            className="studio-floor-quick"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="studio-queue-btn ghost"
              onClick={() => setTimerRunning(!timerRunning)}
              type="button"
            >
              {timerRunning ? 'Pause' : 'Resume'}
            </button>
            <button
              className="studio-primary-btn studio-hold-btn"
              onMouseDown={startFinishHold}
              onMouseUp={endFinishHold}
              onMouseLeave={endFinishHold}
              onTouchStart={startFinishHold}
              onTouchEnd={endFinishHold}
              onTouchCancel={endFinishHold}
              type="button"
            >
              <span className="studio-hold-fill" style={{ width: `${finishHold * 100}%` }} />
              {isHoldingFinish ? 'Holding...' : 'Hold to finish'}
            </button>
          </div>
        </div>
      )}

      {/* 3-2-1 countdown overlay before the timer starts, */}
      {/* provides visual lock-in feedback, */}
      {/* transitions into floor mode when complete, */}
      {/* uses color ring to emphasize timing */}
      {countdownOpen && (
        <div className="studio-countdown-overlay">
          <div className={`studio-countdown-ring countdown-${countdown}`}>
            <div className={`studio-countdown-number countdown-${countdown}`}>{countdown}</div>
            <div className="studio-countdown-sub">Lock in</div>
          </div>
        </div>
      )}

      {sessionLoggedPulseOpen && (
        <div className="studio-log-pulse-overlay" role="status" aria-live="polite">
          <div className="studio-log-pulse-card">
            <div className="studio-log-pulse-check" aria-hidden="true">&#10003;</div>
            <div className="studio-log-pulse-title">Session logged</div>
            <div className="studio-log-pulse-sub">Opening your logs...</div>
          </div>
        </div>
      )}

      {/* congrats overlay after session logging, */}
      {/* allows a quick reflection entry, */}
      {/* saves reflection back into session notes, */}
      {/* closes on save or skip */}
      {congratsOpen && (
        <div className="studio-congrats-overlay">
            <div className="studio-congrats-panel">
              <div className="program-celebration" aria-hidden="true">
                {[...Array(10)].map((_, index) => (
                  <span key={`program-spark-${index}`} className={`program-spark spark-${index + 1}`} />
                ))}
                <div className="program-celebration-badge">{"\u2713"}</div>
              </div>
              <div className="studio-congrats-title">Well done.</div>
              <div className="studio-congrats-sub">
                Session closed. Momentum logged.
              </div>
              <div className="studio-congrats-sub">
                {completedSessionLabel || 'Session'} logged.
              </div>
              <label className="studio-congrats-reflection">
                <span className="studio-input-label">Reflection</span>
                <textarea
                  value={sessionReflection}
                  onChange={(event) => setSessionReflection(event.target.value)}
                  placeholder="What did you learn or feel?"
                />
              </label>
              <div className="studio-congrats-actions">
                <button
                  className="studio-queue-btn ghost"
                  onClick={() => setCongratsOpen(false)}
                  type="button"
                >
                  Close
                </button>
                <button
                  className="studio-primary-btn"
                  onClick={saveReflection}
                  disabled={reflectionSaving}
                  type="button"
                >
                  {reflectionSaving ? 'Saving...' : 'Save reflection'}
                </button>
                <button
                  className="studio-queue-btn ghost"
                  onClick={() => {
                    setCongratsOpen(false);
                    navigate(`/athlete/${userId}/logs`);
                  }}
                  type="button"
                >
                  Open logs
                </button>
              </div>
            </div>
          </div>
      )}

      
    </div>
  );
};

export default AthleteTrainingTab;


