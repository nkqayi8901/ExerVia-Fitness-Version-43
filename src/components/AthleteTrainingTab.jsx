// src/components/AthleteTrainingTab.jsx
// this component powers the Athlete Training area,
// it manages plans, sessions, timers, and reflections,
// and coordinates UI state with Supabase data,
// comments below explain each major block
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { emitToast } from '../utils/toast';
import useAthleteTrainingActivityData from '../hooks/useAthleteTrainingActivityData';
import useAthleteTrainingInsights from '../hooks/useAthleteTrainingInsights';
import useAthleteTrainingPlans from '../hooks/useAthleteTrainingPlans';
import useAthleteTrainingSessionActions from '../hooks/useAthleteTrainingSessionActions';
import useAthleteTrainingSessionPersistence from '../hooks/useAthleteTrainingSessionPersistence';
import useDistanceUnitPreference from '../hooks/useDistanceUnitPreference';
import PageWalkthroughModal from './PageWalkthroughModal';
import AthleteTrainingCreatePlanModal from './AthleteTrainingCreatePlanModal';
import AthleteTrainingCountdownOverlay from './AthleteTrainingCountdownOverlay';
import AthleteTrainingCongratsModal from './AthleteTrainingCongratsModal';
import AthleteTrainingFloorTimerOverlay from './AthleteTrainingFloorTimerOverlay';
import AthleteTrainingLastTrainingModal from './AthleteTrainingLastTrainingModal';
import AthleteTrainingLoggedPulseOverlay from './AthleteTrainingLoggedPulseOverlay';
import AthleteTrainingPlanDetailModal from './AthleteTrainingPlanDetailModal';
import AthleteTrainingPlanLibrary from './AthleteTrainingPlanLibrary';
import AthleteTrainingSessionPreview from './AthleteTrainingSessionPreview';
import AthleteTrainingStatsView from './AthleteTrainingStatsView';
import {
  emptyPlan,
  focusOptions,
  sports,
  trainingWorlds,
  TRAINING_WALKTHROUGH_STEPS,
  worldShortLabels,
} from '../utils/athleteTrainingConfig';
import { vibrateStart } from '../utils/haptics';
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

