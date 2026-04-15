import { useState } from "react";
import { supabase } from "../supabaseClient";
import { emitToast } from "../utils/toast";

const DISCIPLINES = ["Running", "Cycling", "Swimming", "Triathlon", "Walking", "Other"];

export default function AthleteOnboardingModal({ userId, profile, onComplete }) {
  const [displayName, setDisplayName] = useState(
    profile?.display_name || profile?.full_name || ""
  );
  const [city, setCity] = useState(profile?.city || "");
  const [discipline, setDiscipline] = useState("Running");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const cleanCity = city.trim();
    const cleanName = displayName.trim();
    if (!cleanCity) {
      emitToast("Please enter your city — it's needed for the leaderboard.", "warn");
      return;
    }
    if (!cleanName) {
      emitToast("Please enter your display name.", "warn");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({ display_name: cleanName, full_name: cleanName, city: cleanCity })
      .eq("id", Number(userId));
    setSaving(false);
    if (error) {
      emitToast("Could not save profile. Try again.", "error");
      return;
    }
    localStorage.setItem("exervia_display_name", cleanName);
    localStorage.setItem("exervia_discipline", discipline);
    emitToast("Profile set up! You're ready to compete.", "success");
    onComplete({ display_name: cleanName, city: cleanCity });
  };

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="onboarding-logo">⚡</div>
          <h2 className="onboarding-title">Welcome to ExerVia</h2>
          <p className="onboarding-sub">
            Set up your athlete profile to unlock challenges, leaderboards, and rivals.
          </p>
        </div>

        <div className="onboarding-fields">
          <div className="onboarding-field">
            <label className="onboarding-label">Display Name</label>
            <input
              className="profile-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name as others will see it"
              maxLength={40}
            />
          </div>

          <div className="onboarding-field">
            <label className="onboarding-label">
              Your City <span className="onboarding-required">*</span>
            </label>
            <input
              className="profile-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. London, New York, Lagos..."
              maxLength={60}
            />
            <span className="onboarding-hint">Used for the city leaderboard and finding nearby runners</span>
          </div>

          <div className="onboarding-field">
            <label className="onboarding-label">Primary Discipline</label>
            <select
              className="profile-select"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
            >
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="profile-button-update"
          onClick={handleSave}
          disabled={saving}
          type="button"
          style={{ width: "100%", marginTop: 8 }}
        >
          {saving ? "Saving..." : "Let's Go →"}
        </button>

        <button
          className="onboarding-skip"
          onClick={() => onComplete(null)}
          type="button"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
