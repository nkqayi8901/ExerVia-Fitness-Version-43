const WORLD_META = {
  running: {
    sport: "running",
    title: "Velocity Lab",
    fullTitle: "Velocity Lab (Running)",
    subtitle: "Tempo and pace craft",
    ctaLabel: "Open Velocity Lab",
    socialLabel: "Pace craft in motion",
  },
  cycling: {
    sport: "cycling",
    title: "Torque Studio",
    fullTitle: "Torque Studio (Cycling)",
    subtitle: "Cadence and climbs",
    ctaLabel: "Open Torque Studio",
    socialLabel: "Cadence and climbs",
  },
  trail: {
    sport: "trail",
    title: "Trail Forge",
    fullTitle: "Trail Forge (Trail Running)",
    subtitle: "Elevation resilience",
    ctaLabel: "Open Trail Forge",
    socialLabel: "Elevation resilience",
  },
};

export function normalizeAthleteSport(value) {
  const raw = String(value || "running").trim().toLowerCase();
  if (raw.includes("cycle")) return "cycling";
  if (raw.includes("trail")) return "trail";
  return "running";
}

export function getAthleteWorldMeta(value) {
  const sport = normalizeAthleteSport(value);
  return WORLD_META[sport] || WORLD_META.running;
}