// AthleteTrainingTab is the main training hub for athlete mode,
// it manages selection, creation, and execution of plans,
// it controls countdowns, timers, and session logging,
// and renders the full training UI for this section
const AthleteTrainingTab = ({ userId, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [distanceUnit, setDistanceUnit] = useDistanceUnitPreference();
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
  const [sessionLaunchMode, setSessionLaunchMode] = useState('standard');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
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
  const [sessionRecap, setSessionRecap] = useState({ xp: 0, duration: 0, streak: 0, focus: 'Base', prs: [] });
  const [activePlanWeekIndex, setActivePlanWeekIndex] = useState(0);
  const [sessionWeekSnapshot, setSessionWeekSnapshot] = useState(null);
  const [lastTrainingOpen, setLastTrainingOpen] = useState(false);
  const [view, setView] = useState('log');
  const [draggingPin, setDraggingPin] = useState(null);
  const [newPlan, setNewPlan] = useState({ ...emptyPlan });
  const [congratsOpen, setCongratsOpen] = useState(false);
  const [sessionLoggedPulseOpen, setSessionLoggedPulseOpen] = useState(false);
  const athleteSessionStorageKey = useMemo(
    () => (userId ? `exervia_active_athlete_session_${String(userId).trim()}` : ''),
    [userId]
  );
  const athleteReflectionDraftKey = useMemo(
    () => (userId ? `exervia_athlete_reflection_draft_${String(userId).trim()}` : ''),
    [userId]
  );
  const athleteSessionRestoredRef = useRef(false);
  const timerStartedAtRef = useRef(null);
  const {
    apiStatus,
    buildOutline,
    fetchPlans,
    pinnedOrder,
    planFavorites,
    plans,
    savePinnedOrder,
    togglePlanFavorite,
    mapPlan,
  } = useAthleteTrainingPlans({
    userId,
    distanceUnit,
  });
  const {
    recentRouteEfforts,
    recentTrainingSessions,
    recoveryNudge,
    selectedTrainingTrendDay,
    setSelectedTrainingTrendDay,
    setWalkthroughOpen,
    walkthroughOpen,
  } = useAthleteTrainingActivityData({
    userId,
  });
  useAthleteTrainingSessionPersistence({
    athleteReflectionDraftKey,
    athleteSessionRestoredRef,
    athleteSessionStorageKey,
    activePlanWeekIndex,
    countdown,
    countdownOpen,
    congratsOpen,
    floorUiHidden,
    planSearch,
    planSportFilter,
    selectedPlan,
    session,
    sessionFocus,
    sessionIntention,
    sessionReflection,
    sessionWeekSnapshot,
    setActivePlanWeekIndex,
    setCountdown,
    setCountdownOpen,
    setFloorUiHidden,
    setPlanSearch,
    setPlanSportFilter,
    setSelectedPlan,
    setSession,
    setSessionFocus,
    setSessionIntention,
    setSessionReflection,
    setSessionWeekSnapshot,
    setTimerOpen,
    setTimerRunning,
    setTimerSeconds,
    timerOpen,
    timerRunning,
    timerSeconds,
  });

  const handleWalkthroughAction = (step) => {
    const stepId = String(step?.id || '');
    if (stepId === 'pick_world') {
      setPlanSportFilter((prev) => prev || 'running');
      setShowPlanLibrary(true);
      return;
    }
    if (stepId === 'pick_plan') {
      setShowPlanLibrary(true);
      return;
    }
    if (stepId === 'create_plan') {
      setShowCreatePlan(true);
      setShowPlanLibrary(true);
      return;
    }
    if (stepId === 'start_session') {
      if (!selectedPlan) {
        setBanner({ type: 'info', message: 'Pick a plan first, then start your session timer.' });
        return;
      }
      openFocusLock(selectedPlan);
    }
  };

  // startPlan applies a selected plan to session state,
  // sets focus, duration, distance, and notes,
  // closes the plan panel and opens the pulse view,
  // and shows a banner confirming the selection
  const startPlan = (plan, weekIndex = activePlanWeekIndex) => {
    const safeWeekIndex = Math.max(
      0,
      Math.min(Number(weekIndex) || 0, Math.max(0, (plan?.outline || []).length - 1))
    );
    const weekLabel = plan?.outline?.[safeWeekIndex]?.week || 'Week 1';
    const weekSnapshot = plan?.outline?.[safeWeekIndex]
      ? {
          week: plan.outline[safeWeekIndex].week || weekLabel,
          sessions: Array.isArray(plan.outline[safeWeekIndex].sessions)
            ? [...plan.outline[safeWeekIndex].sessions]
            : [],
        }
      : null;
    setSelectedPlan(plan);
    setActivePlanWeekIndex(safeWeekIndex);
    setSessionWeekSnapshot(weekSnapshot);
    setSessionFocus(plan.defaultFocus || 'Base');
    setSession(prev => ({
      ...prev,
      sport: plan.sport,
      // Keep duration user-driven to avoid logging auto-filled defaults.
      duration: prev.duration || '',
      distance: plan.distanceTarget ? String(plan.distanceTarget) : '',
      notes: `Plan: ${plan.name} (${weekLabel}) - ${plan.summary}`
    }));
    setPlanOpen(false);
    setPulsePanel(true);
    setBanner({
      type: 'info',
      message: `${plan.name} loaded (${weekLabel}). Focus set to ${plan.defaultFocus || 'Base'}.`
    });
  };

  // openFocusLock triggers the 3-2-1 lock-in flow,
  // optionally starts the plan before countdown,
  // resets timer state for the session run,
  // and sets the banner to guide the user
  const openFocusLock = (plan, weekIndex = activePlanWeekIndex) => {
    if (plan) {
      startPlan(plan, weekIndex);
    }
    vibrateStart();
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

    const mutation = editingPlanId
      ? await supabase
          .from('user_training_plans')
          .update(payload)
          .eq('id', editingPlanId)
          .select()
          .single()
      : await supabase
          .from('user_training_plans')
          .insert([payload])
          .select()
          .single();
    const { data: savedPlanRow, error } = mutation;

    if (!error) {
      setBanner({
        type: 'success',
        message: editingPlanId ? 'Plan updated in your library.' : 'Plan saved to your library.'
      });
      setShowCreatePlan(false);
      setEditingPlanId(null);
      setNewPlan({ ...emptyPlan });
      const selectedSavedPlan = mapPlan(
        savedPlanRow || { ...payload, id: editingPlanId || `saved-${Date.now()}` },
        'user'
      );
      if (selectedSavedPlan) {
        setSelectedPlan(selectedSavedPlan);
        setSession((prev) => ({
          ...prev,
          sport: selectedSavedPlan.sport || prev.sport,
          duration: selectedSavedPlan.durationTarget ? String(selectedSavedPlan.durationTarget) : prev.duration,
          distance: selectedSavedPlan.distanceTarget ? String(selectedSavedPlan.distanceTarget) : prev.distance,
        }));
        setSessionFocus(selectedSavedPlan.defaultFocus || 'Base');
      }
      await fetchPlans();
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
    setSessionWeekSnapshot(null);
    setPlanOpen(false);
    fetchPlans();
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

  useEffect(() => {
    if (!banner?.message) return;
    const type = banner.type === 'error' ? 'error' : banner.type || 'info';
    emitToast(String(banner.message), type, type === 'error' ? 3600 : 3200);
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
  // calculates elapsed from a real start timestamp,
  // cleans up interval on stop/unmount
  useEffect(() => {
    if (!timerRunning) {
      timerStartedAtRef.current = null;
      return undefined;
    }
    const baseElapsedMs = Math.max(0, Number(timerSeconds || 0)) * 1000;
    timerStartedAtRef.current = Date.now() - baseElapsedMs;
    const interval = setInterval(() => {
      if (!timerStartedAtRef.current) return;
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - timerStartedAtRef.current) / 1000)
      );
      setTimerSeconds(elapsedSeconds);
    }, 250);
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

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

  const closePlanModal = () => {
    setPlanOpen(false);
  };

  const closeCreatePlanModal = () => {
    setShowCreatePlan(false);
    setEditingPlanId(null);
    setNewPlan({ ...emptyPlan });
  };
  useEffect(() => {
    if (!planOpen && !showCreatePlan && !lastTrainingOpen && !congratsOpen && !timerOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (congratsOpen) {
        setCongratsOpen(false);
        return;
      }
      if (timerOpen) {
        setTimerRunning(false);
        setTimerOpen(false);
        setFloorUiHidden(false);
        return;
      }
      if (lastTrainingOpen) {
        setLastTrainingOpen(false);
        return;
      }
      if (showCreatePlan) {
        closeCreatePlanModal();
        return;
      }
      if (planOpen) {
        closePlanModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [congratsOpen, lastTrainingOpen, planOpen, showCreatePlan, timerOpen]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const world = String(params.get('world') || '').trim().toLowerCase();
    if (['running', 'cycling', 'trail', 'swimming', 'hybrid'].includes(world)) {
      setPlanSportFilter(world);
      setShowPlanLibrary(true);
    }
  }, [location.search]);

  useEffect(() => {
    const weekCount = (selectedPlan?.outline || []).length;
    if (!weekCount) {
      setActivePlanWeekIndex(0);
      return;
    }
    setActivePlanWeekIndex((prev) => Math.max(0, Math.min(prev, weekCount - 1)));
  }, [selectedPlan]);

  const {
    filteredPlans,
    recommendedPlans,
    ritualWorldMeta,
    displayPlans,
    sortedPins,
    suggestedPlan,
    timelinePlan,
    timerChecklistWeek,
    lastTraining,
    getRecentPlanName,
    getRecentPlanWeek,
    getRecentObjectives,
    lastTrainingTitle,
    bestDurationMinutes,
    avgDurationMinutes,
    totalSessionsLogged,
    uniqueSportsTracked,
    maxTrainingMinutesByDay,
    topSportsTrend,
    maxSportCount,
    selectedTrainingTrendDayKey,
    selectedDaySessions,
    activeWorldSport,
    filteredRouteEfforts,
    activeWorldSessionCount,
    activeWorldMinutes,
    activeWorldDistanceKm,
    routePrStats,
    weeklyVolumeChart,
    paceTrendPoints,
    paceTrendRange,
    paceTrendPolyline,
    routeRitualPreview,
    detectSessionPrs,
    buildRouteLabUrl,
  } = useAthleteTrainingInsights({
    plans,
    planSearch,
    planSportFilter,
    session,
    sessionFocus,
    selectedPlan,
    pinnedOrder,
    planFavorites,
    activePlanWeekIndex,
    sessionWeekSnapshot,
    recentTrainingSessions,
    recentRouteEfforts,
    selectedTrainingTrendDay,
    distanceUnit,
    userId,
  });
  const {
    endFinishHold,
    saveReflection,
    startFinishHold,
  } = useAthleteTrainingSessionActions({
    activePlanWeekIndex,
    athleteReflectionDraftKey,
    athleteSessionStorageKey,
    detectSessionPrs,
    isHoldingFinish,
    lastLoggedNotes,
    lastLoggedSessionId,
    recentTrainingSessions,
    selectedPlan,
    session,
    sessionFocus,
    sessionIntention,
    sessionReflection,
    sessionWeekSnapshot,
    setBanner,
    setCompletedSessionLabel,
    setCongratsOpen,
    setFinishHold,
    setIsHoldingFinish,
    setLastLoggedNotes,
    setLastLoggedSessionId,
    setReflectionSaving,
    setSelectedPlan,
    setSession,
    setSessionFocus,
    setSessionIntention,
    setSessionLoggedPulseOpen,
    setSessionRecap,
    setSessionReflection,
    setSessionWeekSnapshot,
    setTimerOpen,
    setTimerRunning,
    timerSeconds,
    trainingWorlds,
    userId,
  });

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
  }, [recommendedPlans, selectedPlan, session.duration, session.sport, sessionFocus]);

  const visiblePlans = displayPlans(showAllPlans);

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
  // prefixes the name to signal editable copy context,
  // resets editing id to avoid overwriting originals,
  // opens the create plan modal with prefilled values
  const remixPlan = (plan) => {
    if (!plan) return;
    setEditingPlanId(null);
    setNewPlan({
      name: `Edit \u00B7 ${plan.name}`,
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

  // getPlanStory builds a short narrative summary,
  // tailors the text to focus + sport,
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
              onClick={() => setLastTrainingOpen(true)}
            >
              Last training
            </button>
            <button
              className={`studio-toggle-btn studio-header-action-btn ${view === 'log' ? 'active' : ''}`}
              type="button"
              onClick={() => setView('log')}
            >
              Log
            </button>
            <button
              className={`studio-toggle-btn studio-header-action-btn ${view === 'stats' ? 'active' : ''}`}
              type="button"
              onClick={() => setView('stats')}
            >
              Stats
            </button>
            <div className="studio-toggle" aria-label="Distance unit preference">
              <button
                className={`studio-toggle-btn ${distanceUnit === 'km' ? 'active' : ''}`}
                type="button"
                onClick={() => setDistanceUnit('km')}
              >
                km
              </button>
              <button
                className={`studio-toggle-btn ${distanceUnit === 'mi' ? 'active' : ''}`}
                type="button"
                onClick={() => setDistanceUnit('mi')}
              >
                mi
              </button>
            </div>
          </div>
        </header>

        {/* banner for inline feedback messages, */}
        {/* shows success/warn/error/info status, */}
        {/* auto-dismisses via effect above, */}
        {/* kept near the top for visibility */}
        {banner && (
          <div className={`exervia-banner studio-banner ${banner.type}`}>
            {banner.message}
          </div>
        )}

        

        {/* main content grid for library + preview, */}
        {/* left panel focuses on plan discovery, */}
        {/* right panel focuses on session preview, */}
        {/* layout stays consistent across states */}
        {view === 'log' ? (
          <div className="studio-grid">
            <AthleteTrainingPlanLibrary
              selectedPlan={selectedPlan}
              showPlanLibrary={showPlanLibrary}
              setShowPlanLibrary={setShowPlanLibrary}
              setEditingPlanId={setEditingPlanId}
              emptyPlan={emptyPlan}
              setNewPlan={setNewPlan}
              setShowCreatePlan={setShowCreatePlan}
              trainingWorlds={trainingWorlds}
              activeWorldSport={activeWorldSport}
              worldShortLabels={worldShortLabels}
              setSelectedPlan={setSelectedPlan}
              setSessionWeekSnapshot={setSessionWeekSnapshot}
              setPlanSearch={setPlanSearch}
              showAllPlans={showAllPlans}
              setShowAllPlans={setShowAllPlans}
              planSportFilter={planSportFilter}
              setPlanSportFilter={setPlanSportFilter}
              ritualWorldMeta={ritualWorldMeta}
              activeWorldSessionCount={activeWorldSessionCount}
              filteredRouteEfforts={filteredRouteEfforts}
              planSearch={planSearch}
              apiStatus={apiStatus}
              planFavorites={planFavorites}
              sortedPins={sortedPins}
              setDraggingPin={setDraggingPin}
              draggingPin={draggingPin}
              savePinnedOrder={savePinnedOrder}
              plans={plans}
              displayPlans={visiblePlans}
              togglePlanFavorite={togglePlanFavorite}
              setPlanOpen={setPlanOpen}
              filteredPlans={filteredPlans}
            />
            <AthleteTrainingSessionPreview
              selectedPlan={selectedPlan}
              activeWorldSport={activeWorldSport}
              ritualWorldMeta={ritualWorldMeta}
              sessionLaunchMode={sessionLaunchMode}
              setSessionLaunchMode={setSessionLaunchMode}
              activePlanWeekIndex={activePlanWeekIndex}
              setActivePlanWeekIndex={setActivePlanWeekIndex}
              navigate={navigate}
              buildRouteLabUrl={buildRouteLabUrl}
              openFocusLock={openFocusLock}
              setPlanOpen={setPlanOpen}
              suggestedPlan={suggestedPlan}
              setSelectedPlan={setSelectedPlan}
              routeRitualPreview={routeRitualPreview}
              userId={userId}
              distanceUnit={distanceUnit}
              recoveryNudge={recoveryNudge}
            />
          </div>
        ) : (
          <AthleteTrainingStatsView
            totalSessionsLogged={totalSessionsLogged}
            uniqueSportsTracked={uniqueSportsTracked}
            bestDurationMinutes={bestDurationMinutes}
            avgDurationMinutes={avgDurationMinutes}
            activeWorldSport={activeWorldSport}
            ritualWorldMeta={ritualWorldMeta}
            activeWorldSessionCount={activeWorldSessionCount}
            activeWorldMinutes={activeWorldMinutes}
            activeWorldDistanceKm={activeWorldDistanceKm}
            routePrStats={routePrStats}
            distanceUnit={distanceUnit}
            selectedTrainingTrendDayKey={selectedTrainingTrendDayKey}
            setSelectedTrainingTrendDay={setSelectedTrainingTrendDay}
            weeklyVolumeChart={weeklyVolumeChart}
            paceTrendPoints={paceTrendPoints}
            paceTrendRange={paceTrendRange}
            paceTrendPolyline={paceTrendPolyline}
            topSportsTrend={topSportsTrend}
            maxSportCount={maxSportCount}
            selectedDaySessions={selectedDaySessions}
            getRecentPlanName={getRecentPlanName}
            maxTrainingMinutesByDay={maxTrainingMinutesByDay}
            lastTraining={lastTraining}
            lastTrainingTitle={lastTrainingTitle}
          />
        )}
      </div>

      {/* plan detail modal with full outline, */}
      {/* appears when a plan is opened from the list, */}
      {/* includes actions to start, pin, remix, delete, */}
      {/* closes to return to the main layout */}
      {planOpen && selectedPlan ? (
        <AthleteTrainingPlanDetailModal
          selectedPlan={selectedPlan}
          closePlanModal={closePlanModal}
          activePlanWeekIndex={activePlanWeekIndex}
          setActivePlanWeekIndex={setActivePlanWeekIndex}
          openFocusLock={openFocusLock}
          planFavorites={planFavorites}
          togglePlanFavorite={togglePlanFavorite}
          remixPlan={remixPlan}
          prefillPlanEditor={prefillPlanEditor}
          deletePlan={deletePlan}
          setPlanOpen={setPlanOpen}
        />
      ) : null}

      {/* create/edit plan modal for custom plans, */}
      {/* collects plan metadata and weekly outline, */}
      {/* supports auto-fill and week management, */}
      {/* saves to Supabase on submit */}
      {showCreatePlan ? (
        <AthleteTrainingCreatePlanModal
          closeCreatePlanModal={closeCreatePlanModal}
          newPlan={newPlan}
          setNewPlan={setNewPlan}
          sports={sports}
          focusOptions={focusOptions}
          buildOutline={buildOutline}
          savePlan={savePlan}
          isPlanSaving={isPlanSaving}
        />
      ) : null}

      {/* floor mode timer overlay for active sessions, */}
      {/* shows live timer, progress bar, and cues, */}
      {/* allows pausing/resuming and hidden UI mode, */}
      {/* closes cleanly back to the main view */}
      {timerOpen ? (
        <AthleteTrainingFloorTimerOverlay
          floorUiHidden={floorUiHidden}
          setFloorUiHidden={setFloorUiHidden}
          setTimerRunning={setTimerRunning}
          setTimerOpen={setTimerOpen}
          timelinePlan={timelinePlan}
          sessionFocus={sessionFocus}
          session={session}
          formatTime={formatTime}
          timerSeconds={timerSeconds}
          safeTargetSeconds={safeTargetSeconds}
          timerProgress={timerProgress}
          timerChecklistWeek={timerChecklistWeek}
          startFinishHold={startFinishHold}
          endFinishHold={endFinishHold}
          finishHold={finishHold}
          isHoldingFinish={isHoldingFinish}
          timerRunning={timerRunning}
        />
      ) : null}

      {/* 3-2-1 countdown overlay before the timer starts, */}
      {/* provides visual lock-in feedback, */}
      {/* transitions into floor mode when complete, */}
      {/* uses color ring to emphasize timing */}
      {countdownOpen ? <AthleteTrainingCountdownOverlay countdown={countdown} /> : null}

      {sessionLoggedPulseOpen ? <AthleteTrainingLoggedPulseOverlay /> : null}

      {lastTrainingOpen ? (
        <AthleteTrainingLastTrainingModal
          setLastTrainingOpen={setLastTrainingOpen}
          lastTraining={lastTraining}
          lastTrainingTitle={lastTrainingTitle}
          recentTrainingSessions={recentTrainingSessions}
          getRecentPlanName={getRecentPlanName}
          getRecentPlanWeek={getRecentPlanWeek}
          getRecentObjectives={getRecentObjectives}
          distanceUnit={distanceUnit}
          navigate={navigate}
          userId={userId}
        />
      ) : null}

      {/* congrats overlay after session logging, */}
      {/* allows a quick reflection entry, */}
      {/* saves reflection back into session notes, */}
      {/* closes on save or skip */}
      {congratsOpen ? (
        <AthleteTrainingCongratsModal
          setCongratsOpen={setCongratsOpen}
          completedSessionLabel={completedSessionLabel}
          sessionRecap={sessionRecap}
          sessionReflection={sessionReflection}
          setSessionReflection={setSessionReflection}
          saveReflection={saveReflection}
          reflectionSaving={reflectionSaving}
          navigate={navigate}
          userId={userId}
        />
      ) : null}

      <PageWalkthroughModal
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        mode="athlete"
        userId={userId}
        pageKey="training"
        title="Training Walkthrough"
        steps={TRAINING_WALKTHROUGH_STEPS}
        onStepAction={handleWalkthroughAction}
      />
      
      
    </div>
  );
};

export default AthleteTrainingTab;











