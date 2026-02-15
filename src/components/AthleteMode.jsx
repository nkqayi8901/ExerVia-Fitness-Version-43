import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";

import Navbar from "./Navbar";
import JournalPage from "./JournalPage";
import LogsPage from "./LogsPage";
import AthleteTrainingTab from "./AthleteTrainingTab";
import CommunityHub from "./CommunityHub";
import WorkoutProgram from "./WorkoutProgram";
// Component: AthleteMode - UI layout and interactions.
// This component renders the athletemode experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

// AthleteDashboard manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function AthleteDashboard({ profile, id, userState }) {
  const navigate = useNavigate();
  const [lastSession, setLastSession] = useState(null);
  const [lastLift, setLastLift] = useState(null);

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


  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!id) return;
    loadLastSession();
    loadLastLift();
  }, [id]);


// dayMarker manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const dayMarker = (() => {
    const now = new Date();
    const label = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    return `It's ${label} — build your base.`;
  })();




  // Render
  return (
    <div className="page-shell profile-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Athlete Dashboard</h2>
          <p className="page-subtitle">Welcome back, {profile.full_name}. Train with precision.</p>
          <div className="page-marker">{dayMarker}</div>
        </div>
        <button className="studio-back dashboard-switch-btn" onClick={() => navigate(`/gym/${id}`)}>
          Switch to Gym Mode
        </button>
      </div>

      <div className="grid-3">
        <button className="hud-card clickable" onClick={() => navigate(`/athlete/${id}/training`)}>
          <div className="hud-card-title">TRAINING</div>
          <div className="hud-big">Training Log</div>
          <div className="hud-dim">Aerobic efficiency + load</div>
        </button>

        <button className="hud-card clickable" onClick={() => navigate(`/athlete/${id}/journal`)}>
          <div className="hud-card-title">JOURNAL</div>
          <div className="hud-big">Daily Ritual</div>
          <div className="hud-dim">Mood + system readout</div>
        </button>

        <button className="hud-card clickable" onClick={() => navigate(`/athlete/${id}/logs`)}>
          <div className="hud-card-title">LOGS</div>
          <div className="hud-big">Daily Signals</div>
          <div className="hud-dim">Weight, water, meals, training</div>
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
        <button className="studio-back home-quick-btn" onClick={() => navigate(`/athlete/${id}/training`)}>
          Log session
        </button>
        <button className="studio-back home-quick-btn" onClick={() => navigate(`/athlete/${id}/logs`)}>
          Open logs
        </button>
        <button className="studio-back home-quick-btn" onClick={() => navigate(`/athlete/${id}/journal`)}>
          Open journal
        </button>
        <button className="studio-back home-quick-btn" onClick={() => navigate(`/nutrition`)}>
          Add meal
        </button>
      </div>

    </div>
  );
}

