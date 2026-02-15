import { supabase } from "../supabaseClient";

// Qualifying actions that count toward the daily engagement streak.
export const QUALIFYING_ACTIVITY_ACTIONS = Object.freeze([
  "training_session",
  "journal_entry",
  "community_post",
  "community_reply",
  "community_reaction",
  "strength_log",
  "logs_entry",
]);

const toUtcDayKey = (value = new Date()) =>
  new Date(value).toISOString().slice(0, 10);

// Records one qualifying activity action for the current UTC day.
// Duplicate actions for the same day are ignored by the unique index.
export async function trackDailyActivity(userId, actionType) {
  if (!userId || !QUALIFYING_ACTIVITY_ACTIONS.includes(actionType)) return;

  const payload = {
    user_id: Number(userId),
    activity_date: toUtcDayKey(),
    activity_type: actionType,
  };

  const { error } = await supabase
    .from("daily_activity")
    .upsert(payload, { onConflict: "user_id,activity_date,activity_type" });

  if (error) {
    // Keep activity tracking non-blocking for UX flows.
    console.error("trackDailyActivity error:", error);
  }
}
