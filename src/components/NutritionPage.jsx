// src/components/NutritionPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { emptyDay, fetchDailyLogs, saveMealToLibrary, upsertDailyLog } from "../services/logsApi";
import { getLogsStore, getTodayLogKey, saveLogsStore } from "../services/logsStorage";
import { supabase } from "../supabaseClient";
// Component: NutritionPage - UI layout and interactions.
// This component renders the nutrition experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

/**
 * ExerVia Fuel Protocol (world-class nutrition UX)
 * Primary: TheMealDB (free)
 * Secondary: OpenFoodFacts (optional packaged lookup)
 *
 * Route: /nutrition
 */

const MEALDB = "https://www.themealdb.com/api/json/v1/1";
const DUMMY_RECIPES_SEARCH = "https://dummyjson.com/recipes/search?q=";
const OFF_SEARCH =
  "https://world.openfoodfacts.org/cgi/search.pl?json=1&page_size=8&search_terms=";
const SPOON_BASE = "https://api.spoonacular.com";
const SPOON_KEY = String(process.env.REACT_APP_SPOONACULAR_API_KEY || "").trim();

const GOALS = [
  { key: "high_protein", label: "High Protein", hint: "lean + performance" },
  { key: "balanced", label: "Balanced", hint: "steady energy" },
  { key: "cut", label: "Cut / Lean Out", hint: "high satiety" },
];

const TIME_WINDOWS = [
  { key: "15", label: "15 min" },
  { key: "30", label: "30 min" },
  { key: "45", label: "45 min" },
];

const PREFERENCES = [
  { key: "chicken", label: "Chicken" },
  { key: "beef", label: "Beef" },
  { key: "turkey", label: "Turkey" },
  { key: "seafood", label: "Seafood" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "chickpeas", label: "Chickpeas" },
  { key: "pork", label: "Pork" },
];

const MEALDB_SEARCH_TERMS = {
  chicken: ["chicken", "chicken breast", "grilled chicken"],
  beef: ["beef", "steak", "mince"],
  turkey: ["turkey", "ground turkey", "turkey breast", "roast turkey", "thanksgiving"],
  seafood: ["fish", "salmon", "tuna", "prawn"],
  vegetarian: ["vegetable", "tofu", "lentil"],
  chickpeas: ["chickpea", "chickpeas", "garbanzo", "hummus"],
  pork: ["pork", "pork chop", "pulled pork"]
};

const DUMMY_SEARCH_TERMS = {
  chicken: ["chicken"],
  beef: ["beef"],
  turkey: ["turkey", "ground turkey", "turkey breast"],
  seafood: ["fish", "salmon"],
  vegetarian: ["vegetable", "tofu"],
  chickpeas: ["chickpea", "hummus"],
  pork: ["pork"]
};

// clampList manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function clampList(arr, n) {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

// shuffle manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function shuffle(arr) {
  const a = Array.isArray(arr) ? [...arr] : [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// normalizeMealList manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function normalizeMealList(list) {
  // ensure minimal fields exist: idMeal, strMeal, strMealThumb
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m?.idMeal && m?.strMeal)
    .map((m) => ({
      idMeal: m.idMeal,
      strMeal: m.strMeal,
      strMealThumb: m.strMealThumb,
    }));
}

// buildIngredients manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function buildIngredients(meal) {
  const list = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal?.[`strIngredient${i}`];
    const meas = meal?.[`strMeasure${i}`];
    if (ing && ing.trim()) {
      list.push({ ingredient: ing.trim(), measure: (meas || "").trim() });
    }
  }
  return list;
}

/**
 * Health bias:
 * - Always block desserts + obvious junk
 * - For CUT: stricter (creamy/fried/buttery etc)
 */
// getBadWordsByGoal manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function getBadWordsByGoal(goalKey) {
  const base = [
    "cake",
    "cookie",
    "brownie",
    "dessert",
    "pudding",
    "sweet",
    "candy",
    "donut",
    "doughnut",
    "ice cream",
    "fudge",
    "chocolate bar",
    "toffee",
    "syrup",
  ];

  const generalJunk = [
    "deep fried",
    "fried",
    "battered",
    "crispy",
    "nachos",
    "pizza",
    "burger",
    "fries",
    "loaded",
    "milkshake",
  ];

  const cutExtra = [
    "creamy",
    "cream",
    "alfredo",
    "cheesy",
    "cheese",
    "butter",
    "buttery",
    "mayo",
    "mayonnaise",
    "bacon",
    "pastry",
    "pie",
    "mac and cheese",
  ];

  if (goalKey === "cut") return [...base, ...generalJunk, ...cutExtra];
  return [...base, ...generalJunk];
}

// looksHealthyEnough manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function looksHealthyEnough(name, goalKey) {
// n manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const n = (name || "").toLowerCase();
  const bad = getBadWordsByGoal(goalKey);
  return !bad.some((w) => n.includes(w));
}

async function mealdbFilterByCategory(category) {
  const res = await fetch(`${MEALDB}/filter.php?c=${encodeURIComponent(category)}`);
  const json = await res.json();
  return normalizeMealList(json?.meals || []);
}

async function mealdbSearchByName(term) {
  const res = await fetch(`${MEALDB}/search.php?s=${encodeURIComponent(term)}`);
  const json = await res.json();
  return normalizeMealList(json?.meals || []);
}

async function dummySearchByName(term) {
  const t = String(term || "").trim();
  if (!t) return [];
  const res = await fetch(`${DUMMY_RECIPES_SEARCH}${encodeURIComponent(t)}`);
  const json = await res.json();
  const recipes = Array.isArray(json?.recipes) ? json.recipes : [];
  return recipes
    .filter((r) => r?.id && r?.name)
    .map((r) => ({
      idMeal: `dummy-${r.id}`,
      strMeal: String(r.name || ""),
      strMealThumb: String(r.image || ""),
      source: "dummy",
      dummyRecipe: r
    }));
}

const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function spoonSearchByName(term, limit = 8) {
  if (!SPOON_KEY) return [];
  const query = String(term || "").trim();
  if (!query) return [];
  const url = `${SPOON_BASE}/recipes/complexSearch?query=${encodeURIComponent(
    query
  )}&number=${Math.max(1, Math.min(12, Number(limit) || 8))}&addRecipeInformation=true&fillIngredients=true&apiKey=${encodeURIComponent(
    SPOON_KEY
  )}`;
  const res = await fetch(url);
  const json = await res.json();
  const rows = Array.isArray(json?.results) ? json.results : [];
  return rows
    .filter((row) => row?.id && row?.title)
    .map((row) => ({
      idMeal: `spoon-${row.id}`,
      strMeal: String(row.title || ""),
      strMealThumb: String(row.image || ""),
      source: "spoon",
      spoonRecipe: row
    }));
}

function normalizeTextId(value) {
  return String(value || "").trim().toLowerCase();
}

