import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { recalcUserState } from '../services/stateEngine';
import { trackDailyActivity } from '../services/activityTracker';
import { grantXpEventSafe } from '../services/xpEvents';
import { emitToast } from '../utils/toast';
import { publishTrainingStatus } from '../utils/activityStatusFeed';
import { vibratePr, vibrateSuccess } from '../utils/haptics';

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
    pace: paceMinutesPerKm.toFixed(2),
  };
};

const pushRecoveryNudge = (userId, label, minutes) => {
  let storedUserId = '';
  try {
    storedUserId = localStorage.getItem('exervia_user_id') || '';
  } catch {
    storedUserId = '';
  }
  const nudgeUserId = storedUserId || userId || 'guest';
  const key = `exervia_recovery_nudge_${nudgeUserId}`;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        type: 'training_session',
        label: String(label || 'Session'),
        minutes: Number(minutes || 0),
        at: Date.now(),
      })
    );
  } catch {
    // best-effort persistence only
  }
};

export default function useAthleteTrainingSessionActions({
  activePlanWeekIndex,
  athleteReflectionDraftKey,
  athleteSessionStorageKey,
  detectSessionPrs,
  isHoldingFinish,
  recentTrainingSessions,
  selectedPlan,
  session,
  sessionFocus,
  sessionIntention,
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
  sessionReflection,
  lastLoggedNotes,
  lastLoggedSessionId,
}) {
  const holdTimerRef = useRef(null);

  const handleLogSession = useCallback(async () => {
    const typedDuration = parseInt(session.duration, 10);
    const timerDerivedDuration = timerSeconds > 0 ? Math.max(1, Math.round(timerSeconds / 60)) : 0;
    const planDurationTarget = Number(selectedPlan?.durationTarget || 0);
    const resolvedDuration =
      (Number.isFinite(typedDuration) && typedDuration > 0 ? typedDuration : 0) ||
      timerDerivedDuration ||
      (planDurationTarget > 0 ? planDurationTarget : 0);
    let storedUserId = '';
    try {
      storedUserId = localStorage.getItem('exervia_user_id') || '';
    } catch {
      storedUserId = '';
    }
    const resolvedUserId =
      Number.isFinite(Number(userId))
        ? Number(userId)
        : Number(storedUserId);

    if (!resolvedDuration || !session.sport) {
      setBanner({ type: 'warn', message: 'Please add a duration source and sport before logging.' });
      return;
    }
    if (!Number.isFinite(resolvedUserId) || resolvedUserId <= 0) {
      setBanner({ type: 'error', message: 'Could not resolve your profile for XP. Please refresh and try again.' });
      return;
    }

    let efficiencyData = null;

    if (session.distance && session.duration && session.heartRate) {
      efficiencyData = calculateEfficiency(session.distance, session.duration, session.heartRate);
    }

    const combinedNotes = [
      session.notes.trim(),
      sessionIntention.trim() ? `Intention: ${sessionIntention.trim()}` : '',
    ].filter(Boolean).join('\n');
    const loggedLabel = selectedPlan?.name || `${String(session.sport || 'training').toUpperCase()} session`;
    const distanceKmValue = session.distance ? parseFloat(session.distance) : 0;
    const sessionPrs = detectSessionPrs({
      priorSessions: recentTrainingSessions,
      sport: session.sport,
      durationMinutes: resolvedDuration,
      distanceKm: distanceKmValue,
    });
    const resolvedWeekSnapshot = sessionWeekSnapshot || selectedPlan?.outline?.[activePlanWeekIndex] || null;
    const resolvedPlanWeekLabel = String(resolvedWeekSnapshot?.week || '').trim() || null;
    const resolvedPlanSessions = Array.isArray(resolvedWeekSnapshot?.sessions)
      ? resolvedWeekSnapshot.sessions.filter((item) => String(item || '').trim().length > 0)
      : [];

    const sessionData = {
      user_id: resolvedUserId,
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
        plan_name: selectedPlan ? selectedPlan.name : null,
        plan_week: resolvedPlanWeekLabel,
        plan_sessions: resolvedPlanSessions,
      },
      efficiency_factor: efficiencyData ? efficiencyData.value : null,
    };

    const { data, error } = await supabase
      .from('training_sessions')
      .insert([sessionData])
      .select()
      .single();

    if (!error) {
      const durationBaseXp = Math.max(15, resolvedDuration || 0);
      let awardedXp = 0;
      let xpRelinked = false;
      if (data?.id && durationBaseXp > 0) {
        const xpResult = await grantXpEventSafe({
          userId: resolvedUserId,
          eventType: 'training_session',
          baseXp: durationBaseXp,
          idempotencyKey: `training_session:${data.id}`,
          sourceTable: 'training_sessions',
          sourceId: String(data.id),
          meta: {
            sport: session.sport,
            focus: sessionFocus,
            duration_minutes: durationBaseXp,
            plan_id: selectedPlan ? selectedPlan.id : null,
            plan_name: selectedPlan ? selectedPlan.name : null,
            plan_week: resolvedPlanWeekLabel,
          },
        });
        awardedXp = Number(xpResult.awardedXp || 0);
        xpRelinked = Boolean(xpResult.relinked);
        if (xpResult.error) {
          console.error('grant_xp_event failed:', xpResult.error);
          setBanner({
            type: 'warn',
            message: 'Session logged, but XP update is delayed. It will retry automatically.',
          });
        }
      }
      try {
        await trackDailyActivity(resolvedUserId, 'training_session');
      } catch (activityError) {
        console.error('trackDailyActivity failed:', activityError);
      }
      try {
        await publishTrainingStatus(resolvedUserId, {
          worldLabel: trainingWorlds.find((world) => world.sport === session.sport)?.title || session.sport || 'Training',
          sportLabel: session.sport || 'training',
          focus: sessionFocus,
          durationLabel: `${durationBaseXp} min`,
          planName: selectedPlan?.name || '',
        });
      } catch (feedError) {
        console.error('publishTrainingStatus failed:', feedError);
      }
      try {
        await recalcUserState(resolvedUserId);
      } catch (stateError) {
        console.error('recalcUserState failed:', stateError);
      }
      window.dispatchEvent(new Event('user_state_updated'));

      if (awardedXp > 0) {
        setBanner({
          type: 'success',
          message: `Session logged. +${awardedXp} XP earned.${xpRelinked ? ' Profile link repaired.' : ''}`,
        });
      } else if (efficiencyData && parseFloat(efficiencyData.value) < 0.03) {
        setBanner({
          type: 'success',
          message: `Great efficiency score. Cardiovascular fitness is improving.${xpRelinked ? ' Profile link repaired.' : ''}`,
        });
      } else {
        setBanner({
          type: 'info',
          message: `Session logged. No XP update this time (already counted, daily XP cap reached, or reduced to 0 by diminishing returns).${xpRelinked ? ' Profile link repaired.' : ''}`,
        });
      }

      setSession({
        sport: 'running',
        duration: '',
        distance: '',
        heartRate: '',
        mood: 'Focused',
        notes: '',
      });
      setSessionIntention('');
      setSessionReflection('');
      if (athleteReflectionDraftKey) {
        try {
          localStorage.removeItem(athleteReflectionDraftKey);
        } catch {
          // ignore storage failures
        }
      }
      setLastLoggedSessionId(data?.id || null);
      setLastLoggedNotes(combinedNotes);
      setCompletedSessionLabel(loggedLabel);
      setSessionRecap({
        xp: awardedXp,
        duration: resolvedDuration,
        streak: 0,
        focus: sessionFocus || 'Base',
        prs: sessionPrs,
      });
      pushRecoveryNudge(userId, loggedLabel, resolvedDuration);
      setSessionFocus('Base');
      setSelectedPlan(null);
      setSessionWeekSnapshot(null);
      if (athleteSessionStorageKey) {
        try {
          localStorage.removeItem(athleteSessionStorageKey);
        } catch {
          // ignore storage failures
        }
      }
      setSessionLoggedPulseOpen(false);
      if (sessionPrs.length) {
        vibratePr();
        emitToast(`Athlete PR: ${sessionPrs[0].label}.`, 'success', 3200);
      } else {
        vibrateSuccess();
      }
      setCongratsOpen(true);
      return;
    }

    console.error('Error logging session:', error);
    setBanner({ type: 'error', message: 'Could not log session. Try again.' });
  }, [
    activePlanWeekIndex,
    athleteReflectionDraftKey,
    athleteSessionStorageKey,
    detectSessionPrs,
    recentTrainingSessions,
    selectedPlan,
    session,
    sessionFocus,
    sessionIntention,
    sessionWeekSnapshot,
    setBanner,
    setCompletedSessionLabel,
    setCongratsOpen,
    setLastLoggedNotes,
    setLastLoggedSessionId,
    setSelectedPlan,
    setSession,
    setSessionFocus,
    setSessionIntention,
    setSessionLoggedPulseOpen,
    setSessionRecap,
    setSessionReflection,
    setSessionWeekSnapshot,
    timerSeconds,
    trainingWorlds,
    userId,
  ]);

  const finishSession = useCallback(() => {
    setTimerRunning(false);
    setTimerOpen(false);
    handleLogSession();
  }, [handleLogSession, setTimerOpen, setTimerRunning]);

  const saveReflection = useCallback(async () => {
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
      if (athleteReflectionDraftKey) {
        try {
          localStorage.removeItem(athleteReflectionDraftKey);
        } catch {
          // ignore storage failures
        }
      }
    }
    setReflectionSaving(false);
    setCongratsOpen(false);
  }, [
    athleteReflectionDraftKey,
    lastLoggedNotes,
    lastLoggedSessionId,
    sessionReflection,
    setBanner,
    setCongratsOpen,
    setReflectionSaving,
  ]);

  const startFinishHold = useCallback(() => {
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
  }, [finishSession, isHoldingFinish, setFinishHold, setIsHoldingFinish]);

  const endFinishHold = useCallback(() => {
    if (!holdTimerRef.current) return;
    clearInterval(holdTimerRef.current);
    holdTimerRef.current = null;
    setIsHoldingFinish(false);
    setFinishHold(0);
  }, [setFinishHold, setIsHoldingFinish]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }
    };
  }, []);

  return {
    endFinishHold,
    finishSession,
    saveReflection,
    startFinishHold,
  };
}
