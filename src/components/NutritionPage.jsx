// src/components/NutritionPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { emptyDay, saveMealToLibrary, upsertDailyLog } from "../services/logsApi";
import { getLogsStore, getTodayLogKey, saveLogsStore } from "../services/logsStorage";
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
const OFF_SEARCH =
  "https://world.openfoodfacts.org/cgi/search.pl?json=1&page_size=8&search_terms=";

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

  const [offQuery, setOffQuery] = useState("");
  const [offResults, setOffResults] = useState([]);
  const [offLoading, setOffLoading] = useState(false);
  const [saveBanner, setSaveBanner] = useState("");

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
    // more options than before + scales with time window
    if (timeWindow === "15") return 6;
    if (timeWindow === "30") return 6;
    return 6;
  }, [timeWindow]);

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
    setLoading(true);
    setActiveMeal(null);

    try {
      /**
       * preference → sources (category if possible; fallback to name search)
       * Then: goal health-filter + shuffle + pick cap
       */
      let list = [];

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
        // add a small top-up from name search to diversify
        const extra = await mealdbSearchByName("chicken");
        list = [...list, ...extra];
      } else if (preference === "turkey") {
        // no reliable category; search is best
        const a = await mealdbSearchByName("turkey");
        const b = await mealdbSearchByName("ground turkey");
        list = [...a, ...b];
      } else if (preference === "chickpeas") {
        // search a few common terms
        const a = await mealdbSearchByName("chickpea");
        const b = await mealdbSearchByName("chickpeas");
        const c = await mealdbSearchByName("garbanzo");
        list = [...a, ...b, ...c];
      }

      // de-dup by idMeal
      const seen = new Set();
      list = list.filter((m) => {
        if (!m?.idMeal) return false;
        if (seen.has(m.idMeal)) return false;
        seen.add(m.idMeal);
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
          else if (preference === "turkey") raw = await mealdbSearchByName("turkey");
          else if (preference === "chickpeas") raw = await mealdbSearchByName("chickpea");
          raw = normalizeMealList(raw);
          const s2 = new Set();
          raw = raw.filter((m) => {
            if (!m?.idMeal) return false;
            if (s2.has(m.idMeal)) return false;
            s2.add(m.idMeal);
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

      // Shuffle so "Rebuild Protocol" visibly changes results
      const picked = clampList(shuffle(list), cap);
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

  const handleSaveMealToLogs = async () => {
    if (!activeMeal?.strMeal || !storedId) return;

    const mealName = String(activeMeal.strMeal).trim();
    const dayKey = getTodayLogKey();
    const local = getLogsStore(storedId);
    const currentDay = local.byDate?.[dayKey] || emptyDay();
    const alreadyLogged = (currentDay.meals || []).some(
      (entry) => String(entry?.text || "").trim().toLowerCase() === mealName.toLowerCase()
    );

    const nextDay = alreadyLogged
      ? currentDay
      : {
          ...currentDay,
          meals: [...(currentDay.meals || []), { id: `meal-${Date.now()}`, text: mealName }],
        };

    saveLogsStore(storedId, {
      ...local,
      byDate: {
        ...(local.byDate || {}),
        [dayKey]: nextDay,
      },
    });

    await Promise.all([saveMealToLibrary(storedId, mealName, "recipe"), upsertDailyLog(storedId, dayKey, nextDay)]);

    setSaveBanner(`${mealName} saved to Logs.`);
    navigate(pageMode === "athlete" ? `/athlete/${storedId}/logs` : `/gym/${storedId}/logs`);
  };

  // initial load
  useEffect(() => {
    fetchMealOfDay();
    fetchProtocolMeals();
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

          <button
            className="hud-primary-btn fuel-compact-btn"
            onClick={fetchProtocolMeals}
            disabled={loading}
          >
            {loading ? "Generating…" : "Generate New Meals"}
          </button>
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

