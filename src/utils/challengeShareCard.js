// challengeShareCard.js
// Generates a branded PNG share card for a completed challenge result.
// Uses HTML Canvas — no external dependencies.
//
// Returns a Blob (PNG) that can be used with Web Share API or downloaded.

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPaceFromSeconds(elapsedSeconds, distanceKm) {
  if (!distanceKm || distanceKm <= 0 || !elapsedSeconds) return "--:--/km";
  const paceSeconds = elapsedSeconds / distanceKm;
  const m = Math.floor(paceSeconds / 60);
  const s = Math.round(paceSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

// Draws a rounded rectangle path
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateChallengeCard({
  winnerName,
  loserName,
  winnerTime,   // seconds
  loserTime,    // seconds
  distanceLabel,
  distanceKm,
  xpWager,
  isWinner,     // boolean — from the current user's perspective
  city,
}) {
  const W = 1080;
  const H = 1080;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ── Background ─────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(0.5, "#0f172a");
  bg.addColorStop(1, "#111827");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Glow accent ────────────────────────────────────────────────────────────
  const glow = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, 420);
  glow.addColorStop(0, isWinner ? "rgba(249,115,22,0.18)" : "rgba(100,116,139,0.12)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Top accent line ─────────────────────────────────────────────────────────
  const accent = isWinner ? "#f97316" : "#475569";
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 6);

  // ── ExerVia wordmark ────────────────────────────────────────────────────────
  ctx.font = "700 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#f97316";
  ctx.letterSpacing = "0.05em";
  ctx.textAlign = "center";
  ctx.fillText("EXERVIA", W / 2, 80);

  ctx.font = "400 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("LIVE CHALLENGE", W / 2, 118);

  // ── Distance badge ──────────────────────────────────────────────────────────
  roundRect(ctx, W / 2 - 80, 148, 160, 52, 26);
  ctx.fillStyle = "rgba(249,115,22,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(249,115,22,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = "700 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#f97316";
  ctx.fillText(distanceLabel, W / 2, 183);

  // ── Result label ────────────────────────────────────────────────────────────
  ctx.font = "800 96px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = isWinner ? "#f97316" : "#64748b";
  ctx.fillText(isWinner ? "WINNER" : "BATTLE", W / 2, 320);

  // ── XP delta ───────────────────────────────────────────────────────────────
  ctx.font = "700 44px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = isWinner ? "#fbbf24" : "#64748b";
  ctx.fillText(isWinner ? `+${xpWager} XP` : `-${xpWager} XP`, W / 2, 388);

  // ── Divider ─────────────────────────────────────────────────────────────────
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 422);
  ctx.lineTo(W - 80, 422);
  ctx.stroke();

  // ── Runner result cards ──────────────────────────────────────────────────────
  const drawRunnerCard = (x, y, w, h, name, time, distKm, won) => {
    roundRect(ctx, x, y, w, h, 20);
    const cardBg = ctx.createLinearGradient(x, y, x, y + h);
    cardBg.addColorStop(0, won ? "rgba(249,115,22,0.14)" : "rgba(30,41,59,0.8)");
    cardBg.addColorStop(1, won ? "rgba(249,115,22,0.04)" : "rgba(15,23,42,0.8)");
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.strokeStyle = won ? "rgba(249,115,22,0.5)" : "rgba(51,65,85,0.6)";
    ctx.lineWidth = won ? 2 : 1;
    ctx.stroke();

    // Crown for winner
    if (won) {
      ctx.font = "32px serif";
      ctx.textAlign = "center";
      ctx.fillText("👑", x + w / 2, y + 52);
    }

    // Name
    ctx.font = `700 ${name.length > 12 ? "28px" : "34px"} -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = won ? "#f8fafc" : "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(name.length > 14 ? name.slice(0, 13) + "…" : name, x + w / 2, y + (won ? 98 : 78));

    // Time
    ctx.font = "800 52px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = won ? "#f97316" : "#64748b";
    ctx.fillText(formatTime(time), x + w / 2, y + (won ? 162 : 142));

    // Pace
    ctx.font = "400 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(formatPaceFromSeconds(time, distKm), x + w / 2, y + (won ? 202 : 182));
  };

  const cardW = 460;
  const cardH = 240;
  const cardY = 446;
  drawRunnerCard(60, cardY, cardW, cardH, winnerName, winnerTime, distanceKm, true);
  drawRunnerCard(560, cardY, cardW, cardH, loserName, loserTime, distanceKm, false);

  // ── VS between cards ────────────────────────────────────────────────────────
  ctx.font = "900 40px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#334155";
  ctx.textAlign = "center";
  ctx.fillText("VS", W / 2, cardY + cardH / 2 + 14);

  // ── Time delta ──────────────────────────────────────────────────────────────
  const delta = Math.abs((winnerTime || 0) - (loserTime || 0));
  if (delta > 0) {
    ctx.font = "600 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText(`Won by ${formatTime(delta)}`, W / 2, cardY + cardH + 52);
  }

  // ── City tag ────────────────────────────────────────────────────────────────
  if (city) {
    ctx.font = "600 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#334155";
    ctx.fillText(`📍 ${city}`, W / 2, cardY + cardH + 96);
  }

  // ── Bottom tagline ─────────────────────────────────────────────────────────
  ctx.font = "400 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.fillText("exervia.app · Challenge. Race. Win.", W / 2, H - 48);

  ctx.font = "600 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("exervia.app · Challenge. Race. Win.", W / 2, H - 48);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function shareChallengeCard(blob, caption) {
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], "exervia-challenge.png", { type: "image/png" })] })) {
    try {
      await navigator.share({
        title: "ExerVia Live Challenge",
        text: caption,
        files: [new File([blob], "exervia-challenge.png", { type: "image/png" })],
      });
      return true;
    } catch {
      // fell through to download
    }
  }
  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "exervia-challenge.png";
  a.click();
  URL.revokeObjectURL(url);
  return false;
}
