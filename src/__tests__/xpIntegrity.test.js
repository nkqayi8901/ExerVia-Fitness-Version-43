/**
 * XP integrity tests — pure JS, no Supabase connection needed.
 * Tests the client-side XP math that mirrors the server-side logic.
 * Run with: npm test
 */

// ── Mirror of server-side compute_awarded_xp logic ───────────────────
// Server: daily_cap=600, diminishing_factor from event_count
function computeAwardedXp(baseXp, dayXpSoFar, eventCount) {
  const DAILY_CAP = 600;
  const budgetLeft = Math.max(0, DAILY_CAP - dayXpSoFar);
  if (budgetLeft <= 0 || baseXp <= 0) return 0;

  // Diminishing returns multiplier (matches server plpgsql)
  let multiplier = 1.0;
  if (eventCount >= 10) multiplier = 0.1;
  else if (eventCount >= 7) multiplier = 0.25;
  else if (eventCount >= 5) multiplier = 0.5;
  else if (eventCount >= 3) multiplier = 0.75;

  const raw = Math.floor(baseXp * multiplier);
  return Math.min(raw, budgetLeft);
}

// ── Mirror of level formula ───────────────────────────────────────────
function levelForXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}
function rankForLevel(level) {
  if (level >= 20) return "S";
  if (level >= 15) return "A";
  if (level >= 10) return "B";
  if (level >= 5)  return "C";
  return "D";
}
function xpForLevel(level) {
  return 100 * Math.pow(Math.max(1, level) - 1, 2);
}

// ─────────────────────────────────────────────────────────────────────

describe("XP: compute_awarded_xp", () => {
  test("first event of the day awards full XP", () => {
    expect(computeAwardedXp(100, 0, 0)).toBe(100);
  });

  test("respects daily cap of 600", () => {
    expect(computeAwardedXp(100, 550, 0)).toBe(50);
    expect(computeAwardedXp(100, 600, 0)).toBe(0);
    expect(computeAwardedXp(100, 700, 0)).toBe(0);
  });

  test("diminishing returns at 3+ events (0.75x)", () => {
    expect(computeAwardedXp(100, 0, 3)).toBe(75);
  });

  test("diminishing returns at 5+ events (0.5x)", () => {
    expect(computeAwardedXp(100, 0, 5)).toBe(50);
  });

  test("diminishing returns at 7+ events (0.25x)", () => {
    expect(computeAwardedXp(100, 0, 7)).toBe(25);
  });

  test("diminishing returns at 10+ events (0.1x)", () => {
    expect(computeAwardedXp(100, 0, 10)).toBe(10);
  });

  test("zero base XP returns 0", () => {
    expect(computeAwardedXp(0, 0, 0)).toBe(0);
  });

  test("negative base XP returns 0", () => {
    expect(computeAwardedXp(-50, 0, 0)).toBe(0);
  });

  test("cap takes precedence over diminishing returns", () => {
    // 0.75x of 100 = 75, but only 30 budget left
    expect(computeAwardedXp(100, 570, 3)).toBe(30);
  });

  test("floors fractional XP", () => {
    expect(computeAwardedXp(50, 0, 3)).toBe(37); // 50 * 0.75 = 37.5 → 37
  });
});

describe("Level formula", () => {
  test("level 1 starts at 0 XP", () => {
    expect(levelForXp(0)).toBe(1);
  });

  test("level 2 requires 100 XP", () => {
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(99)).toBe(1);
  });

  test("level 5 requires 1600 XP", () => {
    expect(levelForXp(1600)).toBe(5);
    expect(levelForXp(1599)).toBe(4);
  });

  test("level 10 requires 8100 XP", () => {
    expect(levelForXp(8100)).toBe(10);
  });

  test("level 20 requires 36100 XP", () => {
    expect(levelForXp(36100)).toBe(20);
  });

  test("never goes below 1", () => {
    expect(levelForXp(-500)).toBe(1);
  });
});

describe("Rank thresholds", () => {
  test("D rank below level 5", () => {
    expect(rankForLevel(1)).toBe("D");
    expect(rankForLevel(4)).toBe("D");
  });

  test("C rank at level 5", () => {
    expect(rankForLevel(5)).toBe("C");
    expect(rankForLevel(9)).toBe("C");
  });

  test("B rank at level 10", () => {
    expect(rankForLevel(10)).toBe("B");
    expect(rankForLevel(14)).toBe("B");
  });

  test("A rank at level 15", () => {
    expect(rankForLevel(15)).toBe("A");
    expect(rankForLevel(19)).toBe("A");
  });

  test("S rank at level 20+", () => {
    expect(rankForLevel(20)).toBe("S");
    expect(rankForLevel(99)).toBe("S");
  });
});

describe("XP level boundaries (xpForLevel)", () => {
  test("xpForLevel matches levelForXp inverse", () => {
    [1, 2, 5, 10, 15, 20].forEach((lvl) => {
      const xp = xpForLevel(lvl);
      expect(levelForXp(xp)).toBe(lvl);
    });
  });
});

describe("XP progress within level", () => {
  function progressInLevel(xp) {
    const level = levelForXp(xp);
    const start = xpForLevel(level);
    const next  = xpForLevel(level + 1);
    const span  = next - start;
    return Math.round(((xp - start) / span) * 100);
  }

  test("starts at 0% progress at level boundary", () => {
    expect(progressInLevel(100)).toBe(0); // exactly level 2 start
    expect(progressInLevel(0)).toBe(0);   // level 1 start
  });

  test("halfway through level 1 is ~50%", () => {
    // Level 1: 0 to 100 XP, span = 100. At 50 XP → 50%
    expect(progressInLevel(50)).toBe(50);
  });

  test("progress rounds to 100% one XP before level-up (acceptable)", () => {
    // Level 2: 100–400 XP span=300. At 399 XP: 299/300 = 99.67% → rounds to 100.
    // The UI clamps to 100 anyway; this documents the expected rounding behaviour.
    expect(progressInLevel(399)).toBeGreaterThanOrEqual(99);
    expect(progressInLevel(400)).toBe(0); // exactly level 3
  });
});

describe("Daily XP budget edge cases", () => {
  test("cumulative XP across events never exceeds 600 in a day", () => {
    let dayXp = 0;
    let events = 0;
    const bases = [100, 100, 80, 60, 50, 50, 40, 40, 30, 30, 20, 20];
    for (const base of bases) {
      const awarded = computeAwardedXp(base, dayXp, events);
      dayXp += awarded;
      events++;
      expect(dayXp).toBeLessThanOrEqual(600);
    }
  });
});
