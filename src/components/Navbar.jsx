import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import ModeNav from "./ModeNav";
// Component: Navbar - UI layout and interactions.
// This component renders the navbar experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

export default function Navbar({ modeLabel = "SYSTEM", mode = null, userId = null }) {
  const [userState, setUserState] = useState(null);

// fetchUserState manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
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

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    fetchUserState();

// handler manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const handler = () => {
      fetchUserState();
    };
    window.addEventListener("user_state_updated", handler);

    // Render
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