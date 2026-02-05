export function getCompanionMessage({ state, mode, userInput }) {
  const fatigue = state?.fatigue_score ?? 0;
  const recovery = state?.recovery_score ?? 0;
  const momentum = state?.momentum_score ?? 0;
  const level = state?.level ?? 1;
  const rank = state?.rank ?? "E";

  const input = (userInput || "").toLowerCase();

  // Critical recovery warning
  if (recovery < 30) {
    return mode === "gym"
      ? "🛑 Recovery is critically low. If you train heavy now, you stall progress. Do low-volume + perfect form."
      : "🛑 Aerobic load too high. Adaptation requires recovery. Go easy Zone 2 or full rest.";
  }

  // Momentum high → push
  if (momentum >= 12 && recovery >= 45) {
    return mode === "gym"
      ? `⚡ Momentum is accelerating. Today is a PR window — pick 1 lift and attack it. (Rank ${rank})`
      : `⚡ Momentum is accelerating. Today is a performance window — sharpen, don’t smash. (Rank ${rank})`;
  }

  // Simple intent reads (still template-based, but “aware”)
  if (input.includes("legs") || input.includes("lower")) {
    return mode === "gym"
      ? "Leg day request detected. Keep it brutal but clean: squat pattern + hinge + split squat."
      : "Lower-body request detected. Prioritize mechanics + aerobic support: hills, strides, or strength endurance.";
  }

  // Milestone callout
  if (level >= 10 && rank === "B") {
    return "⚔️ You’ve crossed into advanced territory. Standards are higher now. Show consistency.";
  }

  // Default
  return mode === "gym"
    ? "Keep going. One clean session beats ten chaotic ones."
    : "Keep going. Train with purpose — adaptation comes from precision.";
}

export function appendAchievements(state, message) {
  const achievements = [];
  const momentum = state?.momentum_score ?? 0;
  const level = state?.level ?? 1;

  if (momentum > 10) achievements.push("⚡ Momentum accelerating");
  if (level >= 5) achievements.push("🧬 System adapting");

  return achievements.length ? `${message}\n\n${achievements.join(" • ")}` : message;
}
