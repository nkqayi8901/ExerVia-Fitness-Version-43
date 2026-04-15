import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import localRecipes from '../data/recipes.json';
import './NutritionPinnacle.css';

// ---------------------------------------------------------------------------
// TheMealDB helpers
// ---------------------------------------------------------------------------
const MEALDB = 'https://www.themealdb.com/api/json/v1/1';

const MEALDB_CATEGORY_MAP = {
  chicken: 'Chicken', beef: 'Beef', pork: 'Pork',
  seafood: 'Seafood', vegetarian: 'Vegetarian',
};

const MEALDB_SEARCH_TERMS = {
  turkey: ['turkey', 'roast turkey'], chickpeas: ['chickpea', 'hummus'],
  chicken: ['grilled chicken', 'chicken breast'],
  beef: ['lean beef', 'beef stir fry'], seafood: ['salmon', 'tuna'],
  vegetarian: ['quinoa bowl', 'lentil'], pork: ['pork tenderloin'],
};

async function mealdbFetch(preference) {
  try {
    const category = MEALDB_CATEGORY_MAP[preference];
    if (category) {
      const res = await fetch(`${MEALDB}/filter.php?c=${encodeURIComponent(category)}`);
      const json = await res.json();
      return (json?.meals || []).filter(m => m?.idMeal && m?.strMeal);
    }
    const terms = (MEALDB_SEARCH_TERMS[preference] || [preference]).slice(0, 2);
    const lists = await Promise.all(
      terms.map(t => fetch(`${MEALDB}/search.php?s=${encodeURIComponent(t)}`)
        .then(r => r.json()).then(j => j?.meals || []).catch(() => []))
    );
    return lists.flat().filter(m => m?.idMeal && m?.strMeal);
  } catch {
    return [];
  }
}

function normalizeMealdbEntry(m) {
  return {
    id: `mealdb-${m.idMeal}`,
    name: m.strMeal,
    category: m.strCategory || 'Main',
    preference: null, // filled after filtering
    goal: ['high_protein', 'balanced', 'cut'],
    timeMin: 30,
    difficulty: 'Medium',
    calories: 480, protein: 38, carbs: 42, fat: 16, // reasonable defaults
    image: m.strMealThumb || '',
    description: m.strArea ? `${m.strArea} style` : '',
    ingredients: [],
    instructions: [],
    source: 'mealdb',
  };
}

// ---------------------------------------------------------------------------
// Normalize recipes.json entry to internal meal shape
// ---------------------------------------------------------------------------
function normalizeLocalRecipe(r) {
  return {
    id: r.id,
    name: r.title,
    category: r.mealType || 'Main',
    preference: r.preference,
    goal: r.goals || [],
    timeMin: r.minutes || 30,
    difficulty: r.minutes <= 15 ? 'Easy' : r.minutes <= 30 ? 'Medium' : 'Medium',
    calories: r.nutrition?.calories || 0,
    protein:  r.nutrition?.protein  || 0,
    carbs:    r.nutrition?.carbs    || 0,
    fat:      r.nutrition?.fat      || 0,
    image: '',
    description: r.tip ? r.tip.slice(0, 120) + '…' : '',
    ingredients: (r.ingredients || []).map(i => `${i.measure} ${i.ingredient}`.trim()),
    instructions: r.instructions || [],
    source: 'local',
  };
}

const LOCAL_MEAL_POOL = localRecipes.map(normalizeLocalRecipe);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOALS = [
  { key: 'high_protein', label: 'High Protein', hint: 'lean + performance' },
  { key: 'balanced',     label: 'Balanced',     hint: 'steady energy' },
  { key: 'cut',          label: 'Cut / Lean Out', hint: 'high satiety' },
];

const TIME_WINDOWS = [
  { key: '15', label: '15 min' },
  { key: '30', label: '30 min' },
  { key: '45', label: '45 min' },
];

const PREFERENCES = [
  { key: 'chicken',    label: 'Chicken' },
  { key: 'beef',       label: 'Beef' },
  { key: 'turkey',     label: 'Turkey' },
  { key: 'seafood',    label: 'Seafood' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'chickpeas',  label: 'Chickpeas' },
  { key: 'pork',       label: 'Pork' },
];

// Day abbreviations used throughout
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];


// ---------------------------------------------------------------------------
// Helper: SVG Bar Chart
// ---------------------------------------------------------------------------

