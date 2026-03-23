import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";

import Navbar from "./Navbar";
import JournalPage from "./JournalPage";
import LogsPage from "./LogsPage";
import StrengthProgressTab from "./StrengthProgressTab";
import CommunityHub from "./CommunityHub";
import WorkoutProgram from "./WorkoutProgram";
import PublicProfilePage from "./PublicProfilePage";
import PublicSessionDetailPage from "./PublicSessionDetailPage";
import MessagesPage from "./MessagesPage";
import DashboardWalkthroughModal from "./DashboardWalkthroughModal";
import PromotionMoment from "./PromotionMoment";
import { emitToast } from "../utils/toast";
import { buildProgressionMoment } from "../utils/progressionMoment";
import { publishProgressionStatus } from "../utils/progressionFeed";

// Component: GymMode - UI layout and interactions.
// This component renders the gymmode experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the main component for the gym mode experience
// it manages the overall layout and routing for the gym mode sections
// it also handles fetching the user's profile and state information to display in the navbar and profile overview
// the gym mode is focused on strength training and provides
// features like a strength log, training journal, progress tracking, and a community hub for gym users
// the UI layout and styling was adapted from Tailwind components found on https://tailwindui.com/preview
// the data fetching and state management logic was adapted 
// from the patterns I learned in the SystemStatus and Navbar components

// GymDashboard manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function GymDashboard({ profile, id, userState }) {
  const navigate = useNavigate();
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);