function recipeIdentityKey(meal) {
  return (
    normalizeTextId(meal?.idMeal) ||
    normalizeTextId(meal?.strMeal) ||
    `${normalizeTextId(meal?.source)}:${normalizeTextId(meal?.strMeal)}`
  );
}

function convertDummyToMealShape(recipe) {
  const base = {
    idMeal: `dummy-${recipe?.id || Date.now()}`,
    strMeal: String(recipe?.name || "Recipe"),
    strMealThumb: String(recipe?.image || ""),
    strCategory: Array.isArray(recipe?.mealType) ? recipe.mealType[0] || "Recipe" : "Recipe",
    strArea: String(recipe?.cuisine || ""),
    strInstructions: Array.isArray(recipe?.instructions)
      ? recipe.instructions.join("\n")
      : String(recipe?.instructions || ""),
  };
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  for (let i = 0; i < 20; i += 1) {
    const value = ingredients[i] ? String(ingredients[i]) : "";
    base[`strIngredient${i + 1}`] = value;
    base[`strMeasure${i + 1}`] = "";
  }
  base.__nutrition = {
    calories: Number(recipe?.calories) || 0,
    protein: Number(recipe?.protein) || 0,
    carbs: Number(recipe?.carbs) || 0,
    fat: Number(recipe?.fat) || 0,
  };
  return base;
}

function convertSpoonToMealShape(recipe) {
  const base = {
    idMeal: `spoon-${recipe?.id || Date.now()}`,
    strMeal: String(recipe?.title || "Recipe"),
    strMealThumb: String(recipe?.image || ""),
    strCategory: "Recipe",
    strArea: "",
    strInstructions: "",
  };
  const ingredients = Array.isArray(recipe?.extendedIngredients) ? recipe.extendedIngredients : [];
  for (let i = 0; i < 20; i += 1) {
    const row = ingredients[i];
    base[`strIngredient${i + 1}`] = String(row?.name || "");
    base[`strMeasure${i + 1}`] = String(
      row?.amount && row?.unit ? `${row.amount} ${row.unit}` : row?.original || ""
    );
  }
  const analyzedSteps = Array.isArray(recipe?.analyzedInstructions)
    ? recipe.analyzedInstructions.flatMap((block) => block?.steps || [])
    : [];
  const instructionText = analyzedSteps.length
    ? analyzedSteps.map((step) => step?.step).filter(Boolean).join("\n")
    : stripHtml(recipe?.instructions || recipe?.summary || "");
  base.strInstructions = instructionText;

  const nutrients = Array.isArray(recipe?.nutrition?.nutrients) ? recipe.nutrition.nutrients : [];
  const findNutrient = (name) =>
    Number(
      nutrients.find((row) => String(row?.name || "").toLowerCase() === name)?.amount || 0
    );
  base.__nutrition = {
    calories: findNutrient("calories"),
    protein: findNutrient("protein"),
    carbs: findNutrient("carbohydrates"),
    fat: findNutrient("fat"),
  };
  return base;
}

const toMacroNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const emptyMacros = () => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

const getEntryMacros = (entry) => {
  const base = entry?.nutrition || {};
  const servings = Math.max(1, Number(entry?.servings || 1));
  return {
    calories: toMacroNumber(base.calories) * servings,
    protein: toMacroNumber(base.protein) * servings,
    carbs: toMacroNumber(base.carbs) * servings,
    fat: toMacroNumber(base.fat) * servings,
  };
};

const sumMacros = (entries) =>
  (Array.isArray(entries) ? entries : []).reduce(
    (acc, item) => {
      const m = getEntryMacros(item);
      acc.calories += m.calories;
      acc.protein += m.protein;
      acc.carbs += m.carbs;
      acc.fat += m.fat;
      return acc;
    },
    emptyMacros()
  );

