import { supabase } from '../supabaseClient';

export async function recalcUserState(userId) {
  if (!userId) return;

  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: strengthLogs }, { data: sessions }, { data: activityDays }, { data: existing }] = await Promise.all([
    supabase.from('strength_logs').select('*').eq('user_id', userId).gte('created_at', since),
    supabase.from('training_sessions').select('*').eq('user_id', userId).gte('created_at', since),
    supabase
      .from('daily_activity')
      .select('activity_date')
      .eq('user_id', userId)
      .order('activity_date', { ascending: false })
      .limit(120),
    supabase.from('user_state').select('*').eq('user_id', userId).single(),
  ]);

  // XP/level/rank are server-authoritative via RPC/integrity SQL.
  const xp = Number(existing?.xp || 0);
  const level = Number(existing?.level || 1);
  const rank = existing?.rank || 'D';

  let fatigue = 0;
  let momentum = 0;

  (strengthLogs || []).forEach((log) => {
    fatigue += (log.effort_level || 0) * 2;
    if (log.is_personal_best) momentum += 5;
  });

  (sessions || []).forEach((session) => {
    fatigue += (session.effort_level || 0) * 3;
    if (session.is_personal_best) momentum += 10;
  });

  const now = new Date();
  const lastActivity = new Date(existing?.last_activity || 0);
  const daysInactive = Math.floor((now - lastActivity) / 86400000);
  if (daysInactive >= 7) momentum -= 10;

  const fatigue_score = Math.min(Math.round(fatigue), 100);
  const recovery_score = Math.max(100 - fatigue_score, 0);
  const momentum_score = Math.round(momentum);

  const streak_days = (() => {
    const rows = activityDays || [];
    if (!rows.length) return 0;

    const uniqueDays = Array.from(new Set(rows.map((row) => row.activity_date))).sort().reverse();
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const first = uniqueDays[0];
    if (first !== todayKey && first !== yesterdayKey) return 0;

    let streak = 1;
    let prevDate = new Date(`${first}T00:00:00Z`);
    for (let i = 1; i < uniqueDays.length; i += 1) {
      const currentDate = new Date(`${uniqueDays[i]}T00:00:00Z`);
      const diffDays = Math.round((prevDate - currentDate) / 86400000);
      if (diffDays !== 1) break;
      streak += 1;
      prevDate = currentDate;
    }
    return streak;
  })();

  await supabase.from('user_state').upsert(
    {
      user_id: userId,
      xp,
      level,
      rank,
      fatigue_score,
      recovery_score,
      momentum_score,
      streak_days,
      last_activity: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id' }
  );
}
