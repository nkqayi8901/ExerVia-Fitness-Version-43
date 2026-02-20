import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
// Component: ResetPasswordPage - UI layout and interactions.
// This component renders the reset password experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the reset password page which allows users to set a new password after they have requested a password reset email
// the UI layout and styling was adapted from Tailwind form components found on https://tailwindui.com/preview
// the data fetching and state management logic was adapted from the patterns 
// I learned in the SystemStatus and Navbar components
// the password reset flow was adapted from the official Supabase 
// documentation found at https://supabase.com/docs/guides/auth/managing-users#resetting-passwords
// this page is accessed through a link sent to the user's email when they request a password reset
// the link contains a token that allows the user to set a new password without being logged in

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionReady(Boolean(data?.session));
    };

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdatePassword = async () => {
    if (!password || password.length < 6) {
      setBanner("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setBanner("Passwords do not match.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setBanner("Could not update password. Try opening the reset link again.");
      return;
    }

    setBanner("Password updated. Redirecting to login...");
    setTimeout(() => {
      navigate("/auth");
    }, 1200);
  };

  return (
    <div className="profile-body">
      <div className="profile-container">
        <div className="profile-section">
          <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
          <p className="text-gray-300 mb-6">
            {sessionReady
              ? "Set your new password below."
              : "Open this page from your reset email link to continue."}
          </p>

          {banner ? <p className="text-white">{banner}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-white mb-2">New Password</label>
              <input
                type="password"
                className="profile-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-white mb-2">Confirm Password</label>
              <input
                type="password"
                className="profile-input"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              className="profile-button-primary"
              onClick={handleUpdatePassword}
              disabled={saving || !sessionReady}
              type="button"
            >
              {saving ? "Saving..." : "Update Password"}
            </button>
            <button className="studio-back" onClick={() => navigate("/auth")} type="button">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
