import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

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
