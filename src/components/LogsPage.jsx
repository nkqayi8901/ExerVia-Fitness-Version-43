import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";
import { trackDailyActivity } from "../services/activityTracker";
import {
  addSavedMeal,
  consumeLogsTrainingPrefill,
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

export default function LogsPage({ mode = "gym" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const todayKey = getTodayLogKey();

  const [selectedDay, setSelectedDay] = useState(todayKey);
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
  const [glanceDetail, setGlanceDetail] = useState("training");
  const [weightGoalKg, setWeightGoalKg] = useState("");
  const [waterGoalMl, setWaterGoalMl] = useState("2000");

  useEffect(() => {
    if (!banner) return;
    const timeout = setTimeout(() => setBanner(""), 2600);
    return () => clearTimeout(timeout);
  }, [banner]);

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
      const [logsMap, meals, supplements] = await Promise.all([
        fetchDailyLogs(id),
        fetchSavedMeals(id),
        fetchSupplementLibrary(id),
      ]);

      const local = getLogsStore(id);
      const mergedLogs = { ...(local.byDate || {}), ...(logsMap || {}) };
      const mergedMeals = [...(meals || [])];
      (local.savedMeals || []).forEach((item) => {
        if (!mergedMeals.some((meal) => String(meal.name).toLowerCase() === String(item.name).toLowerCase())) {
          mergedMeals.push(item);
        }
      });
      const mergedSupps = Array.from(new Set([...(supplements || []), ...(local.supplementLibrary || [])]));

      setDailyLogsByDate(mergedLogs);
      setSavedMeals(mergedMeals);
      setSupplementLibrary(mergedSupps);
    };

    run();
  }, [id]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      const [trainingRes, strengthRes] = await Promise.all([
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
      ]);

      const combined = [
        ...(trainingRes.data || []).map((row) => ({
          id: `train-${row.id}`,
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
    };

    run();
  }, [id]);

  const selectedLog = useMemo(() => dailyLogsByDate[selectedDay] || emptyDay(), [dailyLogsByDate, selectedDay]);
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
  const allExtraActivities = useMemo(() => selectedLog.extraActivities || [], [selectedLog]);
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
      const normalizedTrainingTitles = new Set(
        dayTraining
          .map((row) => String(row.title || "").trim().toLowerCase())
          .filter((value) => value && !/session$/i.test(value))
      );

      const completionRows = sessionCompletionEntries
        .map((item) => {
          const inferred = inferCompletionTitle(item);
          const isGeneric = isGenericTrainingLabel(inferred) || /^completed session$/i.test(inferred);
          if (isGeneric && normalizedTrainingTitles.size > 0) {
            return null;
          }
          return {
            id: item.id,
            sourceType: "session_completion",
            created_at: item.created_at || null,
            title: inferred,
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
        ...filteredDayTraining.map((row) => ({
          id: row.id,
          sourceType: row.sourceType,
          created_at: row.created_at,
          title: row.title,
          detail: row.detail,
          report: row.report || {},
        })),
        ...completionRows,
      ];
    },
    [dayTraining, sessionCompletionEntries]
  );

  const visibleSupplements = useMemo(
    () => Array.from(new Set([...BASE_SUPPLEMENTS, ...supplementLibrary])),
    [supplementLibrary]
  );

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
      const day = dailyLogsByDate[key] || emptyDay();
      result.push({
        key,
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        weightKg: toKg(day.weightValue, day.weightUnit || "kg"),
        waterMl: toMl(day.waterAmount, day.waterUnit || "ml"),
      });
    }
    return result;
  }, [dailyLogsByDate]);

  const maxWeightInTrend = Math.max(1, ...sevenDayTrend.map((row) => row.weightKg || 0));
  const maxWaterInTrend = Math.max(1, ...sevenDayTrend.map((row) => row.waterMl || 0));
  const selectedWeightKg = toKg(selectedLog.weightValue, selectedLog.weightUnit || "kg");
  const selectedWaterMl = toMl(selectedLog.waterAmount, selectedLog.waterUnit || "ml");
  const weightGoalStatus =
    Number(weightGoalKg) > 0 && selectedWeightKg > 0
      ? `${selectedWeightKg >= Number(weightGoalKg) ? "On/above" : "Below"} target by ${Math.abs(
          selectedWeightKg - Number(weightGoalKg)
        ).toFixed(1)} kg`
      : "Set a target weight to track progress";
  const waterGoalStatus =
    Number(waterGoalMl) > 0 && selectedWaterMl > 0
      ? `${selectedWaterMl >= Number(waterGoalMl) ? "Hydration goal hit" : "Hydration goal pending"} (${Math.round(
          selectedWaterMl
        )}/${Math.round(Number(waterGoalMl))} ml)`
      : "Set a hydration goal to track consistency";

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
      const currentExercises = Array.isArray(details.exercises) ? details.exercises : [];
      const previousExercises = Array.isArray(prevDetails?.exercises) ? prevDetails.exercises : [];

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
        const exercises = Array.isArray(row.report?.exercises) ? row.report.exercises : [];
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
  }, [activeTrainingReport, trainingRows, allSessionCompletions]);

  const markActivity = async () => {
    if (!id) return;
    await trackDailyActivity(id, "logs_entry");
    await recalcUserState(id);
    window.dispatchEvent(new Event("user_state_updated"));
  };

  const patchDayLogLocal = useCallback((dayKey, updater) => {
    setDailyLogsByDate((prev) => {
      const current = prev[dayKey] || emptyDay();
      return { ...prev, [dayKey]: updater(current) };
    });
  }, []);

  const nextDayLog = useCallback((dayKey, updater) => {
    const current = dailyLogsByDate[dayKey] || emptyDay();
    return updater(current);
  }, [dailyLogsByDate]);

  const saveDayLog = useCallback(async (dayKey, log) => {
    if (!id || !log) return false;

    const local = getLogsStore(id);
    const nextLocal = {
      ...local,
      byDate: {
        ...(local.byDate || {}),
        [dayKey]: log,
      },
    };
    saveLogsStore(id, nextLocal);

    const ok = await upsertDailyLog(id, dayKey, log);
    if (!ok) {
      setBanner("Saved locally. Cloud sync will work after logs tables are active.");
    }
    return ok;
  }, [id]);

  useEffect(() => {
    const run = async () => {
      const pending = consumeLogsTrainingPrefill(id);
      if (!pending) return;
      const dayKey = pending.dayKey || todayKey;
      setSelectedDay(dayKey);
      const next = nextDayLog(dayKey, (current) => ({
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
      setDailyLogsByDate((prev) => ({ ...prev, [dayKey]: next }));
      await saveDayLog(dayKey, next);
      setBanner("Session moved into Logs.");
    };

    run();
  }, [id, nextDayLog, saveDayLog, todayKey]);

  const applyWeight = async () => {
    const value = Number(selectedLog.weightValue);
    const max = selectedLog.weightUnit === "lbs" ? 500 : 227;
    if (!Number.isFinite(value) || value <= 0 || value > max) {
      setBanner(`Weight must be between 1 and ${max} ${selectedLog.weightUnit}.`);
      return;
    }
    await saveDayLog(selectedDay, selectedLog);
    await markActivity();
    setBanner("Weight logged.");
  };

  const applyWater = async () => {
    const value = Number(selectedLog.waterAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setBanner("Enter a valid water amount.");
      return;
    }
    await saveDayLog(selectedDay, selectedLog);
    await markActivity();
    setBanner("Water logged.");
  };

  const addMealEntry = async () => {
    if (!id) return;
    const text = mealInput.trim();
    if (!text) return;
    const alreadyLogged = (selectedLog.meals || []).some(
      (meal) => String(meal?.text || "").trim().toLowerCase() === text.toLowerCase()
    );
    if (alreadyLogged) {
      setBanner("Meal already logged for this day.");
      setMealInput("");
      return;
    }
    const next = nextDayLog(selectedDay, (log) => ({
      ...log,
      meals: [...(log.meals || []), { id: `meal-${Date.now()}`, text }],
    }));
    setDailyLogsByDate((prev) => ({ ...prev, [selectedDay]: next }));
    await saveDayLog(selectedDay, next);

    if (saveMealLibrary) {
      const ok = await saveMealToLibrary(id, text, "manual");
      if (!ok) addSavedMeal(id, text, "manual");

      const cloudMeals = await fetchSavedMeals(id);
      const local = getLogsStore(id);
      const merged = [...(cloudMeals || [])];
      (local.savedMeals || []).forEach((item) => {
        if (!merged.some((meal) => String(meal.name).toLowerCase() === String(item.name).toLowerCase())) {
          merged.push(item);
        }
      });
      setSavedMeals(merged);
    }

    setMealInput("");
    await markActivity();
    setBanner("Meal logged.");
  };

  const toggleSupplement = async (name) => {
    const next = nextDayLog(selectedDay, (log) => {
      const taken = new Set(log.supplementsTaken || []);
      if (taken.has(name)) taken.delete(name);
      else taken.add(name);
      return { ...log, supplementsTaken: Array.from(taken) };
    });
    setDailyLogsByDate((prev) => ({ ...prev, [selectedDay]: next }));
    await saveDayLog(selectedDay, next);
    await markActivity();
  };

  const addSupplement = async () => {
    const name = customSupplement.trim();
    if (!name) return;

    const ok = await addSupplementToLibrary(id, name);
    if (!ok) {
      const local = getLogsStore(id);
      const next = {
        ...local,
        supplementLibrary: Array.from(new Set([...(local.supplementLibrary || []), name])),
      };
      saveLogsStore(id, next);
    }

    const cloudSupps = await fetchSupplementLibrary(id);
    const local = getLogsStore(id);
    setSupplementLibrary(Array.from(new Set([...(cloudSupps || []), ...(local.supplementLibrary || [])])));
    setCustomSupplement("");
  };

  const addExtraActivity = async () => {
    if (!extraType) return;
    const next = nextDayLog(selectedDay, (log) => ({
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
    setDailyLogsByDate((prev) => ({ ...prev, [selectedDay]: next }));
    await saveDayLog(selectedDay, next);
    setExtraMinutes("");
    setExtraNotes("");
    await markActivity();
    setBanner("Extra activity logged.");
  };

  const removeMealEntry = async (mealId) => {
    const next = nextDayLog(selectedDay, (log) => ({
      ...log,
      meals: (log.meals || []).filter((meal) => meal.id !== mealId),
    }));
    setDailyLogsByDate((prev) => ({ ...prev, [selectedDay]: next }));
    await saveDayLog(selectedDay, next);
    setBanner("Meal removed from this day.");
  };

  const removeSupplementEntry = async (name) => {
    const next = nextDayLog(selectedDay, (log) => ({
      ...log,
      supplementsTaken: (log.supplementsTaken || []).filter((supplement) => supplement !== name),
    }));
    setDailyLogsByDate((prev) => ({ ...prev, [selectedDay]: next }));
    await saveDayLog(selectedDay, next);
    setBanner("Supplement removed from this day.");
  };

  const removeExtraActivityEntry = async (activityId) => {
    const next = nextDayLog(selectedDay, (log) => ({
      ...log,
      extraActivities: (log.extraActivities || []).filter((item) => item.id !== activityId),
    }));
    setDailyLogsByDate((prev) => ({ ...prev, [selectedDay]: next }));
    await saveDayLog(selectedDay, next);
    setBanner("Activity removed from this day.");
  };

  const openTrainingReport = (row) => {
    if (!row) return;
    setActiveTrainingReport(row);
  };

  const backPath = mode === "athlete" ? `/athlete/${id}` : `/gym/${id}`;

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
      </div>

      {banner ? <div className="studio-banner success">{banner}</div> : null}

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

        <div className="logs-week-summary">
          <div>Weight: {dayGlance.weight}</div>
          <div>Water: {dayGlance.water}</div>
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
                  {String(row.id || "").startsWith("extra-") ? (
                    <button
                      className="logs-row-delete"
                      type="button"
                      onClick={() => removeExtraActivityEntry(row.id)}
                    >
                      Remove
                    </button>
                  ) : null}
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
          <div className="logs-goal-row">
            <input
              className="studio-form-input"
              type="number"
              value={weightGoalKg}
              onChange={(event) => setWeightGoalKg(event.target.value)}
              placeholder="Goal (kg)"
            />
            <div className="logs-goal-note">{weightGoalStatus}</div>
          </div>
          <div className="logs-row">
            <input
              className="studio-form-input"
              type="number"
              value={selectedLog.weightValue}
              onChange={(event) => patchDayLogLocal(selectedDay, (log) => ({ ...log, weightValue: event.target.value }))}
              placeholder={selectedLog.weightUnit === "lbs" ? "max 500" : "max 227"}
            />
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
          <div className="logs-goal-row">
            <input
              className="studio-form-input"
              type="number"
              value={waterGoalMl}
              onChange={(event) => setWaterGoalMl(event.target.value)}
              placeholder="Goal (ml)"
            />
            <div className="logs-goal-note">{waterGoalStatus}</div>
          </div>
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
                  {String(row.id || "").startsWith("extra-") ? (
                    <button
                      className="logs-row-delete"
                      type="button"
                      onClick={() => removeExtraActivityEntry(row.id)}
                    >
                      Remove
                    </button>
                  ) : null}
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
                            {(activeTrainingReport.report?.details?.totalExercises ?? 0)} exercises
                            {activeTrainingReport.report?.details?.duration ? ` · ${activeTrainingReport.report?.details?.duration}` : ""}
                            {(() => {
                              const exercises = activeTrainingReport.report?.details?.exercises || [];
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
                          {(activeTrainingReport.report?.details?.exercises || []).map((exercise, index) => (
                            <div key={`${activeTrainingReport.id}-exercise-${exercise.id || index}`} className="logs-program-report-row">
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
    </div>
  );
}


