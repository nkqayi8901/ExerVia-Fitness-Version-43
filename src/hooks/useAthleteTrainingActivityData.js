import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function useAthleteTrainingActivityData({ userId }) {
  const [recentTrainingSessions, setRecentTrainingSessions] = useState([]);
  const [recentRouteEfforts, setRecentRouteEfforts] = useState([]);
  const [selectedTrainingTrendDay, setSelectedTrainingTrendDay] = useState('');
  const [recoveryNudge, setRecoveryNudge] = useState(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);

  useEffect(() => {
    if (!userId) {
      setRecentTrainingSessions([]);
      return;
    }
    let active = true;
    const run = async () => {
      const { data } = await supabase
        .from('training_sessions')
        .select('id,sport,duration_minutes,created_at,metrics')
        .eq('user_id', Number(userId))
        .order('created_at', { ascending: false })
        .limit(12);
      if (active) {
        setRecentTrainingSessions(data || []);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setRecentRouteEfforts([]);
      return;
    }
    let active = true;
    const run = async () => {
      const { data } = await supabase
        .from('athlete_runs')
        .select('id,title,discipline,distance_km,elapsed_seconds,created_at')
        .eq('user_id', Number(userId))
        .order('created_at', { ascending: false })
        .limit(20);
      if (active) {
        setRecentRouteEfforts(data || []);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!recentTrainingSessions.length) {
      setSelectedTrainingTrendDay('');
      return;
    }
    if (selectedTrainingTrendDay) return;
    const latestSessionDay = String(recentTrainingSessions[0]?.created_at || '').slice(0, 10);
    if (latestSessionDay) {
      setSelectedTrainingTrendDay(latestSessionDay);
    }
  }, [recentTrainingSessions, selectedTrainingTrendDay]);

  useEffect(() => {
    let storedUserId = '';
    try {
      storedUserId = localStorage.getItem('exervia_user_id') || '';
    } catch {
      storedUserId = '';
    }
    const nudgeUserId = storedUserId || userId || 'guest';
    const key = `exervia_recovery_nudge_${nudgeUserId}`;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') {
        setRecoveryNudge(null);
        return;
      }
      const ageMs = Date.now() - Number(parsed.at || 0);
      if (!Number.isFinite(ageMs) || ageMs > 1000 * 60 * 60 * 72) {
        setRecoveryNudge(null);
        return;
      }
      setRecoveryNudge(parsed);
    } catch {
      setRecoveryNudge(null);
    }
  }, [recentTrainingSessions, userId]);

  useEffect(() => {
    if (!userId) return;
    const walkthroughSeenKey = `exervia_athlete_training_walkthrough_seen_${userId}`;
    try {
      if (localStorage.getItem(walkthroughSeenKey)) return;
      setWalkthroughOpen(true);
      localStorage.setItem(walkthroughSeenKey, '1');
    } catch {
      // ignore storage failure and keep the ritual usable
    }
  }, [userId]);

  return {
    recentRouteEfforts,
    recentTrainingSessions,
    recoveryNudge,
    selectedTrainingTrendDay,
    setSelectedTrainingTrendDay,
    setWalkthroughOpen,
    walkthroughOpen,
  };
}
