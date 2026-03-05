export const forumTracks = [
  { id: "strength", title: "Strength", subtitle: "Progressions, form, PRs" },
  { id: "running", title: "Running", subtitle: "Tempo, pacing, endurance" },
  { id: "hyrox", title: "Hyrox", subtitle: "Race prep, stations, engine" },
  { id: "recovery", title: "Recovery", subtitle: "Sleep, deloads, and reset strategy" },
  { id: "nutrition", title: "Nutrition", subtitle: "Fueling, recovery, habits" },
  { id: "wellbeing", title: "Wellbeing", subtitle: "Mental health, balance, and longevity" },
  { id: "accountability", title: "Accountability", subtitle: "Check-ins, consistency, and habit execution" },
  { id: "general-fitness", title: "General Fitness", subtitle: "All-round training for everyday fitness" },
  { id: "aesthetics-physique", title: "Aesthetics & Physique", subtitle: "Body composition, symmetry, and look goals" },
  { id: "mindset", title: "Mindset", subtitle: "Consistency, discipline, recovery" },
];

export const reactionOptions = [
  { id: "insight", label: "Insight", emoji: "\u{1F4A1}" }, // ??
  { id: "like", label: "Like", emoji: "\u{1F44D}" }, // ??
  { id: "dislike", label: "Dislike", emoji: "\u{1F44E}" }, // ??
];

export const templateTypeOptions = [
  { id: "all", label: "All" },
  { id: "training_plan", label: "Plans" },
  { id: "workout_program", label: "Programs" },
  { id: "recipe", label: "Recipes" },
];

export const templateFocusOptions = [
  { id: "all", label: "All Focus" },
  { id: "upper body", label: "Upper" },
  { id: "lower body", label: "Lower" },
  { id: "full body", label: "Full Body" },
  { id: "push", label: "Push" },
  { id: "pull", label: "Pull" },
  { id: "glutes", label: "Glutes" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "conditioning", label: "Conditioning" },
];

export const STATUS_PREFIX = "[STATUS] ";
export const GROUP_QUESTION_PREFIX = "[Q] ";

export const formatTime = (value) => {
  if (!value) return "";
  try {
    const now = Date.now();
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return "";
    const diffMs = now - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export const buildReplyTree = (replies) => {
  if (!replies?.length) return [];
  const map = {};
  replies.forEach((reply) => {
    map[reply.id] = { ...reply, children: [] };
  });
  const roots = [];
  replies.forEach((reply) => {
    const node = map[reply.id];
    if (reply.parent_id && map[reply.parent_id]) {
      map[reply.parent_id].children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

export const parseQuestionReplyPayload = (body) => {
  const raw = String(body || "");
  const match = raw.match(/^\[Q_REPLY:([^\]]+)\]\s*/);
  if (!match) return null;
  return {
    questionId: String(match[1]),
    text: raw.slice(match[0].length).trim(),
  };
};

export const buildQuestionReplyPayload = (questionId, text) =>
  `[Q_REPLY:${String(questionId)}] ${String(text || "").trim()}`;

export const normalizeGroupFeedPreview = (body) => {
  const raw = String(body || "").trim();
  if (!raw) return "";
  const reply = parseQuestionReplyPayload(raw);
  if (reply?.text) return reply.text;
  return raw.replace(/^\[Q\]\s*/, "").trim();
};

export const normalizeGroupPostChannel = (post) => {
  const explicit = String(post?.channel || "").trim().toLowerCase();
  if (explicit === "questions" || explicit === "general") return explicit;
  const body = String(post?.body || "");
  if (body.startsWith("[Q]") || body.startsWith("[Q_REPLY:")) return "questions";
  return "general";
};

export const getActivityLabel = (activityType) => {
  const normalized = String(activityType || "").trim().toLowerCase();
  if (normalized === "training_session") return "logged a training session";
  if (normalized === "strength_log") return "logged a strength session";
  if (normalized === "journal_entry") return "wrote a journal entry";
  if (normalized === "community_post") return "created a forum post";
  if (normalized === "community_reply") return "replied in forum";
  if (normalized === "community_reaction") return "reacted to a post";
  if (normalized === "community_template_rate") return "rated a template";
  if (normalized === "community_template_try") return "tried a template";
  if (normalized === "nutrition_log") return "logged nutrition";
  if (normalized === "daily_log") return "updated daily log";
  return normalized ? normalized.replaceAll("_", " ") : "recorded activity";
};

export const toDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};


