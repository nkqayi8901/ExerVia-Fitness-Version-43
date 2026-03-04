import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";
import { trackDailyActivity } from "../services/activityTracker";
import { grantXpEventSafe } from "../services/xpEvents";
import { emitToast } from "../utils/toast";
import { isErrorBanner } from "../utils/banner";
import curatedRecipes from "../data/recipes.json";
import {
  addSavedMeal,
  clearLogsTrainingPrefill,
  getLogsTrainingPrefill,
  getLogsStore,
  getTodayLogKey,
  saveLogsStore,
} from "../services/logsStorage";
import {
  addSupplementToLibrary,
  emptyDay,
  fetchDailyLogs,
  fetchSavedMeals,
  fetchSupplementLibrary,
  saveMealToLibrary,
  upsertDailyLog,
} from "../services/logsApi";
import PageWalkthroughModal from "./PageWalkthroughModal";

// This component is responsible for rendering the Logs page, which 
// includes daily logging of meals, supplements, extra activities, and 
// displaying training sessions for a given day.
// The component manages a complex state that includes the daily logs,
// training sessions, saved meals, supplement library, and various UI states.
// The component also handles interactions such as adding meals, supplements,
// extra activities, and viewing training session details.
// The code is structured with multiple useEffect hooks to handle 
// data fetching and state updates,
const EXTRA_ACTIVITY_TYPES = ["Yoga", "Pilates", "Sauna", "Steam", "Walk", "Mobility"];
const BASE_SUPPLEMENTS = [
  "Creatine",
  "Vitamin D3",
  "Omega-3",
  "Magnesium",
  "Protein Powder",
  "Electrolytes",
  "Multivitamin",
  "Vitamin K2",
];

const toDayKeyLocal = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Utility functions for normalizing and inferring log data, 
// formatting labels, and unit conversions.
// These functions help to maintain consistent data structures and
// provide user-friendly labels and insights based on the logged data.
// The isLegacyCompletion function checks if a log entry represents a 
// completed session based on its type and notes.
const isLegacyCompletion = (item) =>
  /program|session/i.test(String(item?.type || "")) && /completed/i.test(String(item?.notes || ""));

const isGenericTrainingLabel = (value) => /^(workout program|training program|program|session)$/i.test(String(value || "").trim());

const inferCompletionTitle = (item) => {
  const explicitTitle = String(item?.title || "").trim();
  if (explicitTitle && !isGenericTrainingLabel(explicitTitle)) return explicitTitle;

  const note = String(item?.notes || "").trim();
  const stripped = note.replace(/\s*completed\s*$/i, "").trim();
  if (stripped && !isGenericTrainingLabel(stripped)) return stripped;

  const type = String(item?.type || "").trim();
  if (type && !isGenericTrainingLabel(type)) return type;

  return "Completed Session";
};

const formatDateTimeLabel = (value) => {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
};

const toNumberSafe = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const parseDurationMinutes = (value) => {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const match = raw.match(/(\d+)/);
  return match ? Number(match[1] || 0) : 0;
};

const toKg = (value, unit) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return String(unit || "kg").toLowerCase() === "lbs" ? num * 0.453592 : num;
};

const toMl = (value, unit) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return String(unit || "ml").toLowerCase() === "liters" ? num * 1000 : num;
};

const LOGS_WALKTHROUGH_STEPS = [
  {
    id: "overview",
    title: "Use Day In A Glance",
    what: "Pick a day, then switch between Training, Meals, Supplements, and Extra Activities.",
    why: "You can quickly validate what got logged and remove accidental entries.",
    firstAction: "Open today's training details.",
  },
  {
    id: "weight_water",
    title: "Log Weight and Water",
    what: "Update body weight and hydration each day for trend consistency.",
    why: "Daily consistency gives cleaner trend lines over weekly windows.",
    firstAction: "Review today's weight/water cards.",
  },
  {
    id: "meals_supplements",
    title: "Track Fuel and Supplements",
    what: "Add meals and supplements for the selected day and save libraries for speed.",
    why: "This keeps nutrition records synced with your training day.",
    firstAction: "Add one meal or supplement.",
  },
  {
    id: "training_report",
    title: "Open Training Report",
    what: "Tap a logged session to open the detailed report and compare context.",
    why: "Reports are where set-level detail and progression checks are visible.",
    firstAction: "Open a session report.",
  },
];

