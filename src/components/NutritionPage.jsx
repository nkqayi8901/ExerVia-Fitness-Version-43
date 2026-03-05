// src/components/NutritionPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { emptyDay, fetchDailyLogs, fetchSavedMeals, removeMealFromLibrary, saveMealToLibrary, upsertDailyLog } from "../services/logsApi";
import { getLogsStore, getTodayLogKey, saveLogsStore } from "../services/logsStorage";
import { supabase } from "../supabaseClient";
import localRecipes from "../data/recipes.json";
import { toUserFacingNetworkMessage } from "../utils/networkError";
import { emitToast } from "../utils/toast";
import { isErrorBanner } from "../utils/banner";
import PageWalkthroughModal from "./PageWalkthroughModal";
// Component: NutritionPage - UI layout and interactions.
// This component renders the nutrition experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the nutrition page which is a key part of the athlete mode experience
// it provides users with meal recommendations based on 
// their fitness level, goals, and preferences
// the UI layout and styling was adapted from Tailwind card and form components

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
const OFF_SEARCH_V2 =
  "https://world.openfoodfacts.org/api/v2/search?fields=code,product_name,nutriments&page_size=8&search_terms=";
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

const NUTRITION_WALKTHROUGH_STEPS = [
  {
    id: "generate",
    title: "Generate Meals",
    what: "Set protocol, prep time, and preference, then generate a fresh feed.",
    why: "This gives you tailored meal options aligned to your current goal.",
    firstAction: "Generate new meals.",
  },
  {
    id: "today_intake",
    title: "Review Today's Intake",
    what: "Track calories and macros from your logged meals for the selected day.",
    why: "You can quickly see if your intake matches your target direction.",
    firstAction: "Open Today's Intake.",
  },
  {
    id: "favorites",
    title: "Use Favorites",
    what: "Switch to Favorites to reuse meals you trust and open faster repeats.",
    why: "Favorites reduce decision fatigue and speed up daily logging.",
    firstAction: "Open Favorites feed.",
  },
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
      source: "mealdb",
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

function createFuelTrendLine(rows, valueGetter, selectedDay) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const values = safeRows.map((row) => Number(valueGetter(row) || 0));
  const nonZeroValues = values.filter((value) => value > 0);
  const hasData = nonZeroValues.length > 0;
  const minValue = hasData ? Math.min(...nonZeroValues) : 0;
  const maxValue = hasData ? Math.max(...nonZeroValues) : 1;
  const range = Math.max(1, maxValue - minValue);
  const usableWidth = 88;
  const xOffset = 6;
  const yBottom = 34;
  const yTop = 8;
  const step = safeRows.length > 1 ? usableWidth / (safeRows.length - 1) : 0;

  const points = safeRows.map((row, index) => {
    const value = Number(valueGetter(row) || 0);
    const x = xOffset + step * index;
    let y = yBottom;
    if (value > 0 && hasData) {
      const normalized = nonZeroValues.length === 1 ? 0.5 : (value - minValue) / range;
      y = yBottom - normalized * (yBottom - yTop);
    }
    return {
      key: row?.key || `macro-${index}`,
      label: row?.label || "",
      dayKey: row?.key || "",
      value,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      active: selectedDay === row?.key,
    };
  });

  return {
    hasData,
    polylinePoints: points.map((point) => `${point.x},${point.y}`).join(" "),
    areaPath:
      hasData && points.length
        ? `M ${points[0].x} ${yBottom} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x} ${yBottom} Z`
        : "",
    points,
  };
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

function normalizeOffQuery(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(\d+g|\d+kg|\d+ml|\d+l|pinch|tbsp|tsp|cup|cups)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recipeIdentityKey(meal) {
  const source = normalizeTextId(meal?.source || meal?.__source);
  const id = normalizeTextId(meal?.idMeal);
  const name = normalizeTextId(meal?.strMeal);
  return (
    (source && id ? `${source}:${id}` : "") ||
    id ||
    (source && name ? `${source}:${name}` : "") ||
    name
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
    source: "dummy",
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
    source: "spoon",
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

function convertLocalToMealShape(recipe) {
  const steps = Array.isArray(recipe?.instructions) ? recipe.instructions : [];
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const base = {
    idMeal: String(recipe?.id || `local-${Date.now()}`),
    strMeal: String(recipe?.title || "Recipe"),
    strMealThumb: "",
    strCategory: String(recipe?.mealType || "Recipe"),
    strArea: String(recipe?.area || "Custom"),
    strInstructions: steps.join("\n"),
    source: "local",
    localRecipe: recipe,
  };
  for (let i = 0; i < 20; i += 1) {
    const row = ingredients[i];
    base[`strIngredient${i + 1}`] = String(row?.ingredient || "");
    base[`strMeasure${i + 1}`] = String(row?.measure || "");
  }
  base.__nutrition = {
    calories: Number(recipe?.nutrition?.calories) || 0,
    protein: Number(recipe?.nutrition?.protein) || 0,
    carbs: Number(recipe?.nutrition?.carbs) || 0,
    fat: Number(recipe?.nutrition?.fat) || 0,
  };
  base.__tip = String(recipe?.tip || "").trim();
  base.__slotTags = Array.isArray(recipe?.slot_tags)
    ? recipe.slot_tags.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return base;
}

function getLocalRecipePool(preference, timeWindow, goal) {
  const list = Array.isArray(localRecipes) ? localRecipes : [];
  const timeValue = Number(timeWindow || 30);
  return list
    .filter((recipe) => String(recipe?.preference || "") === String(preference || ""))
    .filter((recipe) => Number(recipe?.minutes || 999) <= timeValue)
    .filter((recipe) => {
      const goals = Array.isArray(recipe?.goals) ? recipe.goals : [];
      return goals.length === 0 || goals.includes(goal);
    })
    .map((recipe) => convertLocalToMealShape(recipe));
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

const getMealPreviewMacros = (meal) => ({
  calories: toMacroNumber(meal?.__nutrition?.calories),
  protein: toMacroNumber(meal?.__nutrition?.protein),
  carbs: toMacroNumber(meal?.__nutrition?.carbs),
  fat: toMacroNumber(meal?.__nutrition?.fat),
});

const isCuratedMeal = (meal) =>
  String(meal?.idMeal || "").startsWith("local-") || String(meal?.source || "") === "local";

const getRecipeSourceLabel = (meal) => {
  const source = String(meal?.source || meal?.__source || "").toLowerCase();
  if (source === "local") return "ExerVia Curated";
  if (source === "dummy") return "DummyJSON";
  if (source === "spoon") return "Spoonacular";
  return "TheMealDB";
};

const getSlotLabel = (slot) => {
  const map = {
    morning: "Morning",
    midday: "Midday",
    pre_training: "Pre-Training",
    recovery: "Recovery",
  };
  return map[String(slot || "").trim()] || String(slot || "").trim();
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
  const [logsSyncError, setLogsSyncError] = useState("");
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
  const [feedFilter, setFeedFilter] = useState("all");
  const [curatedOnly, setCuratedOnly] = useState(true);
  const [activeFuelView, setActiveFuelView] = useState("intake");
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [favoriteRecipeKeys, setFavoriteRecipeKeys] = useState([]);
  const [favoriteMeals, setFavoriteMeals] = useState([]);
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
  const favoriteStorageKey = useMemo(
    () => `exervia_fuel_favorites_${storedId || "guest"}`,
    [storedId]
  );
  const favoriteMealsStorageKey = useMemo(
    () => `exervia_fuel_favorite_meals_${storedId || "guest"}`,
    [storedId]
  );
  const protocolCacheKey = useMemo(
    () =>
      `exervia_protocol_cache_${storedId || "guest"}_${preference}_${goal}_${timeWindow}_${curatedOnly ? "curated" : "all"}`,
    [storedId, preference, goal, timeWindow, curatedOnly]
  );
  const protocolRequestRef = useRef(0);
  const favoritesHydratedRef = useRef(false);

  useEffect(() => {
    if (!saveBanner) return;
    const timeout = setTimeout(() => setSaveBanner(""), 2800);
    return () => clearTimeout(timeout);
  }, [saveBanner]);

  useEffect(() => {
    if (!saveBanner) return;
    const isErrorLike = isErrorBanner(saveBanner);
    emitToast(String(saveBanner), isErrorLike ? "error" : "info", isErrorLike ? 3600 : 3000);
  }, [saveBanner]);

  useEffect(() => {
    if (!activeMeal && !customRecipeOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (customRecipeOpen) {
        setCustomRecipeOpen(false);
        return;
      }
      if (activeMeal) {
        setActiveMeal(null);
        setOffResults([]);
        setOffQuery("");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeMeal, customRecipeOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(favoriteStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setFavoriteRecipeKeys(Array.isArray(parsed) ? parsed.map((item) => String(item)) : []);
    } catch {
      setFavoriteRecipeKeys([]);
    }
  }, [favoriteStorageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(favoriteMealsStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setFavoriteMeals(Array.isArray(parsed) ? parsed : []);
    } catch {
      setFavoriteMeals([]);
    }
    favoritesHydratedRef.current = true;
  }, [favoriteMealsStorageKey]);

  useEffect(() => {
    if (!favoritesHydratedRef.current) return;
    localStorage.setItem(favoriteStorageKey, JSON.stringify(favoriteRecipeKeys.slice(-400)));
  }, [favoriteRecipeKeys, favoriteStorageKey]);

  useEffect(() => {
    if (!favoritesHydratedRef.current) return;
    localStorage.setItem(favoriteMealsStorageKey, JSON.stringify(favoriteMeals.slice(-400)));
  }, [favoriteMeals, favoriteMealsStorageKey]);

  useEffect(() => {
    let cancelled = false;
    const loadCloudFavorites = async () => {
      if (!storedId) return;
      const cloudMeals = await fetchSavedMeals(storedId);
      if (cancelled || !Array.isArray(cloudMeals) || !cloudMeals.length) return;
      const normalizedCloud = cloudMeals
        .filter((entry) => String(entry?.source || "").toLowerCase() === "favorite")
        .map((entry) => {
          const name = String(entry?.name || "").trim();
          if (!name) return null;
          return {
            idMeal: String(entry?.id || name),
            strMeal: name,
            source: entry?.source || "favorite",
          };
        })
        .filter(Boolean);
      if (!normalizedCloud.length) return;
      setFavoriteMeals((prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        const seen = new Set(existing.map((item) => normalizeTextId(item?.strMeal)));
        const additions = normalizedCloud.filter((item) => !seen.has(normalizeTextId(item?.strMeal)));
        if (!additions.length) return existing;
        return [...existing, ...additions].slice(-400);
      });
    };
    loadCloudFavorites();
    return () => {
      cancelled = true;
    };
  }, [storedId]);

  useEffect(() => {
    if (!favoriteMeals.length) return;
    const fromMeals = favoriteMeals
      .map((meal) => recipeIdentityKey(meal))
      .filter(Boolean);
    if (!fromMeals.length) return;
    setFavoriteRecipeKeys((prev) => {
      const merged = Array.from(new Set([...(prev || []), ...fromMeals]));
      if (
        Array.isArray(prev) &&
        merged.length === prev.length &&
        merged.every((item, index) => item === prev[index])
      ) {
        return prev;
      }
      return merged;
    });
  }, [favoriteMeals]);

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

  const isRecipeFavorite = (meal) => {
    const key = recipeIdentityKey(meal);
    const id = normalizeTextId(meal?.idMeal);
    const name = normalizeTextId(meal?.strMeal);
    if (key && favoriteRecipeKeys.includes(key)) return true;
    if (id && favoriteRecipeKeys.some((item) => item === id || item.endsWith(`:${id}`))) return true;
    if (name && favoriteRecipeKeys.includes(`name:${name}`)) return true;
    if (!name) return false;
    return favoriteMeals.some((item) => normalizeTextId(item?.strMeal) === name);
  };

  const toFavoriteMealSnapshot = (meal) => {
    if (!meal) return null;
    return {
      ...meal,
      idMeal: meal?.idMeal,
      strMeal: meal?.strMeal,
      strMealThumb: meal?.strMealThumb,
      strCategory: meal?.strCategory,
      strArea: meal?.strArea,
      strInstructions: meal?.strInstructions,
      source: meal?.source || meal?.__source || "",
      __source: meal?.__source || meal?.source || "",
      __nutrition: meal?.__nutrition || {},
      __tip: meal?.__tip || "",
      __slotTags: Array.isArray(meal?.__slotTags) ? meal.__slotTags : [],
    };
  };

  const toggleRecipeFavorite = async (meal) => {
    const key = recipeIdentityKey(meal);
    const id = normalizeTextId(meal?.idMeal);
    const name = normalizeTextId(meal?.strMeal);
    const nameKey = name ? `name:${name}` : "";
    const removing = isRecipeFavorite(meal);
    if (!key) return;
    setFavoriteRecipeKeys((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const exists =
        safePrev.includes(key) ||
        (nameKey ? safePrev.includes(nameKey) : false) ||
        (id ? safePrev.some((item) => item === id || item.endsWith(`:${id}`)) : false);
      const next = exists
        ? safePrev.filter((item) => item !== key && item !== nameKey && (!id || (item !== id && !item.endsWith(`:${id}`))))
        : [...safePrev, key, ...(nameKey ? [nameKey] : []), ...(id ? [id] : [])];
      localStorage.setItem(favoriteStorageKey, JSON.stringify(next.slice(-400)));
      return next;
    });
    setFavoriteMeals((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const exists = safePrev.some((item) => {
        const itemKey = recipeIdentityKey(item);
        const itemName = normalizeTextId(item?.strMeal);
        return itemKey === key || (name && itemName === name);
      });
      const next = exists
        ? safePrev.filter((item) => {
            const itemKey = recipeIdentityKey(item);
            const itemName = normalizeTextId(item?.strMeal);
            return itemKey !== key && (!name || itemName !== name);
          })
        : (() => {
            const snapshot = toFavoriteMealSnapshot(meal);
            return snapshot ? [...safePrev, snapshot] : safePrev;
          })();
      localStorage.setItem(favoriteMealsStorageKey, JSON.stringify(next.slice(-400)));
      return next;
    });
    if (storedId && meal?.strMeal) {
      if (removing) {
        await removeMealFromLibrary(storedId, meal.strMeal);
      } else {
        await saveMealToLibrary(storedId, meal.strMeal, "favorite");
      }
    }
  };

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
  const todayLogKey = getTodayLogKey();
  const mergedTodayMeals = useMemo(() => {
    const seen = new Set();
    const merged = [];
    [...(todayMeals || [])].forEach((meal) => {
      const key = normalizeTextId(meal?.text) || String(meal?.id || "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(meal);
    });
    return merged;
  }, [todayMeals]);
  const todayMacroTotals = useMemo(() => sumMacros(mergedTodayMeals), [mergedTodayMeals]);
  const selectedDayMeals = useMemo(() => {
    const baseMeals = logMealsByDate[selectedMacroDay] || [];
    return baseMeals;
  }, [logMealsByDate, selectedMacroDay]);
  const weeklyMacroTrend = useMemo(() => {
    const rows = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${day}`;
      const meals = key === todayLogKey ? mergedTodayMeals : logMealsByDate[key] || [];
      rows.push({
        key,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        totals: sumMacros(meals),
      });
    }
    return rows;
  }, [logMealsByDate, mergedTodayMeals, todayLogKey]);
  const caloriesTrendLine = useMemo(
    () => createFuelTrendLine(weeklyMacroTrend, (row) => row?.totals?.calories, selectedMacroDay),
    [weeklyMacroTrend, selectedMacroDay]
  );
  const proteinTrendLine = useMemo(
    () => createFuelTrendLine(weeklyMacroTrend, (row) => row?.totals?.protein, selectedMacroDay),
    [weeklyMacroTrend, selectedMacroDay]
  );
  const carbsTrendLine = useMemo(
    () => createFuelTrendLine(weeklyMacroTrend, (row) => row?.totals?.carbs, selectedMacroDay),
    [weeklyMacroTrend, selectedMacroDay]
  );
  const fatTrendLine = useMemo(
    () => createFuelTrendLine(weeklyMacroTrend, (row) => row?.totals?.fat, selectedMacroDay),
    [weeklyMacroTrend, selectedMacroDay]
  );
  const visibleProtocolMeals = useMemo(() => {
    if (feedFilter === "favorites") return favoriteMeals;
    return protocolMeals;
  }, [feedFilter, protocolMeals, favoriteMeals]);
  const loadTodayMeals = async () => {
    if (!storedId) return;
    const dayKey = getTodayLogKey();
    setLogsSyncError("");
    try {
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
    } catch (error) {
      const local = getLogsStore(storedId);
      const localMealsByDate = {};
      Object.entries(local.byDate || {}).forEach(([key, day]) => {
        localMealsByDate[key] = Array.isArray(day?.meals) ? day.meals : [];
      });
      setLogMealsByDate(localMealsByDate);
      setTodayMeals(localMealsByDate[dayKey] || []);
      if (!selectedMacroDay || !localMealsByDate[selectedMacroDay]) {
        setSelectedMacroDay(dayKey);
      }
      setLogsSyncError(
        toUserFacingNetworkMessage(error, "Could not sync your fuel logs from cloud. Showing local data.")
      );
    }
  };

  // --- MealDB fetchers ---
  const fetchMealOfDay = async () => {
    const localPool = getLocalRecipePool(preference, "45", goal);
    if (localPool.length) {
      setMealOfDay(localPool[Math.floor(Math.random() * localPool.length)]);
      return;
    }
    if (curatedOnly) {
      setMealOfDay(null);
      return;
    }
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
    const requestId = protocolRequestRef.current + 1;
    protocolRequestRef.current = requestId;
    setError("");
    setAvailabilityNote("");
    let hasWarmStart = false;
    try {
      const raw = localStorage.getItem(protocolCacheKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length) {
        setProtocolMeals(parsed);
        hasWarmStart = true;
      }
    } catch {
      // ignore cache parse errors
    }
    setLoading(!hasWarmStart);
    setActiveMeal(null);

    try {
      /**
       * preference → sources (category if possible; fallback to name search)
       * Then: goal health-filter + shuffle + pick cap
       */
      const localMeals = getLocalRecipePool(preference, timeWindow, goal);
      const useLocalOnly = curatedOnly || localMeals.length >= cap;
      let list = [...localMeals];
      const mealdbTerms = (MEALDB_SEARCH_TERMS[preference] || [preference]).slice(0, 2);

      if (!useLocalOnly) {
        let mealdbList = [];
        if (preference === "seafood") {
          mealdbList = await mealdbFilterByCategory("Seafood");
        } else if (preference === "vegetarian") {
          mealdbList = await mealdbFilterByCategory("Vegetarian");
        } else if (preference === "beef") {
          mealdbList = await mealdbFilterByCategory("Beef");
        } else if (preference === "pork") {
          mealdbList = await mealdbFilterByCategory("Pork");
        } else if (preference === "chicken") {
          mealdbList = await mealdbFilterByCategory("Chicken");
          const extraLists = await Promise.all(mealdbTerms.map((term) => mealdbSearchByName(term)));
          mealdbList = [...mealdbList, ...extraLists.flat()];
        } else {
          const extraLists = await Promise.all(mealdbTerms.map((term) => mealdbSearchByName(term)));
          mealdbList = extraLists.flat();
        }
        list = [...list, ...mealdbList];

        const terms = (DUMMY_SEARCH_TERMS[preference] || [preference]).slice(0, 2);
        const dummyLists = await Promise.all(terms.map((term) => dummySearchByName(term)));
        list = [...list, ...dummyLists.flat()];
      }

      // third pool from Spoonacular (optional API key)
      // used when categories are thin (especially turkey) or result set is still small
      if (!useLocalOnly && SPOON_KEY && (preference === "turkey" || list.length < cap + 2)) {
        const spoonTerms = (MEALDB_SEARCH_TERMS[preference] || [preference]).slice(
          0,
          preference === "turkey" ? 2 : 1
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
          const fallbackTerms = (MEALDB_SEARCH_TERMS[preference] || [preference]).slice(0, 2);
          const fallbackLists = await Promise.all(
            fallbackTerms.map((term) => mealdbSearchByName(term))
          );
          raw = [...normalizeMealList(raw), ...fallbackLists.flat()];
          raw = [...raw, ...getLocalRecipePool(preference, timeWindow, goal)];
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
      const curated = list.filter((meal) => isCuratedMeal(meal));
      const nonCurated = list.filter((meal) => !isCuratedMeal(meal));
      const unseenCurated = curated.filter((meal) => !seenSet.has(recipeIdentityKey(meal)));
      const seenCurated = curated.filter((meal) => seenSet.has(recipeIdentityKey(meal)));
      const unseenOther = nonCurated.filter((meal) => !seenSet.has(recipeIdentityKey(meal)));
      const seenOther = nonCurated.filter((meal) => seenSet.has(recipeIdentityKey(meal)));
      const unseenPool = [...unseenCurated, ...unseenOther];
      const fallbackPool = [...seenCurated, ...seenOther];
      const orderedPool = [...shuffle(unseenPool), ...shuffle(fallbackPool)];
      const picked = clampList(orderedPool, cap);
      const nextSeen = [
        ...seenList,
        ...picked.map((meal) => recipeIdentityKey(meal)).filter(Boolean)
      ];
      localStorage.setItem(seenKey, JSON.stringify(nextSeen.slice(-180)));
      if (requestId !== protocolRequestRef.current) return;
      if (preference === "turkey" && picked.length <= 3) {
        if (SPOON_KEY) {
          setAvailabilityNote("Turkey recipes are limited today. Showing the best available matches.");
        } else {
          setAvailabilityNote(
            "Turkey recipes are limited on free sources. Add REACT_APP_SPOONACULAR_API_KEY to expand results."
          );
        }
      }
      if (useLocalOnly) {
        setAvailabilityNote("Showing curated recipes for this protocol.");
      }
      setProtocolMeals(picked);
      try {
        localStorage.setItem(protocolCacheKey, JSON.stringify(picked));
      } catch {
        // best-effort cache
      }
    } catch {
      if (requestId !== protocolRequestRef.current) return;
      setError("Fuel feed failed. Try again.");
      setProtocolMeals([]);
    } finally {
      if (requestId === protocolRequestRef.current) {
        setLoading(false);
      }
    }
  };

// fetchMealDetail manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchMealDetail = async (idMeal) => {
    setDetailLoading(true);
    try {
      const sourcePool = [...(protocolMeals || []), ...(favoriteMeals || [])];
      if (!idMeal) {
        setActiveMeal(null);
        return;
      }
      if (String(idMeal || "").startsWith("dummy-")) {
        const sourceMeal = sourcePool.find((meal) => String(meal.idMeal) === String(idMeal));
        if (sourceMeal?.dummyRecipe) {
          setActiveMeal(convertDummyToMealShape(sourceMeal.dummyRecipe));
          return;
        }
      }
      if (String(idMeal || "").startsWith("spoon-")) {
        const sourceMeal = sourcePool.find((meal) => String(meal.idMeal) === String(idMeal));
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
      if (String(idMeal || "").startsWith("local-")) {
        const sourceMeal = sourcePool.find((meal) => String(meal.idMeal) === String(idMeal));
        if (sourceMeal?.localRecipe) {
          setActiveMeal(convertLocalToMealShape(sourceMeal.localRecipe));
          return;
        }
        const row = (Array.isArray(localRecipes) ? localRecipes : []).find(
          (item) => String(item?.id) === String(idMeal)
        );
        if (row) {
          setActiveMeal(convertLocalToMealShape(row));
          return;
        }
      }
      const sourceMeal = sourcePool.find((meal) => String(meal.idMeal) === String(idMeal));
      const res = await fetch(`${MEALDB}/lookup.php?i=${encodeURIComponent(idMeal)}`);
      const json = await res.json();
      const meal = json?.meals?.[0] || null;
      if (meal) {
        setActiveMeal({ ...meal, source: sourceMeal?.source || "mealdb" });
        return;
      }
      // Favorites saved from logs/community can have non-MealDB ids.
      // Fall back to the in-memory source object so modal still opens.
      if (sourceMeal) {
        setActiveMeal(sourceMeal);
        return;
      }
      setActiveMeal(null);
    } catch {
      setActiveMeal(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openMealFromCard = (meal) => {
    if (!meal) return;
    const idMeal = String(meal.idMeal || "").trim();
    if (!idMeal) {
      setActiveMeal(meal);
      return;
    }
    fetchMealDetail(idMeal);
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
      const localHits = (Array.isArray(localRecipes) ? localRecipes : [])
        .filter((recipe) =>
          String(recipe?.title || "").toLowerCase().includes(String(keyword || "").toLowerCase())
        )
        .map((recipe) => convertLocalToMealShape(recipe));
      const merged = [
        ...localHits,
        ...(curatedOnly ? [] : mealdbHits),
        ...(curatedOnly ? [] : dummyHits),
        ...(curatedOnly ? [] : spoonHits),
      ]
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
      const prioritized = [
        ...deduped.filter((meal) => isCuratedMeal(meal)),
        ...deduped.filter((meal) => !isCuratedMeal(meal)),
      ];
      setProtocolMeals(clampList(shuffle(prioritized), cap));
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
    const rawQuery = String(q || offQuery || "").trim();
    const query = normalizeOffQuery(rawQuery);
    if (!query) return;
    setOffLoading(true);
    try {
      const trySearch = async (baseUrl, term) => {
        const res = await fetch(`${baseUrl}${encodeURIComponent(term)}`);
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json?.products) ? json.products : [];
      };

      let products = await trySearch(OFF_SEARCH, query);
      if (!products.length) {
        products = await trySearch(OFF_SEARCH_V2, query);
      }
      if (!products.length) {
        const compact = query.split(" ").slice(0, 2).join(" ");
        if (compact && compact !== query) {
          products = await trySearch(OFF_SEARCH, compact);
          if (!products.length) {
            products = await trySearch(OFF_SEARCH_V2, compact);
          }
        }
      }
      setOffResults(products);
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
    if (!storedId) {
      setSaveBanner("Sign in to save intake.");
      return;
    }
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
    if (!storedId) {
      setSaveBanner("Sign in to save meals.");
      return;
    }
    if (!activeMeal?.strMeal) return;

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
    if (!storedId) {
      setSaveBanner("Sign in to share recipes.");
      return;
    }
    if (!activeMeal?.strMeal) return;
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
    if (!storedId) {
      setSaveBanner("Sign in to create custom recipes.");
      return;
    }
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

    const customRecipeMeal = {
      idMeal: `custom:${normalizeTextId(title) || Date.now()}`,
      strMeal: title,
      strCategory: payload.mealType || "Dinner",
      source: "favorite",
      __source: "custom_recipe",
      __nutrition: payload.nutrition || {},
      __slotTags: [String(payload.mealType || "").toLowerCase()].filter(Boolean),
    };
    const customRecipeKey = recipeIdentityKey(customRecipeMeal);
    const customNameKey = `name:${normalizeTextId(title)}`;

    if (customRecipeKey) {
      setFavoriteRecipeKeys((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const next = new Set(safePrev);
        next.add(customRecipeKey);
        next.add(customNameKey);
        return Array.from(next).slice(-400);
      });
    }
    setFavoriteMeals((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const exists = safePrev.some((item) => normalizeTextId(item?.strMeal) === normalizeTextId(title));
      if (exists) return safePrev;
      const snapshot = toFavoriteMealSnapshot(customRecipeMeal);
      return snapshot ? [...safePrev, snapshot].slice(-400) : safePrev;
    });
    await saveMealToLibrary(storedId, title, "favorite");

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

  const handleWalkthroughAction = (step) => {
    const stepId = String(step?.id || "");
    if (stepId === "generate") {
      setActiveFuelView("overview");
      fetchProtocolMeals();
      return;
    }
    if (stepId === "today_intake") {
      setActiveFuelView("intake");
      return;
    }
    if (stepId === "favorites") {
      setFeedFilter("favorites");
    }
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
  }, [goal, curatedOnly]);

  useEffect(() => {
    fetchProtocolMeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curatedOnly]);

  const showOverview = activeFuelView === "overview";
  const showIntake = activeFuelView === "intake";
  const showProtocolSettings = showOverview;

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
              {'Back'}
            </button>
            <h2 className="page-title">{protocolLabel}</h2>
            <p className="page-subtitle">
              Pick a protocol → Pick a time → Pick a preference → Get meals
            </p>
          </div>

          <div className="fuel-header-actions">
            <button
              className="studio-back fuel-compact-btn"
              type="button"
              onClick={() => setWalkthroughOpen(true)}
            >
              Walkthrough
            </button>
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
            <div className="fuel-feed-toggle-row">
              <button
                type="button"
                className={`fuel-feed-toggle ${feedFilter === "all" ? "active" : ""}`}
                onClick={() => setFeedFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`fuel-feed-toggle ${feedFilter === "favorites" ? "active" : ""}`}
                onClick={() => setFeedFilter("favorites")}
              >
                Favorites ({favoriteMeals.length})
              </button>
              <button
                type="button"
                className={`fuel-feed-toggle ${curatedOnly ? "active" : ""}`}
                onClick={() => setCuratedOnly((prev) => !prev)}
              >
                Curated only
              </button>
            </div>
          </div>
        </div>
        {logsSyncError ? (
          <div className="exervia-banner studio-banner error" style={{ marginBottom: 12 }}>
            {logsSyncError}{" "}
            <button className="studio-back" type="button" onClick={loadTodayMeals} style={{ marginLeft: 8 }}>
              Retry sync
            </button>
          </div>
        ) : null}

        <div className="hud-card" style={{ marginBottom: 12 }}>
          <div className="hud-card-title">FUEL PRIORITY</div>
          <div className="hud-dim" style={{ marginBottom: 10 }}>
            Start here first: intake targets.
          </div>
          <div className="fuel-feed-toggle-row">
            <button
              type="button"
              className={`studio-back fuel-compact-btn ${showOverview ? "fuel-chip-active" : ""}`}
              onClick={() => setActiveFuelView("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={`studio-back fuel-compact-btn ${showIntake ? "fuel-chip-active" : ""}`}
              onClick={() => setActiveFuelView("intake")}
            >
              Today's intake
            </button>
          </div>
        </div>

        <div className={`grid-2 ${showIntake ? "fuel-single-column" : ""}`}>
          {/* LEFT: Protocol controls + meal of day */}
          <div className="hud-card">
            {showProtocolSettings ? <div className="hud-card-title">PROTOCOL SETTINGS</div> : null}

            <div className="fuel-row" style={{ display: showProtocolSettings ? undefined : "none" }}>
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

            <div className="fuel-row" style={{ display: showProtocolSettings ? undefined : "none" }}>
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

            <div className="fuel-row" style={{ display: showProtocolSettings ? undefined : "none" }}>
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

            <div className="hud-divider" style={{ display: showProtocolSettings ? undefined : "none" }} />

            <div style={{ display: showIntake ? undefined : "none" }}>
              <div className="hud-card-title" id="fuel-intake-section">TODAY'S INTAKE</div>
              <div className="hud-dim" style={{ marginBottom: 10 }}>
                Targets are personalized from your profile, current level, and selected protocol.
              </div>
              <div className="fuel-macro-grid">
              <div className="fuel-macro-card">
                <div className="fuel-macro-label">Calories</div>
                <div className="fuel-macro-value">
                  {Math.round(todayMacroTotals.calories)}
                  <span> / ?</span>
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
                  <span> / ?</span>
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
                  <span> / ?</span>
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
                  <span> / ?</span>
                </div>
                <div className="fuel-macro-bar">
                  <div
                    className="fuel-macro-fill fat"
                    style={{ width: `${Math.min(100, (todayMacroTotals.fat / Math.max(1, macroTargets.fat)) * 100)}%` }}
                  />
                </div>
              </div>
              </div>
            </div>
            <div style={{ display: showIntake ? undefined : "none" }}>
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
                  <div className="logs-trend-head">
                    <div className="fuel-macro-label">Calories � 7 days</div>
                    <div className="logs-trend-value-pill">
                      {caloriesTrendLine.points.find((point) => point.active)?.value > 0
                        ? `${Math.round(caloriesTrendLine.points.find((point) => point.active)?.value || 0)} kcal`
                        : "No data"}
                    </div>
                  </div>
                  <div className="logs-trend-line-wrap">
                    <svg className="logs-trend-line-svg" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
                      <rect className="logs-trend-grid-fill" x="0" y="0" width="100" height="42" rx="8" />
                      <line className="logs-trend-grid-line" x1="6" y1="34" x2="94" y2="34" />
                      {caloriesTrendLine.hasData ? (
                        <>
                          <path className="logs-trend-area-fill" d={caloriesTrendLine.areaPath} />
                          <polyline className="logs-trend-line-path" points={caloriesTrendLine.polylinePoints} />
                        </>
                      ) : null}
                      {caloriesTrendLine.points.map((point) => (
                        <g key={`cal-point-${point.key}`}>
                          <circle
                            className="logs-trend-hit"
                            cx={point.x}
                            cy={point.y}
                            r={4.2}
                            onClick={() => setSelectedMacroDay(point.dayKey)}
                          />
                          <circle
                            className={`logs-trend-point${point.active ? " active" : ""}`}
                            cx={point.x}
                            cy={point.y}
                            r={point.active ? 1.9 : 1.5}
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="logs-trend-axis">
                    {caloriesTrendLine.points.map((point) => (
                      <button
                        type="button"
                        key={`cal-axis-${point.key}`}
                        className={`logs-trend-col-btn logs-trend-axis-btn${point.active ? " active" : ""}`}
                        onClick={() => setSelectedMacroDay(point.dayKey)}
                      >
                        <div className="logs-trend-label">{point.label}</div>
                        {point.value > 0 ? <span className="logs-trend-tip">{`${Math.round(point.value)} kcal`}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fuel-weekly-card">
                  <div className="logs-trend-head">
                    <div className="fuel-macro-label">Protein � 7 days</div>
                    <div className="logs-trend-value-pill fuel-trend-pill-protein">
                      {proteinTrendLine.points.find((point) => point.active)?.value > 0
                        ? `${Math.round(proteinTrendLine.points.find((point) => point.active)?.value || 0)} g`
                        : "No data"}
                    </div>
                  </div>
                  <div className="logs-trend-line-wrap">
                    <svg className="logs-trend-line-svg" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
                      <rect className="logs-trend-grid-fill" x="0" y="0" width="100" height="42" rx="8" />
                      <line className="logs-trend-grid-line" x1="6" y1="34" x2="94" y2="34" />
                      {proteinTrendLine.hasData ? (
                        <>
                          <path className="logs-trend-area-fill fuel-trend-area-protein" d={proteinTrendLine.areaPath} />
                          <polyline className="logs-trend-line-path fuel-trend-line-protein" points={proteinTrendLine.polylinePoints} />
                        </>
                      ) : null}
                      {proteinTrendLine.points.map((point) => (
                        <g key={`pro-point-${point.key}`}>
                          <circle
                            className="logs-trend-hit"
                            cx={point.x}
                            cy={point.y}
                            r={4.2}
                            onClick={() => setSelectedMacroDay(point.dayKey)}
                          />
                          <circle
                            className={`logs-trend-point fuel-trend-point-protein${point.active ? " active" : ""}`}
                            cx={point.x}
                            cy={point.y}
                            r={point.active ? 1.9 : 1.5}
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="logs-trend-axis">
                    {proteinTrendLine.points.map((point) => (
                      <button
                        type="button"
                        key={`pro-axis-${point.key}`}
                        className={`logs-trend-col-btn logs-trend-axis-btn${point.active ? " active" : ""}`}
                        onClick={() => setSelectedMacroDay(point.dayKey)}
                      >
                        <div className="logs-trend-label">{point.label}</div>
                        {point.value > 0 ? <span className="logs-trend-tip">{`${Math.round(point.value)} g`}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fuel-weekly-card">
                  <div className="logs-trend-head">
                    <div className="fuel-macro-label">Carbs � 7 days</div>
                    <div className="logs-trend-value-pill fuel-trend-pill-carbs">
                      {carbsTrendLine.points.find((point) => point.active)?.value > 0
                        ? `${Math.round(carbsTrendLine.points.find((point) => point.active)?.value || 0)} g`
                        : "No data"}
                    </div>
                  </div>
                  <div className="logs-trend-line-wrap">
                    <svg className="logs-trend-line-svg" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
                      <rect className="logs-trend-grid-fill" x="0" y="0" width="100" height="42" rx="8" />
                      <line className="logs-trend-grid-line" x1="6" y1="34" x2="94" y2="34" />
                      {carbsTrendLine.hasData ? (
                        <>
                          <path className="logs-trend-area-fill fuel-trend-area-carbs" d={carbsTrendLine.areaPath} />
                          <polyline className="logs-trend-line-path fuel-trend-line-carbs" points={carbsTrendLine.polylinePoints} />
                        </>
                      ) : null}
                      {carbsTrendLine.points.map((point) => (
                        <g key={`carb-point-${point.key}`}>
                          <circle
                            className="logs-trend-hit"
                            cx={point.x}
                            cy={point.y}
                            r={4.2}
                            onClick={() => setSelectedMacroDay(point.dayKey)}
                          />
                          <circle
                            className={`logs-trend-point fuel-trend-point-carbs${point.active ? " active" : ""}`}
                            cx={point.x}
                            cy={point.y}
                            r={point.active ? 1.9 : 1.5}
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="logs-trend-axis">
                    {carbsTrendLine.points.map((point) => (
                      <button
                        type="button"
                        key={`carb-axis-${point.key}`}
                        className={`logs-trend-col-btn logs-trend-axis-btn${point.active ? " active" : ""}`}
                        onClick={() => setSelectedMacroDay(point.dayKey)}
                      >
                        <div className="logs-trend-label">{point.label}</div>
                        {point.value > 0 ? <span className="logs-trend-tip">{`${Math.round(point.value)} g`}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fuel-weekly-card">
                  <div className="logs-trend-head">
                    <div className="fuel-macro-label">Fat � 7 days</div>
                    <div className="logs-trend-value-pill fuel-trend-pill-fat">
                      {fatTrendLine.points.find((point) => point.active)?.value > 0
                        ? `${Math.round(fatTrendLine.points.find((point) => point.active)?.value || 0)} g`
                        : "No data"}
                    </div>
                  </div>
                  <div className="logs-trend-line-wrap">
                    <svg className="logs-trend-line-svg" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
                      <rect className="logs-trend-grid-fill" x="0" y="0" width="100" height="42" rx="8" />
                      <line className="logs-trend-grid-line" x1="6" y1="34" x2="94" y2="34" />
                      {fatTrendLine.hasData ? (
                        <>
                          <path className="logs-trend-area-fill fuel-trend-area-fat" d={fatTrendLine.areaPath} />
                          <polyline className="logs-trend-line-path fuel-trend-line-fat" points={fatTrendLine.polylinePoints} />
                        </>
                      ) : null}
                      {fatTrendLine.points.map((point) => (
                        <g key={`fat-point-${point.key}`}>
                          <circle
                            className="logs-trend-hit"
                            cx={point.x}
                            cy={point.y}
                            r={4.2}
                            onClick={() => setSelectedMacroDay(point.dayKey)}
                          />
                          <circle
                            className={`logs-trend-point fuel-trend-point-fat${point.active ? " active" : ""}`}
                            cx={point.x}
                            cy={point.y}
                            r={point.active ? 1.9 : 1.5}
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="logs-trend-axis">
                    {fatTrendLine.points.map((point) => (
                      <button
                        type="button"
                        key={`fat-axis-${point.key}`}
                        className={`logs-trend-col-btn logs-trend-axis-btn${point.active ? " active" : ""}`}
                        onClick={() => setSelectedMacroDay(point.dayKey)}
                      >
                        <div className="logs-trend-label">{point.label}</div>
                        {point.value > 0 ? <span className="logs-trend-tip">{`${Math.round(point.value)} g`}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>              <div className="fuel-intake-top">
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
            </div>

            <div style={{ display: showOverview ? undefined : "none" }}>
            <div className="hud-card-title">MEAL OF THE DAY</div>
            {mealOfDay ? (
              <div
                className="fuel-mealofday"
                role="button"
                tabIndex={0}
                onClick={() => openMealFromCard(mealOfDay)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openMealFromCard(mealOfDay);
                  }
                }}
              >
                <div className="fuel-tile-visual fuel-gradient-1 fuel-feature-visual">
                  <div className="fuel-tile-toprow">
                    <span className="fuel-tile-kicker">{mealOfDay.strCategory || "Daily pick"}</span>
                    {isCuratedMeal(mealOfDay) ? <span className="fuel-curated-badge">Curated</span> : null}
                  </div>
                  <span className="fuel-source-chip">{getRecipeSourceLabel(mealOfDay)}</span>
                  <button
                    type="button"
                    className={`fuel-heart-btn ${isRecipeFavorite(mealOfDay) ? "active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleRecipeFavorite(mealOfDay);
                    }}
                    aria-label={isRecipeFavorite(mealOfDay) ? "Remove favorite recipe" : "Save favorite recipe"}
                  >
                    {isRecipeFavorite(mealOfDay) ? "\u2665" : "\u2661"}
                  </button>
                  <span className="fuel-tile-open">Open recipe</span>
                </div>
                <div className="fuel-meal-body">
                  <div className="fuel-meal-name">{mealOfDay.strMeal}</div>
                  <div className="fuel-tile-meta">
                    {(() => {
                      const macros = getMealPreviewMacros(mealOfDay);
                      if (!macros.calories && !macros.protein && !macros.carbs && !macros.fat) {
                        return <span className="fuel-meta-chip">Macro preview in recipe</span>;
                      }
                      return (
                        <>
                          <span className="fuel-meta-chip">{Math.round(macros.calories)} kcal</span>
                          <span className="fuel-meta-chip">P {Math.round(macros.protein)}g</span>
                          <span className="fuel-meta-chip">C {Math.round(macros.carbs)}g</span>
                          <span className="fuel-meta-chip">F {Math.round(macros.fat)}g</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="hud-dim">Tap to open recipe + shopping list</div>
                </div>
              </div>
            ) : (
              loading ? (
                <div className="fuel-skeleton-feature" aria-hidden="true">
                  <div className="fuel-skeleton-shimmer fuel-skeleton-feature-top" />
                  <div className="fuel-skeleton-shimmer fuel-skeleton-feature-line w-80" />
                  <div className="fuel-skeleton-shimmer fuel-skeleton-feature-line w-55" />
                </div>
              ) : (
                <div className="hud-dim">
                  {curatedOnly
                    ? "No curated daily pick for this filter yet. Try another preference/time."
                    : "Loading daily pick…"}
                </div>
              )
            )}
            </div>
          </div>

          {/* RIGHT: Protocol feed */}
          <div className="hud-card" style={{ display: showOverview ? undefined : "none" }}>
            <div className="hud-card-title">PROTOCOL FEED</div>

            {error ? <div className="fuel-error">{error}</div> : null}

            {loading ? (
              <div className="fuel-skeleton-grid" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div className="fuel-skeleton-tile" key={`fuel-skeleton-${idx}`}>
                    <div className="fuel-skeleton-shimmer fuel-skeleton-visual" />
                    <div className="fuel-skeleton-shimmer fuel-skeleton-line w-85" />
                    <div className="fuel-skeleton-shimmer fuel-skeleton-line w-60" />
                  </div>
                ))}
              </div>
            ) : visibleProtocolMeals.length === 0 ? (
              <div className="hud-dim">
                {feedFilter === "favorites"
                  ? "No favorite recipes in this protocol yet."
                  : "No meals matched the current filters. Try a different preference or switch goal to Balanced."}
              </div>
            ) : (
              <div className="fuel-grid">
                {visibleProtocolMeals.map((m, index) => (
                  <div
                    key={m.idMeal}
                    className="fuel-tile"
                    role="button"
                    tabIndex={0}
                    onClick={() => openMealFromCard(m)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openMealFromCard(m);
                      }
                    }}
                  >
                    <div className={`fuel-tile-visual fuel-gradient-${(index % 4) + 1}`}>
                      <div className="fuel-tile-toprow">
                        <span className="fuel-tile-kicker">{m.strCategory || "Protocol recipe"}</span>
                        {isCuratedMeal(m) ? <span className="fuel-curated-badge">Curated</span> : null}
                      </div>
                      <span className="fuel-source-chip">{getRecipeSourceLabel(m)}</span>
                      <button
                        type="button"
                        className={`fuel-heart-btn ${isRecipeFavorite(m) ? "active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRecipeFavorite(m);
                        }}
                        aria-label={isRecipeFavorite(m) ? "Remove favorite recipe" : "Save favorite recipe"}
                      >
                        {isRecipeFavorite(m) ? "\u2665" : "\u2661"}
                      </button>
                      <span className="fuel-tile-open">Open</span>
                    </div>
                    <div className="fuel-tile-body">
                      <div className="fuel-tile-name">{m.strMeal}</div>
                      <div className="fuel-tile-meta">
                        {(() => {
                          const macros = getMealPreviewMacros(m);
                          if (!macros.calories && !macros.protein && !macros.carbs && !macros.fat) {
                            return <span className="fuel-meta-chip">Macro preview in recipe</span>;
                          }
                          return (
                            <>
                              <span className="fuel-meta-chip">{Math.round(macros.calories)} kcal</span>
                              <span className="fuel-meta-chip">P {Math.round(macros.protein)}g</span>
                              <span className="fuel-meta-chip">C {Math.round(macros.carbs)}g</span>
                              <span className="fuel-meta-chip">F {Math.round(macros.fat)}g</span>
                            </>
                          );
                        })()}
                      </div>
                      <div className="fuel-tile-sub">Open recipe</div>
                    </div>
                  </div>
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
              if (e.target === e.currentTarget) {
                setActiveMeal(null);
                setOffResults([]);
                setOffQuery("");
              }
            }}
          >
            <div className="fuel-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
              <div className="fuel-modal-top">
                <div>
                  <div className="fuel-modal-title">{activeMeal.strMeal}</div>
                  <div className="fuel-detail-tags">
                    <span className="fuel-tag">{getRecipeSourceLabel(activeMeal)}</span>
                    {isCuratedMeal(activeMeal) ? (
                      <span className="fuel-tag fuel-tag-curated">Curated recipe</span>
                    ) : null}
                    {(activeMeal?.__slotTags || []).map((slot) => (
                      <span className="fuel-tag" key={`slot-${slot}`}>
                        {getSlotLabel(slot)}
                      </span>
                    ))}
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
                    className={`studio-back fuel-save-btn ${isRecipeFavorite(activeMeal) ? "active" : ""}`}
                    type="button"
                    onClick={() => toggleRecipeFavorite(activeMeal)}
                  >
                    {isRecipeFavorite(activeMeal) ? "Favorited" : "Save favorite"}
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
                    <div className="fuel-detail-hero">
                      <span className="fuel-tile-kicker">{activeMeal.strCategory || "Recipe"}</span>
                      <div className="fuel-detail-hero-title">{activeMeal.strMeal}</div>
                      <span className="fuel-tile-open">Nutrition + shopping list</span>
                    </div>
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
                    {activeMeal?.__tip ? (
                      <div className="fuel-tip-card">
                        <div className="fuel-tip-title">Coach Tip</div>
                        <div className="fuel-tip-body">{activeMeal.__tip}</div>
                      </div>
                    ) : null}
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
              if (event.target === event.currentTarget) {
                setCustomRecipeOpen(false);
              }
            }}
          >
            <div className="community-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
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
              <div className="community-modal-actions fuel-custom-actions">
                <button className="studio-back hud-secondary-btn fuel-custom-action-btn" type="button" onClick={() => setCustomRecipeOpen(false)}>
                  Cancel
                </button>
                <button className="studio-back community-cta-btn fuel-custom-action-btn" type="button" onClick={handleCreateCustomRecipe}>
                  Share + Add to Logs
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="hud-dim" style={{ marginTop: 12 }}>
          Data sources: Curated local recipe library + TheMealDB + OpenFoodFacts.
        </div>
        {saveBanner ? (
          <div className="exervia-banner studio-banner success" style={{ marginTop: 12 }}>
            {saveBanner}
          </div>
        ) : null}
        <PageWalkthroughModal
          open={walkthroughOpen}
          onClose={() => setWalkthroughOpen(false)}
          mode={pageMode}
          userId={storedId}
          pageKey="nutrition"
          title="Nutrition Walkthrough"
          steps={NUTRITION_WALKTHROUGH_STEPS}
          onStepAction={handleWalkthroughAction}
        />
      </div>
    </div>
  );
}




