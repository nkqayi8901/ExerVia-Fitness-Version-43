import { useEffect, useMemo, useState } from "react";
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
  const [banner, setBanner] = useState("");
  const [glanceDetail, setGlanceDetail] = useState("training");

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
          .select("id, sport, duration_minutes, metrics, created_at")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("strength_logs")
          .select("id, exercise_name, sets_completed, reps_completed, created_at")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

      const combined = [
        ...(trainingRes.data || []).map((row) => ({
          id: `train-${row.id}`,
          created_at: row.created_at,
          title:
            String(row?.metrics?.plan_name || row?.metrics?.program_name || "").trim() ||
            `${String(row.sport || "Training").toUpperCase()} session`,
          detail: `${row.duration_minutes || 0} min`,
        })),
        ...(strengthRes.data || []).map((row) => ({
          id: `lift-${row.id}`,
          created_at: row.created_at,
          title: row.exercise_name || "Strength session",
          detail: `${row.sets_completed || 0} sets · ${row.reps_completed || 0} reps`,
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

  const dayTraining = trainingByDay[selectedDay] || [];
  const allExtraActivities = selectedLog.extraActivities || [];
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
            title: inferred,
            detail: `${item.minutes ? `${item.minutes} min` : "No duration"}${item.notes ? ` · ${item.notes}` : ""}`,
          };
        })
        .filter(Boolean);

      return [
        ...dayTraining.map((row) => ({
        id: row.id,
        title: row.title,
        detail: row.detail,
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

  const markActivity = async () => {
    if (!id) return;
    await trackDailyActivity(id, "logs_entry");
    await recalcUserState(id);
    window.dispatchEvent(new Event("user_state_updated"));
  };

  const patchDayLogLocal = (dayKey, updater) => {
    setDailyLogsByDate((prev) => {
      const current = prev[dayKey] || emptyDay();
      return { ...prev, [dayKey]: updater(current) };
    });
  };

  const nextDayLog = (dayKey, updater) => {
    const current = dailyLogsByDate[dayKey] || emptyDay();
    return updater(current);
  };

  const saveDayLog = async (dayKey, log) => {
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
  };

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
          },
        ],
      }));
      setDailyLogsByDate((prev) => ({ ...prev, [dayKey]: next }));
      await saveDayLog(dayKey, next);
      setBanner("Session moved into Logs.");
    };

    run();
  }, [id, todayKey]);

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
    const text = mealInput.trim();
    if (!text) return;
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

  const backPath = mode === "athlete" ? `/athlete/${id}` : `/gym/${id}`;

  return (
    <div className="page-shell logs-shell">
      <div className="page-header">
        <div>
          <button className="studio-back" onClick={() => navigate(backPath)} type="button">
            {"<- Back"}
          </button>
          <h2 className="page-title">Logs</h2>
          <p className="page-subtitle">Your daily command center for body, fuel, hydration, and training.</p>
        </div>
      </div>

      {banner ? <div className="studio-banner success">{banner}</div> : null}

      <div className="hud-card logs-top-card">
        <div className="logs-top-row">
          <div className="studio-panel-title logs-panel-title">Day In A Glance</div>
          <input
            className="studio-form-input logs-date-input"
            type="date"
            value={selectedDay}
            onChange={(event) => setSelectedDay(event.target.value || todayKey)}
            max={todayKey}
          />
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

        <div className="logs-list">
          {glanceDetail === "training" &&
            (combinedTrainingItems.length ? (
              combinedTrainingItems.map((row) => (
                <div key={row.id} className="logs-list-row">
                  <div className="logs-list-main">
                    <div className="logs-list-title">{row.title}</div>
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
                    <div className="logs-list-title">{row.title}</div>
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
    </div>
  );
}
