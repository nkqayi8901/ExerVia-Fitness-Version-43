import { getAthleteWorldMeta, normalizeAthleteSport } from "./athleteWorlds";

export function buildRunHighlights(run) {
  const sport = normalizeAthleteSport(run?.discipline);
  const world = getAthleteWorldMeta(sport);
  const distance = Number(run?.distanceKm ?? run?.distance_km ?? 0);
  const elapsed = Number(run?.elapsedSeconds ?? run?.elapsed_seconds ?? 0);
  const pace = Number(run?.pacePerKmSeconds ?? run?.pace_per_km_seconds ?? 0);
  const visibility = String(run?.visibility || "private").toLowerCase();
  const challengeMode = String(run?.challengeMode || run?.challenge_mode || "solo").toLowerCase();
  const note = String(run?.routeNote || run?.route_note || "").toLowerCase();
  const highlights = [];

  highlights.push(world.title);

  if (sport === "running") {
    if (distance >= 0.9 && distance <= 1.3) highlights.push("Fastest 1K");
    else if (distance >= 4.5 && distance <= 5.5) highlights.push("5K pressure");
    else if (distance >= 10) highlights.push("Endurance block");
    if (pace > 0 && pace <= 300) highlights.push("Tempo locked");
  }

  if (sport === "cycling") {
    if (distance >= 40) highlights.push("Long ride");
    else if (distance >= 20) highlights.push("Base ride");
    else highlights.push("Torque set");
  }

  if (sport === "trail") {
    if (note.includes("climb") || note.includes("hill") || note.includes("elev")) {
      highlights.push("Trail gain");
    } else if (distance >= 8) {
      highlights.push("Mountain block");
    } else {
      highlights.push("Terrain work");
    }
  }

  if (elapsed >= 3600) highlights.push("Engine builder");
  if (challengeMode === "challenge") highlights.push("Rivalry ready");
  if (visibility === "regional") highlights.push("Regional signal");
  else if (visibility === "nearby") highlights.push("Live signal");

  return Array.from(new Set(highlights)).slice(0, 4);
}

export function buildRunStory(run) {
  const world = getAthleteWorldMeta(run?.discipline);
  const highlights = buildRunHighlights(run);
  return {
    world,
    highlights,
    headline: `${world.title} effort logged`,
    summary:
      highlights.length > 1
        ? `${highlights.slice(1).join(" · ")} across the ${world.title} world.`
        : `${world.socialLabel} carried into the feed.`,
  };
}
