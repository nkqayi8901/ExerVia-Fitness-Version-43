import { useEffect } from 'react';
import { emitToast } from '../utils/toast';

export default function useAthleteTrainingSessionPersistence({
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
}) {
  useEffect(() => {
    if (!athleteSessionStorageKey || athleteSessionRestoredRef.current) return;
    athleteSessionRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(athleteSessionStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return;
      const savedAt = Number(parsed.savedAt || Date.now());
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
      const wasCountdownOpen = Boolean(parsed.countdownOpen);
      let nextCountdownOpen = wasCountdownOpen;
      let nextCountdown = Math.max(Number(parsed.countdown || 0), 0);
      let nextTimerOpen = Boolean(parsed.timerOpen);
      let nextTimerRunning = Boolean(parsed.timerRunning);
      let nextTimerSeconds = Math.max(Number(parsed.timerSeconds || 0), 0);

      if (wasCountdownOpen) {
        if (elapsedSeconds >= nextCountdown) {
          const remainingElapsed = Math.max(elapsedSeconds - nextCountdown, 0);
          nextCountdownOpen = false;
          nextCountdown = 0;
          nextTimerOpen = true;
          nextTimerRunning = true;
          nextTimerSeconds += remainingElapsed;
        } else {
          nextCountdown -= elapsedSeconds;
        }
      } else if (nextTimerRunning) {
        nextTimerSeconds += elapsedSeconds;
      }

      if (parsed.session && typeof parsed.session === 'object') {
        setSession((prev) => ({ ...prev, ...parsed.session }));
      }
      if (parsed.sessionFocus) setSessionFocus(String(parsed.sessionFocus));
      if (parsed.selectedPlan && typeof parsed.selectedPlan === 'object') setSelectedPlan(parsed.selectedPlan);
      if (typeof parsed.planSportFilter === 'string') setPlanSportFilter(parsed.planSportFilter);
      if (typeof parsed.planSearch === 'string') setPlanSearch(parsed.planSearch);
      if (typeof parsed.activePlanWeekIndex === 'number') setActivePlanWeekIndex(parsed.activePlanWeekIndex);
      if (parsed.sessionWeekSnapshot && typeof parsed.sessionWeekSnapshot === 'object') {
        setSessionWeekSnapshot(parsed.sessionWeekSnapshot);
      }
      if (typeof parsed.sessionIntention === 'string') setSessionIntention(parsed.sessionIntention);
      setTimerOpen(nextTimerOpen);
      setTimerRunning(nextTimerRunning);
      setTimerSeconds(nextTimerSeconds);
      setCountdownOpen(nextCountdownOpen);
      setCountdown(nextCountdownOpen ? nextCountdown : 3);
      setFloorUiHidden(Boolean(parsed.floorUiHidden && nextTimerOpen));
      emitToast('Restored your active training session.', 'info', 2800);
    } catch {
      // ignore malformed restore payloads
    }
  }, [
    athleteSessionRestoredRef,
    athleteSessionStorageKey,
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
    setSessionWeekSnapshot,
    setTimerOpen,
    setTimerRunning,
    setTimerSeconds,
  ]);

  useEffect(() => {
    if (!athleteSessionStorageKey) return;
    const hasMeaningfulSession =
      Boolean(selectedPlan) ||
      Boolean(sessionWeekSnapshot) ||
      countdownOpen ||
      timerOpen ||
      timerSeconds > 0 ||
      Boolean(sessionIntention.trim()) ||
      Boolean(session.notes.trim());

    if (!hasMeaningfulSession) {
      try {
        localStorage.removeItem(athleteSessionStorageKey);
      } catch {
        // ignore storage failures
      }
      return;
    }

    try {
      localStorage.setItem(
        athleteSessionStorageKey,
        JSON.stringify({
          session,
          sessionFocus,
          selectedPlan,
          planSportFilter,
          planSearch,
          activePlanWeekIndex,
          sessionWeekSnapshot,
          timerOpen,
          timerRunning,
          timerSeconds,
          countdownOpen,
          countdown,
          floorUiHidden,
          sessionIntention,
          savedAt: Date.now(),
        })
      );
    } catch {
      // ignore storage failures
    }
  }, [
    activePlanWeekIndex,
    athleteSessionStorageKey,
    countdown,
    countdownOpen,
    floorUiHidden,
    planSearch,
    planSportFilter,
    selectedPlan,
    session,
    sessionFocus,
    sessionIntention,
    sessionWeekSnapshot,
    timerOpen,
    timerRunning,
    timerSeconds,
  ]);

  useEffect(() => {
    if (!athleteReflectionDraftKey || !congratsOpen) return;
    try {
      const raw = localStorage.getItem(athleteReflectionDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.text === 'string') {
        setSessionReflection(parsed.text);
      }
    } catch {
      // ignore malformed draft
    }
  }, [athleteReflectionDraftKey, congratsOpen, setSessionReflection]);

  useEffect(() => {
    if (!athleteReflectionDraftKey || !congratsOpen) return;
    try {
      if (!sessionReflection.trim()) {
        localStorage.removeItem(athleteReflectionDraftKey);
        return;
      }
      localStorage.setItem(
        athleteReflectionDraftKey,
        JSON.stringify({
          text: sessionReflection,
          at: Date.now(),
        })
      );
    } catch {
      // ignore storage failure
    }
  }, [athleteReflectionDraftKey, congratsOpen, sessionReflection]);
}
