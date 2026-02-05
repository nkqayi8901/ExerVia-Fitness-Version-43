import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import ModeNav from "./ModeNav";

export default function Navbar({ modeLabel = "SYSTEM", mode = null, userId = null }) {
  const [userState, setUserState] = useState(null);

  const fetchUserState = async () => {
    const userId = localStorage.getItem('exervia_user_id');
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!error && data) setUserState(data);
  };

  useEffect(() => {
    fetchUserState();

    const handler = () => {
      fetchUserState();
    };
    window.addEventListener("user_state_updated", handler);

    return () => window.removeEventListener("user_state_updated", handler);
  }, []);

  return (
    <nav className="hud-topbar">
      <div className="hud-brand">
        <div className="hud-logo">E</div>
        <div>
          <div className="hud-title">ExerVia</div>
          <div className="hud-subtitle">{modeLabel}</div>
        </div>
      </div>

      {mode && userId && (
        <ModeNav mode={mode} userId={userId} placement="inline" />
      )}

      <div className="hud-stats">
        <div className="hud-pill">
          <span className="hud-dim">LV</span>
          <span className="hud-strong">{userState?.level ?? 1}</span>
        </div>
        <div className="hud-pill">
          <span className="hud-dim">RANK</span>
          <span className="hud-strong">{userState?.rank ?? 'E'}</span>
        </div>
        <div className="hud-pill">
          <span className="hud-dim">XP</span>
          <span className="hud-strong">{userState?.xp ?? 0}</span>
        </div>
      </div>
    </nav>
  );
}