// The LogsPage component is the main component for the logs page, which includes
// the logic for fetching and displaying daily logs, training sessions, and
// handling user interactions for logging meals, supplements, and extra activities.
// The component uses multiple useEffect hooks to manage data fetching and state updates,
// and useMemo to compute derived data for rendering the UI efficiently.
// The component also includes logic for handling loading states, error handling, and
// providing insights based on the logged data.
// The component relies on various services for data fetching and state management,
// and uses utility functions for data normalization and formatting.
export default function LogsPage({ mode = "gym" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const todayKey = getTodayLogKey();
  const safeTodayKey = /^\d{4}-\d{2}-\d{2}$/.test(String(todayKey || ""))
    ? String(todayKey)
    : toDayKeyLocal(new Date());

  const [selectedDay, setSelectedDay] = useState(safeTodayKey);
  const [dailyLogsByDate, setDailyLogsByDate] = useState({});
  const [savedMeals, setSavedMeals] = useState([]);
  const [supplementLibrary, setSupplementLibrary] = useState([]);
  const [mealInput, setMealInput] = useState("");
  const [saveMealLibrary, setSaveMealLibrary] = useState(true);
  const [customSupplement, setCustomSupplement] = useState("");
  const [extraType, setExtraType] = useState("Yoga");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [trainingRows, setTrainingRows] = useState([]);
  const [activeTrainingReport, setActiveTrainingReport] = useState(null);
  const [banner, setBanner] = useState("");
  const [logsBootLoading, setLogsBootLoading] = useState(true);
  const [trainingBootLoading, setTrainingBootLoading] = useState(true);
  const [glanceDetail, setGlanceDetail] = useState("training");
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [weightGoalKg, setWeightGoalKg] = useState("");
  const [waterGoalMl, setWaterGoalMl] = useState("2000");
  const logsRequestRef = useRef(0);
  const trainingRequestRef = useRef(0);
  const normalizeDayLog = useCallback((candidate) => {
    const defaults = {
      weightValue: "",
      weightUnit: "kg",
      waterAmount: "",
      waterUnit: "ml",
      meals: [],
      supplementsTaken: [],
      extraActivities: [],
    };
    const fallback = typeof emptyDay === "function" ? emptyDay() : null;
    const source = candidate && typeof candidate === "object" ? candidate : fallback;
    if (!source || typeof source !== "object") return { ...defaults };
    return {
      ...defaults,
      ...source,
      meals: Array.isArray(source.meals) ? source.meals : [],
      supplementsTaken: Array.isArray(source.supplementsTaken) ? source.supplementsTaken : [],
      extraActivities: Array.isArray(source.extraActivities) ? source.extraActivities : [],
    };
  }, []);

  const withTimeout = async (promise, timeoutMs, label = "Request timed out") => {
    let timeoutHandle = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };
// The component includes various useEffect hooks for handling data fetching and state updates,
// such as fetching daily logs, training sessions, and managing loading states and error handling.
// The component also includes logic for computing derived data such
//  as the training sessions for the selected day,
// meal suggestions based on user input, and insights based on the logged data.
// The component also handles user interactions for logging meals, supplements, 
// extra activities, and viewing training session details, and 
// provides feedback through banners and toasts.
  useEffect(() => {
    const dayParam = String(searchParams.get("day") || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayParam)) return;
    setSelectedDay(dayParam);
  }, [searchParams]);

  useEffect(() => {
    const reportParam = String(searchParams.get("report") || "").trim();
    if (!reportParam || !trainingRows.length) return;
    const match = trainingRows.find((row) => {
      const rowId = String(row?.id || "").trim();
      const sourceRowId = String(row?.sourceRowId || "").trim();
      const compositeId = `${String(row?.sourceType || "").trim()}:${sourceRowId}`;
      return reportParam === rowId || reportParam === sourceRowId || reportParam === compositeId;
    });
    if (match) openTrainingReport(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, trainingRows]);

  useEffect(() => {
    if (!banner) return;
    const timeout = setTimeout(() => setBanner(""), 2600);
    return () => clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    if (!banner) return;
    const isErrorLike = isErrorBanner(banner);
    emitToast(String(banner), isErrorLike ? "error" : "info", isErrorLike ? 3600 : 2800);
  }, [banner]);

  useEffect(() => {
    if (!activeTrainingReport) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setActiveTrainingReport(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeTrainingReport]);

  useEffect(() => {
    if (!id) return;
    const raw = localStorage.getItem(`exervia_logs_goals_${id}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.weightGoalKg !== undefined) setWeightGoalKg(String(parsed.weightGoalKg));
      if (parsed?.waterGoalMl !== undefined) setWaterGoalMl(String(parsed.waterGoalMl));
    } catch {
      // ignore invalid goal cache
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    localStorage.setItem(
      `exervia_logs_goals_${id}`,
      JSON.stringify({
        weightGoalKg: weightGoalKg || "",
        waterGoalMl: waterGoalMl || "",
      })
    );
  }, [id, waterGoalMl, weightGoalKg]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      const requestId = logsRequestRef.current + 1;
      logsRequestRef.current = requestId;
      setLogsBootLoading(true);
      try {
        const [logsMap, meals, supplements] = await withTimeout(
          Promise.all([fetchDailyLogs(id), fetchSavedMeals(id), fetchSupplementLibrary(id)]),
          8000,
          "Logs bootstrap timed out"
        );
        if (logsRequestRef.current !== requestId) return;

        const local = getLogsStore(id) || {};
        const mergedLogs = { ...((local && local.byDate) || {}), ...(logsMap || {}) };
        const mergedMeals = [...(meals || [])];
        (((local && local.savedMeals) || [])).forEach((item) => {
          if (!mergedMeals.some((meal) => String(meal.name).toLowerCase() === String(item.name).toLowerCase())) {
            mergedMeals.push(item);
          }
        });
        const mergedSupps = Array.from(new Set([...(supplements || []), ...(((local && local.supplementLibrary) || []))]));

        setDailyLogsByDate(mergedLogs);
        setSavedMeals(mergedMeals);
        setSupplementLibrary(mergedSupps);
      } catch (error) {
        console.error("Logs bootstrap failed:", error);
        if (logsRequestRef.current === requestId) {
          const local = getLogsStore(id) || {};
          setDailyLogsByDate(((local && local.byDate) || {}));
          setSavedMeals(((local && local.savedMeals) || []));
          setSupplementLibrary(((local && local.supplementLibrary) || []));
          setBanner("Loaded local logs. Cloud sync is slow right now.");
        }
      } finally {
        if (logsRequestRef.current === requestId) {
          setLogsBootLoading(false);
        }
      }
    };

    run();
  }, [id]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      const requestId = trainingRequestRef.current + 1;
      trainingRequestRef.current = requestId;
      setTrainingBootLoading(true);
      try {
        const [trainingRes, strengthRes] = await withTimeout(
          Promise.all([
            supabase
              .from("training_sessions")
              .select("*")
              .eq("user_id", id)
              .order("created_at", { ascending: false })
              .limit(120),
            supabase
              .from("strength_logs")
              .select("*")
              .eq("user_id", id)
              .order("created_at", { ascending: false })
              .limit(120),
          ]),
          9000,
          "Training logs timed out"
        );
        if (trainingRequestRef.current !== requestId) return;

        const combined = [
        ...(trainingRes.data || []).map((row) => ({
          id: `train-${row.id}`,
          sourceRowId: row.id,
          sourceType: "training_session",
          created_at: row.created_at,
          title:
            String(row?.metrics?.plan_name || row?.metrics?.program_name || "").trim() ||
            `${String(row.sport || "Training").toUpperCase()} session`,
          detail: `${row.duration_minutes || 0} min`,
          report: {
            sport: row.sport || "training",
            durationMinutes: row.duration_minutes || 0,
            distanceKm: row?.distance_km || row?.metrics?.distance || row?.metrics?.distance_km || "",
            heartRate: row?.heart_rate || row?.metrics?.heart_rate || row?.metrics?.heartRate || "",
            mood: row?.mood || row?.mood_emoji || row?.metrics?.mood || row?.metrics?.mood_emoji || "",
            planName: row?.metrics?.plan_name || row?.metrics?.program_name || "",
            notes: row?.notes || row?.metrics?.notes || "",
          },
        })),
        ...(strengthRes.data || []).map((row) => ({
          id: `lift-${row.id}`,
          sourceRowId: row.id,
          sourceType: "strength_log",
          created_at: row.created_at,
          title: row.exercise_name || "Strength session",
          detail: `${row.sets_completed || row.sets || 0} sets · ${row.reps_completed || row.reps || 0} reps`,
          report: {
            exerciseName: row.exercise_name || "Strength lift",
            sets: row.sets_completed || row.sets || 0,
            reps: row.reps_completed || row.reps || 0,
            weight: row.weight || "",
            effort: row.effort || row.mood || "",
            notes: row.notes || "",
          },
        })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setTrainingRows(combined);
      } catch (error) {
        console.error("Training rows load failed:", error);
        if (trainingRequestRef.current === requestId) {
          setBanner("Could not refresh training logs right now.");
        }
      } finally {
        if (trainingRequestRef.current === requestId) {
          setTrainingBootLoading(false);
        }
      }
    };

    run();
  }, [id]);

  const selectedLog = useMemo(() => {
    const existing = dailyLogsByDate[selectedDay];
    return normalizeDayLog(existing);
  }, [dailyLogsByDate, normalizeDayLog, selectedDay]);
  const trainingByDay = useMemo(() => {
    const map = {};
    trainingRows.forEach((row) => {
      const key = toDayKeyLocal(row.created_at);
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return map;
  }, [trainingRows]);

  const dayTraining = useMemo(() => trainingByDay[selectedDay] || [], [trainingByDay, selectedDay]);
  const allExtraActivities = useMemo(
    () => (selectedLog && typeof selectedLog === "object" ? selectedLog.extraActivities || [] : []),
    [selectedLog]
  );
  const sessionCompletionEntries = useMemo(
    () =>
      allExtraActivities.filter(
        (item) => item?.source === "session_completion" || isLegacyCompletion(item)
      ),
    [allExtraActivities]
  );
  const loggedExtraActivities = useMemo(
    () =>
      allExtraActivities.filter(
        (item) => item?.source !== "session_completion" && !isLegacyCompletion(item)
      ),
    [allExtraActivities]
  );

  const combinedTrainingItems = useMemo(
    () => {
      const displayTrainingTitle =
        dayTraining
          .map((row) => String(row.title || "").trim())
          .find((value) => value && !/session$/i.test(value)) || "";
      let completionRows = sessionCompletionEntries
        .map((item) => {
          const reportTitle = String(
            item?.report?.title ||
            item?.report?.programName ||
            item?.report?.planName ||
            item?.report?.details?.title ||
            ""
          ).trim();
          const inferred = inferCompletionTitle(item);
          const isGeneric = isGenericTrainingLabel(inferred) || /^completed session$/i.test(inferred);
          const fallbackTitle = reportTitle || displayTrainingTitle || "Completed Session";
          return {
            id: item.id,
            sourceType: "session_completion",
            created_at: item.created_at || null,
            title: reportTitle || (isGeneric ? fallbackTitle : inferred),
            detail: `${item.minutes ? `${item.minutes} min` : "No duration"}${item.notes ? ` · ${item.notes}` : ""}`,
            report: {
              source: item.source || "session_completion",
              minutes: item.minutes || "",
              notes: item.notes || "",
              details: item.report || null,
            },
          };
        })
        .filter(Boolean);

      // If a day has only raw strength logs, synthesize one session-level completion row
      // so the user still gets the classic report entry.
      if (!completionRows.length) {
        const sameDayStrength = dayTraining.filter((row) => row.sourceType === "strength_log");
        if (sameDayStrength.length >= 2) {
          const titleFromNotes = sameDayStrength
            .map((row) => String(row?.report?.notes || "").trim())
            .find((note) => /completed|completion/i.test(note));
          const inferredTitle = titleFromNotes
            ? inferCompletionTitle({ notes: titleFromNotes, type: "Workout Program" })
            : "";
          const normalizedExerciseNames = new Set(
            sameDayStrength
              .map((row) => String(row?.report?.exerciseName || row?.title || "").trim().toLowerCase())
              .filter(Boolean)
          );
          const inferredIsExerciseName =
            inferredTitle && normalizedExerciseNames.has(String(inferredTitle).trim().toLowerCase());
          const fallbackTitle =
            (!inferredIsExerciseName && inferredTitle) ||
            displayTrainingTitle ||
            "Strength Session";

          const ordered = [...sameDayStrength].sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          );
          const startMs = new Date(ordered[0]?.created_at || 0).getTime();
          const endMs = new Date(ordered[ordered.length - 1]?.created_at || 0).getTime();
          const durationMinutes = Number.isFinite(startMs) && Number.isFinite(endMs)
            ? Math.max(1, Math.round((endMs - startMs) / 60000))
            : 1;

          const exercises = ordered.map((row, index) => ({
            id: row.sourceRowId || row.id || `exercise-${index}`,
            name: row.report?.exerciseName || row.title || `Exercise ${index + 1}`,
            sets: Number(row.report?.sets || 0),
            reps: row.report?.reps || "",
            weight: Number(row.report?.weight || 0),
          }));

          const totalTonnage = exercises.reduce((sum, exercise) => {
            const sets = Number(exercise.sets || 0);
            const repsRaw = String(exercise.reps || "").trim().toLowerCase();
            if (!sets || repsRaw.includes("failure")) return sum;
            const reps = Number(exercise.reps || 0);
            const weight = Number(exercise.weight || 0);
            if (!reps || !weight) return sum;
            return sum + sets * reps * weight;
          }, 0);

          completionRows = [
            {
              id: `summary-${selectedDay}`,
              sourceType: "session_completion",
              created_at: ordered[ordered.length - 1]?.created_at || null,
              title: fallbackTitle,
              detail: `${durationMinutes} min · ${fallbackTitle} completed`,
              report: {
                source: "derived_strength_summary",
                minutes: durationMinutes,
                notes: `${fallbackTitle} completed`,
                details: {
                  category: "workout_program",
                  title: fallbackTitle,
                  duration: `${durationMinutes} min`,
                  totalExercises: exercises.length,
                  totalTonnage,
                  exercises,
                },
              },
            },
          ];
        }
      }

      const completionExerciseNames = new Set(
        completionRows
          .flatMap((row) => (Array.isArray(row?.report?.details?.exercises) ? row.report.details.exercises : []))
          .map((exercise) => String(exercise?.name || "").trim().toLowerCase())
          .filter(Boolean)
      );

      const filteredDayTraining = completionExerciseNames.size
        ? dayTraining.filter((row) => {
            if (row.sourceType !== "strength_log") return true;
            const exerciseName = String(row.report?.exerciseName || row.title || "").trim().toLowerCase();
            if (!exerciseName) return true;
            return !completionExerciseNames.has(exerciseName);
          })
        : dayTraining;

      return [
        ...completionRows,
        ...filteredDayTraining.map((row) => ({
          id: row.id,
          sourceType: row.sourceType,
          created_at: row.created_at,
          title: row.title,
          detail: row.detail,
          report: row.report || {},
        })),
      ];
    },
    [dayTraining, selectedDay, sessionCompletionEntries]
  );

  const visibleSupplements = useMemo(
    () => Array.from(new Set([...BASE_SUPPLEMENTS, ...supplementLibrary])),
    [supplementLibrary]
  );
  const mealCatalog = useMemo(() => {
    const curatedTitles = Array.isArray(curatedRecipes)
      ? curatedRecipes.map((recipe) => String(recipe?.title || "").trim()).filter(Boolean)
      : [];
    const savedTitles = (savedMeals || []).map((meal) => String(meal?.name || "").trim()).filter(Boolean);
    const merged = [...savedTitles, ...curatedTitles];
    const seen = new Set();
    return merged.filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [savedMeals]);
  const mealSuggestions = useMemo(() => {
    const query = String(mealInput || "").trim().toLowerCase();
    if (query.length < 2) return [];
    return mealCatalog.filter((name) => name.toLowerCase().includes(query)).slice(0, 8);
  }, [mealCatalog, mealInput]);

  const dayGlance = useMemo(
    () => ({
      trainingCount: combinedTrainingItems.length,
      mealCount: (selectedLog.meals || []).length,
      supplementCount: (selectedLog.supplementsTaken || []).length,
      extraCount: loggedExtraActivities.length,
      weight:
        selectedLog.weightValue !== "" && selectedLog.weightValue !== null
          ? `${selectedLog.weightValue} ${selectedLog.weightUnit}`
          : "Not logged",
      water:
        selectedLog.waterAmount !== "" && selectedLog.waterAmount !== null
          ? `${selectedLog.waterAmount} ${selectedLog.waterUnit}`
          : "Not logged",
    }),
    [combinedTrainingItems.length, loggedExtraActivities.length, selectedLog]
  );

  const sevenDayTrend = useMemo(() => {
    const result = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = toDayKeyLocal(date);
      const day = normalizeDayLog(dailyLogsByDate[key]);
      result.push({
        key,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        weightKg: toKg(day.weightValue, day.weightUnit || "kg"),
        waterMl: toMl(day.waterAmount, day.waterUnit || "ml"),
      });
    }
    return result;
  }, [dailyLogsByDate, normalizeDayLog]);

  const maxWeightInTrend = Math.max(1, ...sevenDayTrend.map((row) => row.weightKg || 0));
  const maxWaterInTrend = Math.max(1, ...sevenDayTrend.map((row) => row.waterMl || 0));
  const lastLoggedWeight = useMemo(() => {
    const entries = Object.entries(dailyLogsByDate || {})
      .filter(([dayKey, log]) => {
        if (dayKey === selectedDay) return false;
        const day = normalizeDayLog(log);
        return day.weightValue !== "" && day.weightValue !== null && Number(day.weightValue) > 0;
      })
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
    if (!entries.length) return "";
    const [dayKey, log] = entries[0];
    const day = normalizeDayLog(log);
    const dateLabel = new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${day.weightValue} ${day.weightUnit || "kg"} (${dateLabel})`;
  }, [dailyLogsByDate, normalizeDayLog, selectedDay]);
  const weightInputSuggestions = useMemo(() => {
    if (String(selectedLog?.weightUnit || "kg").toLowerCase() === "lbs") {
      return [95, 115, 135, 155, 185, 205, 225, 245, 275, 315];
    }
    return [40, 50, 60, 70, 80, 90, 100, 110, 120, 130];
  }, [selectedLog?.weightUnit]);

  const deriveCompletionExercises = useCallback((reportRow) => {
    if (!reportRow || reportRow.sourceType !== "session_completion") return [];
    const details = reportRow.report?.details || null;
    if (!details || details.category !== "workout_program") return [];

    const existing = Array.isArray(details.exercises) ? details.exercises : [];
    const expectedCount = Number(details.totalExercises || 0);
    if (existing.length >= 2 && (!expectedCount || existing.length >= expectedCount)) {
      return existing;
    }

    const normalizeProgramToken = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\b(completed|completion|workout program|training program|program|session)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const dayKey = toDayKeyLocal(reportRow.created_at);
    const sameDayStrength = (trainingByDay[dayKey] || []).filter((item) => item.sourceType === "strength_log");

    const completionTitle = String(reportRow.title || details.title || "").trim().toLowerCase();
    const completionNotes = String(reportRow.report?.notes || "").trim().toLowerCase();
    const normalizedTokens = Array.from(
      new Set(
        [
          completionTitle,
          completionNotes,
          String(details?.title || ""),
          String(details?.programName || ""),
          String(details?.planName || ""),
        ]
          .map(normalizeProgramToken)
          .filter((value) => value.length >= 3)
      )
    );
    const completionCreatedAtMs = new Date(reportRow.created_at || 0).getTime();
    const byNoteOrTitle = trainingRows.filter((item) => {
      if (item.sourceType !== "strength_log") return false;
      const note = String(item?.report?.notes || "").trim().toLowerCase();
      const normalizedNote = normalizeProgramToken(note);
      const label = String(item?.title || item?.report?.exerciseName || "").trim().toLowerCase();
      const createdAtMs = new Date(item.created_at || 0).getTime();
      const closeInTime =
        Number.isFinite(completionCreatedAtMs) && Number.isFinite(createdAtMs)
          ? Math.abs(createdAtMs - completionCreatedAtMs) <= 24 * 60 * 60 * 1000
          : false;
      const noteMatch = !!normalizedNote && normalizedTokens.some((token) => normalizedNote.includes(token));
      const labelHint = normalizedTokens.some((token) => token && label && token.includes(label));
      return noteMatch || (closeInTime && labelHint);
    });
    const byTimeWindow = trainingRows.filter((item) => {
      if (item.sourceType !== "strength_log") return false;
      const createdAtMs = new Date(item.created_at || 0).getTime();
      if (!Number.isFinite(completionCreatedAtMs) || !Number.isFinite(createdAtMs)) return false;
      return Math.abs(createdAtMs - completionCreatedAtMs) <= 3 * 60 * 60 * 1000;
    });

    const candidateRows =
      sameDayStrength.length >= 2
        ? sameDayStrength
        : byNoteOrTitle.length >= 2
          ? byNoteOrTitle
          : byTimeWindow.length >= 2
            ? byTimeWindow
          : sameDayStrength;
    if (candidateRows.length < 2) return existing;

    const dedupedByName = new Map();
    [...candidateRows]
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .forEach((item, index) => {
        const name = String(item?.report?.exerciseName || item?.title || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        dedupedByName.set(key, {
          id: item.sourceRowId || item.id || `exercise-${index}`,
          name,
          sets: Number(item?.report?.sets || 0),
          reps: item?.report?.reps || "",
          weight: Number(item?.report?.weight || 0),
        });
      });

    const rebuilt = Array.from(dedupedByName.values());
    return rebuilt.length > existing.length ? rebuilt : existing;
  }, [trainingByDay, trainingRows]);

  const allSessionCompletions = useMemo(() => {
    const rows = [];
    Object.entries(dailyLogsByDate || {}).forEach(([dayKey, log]) => {
      (log?.extraActivities || []).forEach((item, index) => {
        if (!(item?.source === "session_completion" || isLegacyCompletion(item))) return;
        const inferred = inferCompletionTitle(item);
        rows.push({
          id: item.id || `completion-${dayKey}-${index}`,
          title: inferred,
          created_at: item.created_at || `${dayKey}T23:59:59`,
          report: item.report || null,
        });
      });
    });
    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [dailyLogsByDate]);

  const reportInsights = useMemo(() => {
    if (!activeTrainingReport) return null;

    if (activeTrainingReport.sourceType === "strength_log") {
      const currentCreatedAt = new Date(activeTrainingReport.created_at || 0).getTime();
      const currentName = String(
        activeTrainingReport.report?.exerciseName || activeTrainingReport.title || ""
      ).trim().toLowerCase();
      const sameExercise = trainingRows.filter((row) => {
        if (row.sourceType !== "strength_log") return false;
        if (row.id === activeTrainingReport.id) return false;
        const rowName = String(row.report?.exerciseName || row.title || "").trim().toLowerCase();
        return rowName && rowName === currentName;
      });
      const previous = sameExercise
        .filter((row) => new Date(row.created_at || 0).getTime() < currentCreatedAt)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

      const currentSets = toNumberSafe(activeTrainingReport.report?.sets);
      const currentReps = toNumberSafe(activeTrainingReport.report?.reps);
      const currentWeight = toNumberSafe(activeTrainingReport.report?.weight);
      const currentVolume = currentSets * currentReps * currentWeight;

      const prevSets = toNumberSafe(previous?.report?.sets);
      const prevReps = toNumberSafe(previous?.report?.reps);
      const prevWeight = toNumberSafe(previous?.report?.weight);
      const prevVolume = prevSets * prevReps * prevWeight;

      const bestWeightBefore = sameExercise.reduce(
        (best, row) => Math.max(best, toNumberSafe(row.report?.weight)),
        0
      );
      const bestVolumeBefore = sameExercise.reduce((best, row) => {
        const sets = toNumberSafe(row.report?.sets);
        const reps = toNumberSafe(row.report?.reps);
        const weight = toNumberSafe(row.report?.weight);
        return Math.max(best, sets * reps * weight);
      }, 0);

      return {
        previousLabel: previous
          ? `${previous.detail || "Previous session"} (${formatDateTimeLabel(previous.created_at)})`
          : "No previous session for this exercise yet.",
        deltas: previous
          ? {
              weight: currentWeight - prevWeight,
              reps: currentReps - prevReps,
              sets: currentSets - prevSets,
              volume: currentVolume - prevVolume,
            }
          : null,
        deltaComparable: previous
          ? {
              weight: prevWeight > 0,
              reps: prevReps > 0,
              sets: prevSets > 0,
              volume: prevVolume > 0,
            }
          : null,
        prs: {
          weight: currentWeight > 0 && currentWeight > bestWeightBefore,
          volume: currentVolume > 0 && currentVolume > bestVolumeBefore,
        },
      };
    }

    if (activeTrainingReport.sourceType === "session_completion") {
      const details = activeTrainingReport.report?.details || null;
      if (details?.category !== "workout_program") return null;
      const currentTitle = String(activeTrainingReport.title || "").trim().toLowerCase();
      const currentCreatedAt = new Date(activeTrainingReport.created_at || 0).getTime();
      const previous = allSessionCompletions
        .filter((row) => {
          if (String(row.id) === String(activeTrainingReport.id)) return false;
          if (String(row.title || "").trim().toLowerCase() !== currentTitle) return false;
          return new Date(row.created_at || 0).getTime() < currentCreatedAt;
        })
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

      const prevDetails = previous?.report || null;
      const currentExercises = deriveCompletionExercises(activeTrainingReport);
      const previousExercises = previous
        ? deriveCompletionExercises({
            sourceType: "session_completion",
            created_at: previous.created_at,
            report: { details: prevDetails || null },
          })
        : [];

      const previousByExercise = {};
      previousExercises.forEach((exercise) => {
        const key = String(exercise?.name || "").trim().toLowerCase();
        if (!key) return;
        const currentMax = toNumberSafe(previousByExercise[key]?.weight);
        const nextWeight = toNumberSafe(exercise?.weight);
        if (nextWeight >= currentMax) previousByExercise[key] = exercise;
      });

      const bestByExerciseBefore = {};
      allSessionCompletions.forEach((row) => {
        if (String(row.title || "").trim().toLowerCase() !== currentTitle) return;
        if (String(row.id) === String(activeTrainingReport.id)) return;
        const rowTime = new Date(row.created_at || 0).getTime();
        if (rowTime >= currentCreatedAt) return;
        const exercises = deriveCompletionExercises({
          sourceType: "session_completion",
          created_at: row.created_at,
          report: { details: row.report || null },
        });
        exercises.forEach((exercise) => {
          const key = String(exercise?.name || "").trim().toLowerCase();
          if (!key) return;
          const bestWeight = toNumberSafe(bestByExerciseBefore[key]?.weight);
          const nextWeight = toNumberSafe(exercise?.weight);
          if (nextWeight >= bestWeight) bestByExerciseBefore[key] = exercise;
        });
      });

      const exercisePRs = {};
      currentExercises.forEach((exercise) => {
        const key = String(exercise?.name || "").trim().toLowerCase();
        if (!key) return;
        const currentWeight = toNumberSafe(exercise?.weight);
        const previousBest = toNumberSafe(bestByExerciseBefore[key]?.weight);
        exercisePRs[key] = currentWeight > 0 && currentWeight > previousBest;
      });

      const currentTonnage = toNumberSafe(details.totalTonnage);
      const previousTonnage = toNumberSafe(prevDetails?.totalTonnage);

      return {
        previousLabel: previous
          ? `${previous.title} (${formatDateTimeLabel(previous.created_at)})`
          : "No previous completion found for this program yet.",
        deltas: previous
          ? {
              tonnage: currentTonnage - previousTonnage,
              exercises:
                toNumberSafe(details.totalExercises) - toNumberSafe(prevDetails?.totalExercises),
              sets: toNumberSafe(details.totalSets) - toNumberSafe(prevDetails?.totalSets),
              duration:
                parseDurationMinutes(details.duration) -
                parseDurationMinutes(prevDetails?.duration),
            }
          : null,
        prs: {
          tonnage: currentTonnage > 0 && currentTonnage > previousTonnage,
          exerciseWeight: exercisePRs,
        },
        previousByExercise,
      };
    }

    return null;
  }, [activeTrainingReport, trainingRows, allSessionCompletions, deriveCompletionExercises]);

  const activeCompletionExercises = useMemo(
    () => deriveCompletionExercises(activeTrainingReport),
    [activeTrainingReport, deriveCompletionExercises]
  );

  const markActivity = async (actionKey = "logs_activity", baseXp = 10, sourceId = "") => {
    if (!id) return;
    const dayKey = selectedDay || todayKey;
    try {
      const xpResult = await withTimeout(grantXpEventSafe({
        userId: id,
        eventType: "streak_bonus",
        baseXp,
        idempotencyKey: `logs:${dayKey}:${actionKey}`,
        sourceTable: "daily_logs",
        sourceId: String(sourceId || dayKey),
        meta: { day: dayKey, action: actionKey },
      }), 4500, "Logs XP timed out");
      await withTimeout(trackDailyActivity(id, "logs_entry"), 3500, "Logs activity timed out");
      await withTimeout(recalcUserState(id), 3500, "Logs state sync timed out");
      window.dispatchEvent(new Event("user_state_updated"));
      return {
        awardedXp: Number(xpResult.awardedXp || 0),
        xpError: Boolean(xpResult.error),
      };
    } catch (error) {
      console.error("Logs markActivity failed:", error);
      return { awardedXp: 0, xpError: true };
    }
  };

  const patchDayLogLocal = useCallback((dayKey, updater) => {
    setDailyLogsByDate((prev) => {
      const current = normalizeDayLog(prev[dayKey]);
      return { ...prev, [dayKey]: updater(current) };
    });
  }, [normalizeDayLog]);

  const applyDayLogUpdate = useCallback((dayKey, updater) => {
    let nextLog = null;
    setDailyLogsByDate((prev) => {
      const current = normalizeDayLog(prev[dayKey]);
      nextLog = updater(current);
      return { ...prev, [dayKey]: nextLog };
    });
    return nextLog;
  }, [normalizeDayLog]);

  const saveDayLog = useCallback(async (dayKey, log) => {
    if (!id || !log) return false;

    const local = getLogsStore(id) || {};
    const nextLocal = {
      ...local,
      byDate: {
        ...(((local && local.byDate) || {})),
        [dayKey]: log,
      },
    };
    saveLogsStore(id, nextLocal);

    const ok = await withTimeout(upsertDailyLog(id, dayKey, log), 7000, "Daily log sync timed out");
    if (!ok) {
      setBanner("Saved locally. Cloud sync will work after logs tables are active.");
    }
    return ok;
  }, [id]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      const pending = getLogsTrainingPrefill(id);
      if (!pending) return;
      const dayKey = pending.dayKey || todayKey;
      setSelectedDay(dayKey);
      const next = applyDayLogUpdate(dayKey, (current) => ({
        ...current,
        extraActivities: [
          ...(current.extraActivities || []),
          {
            id: `extra-${Date.now()}`,
            source: pending.source || "session_completion",
            type: pending.type || "Workout",
            title: pending.title || pending.type || "Session",
            minutes: pending.minutes || "",
            notes: pending.notes || pending.title || "",
            report: pending.report || null,
          },
        ],
      }));
      try {
        await saveDayLog(dayKey, next);
        clearLogsTrainingPrefill(id);
        setBanner("Session moved into Logs.");
      } catch (error) {
        console.error("Logs prefill apply failed:", error);
        setBanner("Could not move session into Logs right now.");
      }
    };

    run();
  }, [applyDayLogUpdate, id, saveDayLog, todayKey]);

  const applyWeight = async () => {
    const value = Number(selectedLog.weightValue);
    const max = selectedLog.weightUnit === "lbs" ? 500 : 227;
    if (!Number.isFinite(value) || value <= 0 || value > max) {
      setBanner(`Weight must be between 1 and ${max} ${selectedLog.weightUnit}.`);
      return;
    }
    try {
      await saveDayLog(selectedDay, selectedLog);
      const xp = await markActivity("weight", 10, selectedDay);
      setBanner(xp.awardedXp > 0 ? `Weight logged. +${xp.awardedXp} XP earned.` : "Weight logged.");
    } catch (error) {
      console.error("Weight log failed:", error);
      setBanner("Could not save weight right now.");
    }
  };

  const applyWater = async () => {
    const value = Number(selectedLog.waterAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setBanner("Enter a valid water amount.");
      return;
    }
    try {
      await saveDayLog(selectedDay, selectedLog);
      const xp = await markActivity("water", 10, selectedDay);
      setBanner(xp.awardedXp > 0 ? `Water logged. +${xp.awardedXp} XP earned.` : "Water logged.");
    } catch (error) {
      console.error("Water log failed:", error);
      setBanner("Could not save water right now.");
    }
  };

  const addMealEntry = async () => {
    if (!id) return;
    const text = mealInput.trim();
    if (!text) return;
    const next = applyDayLogUpdate(selectedDay, (log) => ({
      ...log,
      meals: [...(log.meals || []), { id: `meal-${Date.now()}`, text }],
    }));
    try {
      await saveDayLog(selectedDay, next);

      if (saveMealLibrary) {
        const ok = await saveMealToLibrary(id, text, "manual");
        if (!ok) addSavedMeal(id, text, "manual");

        const cloudMeals = await fetchSavedMeals(id);
        const local = getLogsStore(id) || {};
        const merged = [...(cloudMeals || [])];
        (((local && local.savedMeals) || [])).forEach((item) => {
          if (!merged.some((meal) => String(meal.name).toLowerCase() === String(item.name).toLowerCase())) {
            merged.push(item);
          }
        });
        setSavedMeals(merged);
      }

      setMealInput("");
      const xp = await markActivity("meal", 12, selectedDay);
      setBanner(xp.awardedXp > 0 ? `Meal logged. +${xp.awardedXp} XP earned.` : "Meal logged.");
    } catch (error) {
      console.error("Meal log failed:", error);
      setBanner("Could not add meal right now.");
    }
  };

  const toggleSupplement = async (name) => {
    const wasTaken = (selectedLog.supplementsTaken || []).includes(name);
    const next = applyDayLogUpdate(selectedDay, (log) => {
      const taken = new Set(log.supplementsTaken || []);
      if (taken.has(name)) taken.delete(name);
      else taken.add(name);
      return { ...log, supplementsTaken: Array.from(taken) };
    });
    try {
      await saveDayLog(selectedDay, next);
      const xp = await markActivity("supplement", 8, selectedDay);
      const actionLabel = wasTaken ? "Supplement removed." : "Supplement logged.";
      setBanner(xp?.awardedXp > 0 ? `${actionLabel} +${xp.awardedXp} XP earned.` : actionLabel);
    } catch (error) {
      console.error("Supplement toggle failed:", error);
      setBanner("Could not update supplement right now.");
    }
  };

  const addSupplement = async () => {
    const name = customSupplement.trim();
    if (!name) return;
    try {
      const ok = await addSupplementToLibrary(id, name);
      if (!ok) {
        const local = getLogsStore(id) || {};
        const next = {
          ...local,
          supplementLibrary: Array.from(new Set([...(((local && local.supplementLibrary) || [])), name])),
        };
        saveLogsStore(id, next);
      }

      const cloudSupps = await fetchSupplementLibrary(id);
      const local = getLogsStore(id) || {};
      setSupplementLibrary(Array.from(new Set([...(cloudSupps || []), ...(((local && local.supplementLibrary) || []))])));
      setCustomSupplement("");
      setBanner("Supplement added to library.");
    } catch (error) {
      console.error("Add supplement failed:", error);
      setBanner("Could not add supplement right now.");
    }
  };

  const addExtraActivity = async () => {
    if (!extraType) return;
    const next = applyDayLogUpdate(selectedDay, (log) => ({
      ...log,
      extraActivities: [
        ...(log.extraActivities || []),
        {
          id: `extra-${Date.now()}`,
          type: extraType,
          minutes: extraMinutes || "",
          notes: extraNotes || "",
        },
      ],
    }));
    try {
      await saveDayLog(selectedDay, next);
      setExtraMinutes("");
      setExtraNotes("");
      const xp = await markActivity("extra_activity", 12, selectedDay);
      setBanner(xp.awardedXp > 0 ? `Extra activity logged. +${xp.awardedXp} XP earned.` : "Extra activity logged.");
    } catch (error) {
      console.error("Extra activity log failed:", error);
      setBanner("Could not log extra activity right now.");
    }
  };

  const removeMealEntry = async (mealId) => {
    const next = applyDayLogUpdate(selectedDay, (log) => ({
      ...log,
      meals: (log.meals || []).filter((meal) => meal.id !== mealId),
    }));
    try {
      await saveDayLog(selectedDay, next);
      setBanner("Meal removed from this day.");
    } catch (error) {
      console.error("Remove meal failed:", error);
      setBanner("Could not remove meal right now.");
    }
  };

  const removeSupplementEntry = async (name) => {
    const next = applyDayLogUpdate(selectedDay, (log) => ({
      ...log,
      supplementsTaken: (log.supplementsTaken || []).filter((supplement) => supplement !== name),
    }));
    try {
      await saveDayLog(selectedDay, next);
      setBanner("Supplement removed from this day.");
    } catch (error) {
      console.error("Remove supplement failed:", error);
      setBanner("Could not remove supplement right now.");
    }
  };

  const removeExtraActivityEntry = async (activityId) => {
    const next = applyDayLogUpdate(selectedDay, (log) => ({
      ...log,
      extraActivities: (log.extraActivities || []).filter((item) => item.id !== activityId),
    }));
    try {
      await saveDayLog(selectedDay, next);
      setBanner("Activity removed from this day.");
    } catch (error) {
      console.error("Remove activity failed:", error);
      setBanner("Could not remove activity right now.");
    }
  };

  const removeTrainingEntry = async (row) => {
    if (!row || !id) return;
    if (row.sourceType === "session_completion") {
      if (String(row.report?.source || "") === "derived_strength_summary") {
        setBanner("Remove individual lift rows to edit this derived session summary.");
        return;
      }
      await removeExtraActivityEntry(row.id);
      return;
    }

    const sourceId = row.sourceRowId || String(row.id || "").split("-").slice(1).join("-");
    if (!sourceId) return;

    if (row.sourceType === "training_session") {
      const { error } = await supabase.from("training_sessions").delete().eq("id", sourceId).eq("user_id", id);
      if (error) {
        setBanner("Could not remove training session right now.");
        return;
      }
      setTrainingRows((prev) => prev.filter((item) => String(item.id) !== String(row.id)));
      setBanner("Training session removed.");
      return;
    }

    if (row.sourceType === "strength_log") {
      const { error } = await supabase.from("strength_logs").delete().eq("id", sourceId).eq("user_id", id);
      if (error) {
        setBanner("Could not remove training plan entry right now.");
        return;
      }
      setTrainingRows((prev) => prev.filter((item) => String(item.id) !== String(row.id)));
      setBanner("Training plan entry removed.");
    }
  };

  function openTrainingReport(row) {
    if (!row) return;
    if (row.sourceType === "strength_log") {
      const strengthDayKey = toDayKeyLocal(row.created_at);
      const completionMatch = combinedTrainingItems.find((item) => {
        if (item?.sourceType !== "session_completion") return false;
        if (String(item?.report?.details?.category || "") !== "workout_program") return false;
        return toDayKeyLocal(item.created_at) === strengthDayKey;
      });
      if (completionMatch) {
        setActiveTrainingReport(completionMatch);
        return;
      }
    }
    setActiveTrainingReport(row);
  }

  const backPath = mode === "athlete" ? `/athlete/${id}` : `/gym/${id}`;
  const isBootLoading = logsBootLoading || trainingBootLoading;
  const handleWalkthroughAction = (step) => {
    const stepId = String(step?.id || "");
    if (stepId === "overview") {
      setGlanceDetail("training");
      return;
    }
    if (stepId === "training_report") {
      const firstTraining = (dayTraining || [])[0];
      if (firstTraining) {
        openTrainingReport(firstTraining);
        return;
      }
      setBanner("Log a training session first to open a report.");
      return;
    }
    if (stepId === "weight_water") {
      setBanner("Use the Weight and Water cards below to update daily values.");
      return;
    }
    if (stepId === "meals_supplements") {
      setBanner("Use Meals and Supplements sections below to log today's intake.");
    }
  };

  if (isBootLoading) {
    return (
      <div className="page-shell logs-shell">
        <div className="page-header">
          <div>
            <button className="studio-back" onClick={() => navigate(backPath)} type="button">
              {"Back"}
            </button>
            <h2 className="page-title">Logs</h2>
            <p className="page-subtitle">Your daily command center for body, fuel, hydration, and training.</p>
          </div>
          <div className="studio-header-actions">
            <button className="studio-back studio-header-action-btn" type="button" onClick={() => setWalkthroughOpen(true)}>
              Walkthrough
            </button>
          </div>
        </div>
        <div className="logs-loading-skeleton" aria-hidden="true">
          <div className="logs-skeleton-card">
            <div className="logs-skeleton-line w-45" />
            <div className="logs-skeleton-grid">
              <div className="logs-skeleton-pill" />
              <div className="logs-skeleton-pill" />
              <div className="logs-skeleton-pill" />
              <div className="logs-skeleton-pill" />
            </div>
          </div>
          <div className="logs-skeleton-card">
            <div className="logs-skeleton-line w-60" />
            <div className="logs-skeleton-row" />
            <div className="logs-skeleton-row" />
            <div className="logs-skeleton-row" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell logs-shell">
      <div className="page-header">
        <div>
          <button className="studio-back" onClick={() => navigate(backPath)} type="button">
            {"Back"}
          </button>
          <h2 className="page-title">Logs</h2>
          <p className="page-subtitle">Your daily command center for body, fuel, hydration, and training.</p>
        </div>
        <div className="studio-header-actions">
          <button className="studio-back studio-header-action-btn" type="button" onClick={() => setWalkthroughOpen(true)}>
            Walkthrough
          </button>
        </div>
      </div>

      {banner ? <div className="exervia-banner studio-banner success">{banner}</div> : null}

      <div className="hud-card logs-top-card">
        <div className="logs-top-row">
          <div className="studio-panel-title logs-panel-title">Day In A Glance</div>
          <div className="logs-day-controls">
            <div className="logs-viewing-day">
              Viewing:{" "}
              <span>
                {new Date(selectedDay || todayKey).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <input
              className="studio-form-input logs-date-input"
              type="date"
              value={selectedDay}
              onChange={(event) => setSelectedDay(event.target.value || todayKey)}
              max={todayKey}
            />
          </div>
        </div>
        <div className="logs-top-note">Tap a card to inspect details and clean up accidental entries.</div>

        <div className="logs-glance-grid">
          <button type="button" className={`logs-glance-card ${glanceDetail === "training" ? "active" : ""}`} onClick={() => setGlanceDetail("training")}>
            <div className="logs-glance-label">Training</div>
            <div className="logs-glance-value">{dayGlance.trainingCount}</div>
          </button>
          <button type="button" className={`logs-glance-card ${glanceDetail === "meals" ? "active" : ""}`} onClick={() => setGlanceDetail("meals")}>
            <div className="logs-glance-label">Meals</div>
            <div className="logs-glance-value">{dayGlance.mealCount}</div>
          </button>
          <button type="button" className={`logs-glance-card ${glanceDetail === "supplements" ? "active" : ""}`} onClick={() => setGlanceDetail("supplements")}>
            <div className="logs-glance-label">Supplements</div>
            <div className="logs-glance-value">{dayGlance.supplementCount}</div>
          </button>
          <button type="button" className={`logs-glance-card ${glanceDetail === "extras" ? "active" : ""}`} onClick={() => setGlanceDetail("extras")}>
            <div className="logs-glance-label">Extra Activities</div>
            <div className="logs-glance-value">{dayGlance.extraCount}</div>
          </button>
        </div>

        <div className="logs-week-summary logs-day-metrics">
          <div className="logs-day-metric-card">
            <span className="logs-day-metric-label">Weight</span>
            <span className="logs-day-metric-value">{dayGlance.weight}</span>
          </div>
          <div className="logs-day-metric-card">
            <span className="logs-day-metric-label">Water</span>
            <span className="logs-day-metric-value">{dayGlance.water}</span>
          </div>
        </div>
        <div className="logs-trend-grid">
          <div className="logs-trend-card">
            <div className="logs-trend-title">Weight trend (7 days)</div>
            <div className="logs-trend-bars">
              {sevenDayTrend.map((row) => (
                <button
                  type="button"
                  key={`weight-${row.key}`}
                  className={`logs-trend-col logs-trend-col-btn${selectedDay === row.key ? " active" : ""}`}
                  onClick={() => setSelectedDay(row.key)}
                >
                  <div className="logs-trend-track">
                    <div
                      className="logs-trend-fill"
                      style={{ height: `${row.weightKg > 0 ? Math.max(6, (row.weightKg / maxWeightInTrend) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="logs-trend-label">{row.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="logs-trend-card">
            <div className="logs-trend-title">Hydration trend (7 days)</div>
            <div className="logs-trend-bars">
              {sevenDayTrend.map((row) => (
                <button
                  type="button"
                  key={`water-${row.key}`}
                  className={`logs-trend-col logs-trend-col-btn${selectedDay === row.key ? " active" : ""}`}
                  onClick={() => setSelectedDay(row.key)}
                >
                  <div className="logs-trend-track">
                    <div
                      className="logs-trend-fill alt"
                      style={{ height: `${row.waterMl > 0 ? Math.max(6, (row.waterMl / maxWaterInTrend) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="logs-trend-label">{row.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="logs-list">
          {glanceDetail === "training" &&
            (combinedTrainingItems.length ? (
              combinedTrainingItems.map((row) => (
                <div key={row.id} className="logs-list-row">
                  <div className="logs-list-main">
                    <button type="button" className="logs-link-btn" onClick={() => openTrainingReport(row)}>
                      {row.title}
                    </button>
                    <div className="logs-list-sub">{row.detail}</div>
                  </div>
                  <button
                    className="logs-row-delete"
                    type="button"
                    onClick={() =>
                      String(row.id || "").startsWith("extra-")
                        ? removeExtraActivityEntry(row.id)
                        : removeTrainingEntry(row)
                    }
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="logs-list-row">No training logged for this day.</div>
            ))}

          {glanceDetail === "meals" &&
            ((selectedLog.meals || []).length ? (
              (selectedLog.meals || []).map((meal) => (
                <div key={meal.id} className="logs-list-row">
                  <div className="logs-list-main">
                    <div className="logs-list-title">{meal.text}</div>
                  </div>
                  <button className="logs-row-delete" type="button" onClick={() => removeMealEntry(meal.id)}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="logs-list-row">No meals logged for this day.</div>
            ))}

          {glanceDetail === "supplements" &&
            ((selectedLog.supplementsTaken || []).length ? (
              (selectedLog.supplementsTaken || []).map((supp) => (
                <div key={supp} className="logs-list-row">
                  <div className="logs-list-main">
                    <div className="logs-list-title">{supp}</div>
                  </div>
                  <button className="logs-row-delete" type="button" onClick={() => removeSupplementEntry(supp)}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="logs-list-row">No supplements logged for this day.</div>
            ))}

          {glanceDetail === "extras" &&
            (loggedExtraActivities.length ? (
              loggedExtraActivities.map((item) => (
                <div key={item.id} className="logs-list-row">
                  <div className="logs-list-main">
                    <div className="logs-list-title">{item.type}</div>
                    <div className="logs-list-sub">
                      {item.minutes ? `${item.minutes} min` : "No duration"}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </div>
                  </div>
                  <button className="logs-row-delete" type="button" onClick={() => removeExtraActivityEntry(item.id)}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="logs-list-row">No extra activities logged for this day.</div>
            ))}
        </div>
      </div>

      <div className="grid-2 logs-grid">
        <div className="hud-card">
          <div className="hud-card-title">Weight</div>
          <div className="hud-dim">How is the weight looking today? Keep it honest and consistent.</div>
          <div className="logs-goal-note">
            {lastLoggedWeight ? `Last logged: ${lastLoggedWeight}` : "No previous weight logged yet."}
          </div>
          <div className="logs-row">
            <input
              className="studio-form-input"
              type="number"
              list="logs-weight-suggestions"
              value={selectedLog.weightValue}
              onChange={(event) => patchDayLogLocal(selectedDay, (log) => ({ ...log, weightValue: event.target.value }))}
              placeholder={selectedLog.weightUnit === "lbs" ? "max 500" : "max 227"}
            />
            <datalist id="logs-weight-suggestions">
              {weightInputSuggestions.map((value) => (
                <option key={`weight-suggestion-${value}`} value={value} />
              ))}
            </datalist>
            <select
              className="studio-select"
              value={selectedLog.weightUnit}
              onChange={(event) => patchDayLogLocal(selectedDay, (log) => ({ ...log, weightUnit: event.target.value }))}
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
            <button className="studio-back logs-action-btn" type="button" onClick={applyWeight}>Save</button>
          </div>
        </div>

        <div className="hud-card">
          <div className="hud-card-title">Water</div>
          <div className="hud-dim">Were you able to hit at least 2000ml today?</div>
          <div className="logs-row">
            <input
              className="studio-form-input"
              type="number"
              value={selectedLog.waterAmount}
              onChange={(event) => patchDayLogLocal(selectedDay, (log) => ({ ...log, waterAmount: event.target.value }))}
              placeholder="e.g. 2500"
            />
            <select
              className="studio-select"
              value={selectedLog.waterUnit}
              onChange={(event) => patchDayLogLocal(selectedDay, (log) => ({ ...log, waterUnit: event.target.value }))}
            >
              <option value="ml">ml</option>
              <option value="liters">liters</option>
            </select>
            <button className="studio-back logs-action-btn" type="button" onClick={applyWater}>Save</button>
          </div>
        </div>

        <div className="hud-card">
          <div className="hud-card-title">Meals</div>
          <div className="logs-row">
            <input
              className="studio-form-input"
              value={mealInput}
              onChange={(event) => setMealInput(event.target.value)}
              placeholder="Meal 1: chicken + rice"
            />
            <button className="studio-back logs-action-btn" onClick={addMealEntry} type="button">Add meal</button>
          </div>
          {mealSuggestions.length > 0 && (
            <div className="logs-suggestions" role="listbox" aria-label="Meal suggestions">
              {mealSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="logs-suggestion-btn"
                  onClick={() => setMealInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <label className="logs-inline-check">
            <input type="checkbox" checked={saveMealLibrary} onChange={(event) => setSaveMealLibrary(event.target.checked)} />
            Save into my meal library
          </label>

          {savedMeals.length > 0 && (
            <div className="logs-chip-row">
              {savedMeals.map((meal) => (
                <button key={meal.id} className="logs-chip" type="button" onClick={() => setMealInput(meal.name)}>
                  {meal.name}
                </button>
              ))}
            </div>
          )}

          <div className="logs-list">
            {(selectedLog.meals || []).map((meal) => (
              <div className="logs-list-row" key={meal.id}>{meal.text}</div>
            ))}
          </div>
        </div>

        <div className="hud-card">
          <div className="hud-card-title">Supplements</div>
          <div className="logs-row">
            <input
              className="studio-form-input"
              value={customSupplement}
              onChange={(event) => setCustomSupplement(event.target.value)}
              placeholder="Add supplement to library"
            />
            <button className="studio-back logs-action-btn" type="button" onClick={addSupplement}>Add</button>
          </div>
          <div className="logs-chip-row">
            {visibleSupplements.map((supp) => (
              <button
                key={supp}
                className={`logs-chip ${(selectedLog.supplementsTaken || []).includes(supp) ? "active" : ""}`}
                type="button"
                onClick={() => toggleSupplement(supp)}
              >
                {supp}
              </button>
            ))}
          </div>
        </div>

        <div className="hud-card">
          <div className="hud-card-title">Today's Training</div>
          {combinedTrainingItems.length === 0 ? (
            <div className="hud-dim logs-empty-note">No training captured for this day yet.</div>
          ) : (
            <div className="logs-list">
              {combinedTrainingItems.map((row) => (
                <div key={row.id} className="logs-list-row">
                  <div className="logs-list-main">
                    <button type="button" className="logs-link-btn" onClick={() => openTrainingReport(row)}>
                      {row.title}
                    </button>
                    <div className="logs-list-sub">{row.detail}</div>
                  </div>
                  <button
                    className="logs-row-delete"
                    type="button"
                    onClick={() =>
                      String(row.id || "").startsWith("extra-")
                        ? removeExtraActivityEntry(row.id)
                        : removeTrainingEntry(row)
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="hud-divider" />

          <div className="logs-row">
            <select className="studio-select" value={extraType} onChange={(event) => setExtraType(event.target.value)}>
              {EXTRA_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              className="studio-form-input"
              value={extraMinutes}
              onChange={(event) => setExtraMinutes(event.target.value)}
              placeholder="Minutes"
            />
          </div>

          <div className="logs-row">
            <input
              className="studio-form-input"
              value={extraNotes}
              onChange={(event) => setExtraNotes(event.target.value)}
              placeholder="Notes (optional)"
            />
            <button className="studio-back logs-action-btn" type="button" onClick={addExtraActivity}>Log activity</button>
          </div>

          <div className="logs-list">
            {loggedExtraActivities.map((item) => (
              <div key={item.id} className="logs-list-row">
                <div className="logs-list-main">
                  <div className="logs-list-title">{item.type}</div>
                  <div className="logs-list-sub">
                    {item.minutes ? `${item.minutes} min` : "No duration"}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </div>
                </div>
                <button className="logs-row-delete" type="button" onClick={() => removeExtraActivityEntry(item.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeTrainingReport && (
        <div className="community-modal-backdrop" onClick={() => setActiveTrainingReport(null)}>
          <div className="community-modal logs-report-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="community-modal-title">Training Report</div>
            <div className="logs-report-head">
              <div className="logs-report-title">{activeTrainingReport.title}</div>
              <div className="logs-report-meta">{formatDateTimeLabel(activeTrainingReport.created_at)}</div>
            </div>
            <div className="logs-list">
              <div className="logs-list-row">
                <div className="logs-list-main">
                  <div className="logs-list-title">Summary</div>
                  <div className="logs-list-sub">{activeTrainingReport.detail}</div>
                </div>
              </div>
              {activeTrainingReport.sourceType === "training_session" && (
                <>
                  <div className="logs-list-row">
                    <div className="logs-list-main">
                      <div className="logs-list-title">Sport</div>
                      <div className="logs-list-sub">{String(activeTrainingReport.report?.sport || "Training").toUpperCase()}</div>
                    </div>
                  </div>
                  {activeTrainingReport.report?.planName ? (
                    <div className="logs-list-row">
                      <div className="logs-list-main">
                        <div className="logs-list-title">Plan / Program</div>
                        <div className="logs-list-sub">{activeTrainingReport.report.planName}</div>
                      </div>
                    </div>
                  ) : null}
                  {(activeTrainingReport.report?.distanceKm || activeTrainingReport.report?.heartRate || activeTrainingReport.report?.mood) ? (
                    <div className="logs-list-row">
                      <div className="logs-list-main">
                        <div className="logs-list-title">Session Metrics</div>
                        <div className="logs-list-sub">
                          {activeTrainingReport.report?.distanceKm ? `${activeTrainingReport.report.distanceKm} km` : "No distance"}
                          {activeTrainingReport.report?.heartRate ? ` · ${activeTrainingReport.report.heartRate} bpm` : ""}
                          {activeTrainingReport.report?.mood ? ` · ${activeTrainingReport.report.mood}` : ""}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              {activeTrainingReport.sourceType === "strength_log" && (
                <>
                  <div className="logs-list-row">
                    <div className="logs-list-main">
                      <div className="logs-list-title">Exercise</div>
                      <div className="logs-list-sub">{activeTrainingReport.report?.exerciseName || activeTrainingReport.title}</div>
                    </div>
                  </div>
                  <div className="logs-list-row">
                    <div className="logs-list-main">
                      <div className="logs-list-title">Sets / Reps / Weight</div>
                      <div className="logs-list-sub">
                        {(activeTrainingReport.report?.sets ?? 0)} sets · {(activeTrainingReport.report?.reps ?? 0)} reps
                        {activeTrainingReport.report?.weight ? ` · ${activeTrainingReport.report.weight} kg` : ""}
                        {(() => {
                          const sets = Number(activeTrainingReport.report?.sets || 0);
                          const repsRaw = String(activeTrainingReport.report?.reps ?? "").trim().toLowerCase();
                          if (repsRaw.includes("failure")) return " · Volume N/A (failure)";
                          const reps = Number(activeTrainingReport.report?.reps || 0);
                          const weight = Number(activeTrainingReport.report?.weight || 0);
                          const volume = sets > 0 && reps > 0 && weight > 0 ? sets * reps * weight : 0;
                          return volume > 0 ? ` · ${volume.toLocaleString()} kg volume` : "";
                        })()}
                      </div>
                    </div>
                  </div>
                  {(activeTrainingReport.report?.effort || activeTrainingReport.report?.notes) ? (
                    <div className="logs-list-row">
                      <div className="logs-list-main">
                        <div className="logs-list-title">Session Notes</div>
                        <div className="logs-list-sub">
                          {activeTrainingReport.report?.effort ? `${activeTrainingReport.report.effort}` : "No effort note"}
                          {activeTrainingReport.report?.notes ? ` · ${activeTrainingReport.report.notes}` : ""}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {reportInsights?.previousLabel ? (
                    <div className="logs-list-row">
                      <div className="logs-list-main">
                        <div className="logs-list-title">Compared to Previous</div>
                        <div className="logs-list-sub">{reportInsights.previousLabel}</div>
                      </div>
                    </div>
                  ) : null}
                  {reportInsights?.deltas ? (
                    <div className="logs-list-row">
                      <div className="logs-list-main">
                        <div className="logs-list-title">Change</div>
                        <div className="logs-list-sub">
                          {[
                            reportInsights?.deltaComparable?.weight
                              ? `Weight ${reportInsights.deltas.weight >= 0 ? "+" : ""}${reportInsights.deltas.weight} kg`
                              : null,
                            reportInsights?.deltaComparable?.reps
                              ? `Reps ${reportInsights.deltas.reps >= 0 ? "+" : ""}${reportInsights.deltas.reps}`
                              : null,
                            reportInsights?.deltaComparable?.sets
                              ? `Sets ${reportInsights.deltas.sets >= 0 ? "+" : ""}${reportInsights.deltas.sets}`
                              : null,
                            reportInsights?.deltaComparable?.volume
                              ? `Volume ${reportInsights.deltas.volume >= 0 ? "+" : ""}${reportInsights.deltas.volume.toLocaleString()} kg`
                              : null,
                          ].filter(Boolean).join(" · ") || "Not enough previous data for comparison."}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {(reportInsights?.prs?.weight || reportInsights?.prs?.volume) ? (
                    <div className="logs-list-row">
                      <div className="logs-list-main">
                        <div className="logs-list-title">PR Flags</div>
                        <div className="logs-list-sub">
                          {reportInsights?.prs?.weight ? "Heaviest load PR" : ""}
                          {reportInsights?.prs?.weight && reportInsights?.prs?.volume ? " · " : ""}
                          {reportInsights?.prs?.volume ? "Session volume PR" : ""}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              {activeTrainingReport.sourceType === "session_completion" && (
                <>
                  <div className="logs-list-row">
                    <div className="logs-list-main">
                      <div className="logs-list-title">Completion Notes</div>
                      <div className="logs-list-sub">{activeTrainingReport.report?.notes || "Session completion synced from training flow."}</div>
                    </div>
                  </div>
                  {activeTrainingReport.report?.details?.category === "workout_program" && (
                    <>
                      {reportInsights?.previousLabel ? (
                        <div className="logs-list-row">
                          <div className="logs-list-main">
                            <div className="logs-list-title">Compared to Previous</div>
                            <div className="logs-list-sub">{reportInsights.previousLabel}</div>
                          </div>
                        </div>
                      ) : null}
                      {reportInsights?.deltas ? (
                        <div className="logs-list-row">
                          <div className="logs-list-main">
                            <div className="logs-list-title">Change</div>
                            <div className="logs-list-sub">
                              {`Volume ${reportInsights.deltas.tonnage >= 0 ? "+" : ""}${reportInsights.deltas.tonnage.toLocaleString()} kg`}
                              {` · Exercises ${reportInsights.deltas.exercises >= 0 ? "+" : ""}${reportInsights.deltas.exercises}`}
                              {` · Sets ${reportInsights.deltas.sets >= 0 ? "+" : ""}${reportInsights.deltas.sets}`}
                              {` · Duration ${reportInsights.deltas.duration >= 0 ? "+" : ""}${reportInsights.deltas.duration} min`}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="logs-list-row">
                        <div className="logs-list-main">
                          <div className="logs-list-title">Program Overview</div>
                          <div className="logs-list-sub">
                            {Math.max(
                              Number(activeTrainingReport.report?.details?.totalExercises || 0),
                              activeCompletionExercises.length
                            )} exercises
                            {activeTrainingReport.report?.details?.duration ? ` · ${activeTrainingReport.report?.details?.duration}` : ""}
                            {(() => {
                              const exercises = activeCompletionExercises || [];
                              const hasFailure = exercises.some((exercise) =>
                                String(exercise?.reps || "").toLowerCase().includes("failure")
                              );
                              const tonnage = Number(activeTrainingReport.report?.details?.totalTonnage || 0);
                              if (tonnage > 0) return ` · ${tonnage.toLocaleString()} kg volume`;
                              if (hasFailure) return " · Volume N/A (failure sets)";
                              return "";
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="logs-program-report">
                        <div className="logs-program-report-head">
                          <span className="logs-program-report-col exercise">Exercise</span>
                          <span className="logs-program-report-col">Sets</span>
                          <span className="logs-program-report-col">Rep Range</span>
                          <span className="logs-program-report-col">Weight (kg)</span>
                        </div>
                        <div className="logs-program-report-body">
                          {(activeCompletionExercises || []).map((exercise, index) => (
                            <div key={`${activeTrainingReport.id}-exercise-${index}-${exercise.id || "no-id"}`} className="logs-program-report-row">
                              <span className="logs-program-report-col exercise">
                                {exercise.name || `Exercise ${index + 1}`}
                                {(() => {
                                  const key = String(exercise?.name || "").trim().toLowerCase();
                                  return reportInsights?.prs?.exerciseWeight?.[key] ? " · PR" : "";
                                })()}
                              </span>
                              <span className="logs-program-report-col">{Number(exercise.sets) || 0}</span>
                              <span className="logs-program-report-col">{exercise.reps || "custom"}</span>
                              <span className="logs-program-report-col">
                                {Number(exercise.weight) > 0 ? exercise.weight : "-"}
                                {(() => {
                                  const key = String(exercise?.name || "").trim().toLowerCase();
                                  const prev = reportInsights?.previousByExercise?.[key];
                                  const prevWeight = Number(prev?.weight || 0);
                                  const currentWeight = Number(exercise?.weight || 0);
                                  if (prevWeight <= 0 || currentWeight <= 0) return "";
                                  const delta = currentWeight - prevWeight;
                                  if (delta === 0) return "";
                                  return ` (${delta >= 0 ? "+" : ""}${delta})`;
                                })()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="community-modal-actions">
              <button className="studio-back logs-action-btn" type="button" onClick={() => setActiveTrainingReport(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <PageWalkthroughModal
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        mode={mode}
        userId={id}
        pageKey="logs"
        title="Logs Walkthrough"
        steps={LOGS_WALKTHROUGH_STEPS}
        onStepAction={handleWalkthroughAction}
      />
    </div>
  );
}


