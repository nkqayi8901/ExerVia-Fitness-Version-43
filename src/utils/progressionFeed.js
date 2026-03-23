import { supabase } from "../supabaseClient";
import { STATUS_PREFIX } from "../components/community/communityHelpers";

export const PROMOTION_PREFIX = "[PROMOTION] ";
const FORUM_CACHE_KEY = "exervia_status_forum_id";

function buildPromotionStatusTitle(moment) {
  return `${STATUS_PREFIX}${PROMOTION_PREFIX}${moment.primaryLabel}`;
}

async function resolveStatusForumId() {
  const cached = localStorage.getItem(FORUM_CACHE_KEY);
  if (cached) return cached;

  const mindsetRes = await supabase
    .from("community_forums")
    .select("id")
    .eq("topic_slug", "mindset")
    .maybeSingle();

  const resolvedId = mindsetRes?.data?.id;
  if (resolvedId) {
    localStorage.setItem(FORUM_CACHE_KEY, String(resolvedId));
    return resolvedId;
  }

  const fallbackRes = await supabase
    .from("community_forums")
    .select("id")
    .limit(1)
    .maybeSingle();

  const fallbackId = fallbackRes?.data?.id;
  if (fallbackId) {
    localStorage.setItem(FORUM_CACHE_KEY, String(fallbackId));
  }
  return fallbackId || null;
}

export async function publishProgressionStatus(userId, moment) {
  if (!userId || !moment) return null;
  const forumId = await resolveStatusForumId();
  if (!forumId) return null;

  const { data, error } = await supabase
    .from("community_posts")
    .insert([
      {
        forum_id: forumId,
        title: buildPromotionStatusTitle(moment),
        body: moment.subtitle,
        created_by: Number(userId),
      },
    ])
    .select("id,created_at,created_by,title,body")
    .single();

  if (error) throw error;
  return data || null;
}
