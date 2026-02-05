// src/components/AthleteTrainingTab.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { recalcUserState } from '../services/stateEngine';

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
];

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
  const [planFavorites, setPlanFavorites] = useState([]);
  const [pinnedOrder, setPinnedOrder] = useState([]);
  const [draggingPin, setDraggingPin] = useState(null);
  const [newPlan, setNewPlan] = useState({ ...emptyPlan });
  const [recentSessions, setRecentSessions] = useState([]);
  const [apiStatus, setApiStatus] = useState('idle');
  const [congratsOpen, setCongratsOpen] = useState(false);

  const focusOptions = ['Base', 'Tempo', 'Speed', 'Recovery', 'Race Prep'];
  const sports = ['running', 'cycling', 'swimming', 'hybrid', 'trail'];
  const trainingWorlds = [
    { id: 'hybrid', title: 'Hybrid Arena', subtitle: 'Carry, sled, engine', sport: 'hybrid' },
    { id: 'running', title: 'Velocity Lab', subtitle: 'Tempo and pace craft', sport: 'running' },
    { id: 'cycling', title: 'Torque Studio', subtitle: 'Cadence and climbs', sport: 'cycling' },
    { id: 'swimming', title: 'Flow Pool', subtitle: 'Form and oxygen', sport: 'swimming' },
    { id: 'trail', title: 'Trail Forge', subtitle: 'Elevation resilience', sport: 'trail' }
  ];
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

  const mapPlan = (plan, source) => {
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

  const loadFavorites = () => {
    const stored = localStorage.getItem('exervia_plan_favorites');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  };

  const loadPinnedOrder = () => {
    const stored = localStorage.getItem('exervia_plan_pinned_order');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  };

  const saveFavorites = (items) => {
    setPlanFavorites(items);
    localStorage.setItem('exervia_plan_favorites', JSON.stringify(items));
  };

  const savePinnedOrder = (items) => {
    setPinnedOrder(items);
    localStorage.setItem('exervia_plan_pinned_order', JSON.stringify(items));
  };

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

    if (collected.length === 0) {
      collected.push(...fallbackPlans);
    }

    setPlans(collected);
  };

  const startPlan = (plan) => {
    setSelectedPlan(plan);
    setSessionFocus(plan.defaultFocus || 'Base');
    setSession(prev => ({
      ...prev,
      sport: plan.sport,
      duration: plan.durationTarget ? String(plan.durationTarget) : '',
      distance: plan.distanceTarget ? String(plan.distanceTarget) : '',
      notes: `Plan: ${plan.name} - ${plan.summary}`
    }));
    setPlanOpen(false);
    setPulsePanel(true);
    setBanner({ type: 'info', message: `${plan.name} loaded. Focus set to ${plan.defaultFocus || 'Base'}.` });
  };

  const openFocusLock = (plan) => {
    if (plan) {
      startPlan(plan);
    }
    setCountdown(3);
    setCountdownOpen(true);
    setTimerSeconds(0);
    setBanner({ type: 'info', message: 'Session starting. Lock in.' });
  };

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

  useEffect(() => {
    if (session.distance && session.duration && session.heartRate) {
      const efficiency = calculateEfficiency(session.distance, session.duration, session.heartRate);
    } else {
    }
  }, [session.distance, session.duration, session.heartRate]);

  useEffect(() => {
    if (!banner) return undefined;
    const timeout = setTimeout(() => setBanner(null), 3200);
    return () => clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    if (!pulsePanel) return undefined;
    const timeout = setTimeout(() => setPulsePanel(false), 800);
    return () => clearTimeout(timeout);
  }, [pulsePanel]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (!timerOpen) return undefined;
    setFloorUiHidden(false);
    const timeout = setTimeout(() => {
      setFloorUiHidden(true);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [timerOpen]);

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

  const handleLogSession = async () => {
    if (!session.duration || !session.sport) {
      setBanner({ type: 'warn', message: 'Please add duration and a sport.' });
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

    const sessionData = {
      user_id: userId,
      sport: session.sport,
      level: 'advanced',
      duration_minutes: parseInt(session.duration, 10),
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
      await recalcUserState(userId);
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
      setSessionFocus('Base');
      setSelectedPlan(null);
      fetchRecentSessions();
      setCongratsOpen(true);
    } else {
      console.error('Error logging session:', error);
      setBanner({ type: 'error', message: 'Could not log session. Try again.' });
    }

  };

  const finishSession = () => {
    setTimerRunning(false);
    setTimerOpen(false);
    handleLogSession();
  };

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

  const endFinishHold = () => {
    if (!holdTimerRef.current) return;
    clearInterval(holdTimerRef.current);
    holdTimerRef.current = null;
    setIsHoldingFinish(false);
    setFinishHold(0);
  };

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

  useEffect(() => {
    if (userId) {
      fetchRecentSessions();
      fetchPlans();
      setPlanFavorites(loadFavorites());
      setPinnedOrder(loadPinnedOrder());
    }
  }, [userId]);

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

  const recommendedPlans = plans
    .filter(plan => plan.sport === session.sport || plan.defaultFocus === sessionFocus)
    .slice(0, 3);

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

  const displayPlans = (planSportFilter ? filteredPlans : []).slice(
    0,
    showAllPlans || planSearch ? filteredPlans.length : 8
  );

  const getStreak = () => {
    if (!recentSessions.length) return 0;
    const sorted = [...recentSessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].created_at);
      const curr = new Date(sorted[i].created_at);
      const diff = Math.floor((prev - curr) / (1000 * 60 * 60 * 24));
      if (diff <= 1) streak += 1;
      else break;
    }
    return streak;
  };

  const streak = getStreak();
  const recentDurations = recentSessions
    .map((item) => item.duration_minutes)
    .filter((value) => Number.isFinite(value));
  const avgDuration = recentDurations.length
    ? recentDurations.reduce((sum, value) => sum + value, 0) / recentDurations.length
    : null;
  const efficiencyValues = recentSessions
    .map((item) => parseFloat(item.efficiency_factor))
    .filter((value) => Number.isFinite(value));
  const avgEfficiency = efficiencyValues.length
    ? efficiencyValues.reduce((sum, value) => sum + value, 0) / efficiencyValues.length
    : null;
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

  const targetMinutes = session.duration || timelinePlan?.durationTarget || 45;
  const targetSeconds = parseInt(targetMinutes, 10) * 60;
  const safeTargetSeconds = Number.isFinite(targetSeconds) ? targetSeconds : 0;
  const timerProgress = safeTargetSeconds ? Math.min(timerSeconds / safeTargetSeconds, 1) : 0;

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isBreathPhase = timerSeconds <= 60 && timerOpen;
  const breathLabel = timerSeconds <= 30 ? 'Inhale' : 'Exhale';
  const breathHint = timerSeconds <= 30 ? '4 seconds in · 4 seconds hold' : '6 seconds out · reset';
  const activeWorldSport = planSportFilter || selectedPlan?.sport || '';

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    }
  };

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

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }
    };
  }, []);

  const getPlanStory = (plan) => {
    const focus = plan?.defaultFocus || 'Base';
    const sport = plan?.sport || 'training';
    if (focus === 'Speed') return `Short, sharp reps to lift your ${sport} pace.`;
    if (focus === 'Recovery') return `Low strain, clean rhythm, full system reset.`;
    if (focus === 'Race Prep') return `Precision blocks to peak for your next event.`;
    if (focus === 'Tempo') return `Sustained tempo to build durable engine.`;
    return `Foundational volume to grow your ${sport} capacity.`;
  };

  return (
    <div className="studio-shell" data-world={activeWorldSport}>
      <div className="studio-wrap">
        <header className="studio-header">
          <div>
            <div className="studio-kicker">ATHLETE STUDIO</div>
            <h2 className="studio-title">Training Ritual</h2>
            <p className="studio-subtitle">Precision sessions. Clean metrics. No noise.</p>
          </div>
          <button
            className="studio-mini-btn"
            onClick={handleBack}
            type="button"
          >
            ← Back
          </button>
        </header>

        {banner && (
          <div className={`studio-banner ${banner.type}`}>
            {banner.message}
          </div>
        )}

        <div className="studio-grid">
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
                      setPlanSportFilter(activeWorldSport === world.sport ? '' : world.sport);
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
                          setShowPlanLibrary(false);
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
                    setShowPlanLibrary(false);
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
                        setShowPlanLibrary(false);
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
                        <span>{block.week}</span>
                        <span>{block.sessions.length} sessions</span>
                      </div>
                    ))}
                    {(selectedPlan.outline || []).length > 2 && (
                      <div className="studio-plan-preview-more">
                        + {(selectedPlan.outline || []).length - 2} more weeks
                      </div>
                    )}
                  </div>
                </div>
                <button
                  className="studio-queue-btn"
                  onClick={() => openFocusLock(selectedPlan)}
                  type="button"
                >
                  Start session
                </button>
                <button
                  className="studio-queue-btn ghost"
                  onClick={() =>
                    navigate(`/athlete/${userId}/program/${selectedPlan.id}`, {
                      state: {
                        program: {
                          id: selectedPlan.id,
                          name: selectedPlan.name,
                          focus: selectedPlan.goal || selectedPlan.summary || 'Training session',
                          duration: selectedPlan.durationTarget ? `${selectedPlan.durationTarget} min` : '45 min',
                          exercises: (selectedPlan.exercises || selectedPlan.outline?.[0]?.sessions || []).map(
                            (item, index) => ({
                              id: `${selectedPlan.id}-${index}`,
                              name: typeof item === 'string' ? item : item?.name || `Session ${index + 1}`,
                              sets: 1,
                              reps: 'session',
                              rest: '-',
                              focus: selectedPlan.goal || 'Stay sharp.'
                            })
                          )
                        }
                      }
                    })
                  }
                  type="button"
                >
                  Open full plan
                </button>
              </>
            ) : (
              <div className="studio-empty">Select a plan to preview the session.</div>
            )}
            <div className="studio-panel-title" style={{ marginTop: 16 }}>
              Recent Sessions
            </div>
            {recentSessions.length > 0 ? (
              <div className="studio-recent-list">
                {recentSessions.slice(0, 2).map((item) => (
                  <div key={item.id} className="studio-recent-row">
                    <div className="studio-recent-main">
                      <div className="studio-recent-title">
                        {item.sport ? item.sport.toUpperCase() : 'SESSION'}
                      </div>
                      <div className="studio-recent-sub">
                        {item.duration_minutes || '--'} min · {item.metrics?.distance || '--'} km
                      </div>
                    </div>
                    <div className="studio-recent-meta">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="studio-empty">No recent sessions logged yet.</div>
            )}
          </section>
        </div>
      </div>

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
                        {block.sessions.map((item) => (
                          <li key={item}>{item}</li>
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
            <div className="studio-swap-body">
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
                      <option key={sport} value={sport}>{sport}</option>
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
              <div className="studio-create-list">
                {newPlan.outline.map((block, idx) => (
                  <div key={block.week} className="studio-create-row">
                    <input
                      className="studio-create-name"
                      value={block.week}
                      onChange={(event) => {
                        const next = [...newPlan.outline];
                        next[idx] = { ...next[idx], week: event.target.value };
                        setNewPlan(prev => ({ ...prev, outline: next }));
                      }}
                      placeholder="Week 1"
                    />
                    <input
                      className="studio-create-name"
                      value={block.sessions.join(', ')}
                      onChange={(event) => {
                        const next = [...newPlan.outline];
                        next[idx] = { ...next[idx], sessions: event.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                        setNewPlan(prev => ({ ...prev, outline: next }));
                      }}
                      placeholder="Session list"
                    />
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
                {newPlan.outline.length > 1 && (
                  <button
                    className="studio-queue-btn ghost danger"
                    onClick={() => setNewPlan(prev => ({
                      ...prev,
                      outline: prev.outline.slice(0, -1)
                    }))}
                    type="button"
                  >
                    Remove week
                  </button>
                )}
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

      {countdownOpen && (
        <div className="studio-countdown-overlay">
          <div className={`studio-countdown-ring countdown-${countdown}`}>
            <div className={`studio-countdown-number countdown-${countdown}`}>{countdown}</div>
            <div className="studio-countdown-sub">Lock in</div>
          </div>
        </div>
      )}

      {congratsOpen && (
        <div className="studio-congrats-overlay">
            <div className="studio-congrats-panel">
              <div className="studio-congrats-title">Well done.</div>
              <div className="studio-congrats-sub">
                Session closed. Momentum logged.
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
                  }}
                  type="button"
                >
                  Plan next ritual
                </button>
              </div>
            </div>
          </div>
      )}

      
    </div>
  );
};

export default AthleteTrainingTab;
