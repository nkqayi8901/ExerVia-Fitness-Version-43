const RANK_ORDER = ["E", "D", "C", "B", "A", "S"];

function getRankScore(rank) {
  const normalized = String(rank || "E").trim().toUpperCase();
  const index = RANK_ORDER.indexOf(normalized);
  return index >= 0 ? index : 0;
}

export function buildProgressionMoment(previousState, nextState, options = {}) {
  if (!previousState || !nextState) return null;

  const discipline = options.discipline || "system";
  const prevLevel = Math.max(1, Number(previousState.level || 1));
  const nextLevel = Math.max(1, Number(nextState.level || 1));
  const prevRank = String(previousState.rank || "E").trim().toUpperCase();
  const nextRank = String(nextState.rank || "E").trim().toUpperCase();
  const levelUp = nextLevel > prevLevel;
  const rankUp = getRankScore(nextRank) > getRankScore(prevRank);

  if (!levelUp && !rankUp) return null;

  const primaryLabel =
    rankUp && levelUp
      ? `Rank ${nextRank} · Level ${nextLevel}`
      : rankUp
        ? `Rank ${nextRank}`
        : `Level ${nextLevel}`;

  const title =
    rankUp && levelUp
      ? "Promotion earned"
      : rankUp
        ? `Rank advanced to ${nextRank}`
        : `Level ${nextLevel} unlocked`;

  const subtitle =
    rankUp && levelUp
      ? `Your ${discipline} profile just moved up a tier. Carry that standard into the next block.`
      : rankUp
        ? `Your recent work pushed your status higher. Let the rest of the app read that standard.`
        : `The next layer is open. Keep the week coherent and turn the unlock into real momentum.`;

  const toastMessage =
    rankUp && levelUp
      ? `Promotion earned. Rank ${nextRank} and Level ${nextLevel} are now live.`
      : rankUp
        ? `Rank up. You have advanced to Rank ${nextRank}.`
        : `Level up. Level ${nextLevel} is now unlocked.`;

  return {
    title,
    subtitle,
    primaryLabel,
    rank: nextRank,
    level: nextLevel,
    toastMessage,
  };
}