// AthleteProfileOverview manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function AthleteProfileOverview({ profile, userState }) {
  const navigate = useNavigate();
  const storedMode = localStorage.getItem("exervia_active_mode") || "athlete";
  const backPath =
    storedMode === "gym"
      ? `/gym/${profile?.id || ""}`
      : `/athlete/${profile?.id || ""}`;
  const xp = userState?.xp ?? 0;
  const level = userState?.level ?? 1;
  const rank = userState?.rank ?? "D";
  const streak = userState?.streak_days ?? 0;
  const recovery = userState?.recovery_score ?? 0;
  const fatigue = userState?.fatigue_score ?? 0;
  const safeLevel = Math.max(1, level);
  const levelStartXp = 100 * Math.pow(safeLevel - 1, 2);
  const nextLevelXp = 100 * Math.pow(safeLevel, 2);
  const levelSpan = Math.max(1, nextLevelXp - levelStartXp);
  const xpIntoLevel = Math.max(0, xp - levelStartXp);
  const xpRemaining = Math.max(0, nextLevelXp - xp);
  const levelProgressPct = Math.max(0, Math.min(100, Math.round((xpIntoLevel / levelSpan) * 100)));

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <button className="studio-back" onClick={() => navigate(backPath)} type="button">
            {'<- Back'}
          </button>
          <h2 className="page-title">Profile</h2>
          <p className="page-subtitle">Rank, level, and identity snapshot for {profile?.full_name || "athlete"}.</p>
        </div>
      </div>
      <div className="grid-3">
        <div className="hud-card">
          <div className="hud-card-title">RANK</div>
          <div className="hud-big">{rank}</div>
          <div className="hud-dim">From training volume + consistency</div>
        </div>
        <div className="hud-card">
          <div className="hud-card-title">LEVEL</div>
          <div className="hud-big">{level}</div>
          <div className="hud-dim">Experience progress</div>
        </div>
        <div className="hud-card">
          <div className="hud-card-title">XP</div>
          <div className="hud-big">{xp}</div>
          <div className="hud-dim">Last 7 days</div>
        </div>
        <div className="hud-card">
          <div className="hud-card-title">STREAK</div>
          <div className="hud-big">{streak}</div>
          <div className="hud-dim">Consecutive active days</div>
        </div>
        <div className="hud-card">
          <div className="hud-card-title">RECOVERY</div>
          <div className="hud-big">{recovery}</div>
          <div className="hud-dim">Readiness score</div>
        </div>
        <div className="hud-card">
          <div className="hud-card-title">FATIGUE</div>
          <div className="hud-big">{fatigue}</div>
          <div className="hud-dim">Load accumulation</div>
        </div>
      </div>
      <div className="hud-card profile-progress-card">
        <div className="profile-progress-head">
          <div className="hud-card-title">PROGRESSION</div>
          <div className="profile-progress-level">Level {safeLevel} · Rank {rank}</div>
        </div>
        <div className="profile-progress-sub">
          {xp} XP · {xpRemaining} XP to Level {safeLevel + 1}
        </div>
        <div className="profile-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelProgressPct}>
          <div className="profile-progress-fill" style={{ width: `${levelProgressPct}%` }} />
        </div>
      </div>
      <div className="profile-divider" />
      <details className="profile-explain plain">
        <summary className="profile-explain-head">
          <span className="profile-explain-icon" aria-hidden="true">i</span>
          <div className="profile-explain-title">How to read this</div>
        </summary>
        <div className="profile-explain-body">
          <p>
            Rank reflects your training volume and consistency across the last 7 days. Level grows with XP, which
            is earned from both strength logs and training sessions.
          </p>
          <p>
            Streak rises when you perform at least one qualifying action in a day (training, journal, post, reply,
            or reaction). Recovery is the inverse of fatigue, and Fatigue tracks load accumulation.
          </p>
          <div className="profile-explain-divider" />
        </div>
      </details>
    </div>
  );
}

export default function AthleteMode() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [userState, setUserState] = useState(null);
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const themeMode = "athlete";

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    if (id) localStorage.setItem("exervia_user_id", id);
    if (id) {
      const path = routeLocation.pathname || "";
      const isSharedPage = path.includes("/profile") || path.includes("/community");
      if (!isSharedPage) {
        localStorage.setItem("exervia_active_mode", "athlete");
      }
    }

// setMode manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const setMode = async () => {
      if (!id) return;
      await supabase.from("user_state").upsert(
        { user_id: id, active_mode: "athlete" },
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
    return <div className={`hud-bg mode-${themeMode} full-center`}>Loading...</div>;
  }

  return (
    <div className={`hud-bg mode-${themeMode}`}>
      <Navbar modeLabel="ATHLETE MODE" mode={themeMode} userId={id} />
      <Routes>
        <Route index element={<AthleteDashboard profile={profile} id={id} userState={userState} />} />
        <Route
          path="training"
          element={
            <AthleteTrainingTab
              userId={id}
              onBack={() => navigate(`/athlete/${id}`)}
            />
          }
        />
        <Route path="journal" element={<JournalPage mode="athlete" />} />
        <Route path="logs" element={<LogsPage mode="athlete" />} />
        <Route path="program/*" element={<WorkoutProgram mode="athlete" />} />
        <Route
          path="profile"
          element={<AthleteProfileOverview profile={profile} userState={userState} />}
        />
        <Route
          path="community"
          element={<CommunityHub userId={id} />}
        />
        <Route
          path="community/group/:groupId"
          element={<CommunityHub userId={id} forceGroupRoom />}
        />
        <Route
          path="community/thread/:threadId"
          element={<CommunityHub userId={id} forceThreadPage />}
        />
      </Routes>
    </div>
  );
}
