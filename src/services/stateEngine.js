import { supabase } from '../supabaseClient';

export async function recalcUserState(userId) {
  if (!userId) return;

  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: strengthLogs } = await supabase
    .from('strength_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since);

  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since);

  const { data: activityDays } = await supabase
    .from('daily_activity')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .limit(120);

  let xp = 0;
  let fatigue = 0;
  let momentum = 0;

  (strengthLogs || []).forEach(log => {
    xp += (log.reps || 0) * (log.sets || 0);
    fatigue += (log.effort_level || 0) * 2;
    if (log.is_personal_best) momentum += 5;
  });

  (sessions || []).forEach(session => {
    xp += session.duration_minutes || 0;
    fatigue += (session.effort_level || 0) * 3;
    // (your training_sessions currently doesn’t set is_personal_best, so this is harmless)
    if (session.is_personal_best) momentum += 10;
  });

  // Weekly decay (light pressure)
  const { data: existing } = await supabase
    .from('user_state')
    .select('*')
    .eq('user_id', userId)
    .single();

  const now = new Date();
  const lastActivity = new Date(existing?.last_activity || 0);
  const daysInactive = Math.floor((now - lastActivity) / 86400000);

  if (daysInactive >= 7) {
    momentum -= 10;
    xp = Math.max(xp - 50, 0);
  }

  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const rank =
    level >= 20 ? 'S' :
    level >= 15 ? 'A' :
    level >= 10 ? 'B' :
    level >= 5  ? 'C' : 'D';

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

  // ✅ IMPORTANT: upsert ensures row exists
  await supabase
    .from('user_state')
    .upsert({
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
    }, { onConflict: 'user_id' });
}
