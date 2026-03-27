import { getAthleteWorldMeta, normalizeAthleteSport } from "./athleteWorlds";

export function buildTrainingStory(training) {
  const sport = normalizeAthleteSport(training?.sport);
  const world = getAthleteWorldMeta(sport);
  const focus = String(training?.focus || "Base").trim();
  const duration = String(training?.durationLabel || "Tracked").trim();
  const planName = String(training?.planName || "").trim();
  const highlights = [world.title];

  if (/speed|threshold/i.test(focus)) highlights.push("Sharp session");
  else if (/tempo/i.test(focus)) highlights.push("Tempo block");
  else if (/recovery/i.test(focus)) highlights.push("Recovery discipline");
  else if (/race/i.test(focus)) highlights.push("Race prep");
  else highlights.push("Base builder");

  if (/60|70|75|80|90/.test(duration)) highlights.push("Long-form work");
  if (planName) highlights.push("Plan aligned");

  return {
    world,
    highlights: Array.from(new Set(highlights)).slice(0, 4),
    summary: `${focus} session flowing through ${world.title}${planName ? ` via ${planName}` : ""}.`,
  };
}
