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
      last_activity: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' });
}