export default function NutritionPage() {
  const navigate = useNavigate();
  const storedId = localStorage.getItem("exervia_user_id");
  const storedMode = localStorage.getItem("exervia_active_mode") || "athlete";
  const pageMode = storedMode === "gym" ? "gym" : "athlete";

  const [goal, setGoal] = useState("high_protein");
  const [timeWindow, setTimeWindow] = useState("30");
  const [preference, setPreference] = useState("chicken");

  const [mealOfDay, setMealOfDay] = useState(null);
  const [protocolMeals, setProtocolMeals] = useState([]);
  const [activeMeal, setActiveMeal] = useState(null);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");

  const [offQuery, setOffQuery] = useState("");
  const [offResults, setOffResults] = useState([]);
  const [offLoading, setOffLoading] = useState(false);
  const [saveBanner, setSaveBanner] = useState("");
  const [todayMeals, setTodayMeals] = useState([]);
  const [logMealsByDate, setLogMealsByDate] = useState({});
  const [selectedMacroDay, setSelectedMacroDay] = useState(getTodayLogKey());
  const [quickMacro, setQuickMacro] = useState({
    title: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [customRecipeOpen, setCustomRecipeOpen] = useState(false);
  const [customRecipeDraft, setCustomRecipeDraft] = useState({
    title: "",
    mealType: "Dinner",
    prepMinutes: "",
    cookMinutes: "",
    servings: "",
    ingredients: "",
    steps: "",
    tags: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [userNutritionContext, setUserNutritionContext] = useState({
    fitnessLevel: "",
    primaryGoal: "",
    level: 1
  });

  useEffect(() => {
    if (!saveBanner) return;
    const timeout = setTimeout(() => setSaveBanner(""), 2800);
    return () => clearTimeout(timeout);
  }, [saveBanner]);

  useEffect(() => {
    let cancelled = false;
    const loadUserContext = async () => {
      if (!storedId) return;
      const [{ data: profileRow }, { data: stateRow }] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("fitness_level,primary_goal")
          .eq("id", Number(storedId))
          .maybeSingle(),
        supabase
          .from("user_state")
          .select("level")
          .eq("user_id", Number(storedId))
          .maybeSingle()
      ]);
      if (cancelled) return;
      setUserNutritionContext({
        fitnessLevel: String(profileRow?.fitness_level || ""),
        primaryGoal: String(profileRow?.primary_goal || ""),
        level: Number(stateRow?.level || 1)
      });
    };
    loadUserContext();
    return () => {
      cancelled = true;
    };
  }, [storedId]);

  // Persist protocol choices
  useEffect(() => {
    const saved = localStorage.getItem("exervia_fuel_protocol");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.goal) setGoal(parsed.goal);
        if (parsed?.timeWindow) setTimeWindow(parsed.timeWindow);
        if (parsed?.preference) setPreference(parsed.preference);
      } catch {
        // ignore
      }
    }
  }, []);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    localStorage.setItem(
      "exervia_fuel_protocol",
      JSON.stringify({ goal, timeWindow, preference })
    );
  }, [goal, timeWindow, preference]);

  const protocolLabel = useMemo(() => {
    const g = GOALS.find((x) => x.key === goal)?.label || "Protocol";
    const p = PREFERENCES.find((x) => x.key === preference)?.label || "Fuel";
    return `${g} • ${p} • ${timeWindow}m`;
  }, [goal, preference, timeWindow]);

  const cap = useMemo(() => {
    if (timeWindow === "15") return 6;
    if (timeWindow === "30") return 6;
    return 6;
  }, [timeWindow]);

  const macroTargets = useMemo(() => {
    const fit = String(userNutritionContext.fitnessLevel || "").toLowerCase();
    const profileGoal = String(userNutritionContext.primaryGoal || "").toLowerCase();
    const userLevel = Math.max(1, Number(userNutritionContext.level || 1));

    let baseCalories = 2400;
    if (fit.includes("beginner")) baseCalories = 2200;
    if (fit.includes("intermediate")) baseCalories = 2500;
    if (fit.includes("advanced")) baseCalories = 2800;

    if (profileGoal.includes("lose weight")) baseCalories -= 250;
    if (profileGoal.includes("build muscle")) baseCalories += 200;
    if (profileGoal.includes("endurance")) baseCalories += 120;

    baseCalories += Math.min(300, Math.max(0, (userLevel - 1) * 18));

    if (goal === "cut") baseCalories -= 220;
    if (goal === "high_protein") baseCalories += 120;

    const totalCalories = Math.max(1600, Math.round(baseCalories / 25) * 25);
    const ratios =
      goal === "cut"
        ? { protein: 0.36, carbs: 0.29, fat: 0.35 }
        : goal === "balanced"
          ? { protein: 0.30, carbs: 0.42, fat: 0.28 }
          : { protein: 0.35, carbs: 0.37, fat: 0.28 };
    const protein = Math.max(120, Math.round((totalCalories * ratios.protein) / 4));
    const carbs = Math.max(120, Math.round((totalCalories * ratios.carbs) / 4));
    const fat = Math.max(40, Math.round((totalCalories * ratios.fat) / 9));
    return { calories: totalCalories, protein, carbs, fat };
  }, [goal, userNutritionContext]);
  const todayMacroTotals = useMemo(() => sumMacros(todayMeals), [todayMeals]);
  const selectedDayMeals = useMemo(() => logMealsByDate[selectedMacroDay] || [], [logMealsByDate, selectedMacroDay]);
  const weeklyMacroTrend = useMemo(() => {
    const rows = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${day}`;
      const meals = logMealsByDate[key] || [];
      rows.push({
        key,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        totals: sumMacros(meals),
      });
    }
    return rows;
  }, [logMealsByDate]);
  const weeklyMax = useMemo(
    () => ({
      calories: Math.max(1, ...weeklyMacroTrend.map((row) => row.totals.calories || 0)),
      protein: Math.max(1, ...weeklyMacroTrend.map((row) => row.totals.protein || 0)),
      carbs: Math.max(1, ...weeklyMacroTrend.map((row) => row.totals.carbs || 0)),
      fat: Math.max(1, ...weeklyMacroTrend.map((row) => row.totals.fat || 0)),
    }),
    [weeklyMacroTrend]
  );

  const loadTodayMeals = async () => {
    if (!storedId) return;
    const dayKey = getTodayLogKey();
    const local = getLogsStore(storedId);
    const cloudMap = await fetchDailyLogs(storedId);
    const mergedByDate = { ...(cloudMap || {}) };
    Object.entries(local.byDate || {}).forEach(([key, day]) => {
      const cloudMeals = mergedByDate[key]?.meals || [];
      const localMeals = day?.meals || [];
      const merged = [...cloudMeals];
      localMeals.forEach((meal) => {
        const mealKey = String(meal?.text || "").trim().toLowerCase();
        if (!mealKey) return;
        if (!merged.some((row) => String(row?.text || "").trim().toLowerCase() === mealKey)) {
          merged.push(meal);
        }
      });
      mergedByDate[key] = {
        ...(mergedByDate[key] || {}),
        meals: merged,
      };
    });
    const mealsByDate = {};
    Object.entries(mergedByDate).forEach(([key, day]) => {
      mealsByDate[key] = Array.isArray(day?.meals) ? day.meals : [];
    });
    setLogMealsByDate(mealsByDate);
    setTodayMeals(mealsByDate[dayKey] || []);
    if (!selectedMacroDay || !mealsByDate[selectedMacroDay]) {
      setSelectedMacroDay(dayKey);
    }
  };

  // --- MealDB fetchers ---
  const fetchMealOfDay = async () => {
    // try a few times to avoid a random dessert/junk pick
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const res = await fetch(`${MEALDB}/random.php`);
        const json = await res.json();
        const meal = json?.meals?.[0] || null;
        if (meal && looksHealthyEnough(meal.strMeal, goal)) {
          setMealOfDay(meal);
          return;
        }
      } catch {
        // ignore
      }
    }
    // fallback (still show something)
    try {
      const res = await fetch(`${MEALDB}/random.php`);
      const json = await res.json();
      setMealOfDay(json?.meals?.[0] || null);
    } catch {
      setMealOfDay(null);
    }
  };

// fetchProtocolMeals manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchProtocolMeals = async () => {
    setError("");
    setAvailabilityNote("");
    setLoading(true);
    setActiveMeal(null);

    try {
      /**
       * preference → sources (category if possible; fallback to name search)
       * Then: goal health-filter + shuffle + pick cap
       */
      let list = [];
      const mealdbTerms = MEALDB_SEARCH_TERMS[preference] || [preference];

      if (preference === "seafood") {
        list = await mealdbFilterByCategory("Seafood");
      } else if (preference === "vegetarian") {
        list = await mealdbFilterByCategory("Vegetarian");
      } else if (preference === "beef") {
        list = await mealdbFilterByCategory("Beef");
      } else if (preference === "pork") {
        list = await mealdbFilterByCategory("Pork");
      } else if (preference === "chicken") {
        // MealDB has a Chicken category (better than searching chicken every time)
        list = await mealdbFilterByCategory("Chicken");
        const extraLists = await Promise.all(mealdbTerms.map((term) => mealdbSearchByName(term)));
        list = [...list, ...extraLists.flat()];
      } else {
        const extraLists = await Promise.all(mealdbTerms.map((term) => mealdbSearchByName(term)));
        list = extraLists.flat();
      }

      // pull a second pool from DummyJSON to avoid thin result sets
      const terms = DUMMY_SEARCH_TERMS[preference] || [preference];
      const dummyLists = await Promise.all(terms.map((term) => dummySearchByName(term)));
      const dummyMeals = dummyLists.flat();
      list = [...list, ...dummyMeals];

      // third pool from Spoonacular (optional API key)
      // used when categories are thin (especially turkey) or result set is still small
      if (SPOON_KEY && (preference === "turkey" || list.length < cap + 2)) {
        const spoonTerms = (MEALDB_SEARCH_TERMS[preference] || [preference]).slice(
          0,
          preference === "turkey" ? 3 : 1
        );
        const spoonLists = await Promise.all(spoonTerms.map((term) => spoonSearchByName(term, 8)));
        list = [...list, ...spoonLists.flat()];
      }

      // de-dup by normalized meal name + id fallback
      const seen = new Set();
      list = list.filter((m) => {
        const key = normalizeTextId(m?.strMeal) || normalizeTextId(m?.idMeal);
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Goal-based health strictness
      list = list.filter((m) => looksHealthyEnough(m?.strMeal, goal));

      // If the filter is too strict (common for turkey/chickpeas), loosen slightly
      if (list.length < 6) {
        // remove only dessert words, keep general junk words
        const dessertOnly = [
          "cake",
          "cookie",
          "brownie",
          "dessert",
          "pudding",
          "sweet",
          "candy",
          "donut",
          "doughnut",
          "ice cream",
          "fudge",
          "toffee",
          "syrup",
        ];
        list = (await (async () => {
          // rebuild from original preference sources quickly again
          let raw = [];
          if (preference === "seafood") raw = await mealdbFilterByCategory("Seafood");
          else if (preference === "vegetarian") raw = await mealdbFilterByCategory("Vegetarian");
          else if (preference === "beef") raw = await mealdbFilterByCategory("Beef");
          else if (preference === "pork") raw = await mealdbFilterByCategory("Pork");
          else if (preference === "chicken") raw = await mealdbFilterByCategory("Chicken");
          const fallbackTerms = MEALDB_SEARCH_TERMS[preference] || [preference];
          const fallbackLists = await Promise.all(
            fallbackTerms.map((term) => mealdbSearchByName(term))
          );
          raw = [...normalizeMealList(raw), ...fallbackLists.flat()];
          const s2 = new Set();
          raw = raw.filter((m) => {
            const key = normalizeTextId(m?.strMeal) || normalizeTextId(m?.idMeal);
            if (!key) return false;
            if (s2.has(key)) return false;
            s2.add(key);
            return true;
          });
          return raw.filter((m) => {
// n manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
            const n = (m?.strMeal || "").toLowerCase();
            return !dessertOnly.some((w) => n.includes(w));
          });
        })());
      }

      // Avoid repeating the same list over and over:
      // keep a short rolling history per preference and prioritize unseen picks.
      const seenKey = `exervia_fuel_seen_${preference}`;
      const seenRaw = localStorage.getItem(seenKey);
      const seenList = (() => {
        try {
          const parsed = JSON.parse(seenRaw || "[]");
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();
      const seenSet = new Set(seenList.map((row) => String(row)));
      const unseenPool = list.filter((meal) => !seenSet.has(recipeIdentityKey(meal)));
      const fallbackPool = list.filter((meal) => seenSet.has(recipeIdentityKey(meal)));
      const orderedPool = [...shuffle(unseenPool), ...shuffle(fallbackPool)];
      const picked = clampList(orderedPool, cap);
      const nextSeen = [
        ...seenList,
        ...picked.map((meal) => recipeIdentityKey(meal)).filter(Boolean)
      ];
      localStorage.setItem(seenKey, JSON.stringify(nextSeen.slice(-180)));
      if (preference === "turkey" && picked.length <= 3) {
        if (SPOON_KEY) {
          setAvailabilityNote("Turkey recipes are limited today. Showing the best available matches.");
        } else {
          setAvailabilityNote(
            "Turkey recipes are limited on free sources. Add REACT_APP_SPOONACULAR_API_KEY to expand results."
          );
        }
      }
      setProtocolMeals(picked);
    } catch {
      setError("Fuel feed failed. Try again.");
      setProtocolMeals([]);
    } finally {
      setLoading(false);
    }
  };

// fetchMealDetail manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchMealDetail = async (idMeal) => {
    setDetailLoading(true);
    try {
      if (String(idMeal || "").startsWith("dummy-")) {
        const sourceMeal = protocolMeals.find((meal) => String(meal.idMeal) === String(idMeal));
        if (sourceMeal?.dummyRecipe) {
          setActiveMeal(convertDummyToMealShape(sourceMeal.dummyRecipe));
          return;
        }
      }
      if (String(idMeal || "").startsWith("spoon-")) {
        const sourceMeal = protocolMeals.find((meal) => String(meal.idMeal) === String(idMeal));
        if (sourceMeal?.spoonRecipe) {
          setActiveMeal(convertSpoonToMealShape(sourceMeal.spoonRecipe));
          return;
        }
        if (SPOON_KEY) {
          const spoonId = String(idMeal).replace("spoon-", "");
          const res = await fetch(
            `${SPOON_BASE}/recipes/${encodeURIComponent(
              spoonId
            )}/information?includeNutrition=true&apiKey=${encodeURIComponent(SPOON_KEY)}`
          );
          const json = await res.json();
          if (json?.id) {
            setActiveMeal(convertSpoonToMealShape(json));
            return;
          }
        }
      }
      const res = await fetch(`${MEALDB}/lookup.php?i=${encodeURIComponent(idMeal)}`);
      const json = await res.json();
      const meal = json?.meals?.[0] || null;
      setActiveMeal(meal);
    } catch {
      setActiveMeal(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleMoreLikeThis = async () => {
    if (!activeMeal) return;
    const rawName = String(activeMeal.strMeal || "").trim();
    const keyword = rawName.split(" ").find((part) => part.length > 3) || rawName;
    if (!keyword) return;
    setLoading(true);
    setError("");
    try {
      const [mealdbHits, dummyHits, spoonHits] = await Promise.all([
        mealdbSearchByName(keyword),
        dummySearchByName(keyword),
        SPOON_KEY ? spoonSearchByName(keyword, 8) : Promise.resolve([])
      ]);
      const merged = [...mealdbHits, ...dummyHits, ...spoonHits]
        .filter((meal) => looksHealthyEnough(meal?.strMeal, goal))
        .filter((meal) => normalizeTextId(meal?.strMeal) !== normalizeTextId(activeMeal.strMeal));
      const seen = new Set();
      const deduped = merged.filter((meal) => {
        const key = normalizeTextId(meal?.strMeal) || normalizeTextId(meal?.idMeal);
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setProtocolMeals(clampList(shuffle(deduped), cap));
      setSaveBanner(`Loaded more options like ${activeMeal.strMeal}.`);
    } catch {
      setError("Could not load similar meals right now.");
    } finally {
      setLoading(false);
    }
  };

  // --- OpenFoodFacts ---
  const searchOpenFoodFacts = async (q) => {
// query manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const query = (q || offQuery).trim();
    if (!query) return;
    setOffLoading(true);
    try {
      const res = await fetch(`${OFF_SEARCH}${encodeURIComponent(query)}`);
      const json = await res.json();
      setOffResults(json?.products || []);
    } catch {
      setOffResults([]);
    } finally {
      setOffLoading(false);
    }
  };

  const saveMealEntryToToday = async (entry, source = "recipe") => {
    if (!storedId || !entry?.text) return { savedLibrary: false, savedCloud: false, mealName: "" };
    const mealName = String(entry.text || "").trim();
    const dayKey = getTodayLogKey();
    const local = getLogsStore(storedId);
    const currentDay = local.byDate?.[dayKey] || emptyDay();
    const alreadyLogged = (currentDay.meals || []).some(
      (item) => String(item?.text || "").trim().toLowerCase() === mealName.toLowerCase()
    );

    const nextDay = alreadyLogged
      ? currentDay
      : {
          ...currentDay,
          meals: [...(currentDay.meals || []), { id: `meal-${Date.now()}`, ...entry }],
        };

    saveLogsStore(storedId, {
      ...local,
      byDate: {
        ...(local.byDate || {}),
        [dayKey]: nextDay,
      },
    });

    setTodayMeals(nextDay.meals || []);
    setLogMealsByDate((prev) => ({ ...prev, [dayKey]: nextDay.meals || [] }));
    const [savedLibrary, savedCloud] = await Promise.all([
      saveMealToLibrary(storedId, mealName, source),
      upsertDailyLog(storedId, dayKey, nextDay),
    ]);
    return { savedLibrary, savedCloud, mealName };
  };

  const handleAddOffProductToToday = async (product) => {
    const title = String(product?.product_name || "").trim();
    if (!title) return;
    const nutrition = {
      calories: toMacroNumber(product?.nutriments?.["energy-kcal"]),
      protein: toMacroNumber(product?.nutriments?.proteins),
      carbs: toMacroNumber(product?.nutriments?.carbohydrates),
      fat: toMacroNumber(product?.nutriments?.fat),
    };
    const { savedCloud } = await saveMealEntryToToday({ text: title, nutrition }, "off_verify");
    setSaveBanner(
      savedCloud
        ? `${title} added to today's intake.`
        : `${title} added locally. Cloud sync pending.`
    );
  };

  const handleQuickMacroAdd = async () => {
    const title = String(quickMacro.title || "").trim();
    if (!title) {
      setSaveBanner("Add a meal name for quick log.");
      return;
    }
    const nutrition = {
      calories: toMacroNumber(quickMacro.calories),
      protein: toMacroNumber(quickMacro.protein),
      carbs: toMacroNumber(quickMacro.carbs),
      fat: toMacroNumber(quickMacro.fat),
    };
    const { savedCloud } = await saveMealEntryToToday({ text: title, nutrition }, "quick_macro");
    setQuickMacro({ title: "", calories: "", protein: "", carbs: "", fat: "" });
    setSaveBanner(
      savedCloud
        ? `${title} logged to today's intake.`
        : `${title} saved locally. Cloud sync pending.`
    );
  };

  const handleSaveMealToLogs = async () => {
    if (!activeMeal?.strMeal || !storedId) return;

    const mealName = String(activeMeal.strMeal).trim();
    const nutrition = {
      calories: toMacroNumber(activeMeal?.__nutrition?.calories),
      protein: toMacroNumber(activeMeal?.__nutrition?.protein),
      carbs: toMacroNumber(activeMeal?.__nutrition?.carbs),
      fat: toMacroNumber(activeMeal?.__nutrition?.fat),
    };
    const { savedLibrary, savedCloud } = await saveMealEntryToToday(
      {
        text: mealName,
        nutrition,
      },
      "recipe"
    );

    if (!savedLibrary || !savedCloud) {
      setSaveBanner(`${mealName} saved locally. Cloud sync pending.`);
    } else {
      setSaveBanner(`${mealName} saved to Logs.`);
    }
    navigate(pageMode === "athlete" ? `/athlete/${storedId}/logs` : `/gym/${storedId}/logs`);
  };

  const handleShareRecipeTemplate = async () => {
    if (!activeMeal?.strMeal || !storedId) return;
    const ingredients = buildIngredients(activeMeal).map((item) => ({
      ingredient: item.ingredient,
      measure: item.measure || ""
    }));
    const payload = {
      name: activeMeal.strMeal,
      mealType: String(activeMeal.strCategory || "meal"),
      servings: "",
      prepMinutes: "",
      cookMinutes: "",
      ingredients,
      steps: String(activeMeal.strInstructions || "")
        .split(/\r?\n/)
        .map((step) => step.trim())
        .filter(Boolean),
      tags: [activeMeal.strCategory, activeMeal.strArea]
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
    };
    const { data: existing } = await supabase
      .from("shared_templates")
      .select("id")
      .eq("template_type", "recipe")
      .eq("created_by", Number(storedId))
      .ilike("title", String(activeMeal.strMeal || "").trim())
      .limit(1);

    if (!existing?.length) {
      const { error } = await supabase.from("shared_templates").insert([{
        template_type: "recipe",
        title: activeMeal.strMeal,
        subtitle: activeMeal.strCategory || "Recipe",
        goal: activeMeal.strCategory || "",
        summary: "Community-shared recipe template",
        tags: payload.tags,
        payload,
        created_by: Number(storedId)
      }]);
      if (error) {
        setSaveBanner("Could not share recipe template.");
        return;
      }
    } else {
      setSaveBanner("Recipe already shared. Keeping your existing template.");
      return;
    }
    setSaveBanner(`${activeMeal.strMeal} shared to Community Templates.`);
  };

  const handleCreateCustomRecipe = async () => {
    if (!storedId) return;
    const title = String(customRecipeDraft.title || "").trim();
    if (!title) {
      setSaveBanner("Add a recipe title first.");
      return;
    }

    const ingredients = String(customRecipeDraft.ingredients || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [ingredient, ...rest] = line.split(" - ");
        return {
          ingredient: String(ingredient || "").trim(),
          measure: String(rest.join(" - ") || "").trim(),
        };
      })
      .filter((item) => item.ingredient);

    const steps = String(customRecipeDraft.steps || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const tags = String(customRecipeDraft.tags || "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12);

    const payload = {
      name: title,
      mealType: customRecipeDraft.mealType || "Dinner",
      prepMinutes: customRecipeDraft.prepMinutes ? Number(customRecipeDraft.prepMinutes) : null,
      cookMinutes: customRecipeDraft.cookMinutes ? Number(customRecipeDraft.cookMinutes) : null,
      servings: customRecipeDraft.servings ? Number(customRecipeDraft.servings) : null,
      nutrition: {
        calories: toMacroNumber(customRecipeDraft.calories),
        protein: toMacroNumber(customRecipeDraft.protein),
        carbs: toMacroNumber(customRecipeDraft.carbs),
        fat: toMacroNumber(customRecipeDraft.fat),
      },
      ingredients,
      steps,
      tags,
    };

    const { data: existingTemplate } = await supabase
      .from("shared_templates")
      .select("id")
      .eq("template_type", "recipe")
      .eq("created_by", Number(storedId))
      .ilike("title", title)
      .limit(1);

    let sharedOk = true;
    if (!existingTemplate?.length) {
      const { error: shareError } = await supabase.from("shared_templates").insert([
        {
          template_type: "recipe",
          title,
          subtitle: `${payload.mealType} recipe`,
          goal: payload.mealType,
          summary: steps[0] || "Community recipe",
          tags,
          payload,
          created_by: Number(storedId),
        },
      ]);
      if (shareError) {
        sharedOk = false;
      }
    }

    const { savedLibrary, savedCloud } = await saveMealEntryToToday(
      {
        text: title,
        nutrition: payload.nutrition,
        servings: payload.servings || 1,
      },
      "custom_recipe"
    );

    setCustomRecipeDraft({
      title: "",
      mealType: "Dinner",
      prepMinutes: "",
      cookMinutes: "",
      servings: "",
      ingredients: "",
      steps: "",
      tags: "",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    });
    setCustomRecipeOpen(false);
    if (!sharedOk) {
      setSaveBanner("Could not share recipe template.");
    } else if (!savedLibrary || !savedCloud) {
      setSaveBanner(`${title} shared. Logs saved locally; cloud sync pending.`);
    } else {
      setSaveBanner(`${title} shared and added to today's Logs.`);
    }
    navigate(pageMode === "athlete" ? `/athlete/${storedId}/logs` : `/gym/${storedId}/logs`);
  };

  // initial load
  useEffect(() => {
    fetchMealOfDay();
    fetchProtocolMeals();
    loadTodayMeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user changes protocol settings, we *don’t* auto-refetch (keeps UX controlled),
  // but we do update Meal of Day to match goal strictness.
  useEffect(() => {
    fetchMealOfDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);


  // Render
  // The return statement below manages the UI layout and interactions,
  // it uses the state and handlers defined above to create a responsive nutrition experience,
  // the structure is designed for readability and maintainability,
  return (
    <div className={`hud-bg mode-${pageMode}`}>
      <Navbar modeLabel="NUTRITION" mode={pageMode} userId={storedId} />

      <div className="page-shell">
        <div className="page-header">
          <div>
            <button
              className="studio-back"
              onClick={() => navigate(pageMode === "athlete" ? `/athlete/${storedId}` : `/gym/${storedId}`)}
              type="button"
            >
              {'<- Back'}
            </button>
            <h2 className="page-title">{protocolLabel}</h2>
            <p className="page-subtitle">
              Pick a protocol → Pick a time → Pick a preference → Get meals
            </p>
          </div>

          <div className="fuel-header-actions">
            <button
              className="studio-back fuel-compact-btn fuel-generate-btn"
              onClick={fetchProtocolMeals}
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate New Meals"}
            </button>
            <button
              className="studio-back fuel-compact-btn"
              type="button"
              onClick={() => setCustomRecipeOpen(true)}
            >
              Create Custom Recipe
            </button>
          </div>
        </div>

        <div className="grid-2">
          {/* LEFT: Protocol controls + meal of day */}
          <div className="hud-card">
            <div className="hud-card-title">PROTOCOL SETTINGS</div>

            <div className="fuel-row">
              <div className="fuel-label">Goal</div>
              <div className="fuel-seg">
                {GOALS.map((g) => (
                  <button
                    key={g.key}
                    className={`fuel-chip ${goal === g.key ? "fuel-chip-active" : ""}`}
                    onClick={() => setGoal(g.key)}
                  >
                    <div className="fuel-chip-top">{g.label}</div>
                    <div className="fuel-chip-sub">{g.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="fuel-row">
              <div className="fuel-label">Time</div>
              <div className="fuel-seg">
                {TIME_WINDOWS.map((t) => (
                  <button
                    key={t.key}
                    className={`fuel-chip small ${timeWindow === t.key ? "fuel-chip-active" : ""}`}
                    onClick={() => setTimeWindow(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fuel-row">
              <div className="fuel-label">Preference</div>
              <div className="fuel-seg fuel-seg-wrap">
                {PREFERENCES.map((p) => (
                  <button
                    key={p.key}
                    className={`fuel-chip small ${preference === p.key ? "fuel-chip-active" : ""}`}
                    onClick={() => setPreference(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="hud-dim" style={{ marginTop: 10 }}>
                Tip: Change settings → hit <b>Generate New Meals</b>.
              </div>
            </div>

            <div className="hud-divider" />

            <div className="hud-card-title">TODAY'S INTAKE</div>
            <div className="hud-dim" style={{ marginBottom: 10 }}>
              Targets are personalized from your profile, current level, and selected protocol.
            </div>
            <div className="fuel-macro-grid">
              <div className="fuel-macro-card">
                <div className="fuel-macro-label">Calories</div>
                <div className="fuel-macro-value">
                  {Math.round(todayMacroTotals.calories)}
                  <span> / {macroTargets.calories}</span>
                </div>
                <div className="fuel-macro-bar">
                  <div
                    className="fuel-macro-fill"
                    style={{ width: `${Math.min(100, (todayMacroTotals.calories / Math.max(1, macroTargets.calories)) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="fuel-macro-card">
                <div className="fuel-macro-label">Protein</div>
                <div className="fuel-macro-value">
                  {Math.round(todayMacroTotals.protein)}g
                  <span> / {macroTargets.protein}g</span>
                </div>
                <div className="fuel-macro-bar">
                  <div
                    className="fuel-macro-fill protein"
                    style={{ width: `${Math.min(100, (todayMacroTotals.protein / Math.max(1, macroTargets.protein)) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="fuel-macro-card">
                <div className="fuel-macro-label">Carbs</div>
                <div className="fuel-macro-value">
                  {Math.round(todayMacroTotals.carbs)}g
                  <span> / {macroTargets.carbs}g</span>
                </div>
                <div className="fuel-macro-bar">
                  <div
                    className="fuel-macro-fill carbs"
                    style={{ width: `${Math.min(100, (todayMacroTotals.carbs / Math.max(1, macroTargets.carbs)) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="fuel-macro-card">
                <div className="fuel-macro-label">Fat</div>
                <div className="fuel-macro-value">
                  {Math.round(todayMacroTotals.fat)}g
                  <span> / {macroTargets.fat}g</span>
                </div>
                <div className="fuel-macro-bar">
                  <div
                    className="fuel-macro-fill fat"
                    style={{ width: `${Math.min(100, (todayMacroTotals.fat / Math.max(1, macroTargets.fat)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="fuel-quick-row">
              <input
                className="studio-form-input"
                placeholder="Quick log meal"
                value={quickMacro.title}
                onChange={(event) => setQuickMacro((prev) => ({ ...prev, title: event.target.value }))}
              />
              <input
                className="studio-form-input"
                placeholder="kcal"
                value={quickMacro.calories}
                onChange={(event) => setQuickMacro((prev) => ({ ...prev, calories: event.target.value }))}
              />
              <input
                className="studio-form-input"
                placeholder="P"
                value={quickMacro.protein}
                onChange={(event) => setQuickMacro((prev) => ({ ...prev, protein: event.target.value }))}
              />
              <input
                className="studio-form-input"
                placeholder="C"
                value={quickMacro.carbs}
                onChange={(event) => setQuickMacro((prev) => ({ ...prev, carbs: event.target.value }))}
              />
              <input
                className="studio-form-input"
                placeholder="F"
                value={quickMacro.fat}
                onChange={(event) => setQuickMacro((prev) => ({ ...prev, fat: event.target.value }))}
              />
              <button className="studio-back fuel-compact-btn" type="button" onClick={handleQuickMacroAdd}>
                Add intake
              </button>
            </div>
            <div className="fuel-weekly-grid">
              <div className="fuel-weekly-card">
                <div className="fuel-macro-label">Calories · 7 days</div>
                <div className="fuel-weekly-bars">
                  {weeklyMacroTrend.map((row) => (
                    <button
                      type="button"
                      className={`fuel-weekly-col fuel-weekly-col-btn${selectedMacroDay === row.key ? " active" : ""}`}
                      key={`wk-cal-${row.key}`}
                      onClick={() => setSelectedMacroDay(row.key)}
                    >
                      <div className="fuel-weekly-track">
                        <div
                          className="fuel-weekly-fill"
                          style={{
                            height: `${row.totals.calories > 0 ? Math.max(5, (row.totals.calories / weeklyMax.calories) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <div className="fuel-weekly-label">{row.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="fuel-weekly-card">
                <div className="fuel-macro-label">Protein · 7 days</div>
                <div className="fuel-weekly-bars">
                  {weeklyMacroTrend.map((row) => (
                    <button
                      type="button"
                      className={`fuel-weekly-col fuel-weekly-col-btn${selectedMacroDay === row.key ? " active" : ""}`}
                      key={`wk-pro-${row.key}`}
                      onClick={() => setSelectedMacroDay(row.key)}
                    >
                      <div className="fuel-weekly-track">
                        <div
                          className="fuel-weekly-fill protein"
                          style={{
                            height: `${row.totals.protein > 0 ? Math.max(5, (row.totals.protein / weeklyMax.protein) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <div className="fuel-weekly-label">{row.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="fuel-weekly-card">
                <div className="fuel-macro-label">Carbs · 7 days</div>
                <div className="fuel-weekly-bars">
                  {weeklyMacroTrend.map((row) => (
                    <button
                      type="button"
                      className={`fuel-weekly-col fuel-weekly-col-btn${selectedMacroDay === row.key ? " active" : ""}`}
                      key={`wk-carb-${row.key}`}
                      onClick={() => setSelectedMacroDay(row.key)}
                    >
                      <div className="fuel-weekly-track">
                        <div
                          className="fuel-weekly-fill carbs"
                          style={{
                            height: `${row.totals.carbs > 0 ? Math.max(5, (row.totals.carbs / weeklyMax.carbs) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <div className="fuel-weekly-label">{row.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="fuel-weekly-card">
                <div className="fuel-macro-label">Fat · 7 days</div>
                <div className="fuel-weekly-bars">
                  {weeklyMacroTrend.map((row) => (
                    <button
                      type="button"
                      className={`fuel-weekly-col fuel-weekly-col-btn${selectedMacroDay === row.key ? " active" : ""}`}
                      key={`wk-fat-${row.key}`}
                      onClick={() => setSelectedMacroDay(row.key)}
                    >
                      <div className="fuel-weekly-track">
                        <div
                          className="fuel-weekly-fill fat"
                          style={{
                            height: `${row.totals.fat > 0 ? Math.max(5, (row.totals.fat / weeklyMax.fat) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <div className="fuel-weekly-label">{row.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="fuel-intake-top">
              <div className="fuel-macro-label">
                Intake for{" "}
                {new Date(selectedMacroDay).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              {selectedMacroDay !== getTodayLogKey() ? (
                <button className="studio-back fuel-compact-btn" type="button" onClick={() => setSelectedMacroDay(getTodayLogKey())}>
                  Back to today
                </button>
              ) : null}
            </div>
            {selectedDayMeals.length > 0 ? (
              <div className="fuel-intake-list">
                {selectedDayMeals.slice(-5).reverse().map((meal, index) => {
                  const macros = getEntryMacros(meal);
                  return (
                    <div className="fuel-intake-row" key={`${meal.id || meal.text}-${index}`}>
                      <div className="fuel-intake-name">{meal.text}</div>
                      <div className="fuel-intake-macros">
                        {Math.round(macros.calories)} kcal · P {Math.round(macros.protein)} · C {Math.round(macros.carbs)} · F {Math.round(macros.fat)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="hud-dim fuel-intake-empty">No intake logged for this day yet.</div>
            )}

            <div className="hud-card-title">MEAL OF THE DAY</div>
            {mealOfDay ? (
              <button
                className="fuel-mealofday"
                onClick={() => fetchMealDetail(mealOfDay.idMeal)}
              >
                <img
                  src={mealOfDay.strMealThumb}
                  alt={mealOfDay.strMeal}
                  className="fuel-thumb"
                />
                <div>
                  <div className="fuel-meal-name">{mealOfDay.strMeal}</div>
                  <div className="hud-dim">Tap to open recipe + shopping list</div>
                </div>
              </button>
            ) : (
              <div className="hud-dim">Loading daily pick…</div>
            )}
          </div>

          {/* RIGHT: Protocol feed */}
          <div className="hud-card">
            <div className="hud-card-title">PROTOCOL FEED</div>

            {error ? <div className="fuel-error">{error}</div> : null}

            {loading ? (
              <div className="hud-dim">Generating meals…</div>
            ) : protocolMeals.length === 0 ? (
              <div className="hud-dim">
                No meals matched the current filters. Try a different preference or switch goal to Balanced.
              </div>
            ) : (
              <div className="fuel-grid">
                {protocolMeals.map((m) => (
                  <button
                    key={m.idMeal}
                    className="fuel-tile"
                    onClick={() => fetchMealDetail(m.idMeal)}
                  >
                    <img
                      src={m.strMealThumb}
                      alt={m.strMeal}
                      className="fuel-tile-thumb"
                      loading="lazy"
                    />
                    <div className="fuel-tile-name">{m.strMeal}</div>
                    <div className="fuel-tile-sub">Open recipe</div>
                  </button>
                ))}
              </div>
            )}
            {availabilityNote ? (
              <div className="hud-dim" style={{ marginTop: 10 }}>
                {availabilityNote}
              </div>
            ) : null}
          </div>
        </div>

        {/* MODAL RECIPE VIEW */}
        {activeMeal && (
          <div
            className="fuel-modal-backdrop"
            onMouseDown={(e) => {
              // click outside closes
              if (e.target.classList.contains("fuel-modal-backdrop")) {
                setActiveMeal(null);
                setOffResults([]);
                setOffQuery("");
              }
            }}
          >
            <div className="fuel-modal" role="dialog" aria-modal="true">
              <div className="fuel-modal-top">
                <div>
                  <div className="fuel-modal-title">{activeMeal.strMeal}</div>
                  <div className="fuel-detail-tags">
                    {activeMeal.strCategory ? (
                      <span className="fuel-tag">{activeMeal.strCategory}</span>
                    ) : null}
                    {activeMeal.strArea ? (
                      <span className="fuel-tag">{activeMeal.strArea}</span>
                    ) : null}
                  </div>
                </div>
                <div className="fuel-modal-actions">
                  <button
                    className="studio-back fuel-save-btn"
                    onClick={handleSaveMealToLogs}
                    type="button"
                  >
                    Save to logs
                  </button>
                  <button
                    className="studio-back fuel-save-btn"
                    onClick={handleMoreLikeThis}
                    type="button"
                  >
                    More like this
                  </button>
                  <button
                    className="studio-back fuel-save-btn"
                    onClick={handleShareRecipeTemplate}
                    type="button"
                  >
                    Share template
                  </button>
                  <button
                    className="hud-secondary-btn"
                    onClick={() => {
                      setActiveMeal(null);
                      setOffResults([]);
                      setOffQuery("");
                    }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {detailLoading ? (
                <div className="hud-dim">Opening recipe…</div>
              ) : (
                <div className="fuel-modal-body">
                  <div className="fuel-modal-left">
                    <img
                      src={activeMeal.strMealThumb}
                      alt={activeMeal.strMeal}
                      className="fuel-detail-img"
                    />
                    <div className="hud-divider" />
                    <div className="fuel-section-title">Shopping List</div>

                    <div className="fuel-shopping">
                      {buildIngredients(activeMeal).map((x, idx) => (
                        <div key={`${x.ingredient}-${idx}`} className="fuel-shopping-row">
                          <div>
                            <div className="fuel-ing">{x.ingredient}</div>
                            <div className="hud-dim">{x.measure || "—"}</div>
                          </div>
                          <button
                            className="fuel-off-btn"
                            onClick={() => {
                              setOffQuery(x.ingredient);
                              searchOpenFoodFacts(x.ingredient);
                            }}
                            title="Check packaged options (OpenFoodFacts)"
                          >
                            Verify
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="fuel-modal-right">
                    <div className="fuel-section-title">Instructions</div>
                    <div className="fuel-instructions">
                      {activeMeal.strInstructions || "No instructions provided."}
                    </div>

                    <div className="hud-divider" />

                    <div className="fuel-section-title">Optional: OpenFoodFacts Check</div>
                    <div className="fuel-off">
                      <div className="fuel-off-bar">
                        <input
                          className="fuel-off-input"
                          value={offQuery}
                          onChange={(e) => setOffQuery(e.target.value)}
                          placeholder="Search packaged foods (e.g., greek yogurt, oats)…"
                          onKeyDown={(e) => e.key === "Enter" && searchOpenFoodFacts()}
                        />
                        <button
                          className="fuel-off-search"
                          onClick={() => searchOpenFoodFacts()}
                          disabled={offLoading}
                        >
                          {offLoading ? "…" : "Search"}
                        </button>
                      </div>

                      {offResults.length > 0 ? (
                        <div className="fuel-off-results">
                          {offResults.slice(0, 8).map((p, i) => (
                            <div key={`${p.code || i}`} className="fuel-off-card">
                              <div className="fuel-off-name">
                                {p.product_name || "Unnamed product"}
                              </div>
                              <div className="hud-dim">
                                kcal: {p.nutriments?.["energy-kcal"] ?? "—"} • protein:{" "}
                                {p.nutriments?.proteins ?? "—"}g • carbs:{" "}
                                {p.nutriments?.carbohydrates ?? "—"}g • fat:{" "}
                                {p.nutriments?.fat ?? "—"}g
                              </div>
                              <button
                                className="studio-back fuel-compact-btn fuel-off-add-btn"
                                type="button"
                                onClick={() => handleAddOffProductToToday(p)}
                              >
                                Add to intake
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="hud-dim">
                          
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {customRecipeOpen && (
          <div
            className="community-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target.classList.contains("community-modal-backdrop")) {
                setCustomRecipeOpen(false);
              }
            }}
          >
            <div className="community-modal" role="dialog" aria-modal="true">
              <div className="community-modal-title">Create custom recipe</div>
              <input
                className="community-modal-input"
                placeholder="Recipe title"
                value={customRecipeDraft.title}
                onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <div className="logs-row">
                <select
                  className="community-thread-select"
                  value={customRecipeDraft.mealType}
                  onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, mealType: event.target.value }))}
                >
                  {["Breakfast", "Lunch", "Dinner", "Snack"].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  className="community-modal-input"
                  placeholder="Prep min"
                  value={customRecipeDraft.prepMinutes}
                  onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, prepMinutes: event.target.value }))}
                />
                <input
                  className="community-modal-input"
                  placeholder="Cook min"
                  value={customRecipeDraft.cookMinutes}
                  onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, cookMinutes: event.target.value }))}
                />
                <input
                  className="community-modal-input"
                  placeholder="Servings"
                  value={customRecipeDraft.servings}
                  onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, servings: event.target.value }))}
                />
              </div>
              <div className="logs-row">
                <input
                  className="community-modal-input"
                  placeholder="Calories / serving"
                  value={customRecipeDraft.calories}
                  onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, calories: event.target.value }))}
                />
                <input
                  className="community-modal-input"
                  placeholder="Protein (g)"
                  value={customRecipeDraft.protein}
                  onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, protein: event.target.value }))}
                />
                <input
                  className="community-modal-input"
                  placeholder="Carbs (g)"
                  value={customRecipeDraft.carbs}
                  onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                />
                <input
                  className="community-modal-input"
                  placeholder="Fat (g)"
                  value={customRecipeDraft.fat}
                  onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, fat: event.target.value }))}
                />
              </div>
              <textarea
                className="community-modal-textarea"
                placeholder={"Ingredients (one per line)\nExample: Chicken breast - 200g"}
                value={customRecipeDraft.ingredients}
                onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, ingredients: event.target.value }))}
              />
              <textarea
                className="community-modal-textarea"
                placeholder={"Steps (one per line)\nExample: Cook chicken until golden"}
                value={customRecipeDraft.steps}
                onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, steps: event.target.value }))}
              />
              <input
                className="community-modal-input"
                placeholder="Tags (comma separated)"
                value={customRecipeDraft.tags}
                onChange={(event) => setCustomRecipeDraft((prev) => ({ ...prev, tags: event.target.value }))}
              />
              <div className="community-modal-actions">
                <button className="studio-back hud-secondary-btn" type="button" onClick={() => setCustomRecipeOpen(false)}>
                  Cancel
                </button>
                <button className="studio-back community-cta-btn" type="button" onClick={handleCreateCustomRecipe}>
                  Share + Add to Logs
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="hud-dim" style={{ marginTop: 12 }}>
          Data sources: TheMealDB (recipes) + OpenFoodFacts (packaged nutrition).
        </div>
        {saveBanner ? (
          <div className="studio-banner success" style={{ marginTop: 12 }}>
            {saveBanner}
          </div>
        ) : null}
      </div>
    </div>
  );
}

