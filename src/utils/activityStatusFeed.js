import { supabase } from "../supabaseClient";
import { STATUS_PREFIX } from "../components/community/communityHelpers";

export const TRAINING_PREFIX = "[TRAINING] ";
export const RUN_PREFIX = "[RUN] ";
export const RUN_META_PATTERN = /\[\[run:(\d+)\]\]/i;
export const TRAINING_META_PATTERN = /\[\[training:([^|\]]+)\|([^|\]]+)\|([^|\]]+)\|?([^|\]]*)\]\]/i;
const FORUM_CACHE_PREFIX = "exervia_status_forum_";

export function extractRunMeta(value) {
  const raw = String(value || "");
  const match = raw.match(RUN_META_PATTERN);
  return {
    runId: match?.[1] ? String(match[1]) : "",
    cleanText: raw.replace(RUN_META_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

export function extractTrainingMeta(value) {
  const raw = String(value || "");
  const match = raw.match(TRAINING_META_PATTERN);
  return {
    sport: match?.[1] ? String(match[1]).trim().toLowerCase() : "",
    focus: match?.[2] ? String(match[2]).trim() : "",
    durationLabel: match?.[3] ? String(match[3]).trim() : "",
    planName: match?.[4] ? String(match[4]).trim() : "",
    cleanText: raw.replace(TRAINING_META_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

async function resolveForumId(topicSlug) {
  const cacheKey = `${FORUM_CACHE_PREFIX}${String(topicSlug || "mindset")}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  if (topicSlug) {
    const directRes = await supabase
      .from("community_forums")
      .select("id")
      .eq("topic_slug", topicSlug)
      .maybeSingle();

    const directId = directRes?.data?.id;
    if (directId) {
      localStorage.setItem(cacheKey, String(directId));
      return directId;
    }
  }

  const fallbackRes = await supabase
    .from("community_forums")
    .select("id")
    .limit(1)
    .maybeSingle();

  const fallbackId = fallbackRes?.data?.id;
  if (fallbackId) {
    localStorage.setItem(cacheKey, String(fallbackId));
  }
  return fallbackId || null;
}

export async function publishTrainingStatus(userId, payload) {
  if (!userId || !payload) return null;
  const forumId = await resolveForumId("accountability");
  if (!forumId) return null;

  const worldLabel = String(payload.worldLabel || payload.sportLabel || "Training").trim();
  const focusLabel = String(payload.focus || "Base").trim();
  const durationLabel = String(payload.durationLabel || "Tracked").trim();
  const sportLabel = String(payload.sportLabel || "training").trim().toLowerCase();
  const planName = String(payload.planName || "").trim();
  const body = `Logged a ${focusLabel.toLowerCase()} session · ${durationLabel}${planName ? `\nPlan: ${planName}` : ""}\n[[training:${sportLabel}|${focusLabel}|${durationLabel}|${planName}]]`;

  const { data, error } = await supabase
    .from("community_posts")
    .insert([
      {
        forum_id: forumId,
        title: `${STATUS_PREFIX}${TRAINING_PREFIX}${worldLabel}`,
        body,
        created_by: Number(userId),
      },
    ])
    .select("id,created_at,created_by,title,body")
    .single();

  if (error) throw error;
  return data || null;
}

export async function publishRunStatus(userId, payload) {
  if (!userId || !payload) return null;
  const forumId = await resolveForumId("running");
  if (!forumId) return null;

  const discipline = String(payload.discipline || "Run").trim();
  const name = String(payload.name || "Route effort").trim();
  const distance = String(payload.distanceLabel || "0.00 km").trim();
  const elapsed = String(payload.elapsedLabel || "00:00").trim();
  const pace = String(payload.paceLabel || "--:--/km").trim();
  const runId = payload.runId ? String(payload.runId).trim() : "";
  const body = `${discipline} logged · ${distance} in ${elapsed} · pace ${pace}${runId ? `\n[[run:${runId}]]` : ""}`;

  const { data, error } = await supabase
    .from("community_posts")
    .insert([
      {
        forum_id: forumId,
        title: `${STATUS_PREFIX}${RUN_PREFIX}${name}`,
        body,
        created_by: Number(userId),
      },
    ])
    .select("id,created_at,created_by,title,body")
    .single();

  if (error) throw error;
  return data || null;
}
