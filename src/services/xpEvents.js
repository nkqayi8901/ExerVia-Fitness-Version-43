import { supabase } from "../supabaseClient";

const isNotAllowedError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("not allowed");
};

const ensureProfileAuthLink = async (profileId) => {
  if (!profileId) return false;
  const { data, error } = await supabase.rpc("ensure_profile_auth_link", {
    p_profile_id: Number(profileId),
  });
  if (error) return false;
  return Boolean(data);
};

export async function grantXpEventSafe({
  userId,
  eventType,
  baseXp,
  idempotencyKey,
  sourceTable = null,
  sourceId = null,
  meta = {},
}) {
  const payload = {
    p_user_id: Number(userId),
    p_event_type: String(eventType || ""),
    p_base_xp: Number(baseXp || 0),
    p_idempotency_key: String(idempotencyKey || ""),
    p_source_table: sourceTable ? String(sourceTable) : null,
    p_source_id: sourceId ? String(sourceId) : null,
    p_meta: meta || {},
  };

  const invoke = async () => supabase.rpc("grant_xp_event", payload);

  let { data, error } = await invoke();
  if (!error) {
    return { awardedXp: Number(data || 0), relinked: false, error: null };
  }

  if (!isNotAllowedError(error)) {
    return { awardedXp: 0, relinked: false, error };
  }

  const relinked = await ensureProfileAuthLink(userId);
  if (!relinked) {
    return { awardedXp: 0, relinked: false, error };
  }

  ({ data, error } = await invoke());
  if (error) {
    return { awardedXp: 0, relinked: true, error };
  }

  return { awardedXp: Number(data || 0), relinked: true, error: null };
}

