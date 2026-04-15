// questProgress.js
// Call these helpers from anywhere in the app when a relevant action happens.
// They call update_quest_progress() on the server and then fire a DOM event
// so DailyQuests.jsx refreshes automatically.

import { supabase } from "../supabaseClient";

async function updateProgress(category, amount = 1) {
  try {
    await supabase.rpc("update_quest_progress", {
      p_category: category,
      p_amount: amount,
    });
    window.dispatchEvent(new CustomEvent("quest_progress_updated"));
  } catch {
    // Quest progress is non-critical — never block the main action
  }
}

export const questProgress = {
  trainingSession: (count = 1) => updateProgress("training", count),
  run:             (count = 1) => updateProgress("running", count),
  runKm:           (km)        => updateProgress("running", Math.floor(km)),
  challenge:       (count = 1) => updateProgress("challenge", count),
  challengeWin:    (count = 1) => updateProgress("challenge", count),
  meal:            (count = 1) => updateProgress("nutrition", count),
  communityPost:   (count = 1) => updateProgress("social", count),
  streak:          (days)      => updateProgress("streak", days),
  special:         (count = 1) => updateProgress("special", count),
};
