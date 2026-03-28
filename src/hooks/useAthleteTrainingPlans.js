import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  fallbackPlans,
  outlinePresets,
  worldFallbackPlans,
} from '../utils/athleteTrainingConfig';
import { formatDistance } from '../utils/athleteMetrics';

const FAVORITES_KEY = 'exervia_plan_favorites';
const PINNED_ORDER_KEY = 'exervia_plan_pinned_order';

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
    source,
  };
};

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

const loadStoredJson = (key) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export default function useAthleteTrainingPlans({ userId, distanceUnit }) {
  const [plans, setPlans] = useState([]);
  const [planFavorites, setPlanFavorites] = useState([]);
  const [pinnedOrder, setPinnedOrder] = useState([]);
  const [apiStatus, setApiStatus] = useState('idle');

  const saveFavorites = useCallback((items) => {
    setPlanFavorites(items);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
    } catch {
      // best-effort persistence only
    }
  }, []);

  const savePinnedOrder = useCallback((items) => {
    setPinnedOrder(items);
    try {
      localStorage.setItem(PINNED_ORDER_KEY, JSON.stringify(items));
    } catch {
      // best-effort persistence only
    }
  }, []);

  const togglePlanFavorite = useCallback((plan) => {
    if (!plan?.name) return;
    if (planFavorites.includes(plan.name)) {
      const next = planFavorites.filter((item) => item !== plan.name);
      saveFavorites(next);
      savePinnedOrder(pinnedOrder.filter((item) => item !== plan.name));
    } else {
      saveFavorites([...planFavorites, plan.name]);
      if (!pinnedOrder.includes(plan.name)) {
        savePinnedOrder([...pinnedOrder, plan.name]);
      }
    }
  }, [pinnedOrder, planFavorites, saveFavorites, savePinnedOrder]);

  const buildOutline = useCallback((sport, focus, duration, distance) => {
    const durationTag = duration ? `${duration} min` : null;
    const distanceTag = distance
      ? formatDistance(distance, { unit: distanceUnit, decimals: distanceUnit === 'mi' ? 1 : 0, includeUnit: true })
      : null;
    const tag = [durationTag, distanceTag].filter(Boolean).join(' · ');
    const weekFocus = [
      focus,
      focus === 'Base' ? 'Tempo' : 'Base',
      focus === 'Speed' ? 'Tempo' : 'Speed',
      'Recovery',
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
        sessions,
      };
    });
  }, [distanceUnit]);

  const fetchExternalPlans = useCallback(async () => {
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
      return list.map((item) => mapPlan(item, 'api'));
    } catch (error) {
      console.error('Plan API error:', error);
      setApiStatus('error');
      return [];
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    const collected = [];
    const apiPlans = await fetchExternalPlans();

    if (apiPlans.length > 0) {
      apiPlans.forEach((plan) => {
        if (plan) collected.push(plan);
      });
    }

    const { data: templateData } = await supabase
      .from('training_plan_templates')
      .select('*')
      .limit(40);

    if (templateData && templateData.length > 0) {
      templateData.forEach((template) => {
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
        userPlanData.forEach((plan) => {
          const mapped = mapPlan(plan, 'user');
          if (mapped) collected.unshift(mapped);
        });
      }
    }

    if (collected.length === 0) {
      collected.push(...fallbackPlans, ...worldFallbackPlans);
    }

    setPlans(dedupePlans(collected));
  }, [fetchExternalPlans, userId]);

  useEffect(() => {
    fetchPlans();
    setPlanFavorites(loadStoredJson(FAVORITES_KEY));
    setPinnedOrder(loadStoredJson(PINNED_ORDER_KEY));
  }, [fetchPlans]);

  return {
    apiStatus,
    buildOutline,
    fetchPlans,
    pinnedOrder,
    planFavorites,
    plans,
    savePinnedOrder,
    setPlans,
    togglePlanFavorite,
    mapPlan,
  };
}
