import { useCallback, useMemo } from 'react';
import { formatDistance, formatPaceFromSecondsPerKm } from '../utils/athleteMetrics';
import { getAthleteWorldMeta } from '../utils/athleteWorlds';

function useAthleteTrainingInsights({
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
}) {
  const filteredPlans = useMemo(() => {
    const query = planSearch.toLowerCase();
    return plans.filter((plan) => {
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
  }, [planSearch, planSportFilter, plans]);

  const recommendedPlans = useMemo(
    () => plans.filter((plan) => plan.sport === session.sport || plan.defaultFocus === sessionFocus).slice(0, 3),
    [plans, session.sport, sessionFocus]
  );

  const ritualWorldMeta = useMemo(
    () => getAthleteWorldMeta(planSportFilter || selectedPlan?.sport || session.sport || 'running'),
    [planSportFilter, selectedPlan?.sport, session.sport]
  );

  const displayPlans = useCallback(
    (showAllPlans) => (planSportFilter ? filteredPlans : []).slice(0, showAllPlans || planSearch ? filteredPlans.length : 5),
    [filteredPlans, planSearch, planSportFilter]
  );

  const sortedPins = useMemo(
    () => [
      ...pinnedOrder.filter((item) => planFavorites.includes(item)),
      ...planFavorites.filter((item) => !pinnedOrder.includes(item)),
    ],
    [pinnedOrder, planFavorites]
  );

  const pinnedPlans = useMemo(
    () => sortedPins.map((item) => plans.find((plan) => plan.name === item)).filter(Boolean),
    [plans, sortedPins]
  );

  const pinnedPlan = pinnedPlans[0] || null;
  const suggestedPlan = filteredPlans[0] || pinnedPlan || recommendedPlans[0] || null;
  const timelinePlan = selectedPlan || pinnedPlan || recommendedPlans[0];
  const selectedPlanOutline = Array.isArray(selectedPlan?.outline) ? selectedPlan.outline : [];
  const selectedPlanWeek = selectedPlanOutline[activePlanWeekIndex] || selectedPlanOutline[0] || null;
  const timerChecklistWeek = sessionWeekSnapshot || selectedPlanWeek;
  const lastTraining = recentTrainingSessions[0] || null;

  const parsePlanNameFromNotes = useCallback((notesValue = '') => {
    const notesText = String(notesValue || '');
    const match = notesText.match(/Plan:\s*(.+?)\s*(?:\(|-|$)/i);
    return match ? String(match[1] || '').trim() : '';
  }, []);

  const getRecentPlanName = useCallback(
    (row) =>
      String(row?.metrics?.plan_name || '').trim() ||
      parsePlanNameFromNotes(row?.notes || '') ||
      String(row?.sport || 'training').toUpperCase(),
    [parsePlanNameFromNotes]
  );

  const getRecentPlanWeek = useCallback((row) => {
    const metricsWeek = String(row?.metrics?.plan_week || '').trim();
    if (metricsWeek) return metricsWeek;
    const notesText = String(row?.notes || '');
    const weekMatch = notesText.match(/\((Week\s+\d+)\)/i);
    return weekMatch ? String(weekMatch[1] || '').trim() : '';
  }, []);

  const getRecentObjectives = useCallback((row) => {
    const fromMetrics = Array.isArray(row?.metrics?.plan_sessions)
      ? row.metrics.plan_sessions.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    return fromMetrics.length ? fromMetrics : [];
  }, []);

  const lastTrainingTitle = lastTraining ? getRecentPlanName(lastTraining) : '';
  const timedSessionDurations = recentTrainingSessions
    .map((row) => Number(row?.duration_minutes || 0))
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0);
  const bestDurationMinutes = timedSessionDurations.length ? Math.min(...timedSessionDurations) : 0;
  const avgDurationMinutes = timedSessionDurations.length
    ? Math.round(timedSessionDurations.reduce((sum, minutes) => sum + Number(minutes || 0), 0) / timedSessionDurations.length)
    : 0;
  const totalSessionsLogged = recentTrainingSessions.length;
  const uniqueSportsTracked = new Set(
    recentTrainingSessions.map((row) => String(row?.sport || '').trim()).filter(Boolean)
  ).size;

  const recentSessionDurationByDay = useMemo(() => {
    const now = new Date();
    const rows = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      const key = date.toISOString().slice(0, 10);
      const dayRows = recentTrainingSessions.filter((row) => String(row?.created_at || '').slice(0, 10) === key);
      const totalMinutes = dayRows.reduce((sum, row) => sum + Math.max(0, Number(row?.duration_minutes || 0)), 0);
      rows.push({
        key,
        label: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        minutes: totalMinutes,
      });
    }
    return rows;
  }, [recentTrainingSessions]);

  const maxTrainingMinutesByDay = Math.max(1, ...recentSessionDurationByDay.map((item) => Number(item.minutes || 0)));

  const topSportsTrend = useMemo(() => {
    const counts = {};
    recentTrainingSessions.forEach((row) => {
      const key = String(row?.sport || '').trim();
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([sport, count]) => ({ sport: sport.toUpperCase(), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [recentTrainingSessions]);

  const maxSportCount = Math.max(1, ...topSportsTrend.map((item) => Number(item.count || 0)));
  const selectedTrainingTrendDayKey =
    selectedTrainingTrendDay || recentSessionDurationByDay[recentSessionDurationByDay.length - 1]?.key || '';
  const selectedDaySessions = recentTrainingSessions
    .filter((row) => String(row?.created_at || '').slice(0, 10) === selectedTrainingTrendDayKey)
    .slice(0, 8);

  const activeWorldSport = planSportFilter || selectedPlan?.sport || '';
  const filteredRouteEfforts = useMemo(() => {
    const world = activeWorldSport || '';
    if (!world) return recentRouteEfforts.slice(0, 3);
    return recentRouteEfforts
      .filter((effort) => String(effort?.discipline || '').trim().toLowerCase() === world)
      .slice(0, 3);
  }, [activeWorldSport, recentRouteEfforts]);

  const activeWorldSessionCount = activeWorldSport
    ? recentTrainingSessions.filter((row) => String(row?.sport || '').trim().toLowerCase() === activeWorldSport).length
    : 0;
  const activeWorldMinutes = activeWorldSport
    ? recentTrainingSessions
        .filter((row) => String(row?.sport || '').trim().toLowerCase() === activeWorldSport)
        .reduce((sum, row) => sum + Math.max(0, Number(row?.duration_minutes || 0)), 0)
    : 0;
  const activeWorldDistanceKm = activeWorldSport
    ? recentRouteEfforts
        .filter((effort) => String(effort?.discipline || '').trim().toLowerCase() === activeWorldSport)
        .reduce((sum, effort) => sum + Math.max(0, Number(effort?.distance_km || 0)), 0)
    : 0;

  const formatPaceLabel = useCallback(
    (secondsPerKm) => formatPaceFromSecondsPerKm(secondsPerKm, { unit: distanceUnit, includeUnit: true }),
    [distanceUnit]
  );

  const routePrStats = useMemo(() => {
    const routeRows = recentRouteEfforts.filter(
      (effort) => Number(effort?.distance_km || 0) > 0 && Number(effort?.elapsed_seconds || 0) > 0
    );
    if (!routeRows.length) {
      return { bestPace: null, longestDistance: 0, longestDiscipline: '' };
    }
    const bestPaceRow = routeRows.reduce((best, current) => {
      const currentPace = Number(current.elapsed_seconds || 0) / Number(current.distance_km || 1);
      if (!best) return { row: current, pace: currentPace };
      return currentPace < best.pace ? { row: current, pace: currentPace } : best;
    }, null);
    const longestDistanceRow = routeRows.reduce(
      (best, current) => (Number(current.distance_km || 0) > Number(best?.distance_km || 0) ? current : best),
      null
    );
    return {
      bestPace: bestPaceRow ? formatPaceFromSecondsPerKm(bestPaceRow.pace, { unit: distanceUnit, includeUnit: true }) : null,
      longestDistance: Number(longestDistanceRow?.distance_km || 0),
      longestDiscipline: longestDistanceRow ? getAthleteWorldMeta(longestDistanceRow.discipline).title : '',
    };
  }, [distanceUnit, recentRouteEfforts]);

  const weeklyVolumeChart = useMemo(
    () => recentSessionDurationByDay.map((item) => ({ ...item, ratio: maxTrainingMinutesByDay ? Number(item.minutes || 0) / maxTrainingMinutesByDay : 0 })),
    [recentSessionDurationByDay, maxTrainingMinutesByDay]
  );

  const paceTrendPoints = useMemo(
    () =>
      recentRouteEfforts
        .filter((effort) => Number(effort?.distance_km || 0) > 0 && Number(effort?.elapsed_seconds || 0) > 0)
        .slice(0, 8)
        .reverse()
        .map((effort) => {
          const paceSeconds = Number(effort.elapsed_seconds || 0) / Math.max(0.01, Number(effort.distance_km || 0));
          return {
            id: effort.id,
            label: new Date(effort.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            paceSeconds,
            paceLabel: formatPaceLabel(paceSeconds) || `--:--/${distanceUnit}`,
          };
        }),
    [distanceUnit, formatPaceLabel, recentRouteEfforts]
  );

  const paceTrendRange = useMemo(() => {
    if (!paceTrendPoints.length) return { min: 0, max: 0 };
    const values = paceTrendPoints.map((item) => item.paceSeconds);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [paceTrendPoints]);

  const paceTrendPolyline = useMemo(() => {
    if (paceTrendPoints.length < 2) return '';
    const spread = Math.max(1, paceTrendRange.max - paceTrendRange.min);
    const stepX = paceTrendPoints.length > 1 ? 100 / (paceTrendPoints.length - 1) : 100;
    return paceTrendPoints
      .map((item, index) => {
        const normalized = (item.paceSeconds - paceTrendRange.min) / spread;
        const x = index * stepX;
        const y = 100 - normalized * 74 - 12;
        return `${x},${y}`;
      })
      .join(' ');
  }, [paceTrendPoints, paceTrendRange]);

  const routeRitualPreview = filteredRouteEfforts.slice(0, 2);

  const detectSessionPrs = useCallback(
    ({ priorSessions, sport, durationMinutes, distanceKm }) => {
      const normalizedSport = String(sport || '').trim().toLowerCase();
      const rows = priorSessions.filter((row) => String(row?.sport || '').trim().toLowerCase() === normalizedSport);
      const prs = [];
      const maxDuration = rows.reduce((best, row) => Math.max(best, Number(row?.duration_minutes || 0)), 0);
      const maxDistance = rows.reduce((best, row) => Math.max(best, Number(row?.metrics?.distance || 0)), 0);
      if (Number(durationMinutes || 0) > 0 && Number(durationMinutes || 0) > maxDuration) {
        prs.push({ label: 'Longest session', value: `${Math.round(Number(durationMinutes || 0))} min` });
      }
      if (Number(distanceKm || 0) > 0 && Number(distanceKm || 0) > maxDistance) {
        prs.push({
          label: 'Longest distance',
          value: formatDistance(distanceKm, { unit: distanceUnit, decimals: 1, includeUnit: true }),
        });
      }
      return prs;
    },
    [distanceUnit]
  );

  const buildRouteLabUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (activeWorldSport) params.set('world', activeWorldSport);
    if (selectedPlan?.name) params.set('plan', selectedPlan.name);
    if (selectedPlan?.defaultFocus) params.set('focus', selectedPlan.defaultFocus);
    if (selectedPlanWeek?.week) params.set('week', selectedPlanWeek.week);
    const firstObjective = Array.isArray(selectedPlanWeek?.sessions) ? selectedPlanWeek.sessions[0] : '';
    if (firstObjective) params.set('objective', firstObjective);
    return `/athlete/${userId}/routes${params.toString() ? `?${params.toString()}` : ''}`;
  }, [activeWorldSport, selectedPlan?.defaultFocus, selectedPlan?.name, selectedPlanWeek?.sessions, selectedPlanWeek?.week, userId]);

  return {
    filteredPlans,
    recommendedPlans,
    ritualWorldMeta,
    displayPlans,
    sortedPins,
    pinnedPlans,
    pinnedPlan,
    suggestedPlan,
    timelinePlan,
    selectedPlanOutline,
    selectedPlanWeek,
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
    recentSessionDurationByDay,
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
  };
}

export default useAthleteTrainingInsights;
