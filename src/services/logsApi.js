// This module provides functions for interacting with the Supabase backend to manage
// daily logs, saved meals, and supplement library for the Exervia Fitness application.
// It includes functions for fetching and upserting daily logs, managing saved meals,
// and handling the supplement library. The module also includes utility functions
// for normalizing log data, inferring insights, and formatting labels and units.
// The functions are designed to handle errors gracefully and provide consistent
// data structures for the frontend components to consume.
import { supabase } from "../supabaseClient";

const emptyDay = () => ({
  weightValue: "",
  weightUnit: "kg",
  waterAmount: "",
  waterUnit: "ml",
  meals: [],
  supplementsTaken: [],
  extraActivities: [],
});

// Utility function to convert an array of daily log rows from the database into a map keyed by date for easier access in the frontend. Each log entry is normalized to ensure
// consistent data structures, with default values for missing fields. This function
// helps to abstract away the database schema and provide a clean interface for the
// frontend components to work with daily logs.
const toDayMap = (rows) => {
  const map = {};
  (rows || []).forEach((row) => {
    const key = row.log_date;
    map[key] = {
      weightValue: row.weight_value ?? "",
      weightUnit: row.weight_unit || "kg",
      waterAmount: row.water_amount ?? "",
      waterUnit: row.water_unit || "ml",
      meals: Array.isArray(row.meals) ? row.meals : [],
      supplementsTaken: Array.isArray(row.supplements_taken) ? row.supplements_taken : [],
      extraActivities: Array.isArray(row.extra_activities) ? row.extra_activities : [],
    };
  });
  return map;
};

// Utility function to infer insights from a daily log entry. 
// This function analyzes the log data to generate insights such as 
// hydration status, meal patterns, and supplement usage. T
// he insights are returned as an array of strings that can be displayed in the frontend to provide users with feedback and suggestions based on their logged data.
export async function fetchDailyLogs(userId) {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .order("log_date", { ascending: false })
    .limit(120);
  if (error) {
    console.error("fetchDailyLogs error:", error);
    return {};
  }
  return toDayMap(data);
}

// Function to upsert (insert or update) a daily log entry for a specific user and date.
// The function takes the user ID, date key, and log data as input, 
// constructs the payload for the database, and performs the upsert operation 
// using Supabase. It handles errors gracefully and returns a boolean indicating 
// the success of the operation.
// The log data is normalized to ensure that all fields are present
//  and have consistent types, which helps to maintain data integrity in the database and
//  simplifies the logic in the frontend components that consume this data.
export async function upsertDailyLog(userId, dayKey, log) {
  const payload = {
    user_id: Number(userId),
    log_date: dayKey,
    weight_value: log.weightValue === "" ? null : Number(log.weightValue),
    weight_unit: log.weightUnit || "kg",
    water_amount: log.waterAmount === "" ? null : Number(log.waterAmount),
    water_unit: log.waterUnit || "ml",
    meals: Array.isArray(log.meals) ? log.meals : [],
    supplements_taken: Array.isArray(log.supplementsTaken) ? log.supplementsTaken : [],
    extra_activities: Array.isArray(log.extraActivities) ? log.extraActivities : [],
  };

  const { error } = await supabase
    .from("daily_logs")
    .upsert(payload, { onConflict: "user_id,log_date" });

  if (error) {
    console.error("upsertDailyLog error:", error);
  }
  return !error;
}

export async function fetchSavedMeals(userId) {
  const { data, error } = await supabase
    .from("saved_meals")
    .select("id, name, source, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchSavedMeals error:", error);
    return [];
  }
  return data || [];
}

export async function saveMealToLibrary(userId, mealName, source = "manual") {
  const name = String(mealName || "").trim();
  if (!name) return false;

  const { data: existing } = await supabase
    .from("saved_meals")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .limit(1);

  if (existing && existing.length > 0) return true;

  const { error } = await supabase.from("saved_meals").insert({
    user_id: Number(userId),
    name,
    source,
  });
  if (error) {
    console.error("saveMealToLibrary error:", error);
    return false;
  }
  return true;
}

export async function removeMealFromLibrary(userId, mealName) {
  const name = String(mealName || "").trim();
  if (!name) return false;
  const { error } = await supabase
    .from("saved_meals")
    .delete()
    .eq("user_id", Number(userId))
    .ilike("name", name);
  if (error) {
    console.error("removeMealFromLibrary error:", error);
    return false;
  }
  return true;
}

export async function fetchSupplementLibrary(userId) {
  const { data, error } = await supabase
    .from("supplement_library")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchSupplementLibrary error:", error);
    return [];
  }
  return (data || []).map((item) => item.name).filter(Boolean);
}

export async function addSupplementToLibrary(userId, supplementName) {
  const name = String(supplementName || "").trim();
  if (!name) return false;

  const { data: existing } = await supabase
    .from("supplement_library")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .limit(1);

  if (existing && existing.length > 0) return true;

  const { error } = await supabase.from("supplement_library").insert({
    user_id: Number(userId),
    name,
  });
  if (error) {
    console.error("addSupplementToLibrary error:", error);
    return false;
  }
  return true;
}

export { emptyDay };
