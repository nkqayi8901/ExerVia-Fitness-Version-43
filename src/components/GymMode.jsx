import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";

import Navbar from "./Navbar";
import JournalPage from "./JournalPage";
import StrengthProgressTab from "./StrengthProgressTab";
import WorkoutProgram from "./WorkoutProgram";
// Component: GymMode - UI layout and interactions.
// This component renders the gymmode experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

// GymDashboard manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function GymDashboard({ profile, id, userState }) {
  const navigate = useNavigate();
  const [lastLift, setLastLift] = useState(null);
  const [lastSession, setLastSession] = useState(null);

// loadLastLift manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const loadLastLift = async () => {
    const { data } = await supabase
      .from("strength_logs")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    setLastLift(data || null);
  };

// loadLastSession manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const loadLastSession = async () => {
    const { data } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    setLastSession(data || null);
  };


  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!id) return;
    loadLastLift();
    loadLastSession();
  }, [id]);


// dayMarker manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const dayMarker = (() => {
    const now = new Date();
    const label = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    return `It's ${label} — forge your strength.`;
  })();




  // Render
  return (
    <div className="page-shell profile-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Gym Dashboard</h2>
          <p className="page-subtitle">Welcome back, {profile.full_name}. Build the system.</p>
          <div className="page-marker">{dayMarker}</div>
        </div>
        <button className="hud-secondary-btn" onClick={() => navigate(`/athlete/${id}`)}>
          Switch to Athlete Mode
        </button>
      </div>

      <div className="grid-3">
        <button className="hud-card clickable" onClick={() => navigate(`/gym/${id}/progress`)}>
          <div className="hud-card-title">PROGRESS</div>
          <div className="hud-big">Strength Log</div>
          <div className="hud-dim">PRs, 1RM, progression</div>
        </button>

        <button className="hud-card clickable" onClick={() => navigate(`/gym/${id}/journal`)}>
          <div className="hud-card-title">JOURNAL</div>
          <div className="hud-big">Daily Ritual</div>
          <div className="hud-dim">Mood + system readout</div>
        </button>

        <button className="hud-card clickable" onClick={() => navigate(`/nutrition`)}>
          <div className="hud-card-title">NUTRITION</div>
          <div className="hud-big">Fuel</div>
          <div className="hud-dim">Search + track meals</div>
        </button>

        <button className="hud-card clickable" onClick={() => navigate(`/athlete/${id}/profile`)}>
          <div className="hud-card-title">PROFILE</div>
          <div className="hud-big">Rank + Level</div>
          <div className="hud-dim">Identity, badges, progress</div>
        </button>

        <button className="hud-card clickable" onClick={() => navigate(`/athlete/${id}/community`)}>
          <div className="hud-card-title">COMMUNITY</div>
          <div className="hud-big">Social</div>
          <div className="hud-dim">Groups, forums, challenges</div>
        </button>
      </div>

      <div className="quick-add-row">
        <button className="hud-secondary-btn" onClick={() => navigate(`/gym/${id}/progress`)}>
          Log lift
        </button>
        <button className="hud-secondary-btn" onClick={() => navigate(`/gym/${id}/journal`)}>
          Open journal
        </button>
        <button className="hud-secondary-btn" onClick={() => navigate(`/nutrition`)}>
          Add meal
        </button>
      </div>

    </div>
  );
}

export default function GymMode() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [userState, setUserState] = useState(null);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (id) localStorage.setItem("exervia_user_id", id);
    if (id) localStorage.setItem("exervia_active_mode", "gym");

// setMode manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const setMode = async () => {
      if (!id) return;
      await supabase.from("user_state").upsert(
        { user_id: id, active_mode: "gym" },
        { onConflict: "user_id" }
      );
    };

    setMode();
  }, [id]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
// fetchProfile manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", id)
        .single();
      setProfile(data);
    };

    fetchProfile();
  }, [id]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (!id) return;

// fetchUserState manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const fetchUserState = async () => {
      const { data } = await supabase
        .from("user_state")
        .select("*")
        .eq("user_id", id)
        .single();
      if (!data) {
        await recalcUserState(id);
        const { data: refreshed } = await supabase
          .from("user_state")
          .select("*")
          .eq("user_id", id)
          .single();
        setUserState(refreshed);
        return;
      }
      setUserState(data);
    };

    fetchUserState();

// handler manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const handler = () => fetchUserState();
    window.addEventListener("user_state_updated", handler);
    return () => window.removeEventListener("user_state_updated", handler);
  }, [id]);

  if (!profile) {
    return <div className="hud-bg mode-gym full-center">Loading...</div>;
  }

  return (
    <div className="hud-bg mode-gym">
      <Navbar modeLabel="GYM MODE" mode="gym" userId={id} />
      <Routes>
        <Route index element={<GymDashboard profile={profile} id={id} userState={userState} />} />
        <Route path="progress" element={<StrengthProgressTab userId={id} />} />
        <Route path="journal" element={<JournalPage mode="gym" />} />
        <Route path="program/*" element={<WorkoutProgram mode="gym" />} />
      </Routes>
    </div>
  );
}