function BarChart({ data, color, target, label }) {
  const maxVal = Math.max(...data, target || 0, 1);
  const chartH = 100;
  const barW = 18;
  const gap = 8;
  const totalW = (barW + gap) * 7 - gap;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${chartH + 24}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-label={`${label} 7-day bar chart`}
    >
      {/* Target line */}
      {target > 0 && (
        <line
          x1={0}
          y1={chartH - (target / maxVal) * chartH}
          x2={totalW}
          y2={chartH - (target / maxVal) * chartH}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      {data.map((val, i) => {
        const barH = val > 0 ? Math.max(4, (val / maxVal) * chartH) : 2;
        const x = i * (barW + gap);
        const y = chartH - barH;
        const opacity = val > 0 ? 1 : 0.25;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill={color}
              opacity={opacity}
            />
            <text
              x={x + barW / 2}
              y={chartH + 14}
              textAnchor="middle"
              fill="rgba(148,163,184,0.8)"
              fontSize={9}
            >
              {DAY_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helper: Macro Ring (SVG donut)
// ---------------------------------------------------------------------------

function MacroRing({ value, target, color, label, size = 80 }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div className="macro-ring-wrap" style={{ width: size, height: size + 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div style={{ textAlign: 'center', marginTop: -4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{value > 0 ? value : '—'}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Recipe Modal
// ---------------------------------------------------------------------------

function RecipeModal({ meal, onClose, onLogMeal }) {
  if (!meal) return null;
  return (
    <div
      className="walkthrough-modal"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ zIndex: 2000 }}
    >
      <div
        className="walkthrough-content"
        style={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', padding: 0, borderRadius: 16 }}
      >
        {/* Image */}
        <div style={{ position: 'relative', height: 200, overflow: 'hidden', borderRadius: '16px 16px 0 0' }}>
          <img
            src={meal.image}
            alt={meal.name}
            onError={e => { e.target.style.display = 'none'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(11,18,32,0.9) 0%, transparent 60%)',
          }} />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, color: '#fff', fontSize: 16, width: 32, height: 32,
              cursor: 'pointer', lineHeight: '1',
            }}
          >×</button>
          <div style={{ position: 'absolute', bottom: 12, left: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{meal.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{meal.category} · {meal.timeMin} min · {meal.difficulty}</div>
          </div>
        </div>

        {/* Macros */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Calories', val: `${meal.calories} kcal`, color: '#f59e0b' },
              { label: 'Protein',  val: `${meal.protein}g`,      color: '#10b981' },
              { label: 'Carbs',    val: `${meal.carbs}g`,        color: '#3b82f6' },
              { label: 'Fat',      val: `${meal.fat}g`,          color: '#a855f7' },
            ].map(m => (
              <div key={m.label} style={{
                background: 'rgba(17,24,39,0.8)', border: '1px solid #1f2937',
                borderRadius: 8, padding: '6px 12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.val}</div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 10, fontSize: 14 }}>Ingredients</div>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#94a3b8', fontSize: 13, lineHeight: 1.8 }}>
            {meal.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
          </ul>
        </div>

        {/* Instructions */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 10, fontSize: 14 }}>Instructions</div>
          <ol style={{ margin: 0, paddingLeft: 20, color: '#94a3b8', fontSize: 13, lineHeight: 1.8 }}>
            {meal.instructions.map((step, i) => <li key={i} style={{ marginBottom: 6 }}>{step}</li>)}
          </ol>
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 20px', display: 'flex', gap: 10 }}>
          <button
            className="add-intake-btn"
            style={{ flex: 1 }}
            onClick={() => { onLogMeal(meal); onClose(); }}
          >
            Log This Meal
          </button>
          <button
            className="walkthrough-btn"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const NutritionPinnacle = ({ viewerId }) => {
  const { id }    = useParams();

  const resolvedViewerIdRaw = Number(viewerId || id);
  const resolvedViewerId    = Number.isFinite(resolvedViewerIdRaw) ? resolvedViewerIdRaw : null;

  // ------------------------------------------------------------------
  // Core UI state
  // ------------------------------------------------------------------
  const [loading,       setLoading]       = useState(true);
  const [activeView,    setActiveView]    = useState('intake'); // 'intake' | 'protocol' | 'overview'
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // ------------------------------------------------------------------
  // Protocol / filter state
  // ------------------------------------------------------------------
  const [protocolSettings, setProtocolSettings] = useState({
    goal:       'balanced',
    time:       '45',
    preference: 'chicken',
  });

  // Seed used to rotate visible meals on "Generate New Meals"
  const [mealSeed, setMealSeed] = useState(0);

  // Async-generated meal pool (local + TheMealDB)
  const [generatedMeals, setGeneratedMeals] = useState([]);
  const [generatingMeals, setGeneratingMeals] = useState(false);

  // ------------------------------------------------------------------
  // Nutrition targets (recalculated from profile)
  // ------------------------------------------------------------------
  const [targets, setTargets] = useState({
    calories: 2500,
    protein:  150,
    carbs:    300,
    fat:      80,
  });

  // ------------------------------------------------------------------
  // Today's intake data (loaded from Supabase + updated optimistically)
  // ------------------------------------------------------------------
  const [intakeData, setIntakeData] = useState({
    calories: 0,
    protein:  0,
    carbs:    0,
    fat:      0,
  });

  // ------------------------------------------------------------------
  // Quick-log form state
  // ------------------------------------------------------------------
  const [quickLog, setQuickLog] = useState({
    calories: '',
    protein:  '',
    carbs:    '',
    fat:      '',
  });
  const [logSaving, setLogSaving] = useState(false);
  const [logMessage, setLogMessage] = useState('');

  // ------------------------------------------------------------------
  // Weekly chart data: array of 7 objects {calories, protein, carbs, fat}
  // Index 0 = Mon of current week, index 6 = Sun
  // ------------------------------------------------------------------
  const [weeklyData, setWeeklyData] = useState(() =>
    Array.from({ length: 7 }, () => ({ calories: 0, protein: 0, carbs: 0, fat: 0 }))
  );

  // ------------------------------------------------------------------
  // Favorites
  // ------------------------------------------------------------------
  const [favorites, setFavorites] = useState(new Set());

  // ------------------------------------------------------------------
  // Recipe modal
  // ------------------------------------------------------------------
  const [recipeModal, setRecipeModal] = useState(null); // meal object | null

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getProgressPct = (current, target) =>
    target > 0 ? Math.min((current / target) * 100, 100) : 0;

  const formatDateReadable = (date = new Date()) =>
    date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Build ISO date strings for this week Mon–Sun
  const weekDates = useMemo(() => {
    const today  = new Date();
    const dow    = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dow + 6) % 7)); // rewind to Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, []);

  // ------------------------------------------------------------------
  // Load data on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // 1. User profile → targets
      if (resolvedViewerId) {
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('weight_kg, goal, fitness_level')
            .eq('id', resolvedViewerId)
            .single();

          if (!cancelled && profile) {
            const base = (profile.weight_kg || 75) * 30;
            setTargets({
              calories: Math.round(base),
              protein:  Math.round((profile.weight_kg || 75) * 2.2),
              carbs:    Math.round((base * 0.45) / 4),
              fat:      Math.round((base * 0.25) / 9),
            });
          }
        } catch (_) {
          // non-fatal
        }

        // 2. Today's intake
        try {
          const { data: todayRows } = await supabase
            .from('nutrition_logs')
            .select('calories, protein_g, carbs_g, fat_g')
            .eq('user_id', resolvedViewerId)
            .eq('date', todayISO());

          if (!cancelled && todayRows && todayRows.length > 0) {
            const totals = todayRows.reduce(
              (acc, r) => ({
                calories: acc.calories + (r.calories    || 0),
                protein:  acc.protein  + (r.protein_g   || 0),
                carbs:    acc.carbs    + (r.carbs_g     || 0),
                fat:      acc.fat      + (r.fat_g       || 0),
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );
            setIntakeData(totals);
          }
        } catch (_) {
          // non-fatal
        }

        // 3. Weekly data
        try {
          const { data: weekRows } = await supabase
            .from('nutrition_logs')
            .select('date, calories, protein_g, carbs_g, fat_g')
            .eq('user_id', resolvedViewerId)
            .in('date', weekDates);

          if (!cancelled && weekRows) {
            const mapped = weekDates.map(dateStr => {
              const rows = weekRows.filter(r => r.date === dateStr);
              return rows.reduce(
                (acc, r) => ({
                  calories: acc.calories + (r.calories   || 0),
                  protein:  acc.protein  + (r.protein_g  || 0),
                  carbs:    acc.carbs    + (r.carbs_g    || 0),
                  fat:      acc.fat      + (r.fat_g      || 0),
                }),
                { calories: 0, protein: 0, carbs: 0, fat: 0 }
              );
            });
            setWeeklyData(mapped);
          }
        } catch (_) {
          // non-fatal
        }

        // 4. Favorites
        try {
          const { data: favData } = await supabase
            .from('user_favorites')
            .select('meal_id')
            .eq('user_id', resolvedViewerId)
            .eq('type', 'meal');

          if (!cancelled && favData) {
            setFavorites(new Set(favData.map(f => f.meal_id)));
          }
        } catch (_) {
          // non-fatal
        }
      }

      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [resolvedViewerId, weekDates]);

  // ------------------------------------------------------------------
  // Quick log handler — saves to Supabase and updates local state
  // ------------------------------------------------------------------
  const handleAddIntake = async () => {
    const kcal = Number(quickLog.calories) || 0;
    const prot = Number(quickLog.protein)  || 0;
    const carb = Number(quickLog.carbs)    || 0;
    const fat  = Number(quickLog.fat)      || 0;

    if (!kcal && !prot && !carb && !fat) {
      setLogMessage('Enter at least one value.');
      setTimeout(() => setLogMessage(''), 3000);
      return;
    }

    setLogSaving(true);
    setLogMessage('');

    // Optimistic update
    const newIntake = {
      calories: intakeData.calories + kcal,
      protein:  intakeData.protein  + prot,
      carbs:    intakeData.carbs    + carb,
      fat:      intakeData.fat      + fat,
    };
    setIntakeData(newIntake);

    // Also update weekly data for today
    const todayIndex = weekDates.indexOf(todayISO());
    if (todayIndex >= 0) {
      setWeeklyData(prev => {
        const next = [...prev];
        next[todayIndex] = {
          calories: (next[todayIndex]?.calories || 0) + kcal,
          protein:  (next[todayIndex]?.protein  || 0) + prot,
          carbs:    (next[todayIndex]?.carbs    || 0) + carb,
          fat:      (next[todayIndex]?.fat      || 0) + fat,
        };
        return next;
      });
    }

    // Persist
    if (resolvedViewerId) {
      try {
        const { error: dbErr } = await supabase.from('nutrition_logs').insert({
          user_id:   resolvedViewerId,
          date:      todayISO(),
          calories:  kcal,
          protein_g: prot,
          carbs_g:   carb,
          fat_g:     fat,
          source:    'quick_log',
          created_at: new Date().toISOString(),
        });

        if (dbErr) {
          setLogMessage('Saved locally (sync failed).');
        } else {
          setLogMessage('Logged!');
        }
      } catch (_) {
        setLogMessage('Saved locally (offline).');
      }
    } else {
      setLogMessage('Logged locally (no account).');
    }

    setQuickLog({ calories: '', protein: '', carbs: '', fat: '' });
    setLogSaving(false);
    setTimeout(() => setLogMessage(''), 3000);
  };

  // ------------------------------------------------------------------
  // Log meal directly from a meal card
  // ------------------------------------------------------------------
  const handleLogMeal = async (meal) => {
    const entry = {
      calories: meal.calories,
      protein:  meal.protein,
      carbs:    meal.carbs,
      fat:      meal.fat,
    };

    // Optimistic update
    setIntakeData(prev => ({
      calories: prev.calories + entry.calories,
      protein:  prev.protein  + entry.protein,
      carbs:    prev.carbs    + entry.carbs,
      fat:      prev.fat      + entry.fat,
    }));
    const todayIndex = weekDates.indexOf(todayISO());
    if (todayIndex >= 0) {
      setWeeklyData(prev => {
        const next = [...prev];
        next[todayIndex] = {
          calories: (next[todayIndex]?.calories || 0) + entry.calories,
          protein:  (next[todayIndex]?.protein  || 0) + entry.protein,
          carbs:    (next[todayIndex]?.carbs    || 0) + entry.carbs,
          fat:      (next[todayIndex]?.fat      || 0) + entry.fat,
        };
        return next;
      });
    }

    if (resolvedViewerId) {
      try {
        await supabase.from('nutrition_logs').insert({
          user_id:   resolvedViewerId,
          date:      todayISO(),
          calories:  entry.calories,
          protein_g: entry.protein,
          carbs_g:   entry.carbs,
          fat_g:     entry.fat,
          source:    meal.name,
          created_at: new Date().toISOString(),
        });
      } catch (_) {
        // non-fatal
      }
    }
  };

  // ------------------------------------------------------------------
  // Favorite toggle
  // ------------------------------------------------------------------
  const handleFavoriteToggle = async (mealId) => {
    try {
      if (favorites.has(mealId)) {
        setFavorites(prev => { const s = new Set(prev); s.delete(mealId); return s; });
        if (resolvedViewerId) {
          await supabase.from('user_favorites').delete()
            .eq('user_id', resolvedViewerId).eq('meal_id', mealId).eq('type', 'meal');
        }
      } else {
        setFavorites(prev => new Set([...prev, mealId]));
        if (resolvedViewerId) {
          await supabase.from('user_favorites').insert({
            user_id: resolvedViewerId, meal_id: mealId, type: 'meal',
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (_) {
      // non-fatal
    }
  };

  // ------------------------------------------------------------------
  // Async meal generation: local recipes.json + TheMealDB fallback
  // ------------------------------------------------------------------
  const generateMeals = async (settings = protocolSettings) => {
    setGeneratingMeals(true);
    const timeLimit = Number(settings.time) || 45;
    const { goal, preference } = settings;

    // 1. Filter local pool first
    let pool = LOCAL_MEAL_POOL.filter(m =>
      m.preference === preference &&
      m.timeMin <= timeLimit &&
      m.goal.includes(goal)
    );

    // 2. If local pool is thin, pull from TheMealDB
    if (pool.length < 6) {
      try {
        const remote = await mealdbFetch(preference);
        const remoteNorm = remote
          .map(m => ({ ...normalizeMealdbEntry(m), preference }))
          .filter(m => m.timeMin <= timeLimit);
        // de-dup against local
        const existingNames = new Set(pool.map(m => m.name.toLowerCase()));
        const fresh = remoteNorm.filter(m => !existingNames.has(m.name.toLowerCase()));
        pool = [...pool, ...fresh];
      } catch {
        // network failure — stick with local
      }
    }

    // 3. Shuffle for variety
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    // 4. Fallback: if nothing matched at all, show all local recipes for this preference
    const final = shuffled.length > 0
      ? shuffled
      : LOCAL_MEAL_POOL.filter(m => m.preference === preference);

    setGeneratedMeals(final.length > 0 ? final : LOCAL_MEAL_POOL);
    setGeneratingMeals(false);
  };

  // Regenerate whenever protocol settings change
  useEffect(() => {
    generateMeals(protocolSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolSettings]);

  // Rotate / paginate meals based on mealSeed
  const displayedMeals = useMemo(() => {
    if (generatedMeals.length === 0) return LOCAL_MEAL_POOL.slice(0, 6);
    const pageSize = 6;
    const totalPages = Math.ceil(generatedMeals.length / pageSize);
    const page = mealSeed % totalPages;
    return generatedMeals.slice(page * pageSize, page * pageSize + pageSize);
  }, [generatedMeals, mealSeed]);

  // Featured meal of the day (stable per calendar day + seed)
  const featuredMeal = useMemo(() => {
    const pool = generatedMeals.length > 0 ? generatedMeals : LOCAL_MEAL_POOL;
    const dayIndex = new Date().getDate() % pool.length;
    return pool[(dayIndex + mealSeed) % pool.length];
  }, [generatedMeals, mealSeed]);

  // ------------------------------------------------------------------
  // Weekly averages for Overview
  // ------------------------------------------------------------------
  const weeklyAverages = useMemo(() => {
    const activeDays = weeklyData.filter(d => d.calories > 0);
    if (activeDays.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0, days: 0 };
    const sum = activeDays.reduce(
      (acc, d) => ({
        calories: acc.calories + d.calories,
        protein:  acc.protein  + d.protein,
        carbs:    acc.carbs    + d.carbs,
        fat:      acc.fat      + d.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return {
      calories: Math.round(sum.calories / activeDays.length),
      protein:  Math.round(sum.protein  / activeDays.length),
      carbs:    Math.round(sum.carbs    / activeDays.length),
      fat:      Math.round(sum.fat      / activeDays.length),
      days:     activeDays.length,
    };
  }, [weeklyData]);

  // ------------------------------------------------------------------
  // Render: Loading
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="nutrition-pinnacle">
        <div className="pinnacle-loading">
          <div className="pinnacle-spinner" />
          <p style={{ color: 'var(--pinnacle-text-secondary)', fontSize: 14 }}>
            Initializing Nutrition Hub…
          </p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render: Main
  // ------------------------------------------------------------------
  return (
    <div className="nutrition-pinnacle">

      {/* ── Header ── */}
      <div className="pinnacle-header">
        <div className="pinnacle-branding">
          <div className="pinnacle-logo">
            <span className="pinnacle-icon">🥗</span>
            <span className="pinnacle-title">Nutrition Hub</span>
          </div>
          <div className="pinnacle-subtitle">ExerVia Fuel Loop</div>
        </div>

        <div className="pinnacle-actions">
          <button className="walkthrough-btn" onClick={() => setShowWalkthrough(s => !s)}>
            Walkthrough
          </button>
          <button
            className="generate-btn"
            onClick={() => { generateMeals(protocolSettings); setMealSeed(s => s + 1); }}
            disabled={generatingMeals}
          >
            {generatingMeals ? 'Finding meals…' : '↻ Generate New Meals'}
          </button>
          <button className="custom-btn">Create Custom Recipe</button>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="pinnacle-nav">
        <div className="nav-tabs">
          {[
            { key: 'intake',   label: 'Intake View' },
            { key: 'protocol', label: 'Protocol View' },
            { key: 'overview', label: 'Overview' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`nav-tab${activeView === tab.key ? ' active' : ''}`}
              onClick={() => setActiveView(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Walkthrough Modal ── */}
      {showWalkthrough && (
        <div className="walkthrough-modal" onClick={e => { if (e.target === e.currentTarget) setShowWalkthrough(false); }}>
          <div className="walkthrough-content">
            <h3>ExerVia Fuel Loop Guide</h3>
            <ol>
              <li><strong>Pick a protocol:</strong> Select your nutrition goal in the Protocol Settings panel.</li>
              <li><strong>Pick a time window:</strong> Filter meals by how long you have to cook.</li>
              <li><strong>Pick a protein preference:</strong> Choose your preferred protein source.</li>
              <li><strong>Generate meals:</strong> Hit "Generate New Meals" to rotate fresh suggestions.</li>
              <li><strong>Log intake:</strong> Use Quick Log or the "Log Intake" button on any meal card.</li>
              <li><strong>Open recipe:</strong> Click "Recipe" on any meal card for full ingredients and steps.</li>
            </ol>
            <button onClick={() => setShowWalkthrough(false)}>Got it!</button>
          </div>
        </div>
      )}

      {/* ── Recipe Modal ── */}
      <RecipeModal
        meal={recipeModal}
        onClose={() => setRecipeModal(null)}
        onLogMeal={handleLogMeal}
      />

      {/* ── Main Content ── */}
      <div className="pinnacle-content">

        {/* ================================================================
            INTAKE VIEW
        ================================================================ */}
        {activeView === 'intake' && (
          <div className="intake-view">

            {/* Protocol Settings */}
            <div className="protocol-settings-card">
              <h3>Protocol Settings</h3>
              <div className="settings-grid">

                {/* Goal */}
                <div className="setting-group">
                  <label>Goal</label>
                  <div className="goal-options">
                    {GOALS.map(g => (
                      <button
                        key={g.key}
                        className={`goal-btn${protocolSettings.goal === g.key ? ' active' : ''}`}
                        onClick={() => setProtocolSettings(s => ({ ...s, goal: g.key }))}
                      >
                        {g.label}
                        <span className="goal-desc">{g.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time */}
                <div className="setting-group">
                  <label>Time</label>
                  <div className="time-options">
                    {TIME_WINDOWS.map(t => (
                      <button
                        key={t.key}
                        className={`time-btn${protocolSettings.time === t.key ? ' active' : ''}`}
                        onClick={() => setProtocolSettings(s => ({ ...s, time: t.key }))}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preference */}
                <div className="setting-group">
                  <label>Preference</label>
                  <div className="preference-options">
                    {PREFERENCES.map(p => (
                      <button
                        key={p.key}
                        className={`preference-btn${protocolSettings.preference === p.key ? ' active' : ''}`}
                        onClick={() => setProtocolSettings(s => ({ ...s, preference: p.key }))}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="settings-tip">
                Tip: Change settings then hit "Generate New Meals" in the header to rotate the feed.
              </div>
            </div>

            {/* Today's Intake */}
            <div className="intake-card">
              <h3>Today's Intake — {formatDateReadable()}</h3>
              <div className="intake-targets">
                {[
                  { key: 'calories', label: 'Calories', unit: 'kcal', cls: 'calories' },
                  { key: 'protein',  label: 'Protein',  unit: 'g',    cls: 'protein' },
                  { key: 'carbs',    label: 'Carbs',    unit: 'g',    cls: 'carbs' },
                  { key: 'fat',      label: 'Fat',      unit: 'g',    cls: 'fat' },
                ].map(({ key, label, unit, cls }) => (
                  <div key={key} className="target-item">
                    <div className="target-label">{label}</div>
                    <div className="target-value">
                      {intakeData[key]}{unit !== 'kcal' ? unit : ''} /{' '}
                      {targets[key]}{unit !== 'kcal' ? unit : ' kcal'}
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${cls}`}
                        style={{ width: `${getProgressPct(intakeData[key], targets[key])}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Log */}
              <div className="quick-log">
                <h4>Quick Log Meal</h4>
                <div className="log-inputs">
                  <input
                    type="number" min="0" placeholder="kcal"
                    value={quickLog.calories}
                    onChange={e => setQuickLog(s => ({ ...s, calories: e.target.value }))}
                  />
                  <input
                    type="number" min="0" placeholder="Protein g"
                    value={quickLog.protein}
                    onChange={e => setQuickLog(s => ({ ...s, protein: e.target.value }))}
                  />
                  <input
                    type="number" min="0" placeholder="Carbs g"
                    value={quickLog.carbs}
                    onChange={e => setQuickLog(s => ({ ...s, carbs: e.target.value }))}
                  />
                  <input
                    type="number" min="0" placeholder="Fat g"
                    value={quickLog.fat}
                    onChange={e => setQuickLog(s => ({ ...s, fat: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    className="add-intake-btn"
                    onClick={handleAddIntake}
                    disabled={logSaving}
                  >
                    {logSaving ? 'Saving…' : 'Add to Today'}
                  </button>
                  {logMessage && (
                    <span style={{ fontSize: 13, color: logMessage.includes('!') ? '#10b981' : '#f59e0b' }}>
                      {logMessage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 7-Day Charts */}
            <div className="charts-grid">
              {[
                { key: 'calories', label: 'Calories · 7 days', color: '#f59e0b', target: targets.calories },
                { key: 'protein',  label: 'Protein · 7 days',  color: '#10b981', target: targets.protein },
                { key: 'carbs',    label: 'Carbs · 7 days',    color: '#3b82f6', target: targets.carbs },
                { key: 'fat',      label: 'Fat · 7 days',      color: '#a855f7', target: targets.fat },
              ].map(({ key, label, color, target }) => (
                <div key={key} className="chart-card">
                  <h4>{label}</h4>
                  <div style={{ height: 124 }}>
                    <BarChart
                      data={weeklyData.map(d => d[key] || 0)}
                      color={color}
                      target={target}
                      label={label}
                    />
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ================================================================
            PROTOCOL VIEW
        ================================================================ */}
        {activeView === 'protocol' && (
          <div className="protocol-view">

            {/* Protocol Settings (mirrored here for convenience) */}
            <div className="protocol-settings-card" style={{ marginBottom: 24 }}>
              <h3>Active Protocol Filters</h3>
              <div className="settings-grid">
                <div className="setting-group">
                  <label>Goal</label>
                  <div className="goal-options">
                    {GOALS.map(g => (
                      <button
                        key={g.key}
                        className={`goal-btn${protocolSettings.goal === g.key ? ' active' : ''}`}
                        onClick={() => { setProtocolSettings(s => ({ ...s, goal: g.key })); setMealSeed(0); }}
                      >
                        {g.label}
                        <span className="goal-desc">{g.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-group">
                  <label>Time</label>
                  <div className="time-options">
                    {TIME_WINDOWS.map(t => (
                      <button
                        key={t.key}
                        className={`time-btn${protocolSettings.time === t.key ? ' active' : ''}`}
                        onClick={() => { setProtocolSettings(s => ({ ...s, time: t.key })); setMealSeed(0); }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setting-group">
                  <label>Preference</label>
                  <div className="preference-options">
                    {PREFERENCES.map(p => (
                      <button
                        key={p.key}
                        className={`preference-btn${protocolSettings.preference === p.key ? ' active' : ''}`}
                        onClick={() => { setProtocolSettings(s => ({ ...s, preference: p.key })); setMealSeed(0); }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="settings-tip">
                {generatedMeals.length} meal{generatedMeals.length !== 1 ? 's' : ''} match your filters.
                Hit "Generate New Meals" to rotate the selection.
              </div>
            </div>

            {/* Meal of the Day */}
            {featuredMeal && (
              <div className="meal-of-day-card">
                <h3>Meal of the Day</h3>
                <div className="meals-grid" style={{ padding: '20px' }}>
                  <div className="meal-card featured">
                    <div className="meal-header">
                      <span className="meal-category">{featuredMeal.category}</span>
                      <span className="meal-type">Featured</span>
                    </div>
                    <div className="meal-source">ExerVia Curated · {featuredMeal.timeMin} min · {featuredMeal.difficulty}</div>
                    <div className="meal-actions">
                      <button
                        className="favorite-btn"
                        onClick={() => handleFavoriteToggle(featuredMeal.id)}
                        title={favorites.has(featuredMeal.id) ? 'Remove from favourites' : 'Add to favourites'}
                      >
                        {favorites.has(featuredMeal.id) ? '♥' : '♡'}
                      </button>
                      <button className="open-recipe-btn" onClick={() => setRecipeModal(featuredMeal)}>
                        Recipe
                      </button>
                      <button
                        className="add-intake-btn"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleLogMeal(featuredMeal)}
                      >
                        Log Intake
                      </button>
                    </div>
                    <div className="meal-name">{featuredMeal.name}</div>
                    <div className="meal-nutrition">
                      <span className="nutrition-item">{featuredMeal.calories} kcal</span>
                      <span className="nutrition-item">P {featuredMeal.protein}g</span>
                      <span className="nutrition-item">C {featuredMeal.carbs}g</span>
                      <span className="nutrition-item">F {featuredMeal.fat}g</span>
                    </div>
                    <div className="meal-description">{featuredMeal.description}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Protocol Feed */}
            <div className="protocol-feed">
              <h3>Protocol Feed</h3>
              {displayedMeals.length === 0 ? (
                <div style={{ padding: 24, color: 'var(--pinnacle-text-muted)', fontStyle: 'italic' }}>
                  No meals match the current filters. Try a different preference or time window.
                </div>
              ) : (
                <div className="meals-grid">
                  {displayedMeals.map(meal => (
                    <div key={meal.id} className="meal-card">
                      <div className="meal-header">
                        <span className="meal-category">{meal.category}</span>
                        <span className="meal-type">Curated</span>
                      </div>
                      <div className="meal-source">ExerVia Curated · {meal.timeMin} min · {meal.difficulty}</div>
                      <div className="meal-actions">
                        <button
                          className="favorite-btn"
                          onClick={() => handleFavoriteToggle(meal.id)}
                          title={favorites.has(meal.id) ? 'Remove from favourites' : 'Add to favourites'}
                        >
                          {favorites.has(meal.id) ? '♥' : '♡'}
                        </button>
                        <button className="open-recipe-btn" onClick={() => setRecipeModal(meal)}>
                          Recipe
                        </button>
                        <button
                          className="add-intake-btn"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => handleLogMeal(meal)}
                        >
                          Log Intake
                        </button>
                      </div>
                      <div className="meal-name">{meal.name}</div>
                      <div className="meal-nutrition">
                        <span className="nutrition-item">{meal.calories} kcal</span>
                        <span className="nutrition-item">P {meal.protein}g</span>
                        <span className="nutrition-item">C {meal.carbs}g</span>
                        <span className="nutrition-item">F {meal.fat}g</span>
                      </div>
                      <div className="meal-description">{meal.description}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="feed-note">
                Showing {displayedMeals.length} of {generatedMeals.length} matching meals.
                Use "Generate New Meals" to see more.
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            OVERVIEW VIEW
        ================================================================ */}
        {activeView === 'overview' && (
          <div className="overview-view">

            {/* Today's Summary with rings */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ color: 'var(--pinnacle-text-primary)', marginBottom: 16 }}>
                Today's Summary — {formatDateReadable()}
              </h3>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <MacroRing value={intakeData.calories} target={targets.calories} color="#f59e0b" label="kcal"    size={90} />
                <MacroRing value={intakeData.protein}  target={targets.protein}  color="#10b981" label="protein" size={90} />
                <MacroRing value={intakeData.carbs}    target={targets.carbs}    color="#3b82f6" label="carbs"   size={90} />
                <MacroRing value={intakeData.fat}      target={targets.fat}      color="#a855f7" label="fat"     size={90} />
              </div>

              {/* Progress bars */}
              <div className="intake-targets" style={{ marginTop: 24 }}>
                {[
                  { key: 'calories', label: 'Calories', unit: 'kcal', cls: 'calories' },
                  { key: 'protein',  label: 'Protein',  unit: 'g',    cls: 'protein' },
                  { key: 'carbs',    label: 'Carbs',    unit: 'g',    cls: 'carbs' },
                  { key: 'fat',      label: 'Fat',      unit: 'g',    cls: 'fat' },
                ].map(({ key, label, unit, cls }) => (
                  <div key={key} className="target-item">
                    <div className="target-label">{label}</div>
                    <div className="target-value">
                      {intakeData[key]}{unit !== 'kcal' ? unit : ''} / {targets[key]}{unit !== 'kcal' ? unit : ' kcal'}
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${cls}`}
                        style={{ width: `${getProgressPct(intakeData[key], targets[key])}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7-Day Averages */}
            <div style={{
              background: 'var(--pinnacle-card)', border: '1px solid var(--pinnacle-border)',
              borderRadius: 'var(--pinnacle-radius)', padding: 20, marginBottom: 24,
            }}>
              <h3 style={{ color: 'var(--pinnacle-text-primary)', marginBottom: 16 }}>
                7-Day Averages
                {weeklyAverages.days > 0
                  ? ` (${weeklyAverages.days} day${weeklyAverages.days !== 1 ? 's' : ''} logged)`
                  : ' — No data yet'}
              </h3>

              {weeklyAverages.days === 0 ? (
                <p style={{ color: 'var(--pinnacle-text-muted)', fontStyle: 'italic' }}>
                  Log some meals to see your weekly averages here.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Avg Calories', val: `${weeklyAverages.calories} kcal`, target: targets.calories, color: '#f59e0b' },
                    { label: 'Avg Protein',  val: `${weeklyAverages.protein}g`,  target: targets.protein, color: '#10b981' },
                    { label: 'Avg Carbs',    val: `${weeklyAverages.carbs}g`,    target: targets.carbs,   color: '#3b82f6' },
                    { label: 'Avg Fat',      val: `${weeklyAverages.fat}g`,      target: targets.fat,     color: '#a855f7' },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      background: 'rgba(17,24,39,0.8)', border: '1px solid var(--pinnacle-border)',
                      borderRadius: 12, padding: 16,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--pinnacle-text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--pinnacle-text-muted)', marginTop: 2 }}>
                        Target: {stat.target}{stat.label.includes('Cal') ? ' kcal' : 'g'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Chart: Calories */}
            <div style={{
              background: 'var(--pinnacle-card)', border: '1px solid var(--pinnacle-border)',
              borderRadius: 'var(--pinnacle-radius)', padding: 20,
            }}>
              <h3 style={{ color: 'var(--pinnacle-text-primary)', marginBottom: 16 }}>
                Weekly Calorie Trend
              </h3>
              <div style={{ height: 160 }}>
                <BarChart
                  data={weeklyData.map(d => d.calories || 0)}
                  color="#f59e0b"
                  target={targets.calories}
                  label="Calories 7-day"
                />
              </div>

              {/* Day labels with per-day totals */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 8,
              }}>
                {weekDates.map((date, i) => {
                  const d = weeklyData[i];
                  const isToday = date === todayISO();
                  return (
                    <div key={date} style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 10, color: isToday ? '#10b981' : 'var(--pinnacle-text-muted)',
                        fontWeight: isToday ? 700 : 400,
                      }}>
                        {DAY_LABELS[i]}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--pinnacle-text-muted)' }}>
                        {d.calories > 0 ? `${d.calories}` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>{/* end pinnacle-content */}

      {/* ── Footer ── */}
      <div className="pinnacle-footer">
        <div className="footer-info">
          Data sources: ExerVia Curated Recipe Library · Supabase nutrition_logs
        </div>
        <div className="footer-actions">
          <button className="footer-btn" onClick={() => setActiveView('protocol')}>
            View Protocol Feed
          </button>
          <button className="footer-btn" onClick={() => setActiveView('overview')}>
            Weekly Overview
          </button>
          <button className="footer-btn primary" onClick={() => setActiveView('intake')}>
            Log Intake
          </button>
        </div>
      </div>

    </div>
  );
};

export default NutritionPinnacle;