// dayMarker manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const dayMarker = (() => {
    const now = new Date();
    const label = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    return `It's ${label} — log a session.`;
  })();
  // Render
  return (
    <div className="page-shell profile-shell">
      <div className="page-header dashboard-hero">
        <div className="dashboard-hero-main">
          <div className="dashboard-hero-kicker">Strength System</div>
          <div className="dashboard-title-row">
            <h2 className="page-title">{profile.full_name}'s Gym Dashboard</h2>
            <div className="dashboard-header-actions">
              <button className="studio-back dashboard-header-btn" type="button" onClick={() => setWalkthroughOpen(true)}>
                Walkthrough
              </button>
              <button className="studio-back dashboard-header-btn dashboard-switch-btn" onClick={() => navigate(`/athlete/${id}`)}>
                Switch to Athlete Mode
              </button>
            </div>
          </div>
          <p className="page-subtitle">Welcome back, {profile.full_name}. Start your day right.</p>
          <div className="page-marker">{dayMarker}</div>
        </div>
      </div>
      <div className="grid-3 dashboard-card-grid">
        <button className="hud-card clickable dashboard-section-card dashboard-section-card-featured" onClick={() => navigate(`/gym/${id}/progress`)}>
          <div className="dashboard-section-accent" aria-hidden="true" />
          <div className="hud-card-title">PROGRESS</div>
          <div className="hud-big">Strength Log</div>
          <div className="hud-dim">PRs, 1RM, progression</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/gym/${id}/journal`)}>
          <div className="hud-card-title">JOURNAL</div>
          <div className="hud-big">Daily Ritual</div>
          <div className="hud-dim">Mood + system readout</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/gym/${id}/logs`)}>
          <div className="hud-card-title">LOGS</div>
          <div className="hud-big">Daily Signals</div>
          <div className="hud-dim">Weight, water, meals, training</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/nutrition`)}>
          <div className="hud-card-title">NUTRITION</div>
          <div className="hud-big">Fuel</div>
          <div className="hud-dim">Search + track meals</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/gym/${id}/profile`)}>
          <div className="hud-card-title">PROFILE</div>
          <div className="hud-big">Rank + Level</div>
          <div className="hud-dim">Identity, badges, progress</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/gym/${id}/community`)}>
          <div className="hud-card-title">COMMUNITY</div>
          <div className="hud-big">Social</div>
          <div className="hud-dim">Groups, forums, challenges</div>
        </button>
      </div>

      <div className="quick-add-row dashboard-quick-grid">
        <button className="studio-back home-quick-btn dashboard-quick-btn" onClick={() => navigate(`/gym/${id}/progress`)}>
          Log session
        </button>
        <button className="studio-back home-quick-btn dashboard-quick-btn" onClick={() => navigate(`/gym/${id}/logs`)}>
          Open logs
        </button>
        <button className="studio-back home-quick-btn dashboard-quick-btn" onClick={() => navigate(`/gym/${id}/journal`)}>
          Open journal
        </button>
        <button className="studio-back home-quick-btn dashboard-quick-btn" onClick={() => navigate(`/nutrition`)}>
          Add meal
        </button>
        <button className="studio-back home-quick-btn dashboard-quick-btn" onClick={() => navigate(`/settings`)}>
          Settings
        </button>
      </div>
      <DashboardWalkthroughModal
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        mode="gym"
        userId={id}
      />

    </div>
  );
}

function GymProfileOverview({ profile, userState }) {
  const navigate = useNavigate();
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
  const milestoneTone =
    xpRemaining <= Math.max(80, Math.round(levelSpan * 0.18))
      ? "Milestone close"
      : xpRemaining <= Math.max(160, Math.round(levelSpan * 0.34))
        ? "Unlock building"
        : "Identity in progress";
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <button className="studio-back" onClick={() => navigate(`/gym/${profile?.id || ""}`)} type="button">
            {"Back"}
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
      <div className="hud-card profile-progress-card profile-progress-card-merged">
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
        <div className="profile-progress-divider" />
        <div className="hud-card-title">NEXT PRESTIGE TARGET</div>
        <div className="profile-prestige-title">Level {safeLevel + 1} unlock</div>
        <div className="profile-prestige-sub">
          {xpRemaining} XP remaining. Keep training volume, daily logging, and streak protection moving in the same direction.
        </div>
        <div className="profile-prestige-note">
          <span>{milestoneTone}</span>
          <strong>Next visible identity step: Rank {rank} · Level {safeLevel + 1} across your profile and community surfaces.</strong>
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

export default function GymMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [userState, setUserState] = useState(null);
  const [promotionMoment, setPromotionMoment] = useState(null);
  const profileRequestRef = useRef(0);
  const stateRequestRef = useRef(0);
  const progressionBaselineRef = useRef(null);
  const promotionTimerRef = useRef(null);

  const withTimeout = async (promise, timeoutMs, label = "Request timed out") => {
    let timeoutHandle = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
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

  useEffect(() => () => {
    if (promotionTimerRef.current) clearTimeout(promotionTimerRef.current);
  }, []);

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
      const requestId = profileRequestRef.current + 1;
      profileRequestRef.current = requestId;
      const fallbackName = localStorage.getItem("exervia_display_name") || "Athlete";
      try {
        const { data } = await withTimeout(
          supabase.from("user_profiles").select("*").eq("id", id).single(),
          6000,
          "Profile load timed out"
        );
        if (profileRequestRef.current !== requestId) return;
        if (data) {
          setProfile(data);
          localStorage.setItem("exervia_display_name", String(data.display_name || data.full_name || fallbackName));
          return;
        }
      } catch (error) {
        console.error("GymMode profile load failed:", error);
      }
      if (profileRequestRef.current !== requestId) return;
      setProfile((prev) =>
        prev || {
          id,
          full_name: fallbackName,
          display_name: fallbackName,
          username: localStorage.getItem("exervia_username") || "",
        }
      );
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
      const requestId = stateRequestRef.current + 1;
      stateRequestRef.current = requestId;
      const cacheKey = `exervia_user_state_${id}`;
      const applyIncomingState = (nextState, { allowMoment = true } = {}) => {
        setUserState(nextState);
        if (!nextState) {
          progressionBaselineRef.current = null;
          localStorage.removeItem(cacheKey);
          return;
        }
        if (allowMoment) {
          const moment = buildProgressionMoment(progressionBaselineRef.current, nextState, {
            discipline: "strength",
          });
          if (moment) {
            setPromotionMoment(moment);
            emitToast(moment.toastMessage, "success", 3800);
            publishProgressionStatus(id, moment)
              .then((post) => {
                if (post?.id) {
                  window.dispatchEvent(new CustomEvent("exervia:progression_event", { detail: { userId: Number(id), postId: post.id } }));
                }
              })
              .catch(() => {});
            if (promotionTimerRef.current) clearTimeout(promotionTimerRef.current);
            promotionTimerRef.current = setTimeout(() => setPromotionMoment(null), 5200);
          }
        }
        progressionBaselineRef.current = nextState;
        localStorage.setItem(cacheKey, JSON.stringify(nextState));
      };
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            applyIncomingState(parsed, { allowMoment: false });
          }
        }
      } catch {
        // ignore cache parse errors
      }
      try {
        const { data } = await withTimeout(
          supabase.from("user_state").select("*").eq("user_id", id).single(),
          5000,
          "State load timed out"
        );
        if (stateRequestRef.current !== requestId) return;
        if (!data) {
          await withTimeout(recalcUserState(id), 5000, "State recalc timed out");
          const { data: refreshed } = await withTimeout(
            supabase.from("user_state").select("*").eq("user_id", id).single(),
            5000,
            "State refresh timed out"
          );
          if (stateRequestRef.current !== requestId) return;
          applyIncomingState(refreshed || null);
          return;
        }
        applyIncomingState(data);
      } catch (error) {
        console.error("GymMode user_state load failed:", error);
      }
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
      <PromotionMoment
        moment={promotionMoment}
        onClose={() => setPromotionMoment(null)}
        onOpenProfile={() => {
          setPromotionMoment(null);
          navigate(`/gym/${id}/profile`);
        }}
      />
      <Routes>
        <Route index element={<GymDashboard profile={profile} id={id} userState={userState} />} />
        <Route path="progress" element={<StrengthProgressTab userId={id} />} />
        <Route path="journal" element={<JournalPage mode="gym" />} />
        <Route path="logs" element={<LogsPage mode="gym" />} />
        <Route path="program/*" element={<WorkoutProgram mode="gym" />} />
        <Route path="profile" element={<GymProfileOverview profile={profile} userState={userState} />} />
        <Route path="profile/:targetId" element={<PublicProfilePage mode="gym" viewerId={id} />} />
        <Route
          path="profile/:targetId/session/:sessionType/:sessionId"
          element={<PublicSessionDetailPage mode="gym" viewerId={id} />}
        />
        <Route path="community" element={<CommunityHub userId={id} />} />
        <Route path="community/group/:groupId" element={<CommunityHub userId={id} forceGroupRoom />} />
        <Route path="community/thread/:threadId" element={<CommunityHub userId={id} forceThreadPage />} />
        <Route path="messages" element={<MessagesPage mode="gym" userId={id} />} />
      </Routes>
    </div>
  );
}
