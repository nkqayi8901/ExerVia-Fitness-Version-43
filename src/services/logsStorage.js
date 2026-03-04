// This module provides functions for managing logs storage in localStorage,
// including fetching and saving the logs store, managing saved meals, and
// handling prefill data for training sessions. The logs store is structured
// to include daily logs, a supplement library, and saved meals, and is 
// keyed by user ID to allow for multiple users on the same device. The module
// also includes utility functions for generating keys and handling localStorage
// interactions safely.
const buildUserKey = (prefix, userId) => `${prefix}_${userId || "guest"}`;

const getTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultStore = () => ({
  byDate: {},
  supplementLibrary: [],
  savedMeals: [],
});

const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("localStorage write skipped:", error);
    return false;
  }
};

export const getLogsStore = (userId) => {
  const key = buildUserKey("exervia_logs_store", userId);
  const raw = localStorage.getItem(key);
  if (!raw) return defaultStore();
  try {
    const parsed = JSON.parse(raw);
    return {
      byDate: parsed?.byDate || {},
      supplementLibrary: Array.isArray(parsed?.supplementLibrary) ? parsed.supplementLibrary : [],
      savedMeals: Array.isArray(parsed?.savedMeals) ? parsed.savedMeals : [],
    };
  } catch {
    return defaultStore();
  }
};

export const saveLogsStore = (userId, store) => {
  const key = buildUserKey("exervia_logs_store", userId);
  safeSetItem(key, JSON.stringify(store));
};

export const addSavedMeal = (userId, mealName, source = "custom") => {
  const name = String(mealName || "").trim();
  if (!name) return;
  const store = getLogsStore(userId);
  const exists = store.savedMeals.some(
    (item) => String(item?.name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (exists) return;
  store.savedMeals = [
    ...store.savedMeals,
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, source },
  ];
  saveLogsStore(userId, store);
};

export const queueLogsTrainingPrefill = (userId, payload) => {
  const key = buildUserKey("exervia_logs_prefill", userId);
  const entry = {
    ...payload,
    dayKey: payload?.dayKey || getTodayKey(),
    createdAt: new Date().toISOString(),
  };
  safeSetItem(key, JSON.stringify(entry));
};

export const getLogsTrainingPrefill = (userId) => {
  const key = buildUserKey("exervia_logs_prefill", userId);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearLogsTrainingPrefill = (userId) => {
  const key = buildUserKey("exervia_logs_prefill", userId);
  localStorage.removeItem(key);
};

export const consumeLogsTrainingPrefill = (userId) => {
  const entry = getLogsTrainingPrefill(userId);
  if (!entry) return null;
  clearLogsTrainingPrefill(userId);
  return entry;
};

export const getTodayLogKey = getTodayKey;
