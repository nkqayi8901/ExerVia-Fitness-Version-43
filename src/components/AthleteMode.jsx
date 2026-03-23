import { Routes, Route, useNavigate, useLocation, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";

import Navbar from "./Navbar";
import JournalPage from "./JournalPage";
import LogsPage from "./LogsPage";
import AthleteTrainingTab from "./AthleteTrainingTab";
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

// Component: AthleteMode - UI layout and interactions.
// This component renders the athletemode experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the main component for the athlete mode experience
// it manages the overall layout and routing for the athlete mode sections
// it also handles fetching the user's profile and state information to
// display in the navbar and profile overview
// the athlete mode is focused on holistic athlete development and provides
// features like training plans, a training journal, progress tracking, and a community hub for athletes
// the UI layout and styling was adapted from Tailwind components found on https://tailwindui.com/preview
// the data fetching and state management logic was adapted from the patterns I learned in the SystemStatus and Navbar components

// AthleteDashboard manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
function AthleteDashboard({ profile, id, userState }) {
  const navigate = useNavigate();
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);

// dayMarker manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const dayMarker = (() => {
    const now = new Date();
    const label = now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    return `It's ${label} —  log a session.`;
  })();
  // Render
  return (
    <div className="page-shell profile-shell">
      <div className="page-header dashboard-hero">
        <div className="dashboard-hero-main">
          <div className="dashboard-hero-kicker">Performance System</div>
          <div className="dashboard-title-row">
            <h2 className="page-title"> {profile.full_name}'s Athlete Dashboard</h2>
            <div className="dashboard-header-actions">
              <button className="studio-back dashboard-header-btn" type="button" onClick={() => setWalkthroughOpen(true)}>
                Walkthrough
              </button>
              <button className="studio-back dashboard-header-btn dashboard-switch-btn" onClick={() => navigate(`/gym/${id}`)}>
                Switch to Gym Mode
              </button>
            </div>
          </div>
          <p className="page-subtitle">Welcome back, {profile.full_name}. Train with precision.</p>
          <div className="page-marker">{dayMarker}</div>
        </div>
      </div>
      <div className="grid-3 dashboard-card-grid">
        <button className="hud-card clickable dashboard-section-card dashboard-section-card-featured" onClick={() => navigate(`/athlete/${id}/training`)}>
          <div className="dashboard-section-accent" aria-hidden="true" />
          <div className="hud-card-title">TRAINING</div>
          <div className="hud-big">Training Log</div>
          <div className="hud-dim">Aerobic efficiency + load</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/athlete/${id}/journal`)}>
          <div className="hud-card-title">JOURNAL</div>
          <div className="hud-big">Daily Ritual</div>
          <div className="hud-dim">Mood + system readout</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/athlete/${id}/logs`)}>
          <div className="hud-card-title">LOGS</div>
          <div className="hud-big">Daily Signals</div>
          <div className="hud-dim">Weight, water, meals, training</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/nutrition`)}>
          <div className="hud-card-title">NUTRITION</div>
          <div className="hud-big">Fuel</div>
          <div className="hud-dim">Search + track meals</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/athlete/${id}/profile`)}>
          <div className="hud-card-title">PROFILE</div>
          <div className="hud-big">Rank + Level</div>
          <div className="hud-dim">Identity, badges, progress</div>
        </button>

        <button className="hud-card clickable dashboard-section-card" onClick={() => navigate(`/athlete/${id}/community`)}>
          <div className="hud-card-title">COMMUNITY</div>
          <div className="hud-big">Social</div>
          <div className="hud-dim">Groups, forums, challenges</div>
        </button>
      </div>

      <div className="quick-add-row dashboard-quick-grid">
        <button className="studio-back home-quick-btn dashboard-quick-btn" onClick={() => navigate(`/athlete/${id}/training`)}>
          Log session
        </button>
        <button className="studio-back home-quick-btn dashboard-quick-btn" onClick={() => navigate(`/athlete/${id}/logs`)}>
          Open logs
        </button>
        <button className="studio-back home-quick-btn dashboard-quick-btn" onClick={() => navigate(`/athlete/${id}/journal`)}>
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
        mode="athlete"
        userId={id}
      />

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
          <button className="studio-back" onClick={() => navigate(backPath)} type="button">
            {'Back'}
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
          {xpRemaining} XP remaining. Keep training, recovery, and daily signals moving together to keep climbing.
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

export default function AthleteMode() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [userState, setUserState] = useState(null);
  const [promotionMoment, setPromotionMoment] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const profileRequestRef = useRef(0);
  const stateRequestRef = useRef(0);
  const progressionBaselineRef = useRef(null);
  const promotionTimerRef = useRef(null);
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const themeMode = "athlete";

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
  }, [id, routeLocation.pathname]);

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
      setProfileReady(false);
      const requestId = profileRequestRef.current + 1;
      profileRequestRef.current = requestId;
      const fallbackName = localStorage.getItem("exervia_display_name") || "Athlete";
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("user_profiles")
            .select("*")
            .eq("id", id)
            .maybeSingle(),
          6000,
          "Profile load timed out"
        );
        if (profileRequestRef.current !== requestId) return;
        if (error || !data) {
          setProfile({
            id,
            full_name: fallbackName,
            username: localStorage.getItem("exervia_username") || "",
          });
          setProfileReady(true);
          return;
        }
        setProfile(data);
        localStorage.setItem("exervia_display_name", String(data.display_name || data.full_name || fallbackName));
        setProfileReady(true);
        return;
      } catch (error) {
        console.error("AthleteMode profile load failed:", error);
      }
      if (profileRequestRef.current !== requestId) return;
      setProfile({
        id,
        full_name: fallbackName,
        username: localStorage.getItem("exervia_username") || "",
      });
      setProfileReady(true);
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
            discipline: "performance",
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
          supabase
            .from("user_state")
            .select("*")
            .eq("user_id", id)
            .single(),
          5000,
          "State load timed out"
        );
        if (stateRequestRef.current !== requestId) return;
        if (!data) {
          await withTimeout(recalcUserState(id), 5000, "State recalc timed out");
          const { data: refreshed } = await withTimeout(
            supabase
              .from("user_state")
              .select("*")
              .eq("user_id", id)
              .single(),
            5000,
            "State refresh timed out"
          );
          if (stateRequestRef.current !== requestId) return;
          applyIncomingState(refreshed || null);
          return;
        }
        applyIncomingState(data);
      } catch (error) {
        console.error("AthleteMode user_state load failed:", error);
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

  if (!profileReady || !profile) {
    return <div className={`hud-bg mode-${themeMode} full-center`}>Loading...</div>;
  }

  return (
    <div className={`hud-bg mode-${themeMode}`}>
      <Navbar modeLabel="ATHLETE MODE" mode={themeMode} userId={id} />
      <PromotionMoment
        moment={promotionMoment}
        onClose={() => setPromotionMoment(null)}
        onOpenProfile={() => {
          setPromotionMoment(null);
          navigate(`/athlete/${id}/profile`);
        }}
      />
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
          path="profile/:targetId"
          element={<PublicProfilePage mode="athlete" viewerId={id} />}
        />
        <Route
          path="profile/:targetId/session/:sessionType/:sessionId"
          element={<PublicSessionDetailPage mode="athlete" viewerId={id} />}
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
        <Route path="messages" element={<MessagesPage mode="athlete" userId={id} />} />
      </Routes>
    </div>
  );
}
