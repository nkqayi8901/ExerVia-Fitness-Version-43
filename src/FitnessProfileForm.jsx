import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";

const FITNESS_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const PRIMARY_GOALS = ["Build Muscle", "Lose Weight", "Improve Endurance", "General Fitness"];

const slugifyUsername = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

const parseAuthError = (error, fallback) => {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (message.includes("email address") && message.includes("already")) {
    return "Email already in use.";
  }
  if (message.includes("user already registered")) {
    return "Email already in use.";
  }
  if (message.includes("already registered") || message.includes("already been registered")) {
    return "Email already in use.";
  }
  if (message.includes("email not confirmed")) {
    return "Email not confirmed yet. Check your inbox and confirm the account.";
  }
  return fallback;
};

export default function FitnessProfileForm() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("Beginner");
  const [primaryGoal, setPrimaryGoal] = useState("Build Muscle");

  const [claimUsername, setClaimUsername] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [claimPassword, setClaimPassword] = useState("");

  const [profile, setProfile] = useState(null);

  const resolvedUsername = useMemo(() => slugifyUsername(username || fullName), [username, fullName]);

  const setUserStorage = (profileRow, authUser) => {
    localStorage.setItem("exervia_user_id", String(profileRow.id));
    localStorage.setItem("exervia_username", String(profileRow.username || ""));
    localStorage.setItem("exervia_display_name", String(profileRow.display_name || profileRow.full_name || ""));
    if (authUser?.id) {
      localStorage.setItem("exervia_auth_uid", String(authUser.id));
    }
  };

  const clearUserStorage = () => {
    localStorage.removeItem("exervia_user_id");
    localStorage.removeItem("exervia_username");
    localStorage.removeItem("exervia_display_name");
    localStorage.removeItem("exervia_auth_uid");
  };

  const fetchProfileByAuthUser = async (authUser) => {
    if (!authUser?.id) return null;

    const { data: existing, error: existingError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (existingError) {
      setBanner("Could not load your profile.");
      return null;
    }
    if (existing) return existing;

    const baseName = authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Athlete";
    let candidateUsername = slugifyUsername(authUser.user_metadata?.username || baseName) || `athlete${Date.now()}`;

    for (let i = 0; i < 8; i += 1) {
      const testName = i === 0 ? candidateUsername : `${candidateUsername}${i + 1}`;
      const { data: collision } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("username", testName)
        .maybeSingle();
      if (!collision) {
        candidateUsername = testName;
        break;
      }
    }

    const draft = {
      full_name: baseName,
      display_name: baseName,
      username: candidateUsername,
      email: authUser.email || null,
      auth_user_id: authUser.id,
      fitness_level: "Beginner",
      primary_goal: "General Fitness"
    };

    const { data: created, error: createError } = await supabase
      .from("user_profiles")
      .insert([draft])
      .select("*")
      .single();

    if (createError) {
      setBanner("Could not create your profile yet. Try again.");
      return null;
    }
    return created;
  };

  const syncSession = async (nextSession) => {
    setSession(nextSession || null);
    if (!nextSession?.user) {
      setProfile(null);
      clearUserStorage();
      setLoading(false);
      return;
    }

    const row = await fetchProfileByAuthUser(nextSession.user);
    if (row) {
      setProfile(row);
      setFullName(row.full_name || "");
      setUsername(row.username || "");
      setFitnessLevel(row.fitness_level || "Beginner");
      setPrimaryGoal(row.primary_goal || "Build Muscle");
      setUserStorage(row, nextSession.user);
    }
    setLoading(false);
  };

  const resolveHomePath = async (profileId) => {
    if (!profileId) return "/auth";
    const { data } = await supabase
      .from("user_state")
      .select("active_mode")
      .eq("user_id", profileId)
      .maybeSingle();
    const modeFromState = data?.active_mode;
    const modeFromStorage = localStorage.getItem("exervia_active_mode");
    const preferredMode = modeFromState || modeFromStorage || "gym";
    localStorage.setItem("exervia_active_mode", preferredMode);
    return preferredMode === "athlete" ? `/athlete/${profileId}` : `/gym/${profileId}`;
  };

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await syncSession(data?.session || null);
    };

    boot();

    const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await syncSession(nextSession);
    });

    return () => {
      mounted = false;
      authSub?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToApp = async () => {
    if (!profile?.id) return;
    const destination = await resolveHomePath(profile.id);
    navigate(destination);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setBanner("Enter your email and password.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    setSaving(false);
    if (error) {
      setBanner(parseAuthError(error, "Login failed."));
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;
    if (authUser) {
      const row = await fetchProfileByAuthUser(authUser);
      if (row) {
        setProfile(row);
        setUserStorage(row, authUser);
        const destination = await resolveHomePath(row.id);
        navigate(destination);
        return;
      }
    }
    setBanner("Logged in. Profile loading...");
  };

  const handleSignup = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = resolvedUsername;

    if (!fullName.trim()) {
      setBanner("Add your full name.");
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setBanner("Username must be at least 3 characters.");
      return;
    }
    if (!cleanEmail || !password) {
      setBanner("Enter email and password.");
      return;
    }

    setSaving(true);

    const { data: usernameCollision } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (usernameCollision) {
      setSaving(false);
      setBanner("That username is taken. Try another one.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          username: cleanUsername
        }
      }
    });

    if (error) {
      setSaving(false);
      setBanner(parseAuthError(error, "Sign up failed."));
      return;
    }

    const signedUser = data?.user;
    if (signedUser?.id) {
      await supabase.from("user_profiles").insert([
        {
          full_name: fullName.trim(),
          display_name: fullName.trim(),
          username: cleanUsername,
          email: cleanEmail,
          auth_user_id: signedUser.id,
          fitness_level: fitnessLevel,
          primary_goal: primaryGoal
        }
      ]);
    }

    setSaving(false);
    if (!data?.session) {
      setBanner("Account created. Check your email to confirm, then log in.");
      setMode("login");
      return;
    }
    const authUser = data.session.user;
    const row = await fetchProfileByAuthUser(authUser);
    if (row) {
      setProfile(row);
      setUserStorage(row, authUser);
      const destination = await resolveHomePath(row.id);
      navigate(destination);
      return;
    }
    setBanner("Account created.");
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setBanner("Enter your account email first.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setSaving(false);
    if (error) {
      setBanner("Could not send reset email right now.");
      return;
    }
    setBanner("Password reset email sent.");
  };

  const handleClaimExisting = async () => {
    const cleanClaimUsername = slugifyUsername(claimUsername);
    const cleanClaimEmail = claimEmail.trim().toLowerCase();
    if (!cleanClaimUsername || !cleanClaimEmail || !claimPassword) {
      setBanner("Add username, email, and password to claim your profile.");
      return;
    }

    setSaving(true);

    const { data: legacyProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("username", cleanClaimUsername)
      .is("auth_user_id", null)
      .maybeSingle();

    if (profileError) {
      setSaving(false);
      setBanner("Could not validate profile claim.");
      return;
    }

    if (!legacyProfile) {
      setSaving(false);
      setBanner("No claimable profile found for that username.");
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanClaimEmail,
      password: claimPassword,
      options: {
        data: {
          full_name: legacyProfile.full_name || legacyProfile.display_name || cleanClaimUsername,
          username: cleanClaimUsername
        }
      }
    });

    if (signUpError) {
      setSaving(false);
      setBanner(parseAuthError(signUpError, "Could not claim this profile."));
      return;
    }

    const authUserId = signUpData?.user?.id;
    if (!authUserId) {
      setSaving(false);
      setBanner("Claim created. Confirm your email, then log in.");
      setMode("login");
      return;
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({
        auth_user_id: authUserId,
        email: cleanClaimEmail,
        display_name: legacyProfile.display_name || legacyProfile.full_name
      })
      .eq("id", legacyProfile.id)
      .is("auth_user_id", null);

    if (updateError) {
      setSaving(false);
      setBanner("Profile linked, but record update failed. Contact support.");
      return;
    }

    setSaving(false);
    if (!signUpData?.session) {
      setBanner("Profile claimed. Confirm your email, then log in.");
      setMode("login");
      return;
    }
    const authUser = signUpData.session.user;
    const row = await fetchProfileByAuthUser(authUser);
    if (row) {
      setProfile(row);
      setUserStorage(row, authUser);
      const destination = await resolveHomePath(row.id);
      navigate(destination);
      return;
    }
    setBanner("Profile claimed successfully.");
  };

  const handleProfileSave = async () => {
    if (!profile?.id) return;
    const cleanUsername = slugifyUsername(username);
    if (!fullName.trim()) {
      setBanner("Full name is required.");
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setBanner("Username must be at least 3 characters.");
      return;
    }

    setSaving(true);

    const { data: collision } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("username", cleanUsername)
      .neq("id", profile.id)
      .maybeSingle();

    if (collision) {
      setSaving(false);
      setBanner("Username already in use.");
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .update({
        full_name: fullName.trim(),
        display_name: fullName.trim(),
        username: cleanUsername,
        fitness_level: fitnessLevel,
        primary_goal: primaryGoal
      })
      .eq("id", profile.id)
      .select("*")
      .single();

    setSaving(false);
    if (error || !data) {
      setBanner("Could not update profile.");
      return;
    }

    setProfile(data);
    setUserStorage(data, session?.user || null);
    setBanner("Profile updated.");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearUserStorage();
    setMode("login");
    setBanner("Logged out.");
  };

  if (loading) {
    return (
      <div className="profile-body">
        <div className="profile-container">
          <div className="profile-section">
            <p className="text-white">Loading account...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-body">
      <div className="profile-container">
        <header className="profile-header">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="flex items-center space-x-3">
              <div className="landing-logo">E</div>
              <h1 className="text-2xl font-bold text-white">ExerVia Account</h1>
            </div>
            <button onClick={() => navigate("/")} className="studio-back" type="button">
              {"<- Back"}
            </button>
          </div>
        </header>

        {banner ? (
          <div className="profile-section" style={{ padding: 16 }}>
            <p className="text-white m-0">{banner}</p>
          </div>
        ) : null}

        {!session?.user ? (
          <div className="profile-section">
            <div className="flex gap-2 flex-wrap mb-6">
              <button className={`studio-toggle-btn ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")} type="button">Login</button>
              <button className={`studio-toggle-btn ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")} type="button">Sign Up</button>
              <button className={`studio-toggle-btn ${mode === "forgot" ? "active" : ""}`} onClick={() => setMode("forgot")} type="button">Forgot Password</button>
              <button className={`studio-toggle-btn ${mode === "claim" ? "active" : ""}`} onClick={() => setMode("claim")} type="button">Claim Existing</button>
            </div>

            {(mode === "login" || mode === "signup" || mode === "forgot") ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-white mb-2">Email</label>
                  <input className="profile-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                {mode !== "forgot" ? (
                  <div>
                    <label className="block text-white mb-2">Password</label>
                    <input type="password" className="profile-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                  </div>
                ) : null}

                {mode === "signup" ? (
                  <>
                    <div>
                      <label className="block text-white mb-2">Full Name</label>
                      <input className="profile-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Smith" />
                    </div>
                    <div>
                      <label className="block text-white mb-2">Username</label>
                      <input className="profile-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johnsmith" />
                      <p className="text-xs text-gray-400 mt-2 mb-0">Preview: {resolvedUsername || "-"}</p>
                    </div>
                    <div>
                      <label className="block text-white mb-2">Fitness Level</label>
                      <select className="profile-select" value={fitnessLevel} onChange={(e) => setFitnessLevel(e.target.value)}>
                        {FITNESS_LEVELS.map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-white mb-2">Primary Goal</label>
                      <select className="profile-select" value={primaryGoal} onChange={(e) => setPrimaryGoal(e.target.value)}>
                        {PRIMARY_GOALS.map((goal) => (
                          <option key={goal} value={goal}>{goal}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {mode === "claim" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-white mb-2">Existing Username</label>
                  <input className="profile-input" value={claimUsername} onChange={(e) => setClaimUsername(e.target.value)} placeholder="johnsmith" />
                </div>
                <div>
                  <label className="block text-white mb-2">Email</label>
                  <input className="profile-input" value={claimEmail} onChange={(e) => setClaimEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div>
                  <label className="block text-white mb-2">Set Password</label>
                  <input type="password" className="profile-input" value={claimPassword} onChange={(e) => setClaimPassword(e.target.value)} placeholder="New password" />
                </div>
              </div>
            ) : null}

            <div className="flex gap-3 mt-6 flex-wrap">
              {mode === "login" ? (
                <button className="profile-button-primary" onClick={handleLogin} disabled={saving} type="button">
                  {saving ? "Logging in..." : "Login"}
                </button>
              ) : null}
              {mode === "signup" ? (
                <button className="profile-button-primary" onClick={handleSignup} disabled={saving} type="button">
                  {saving ? "Creating account..." : "Create Account"}
                </button>
              ) : null}
              {mode === "forgot" ? (
                <button className="profile-button-primary" onClick={handleForgotPassword} disabled={saving} type="button">
                  {saving ? "Sending..." : "Send Reset Email"}
                </button>
              ) : null}
              {mode === "claim" ? (
                <button className="profile-button-primary" onClick={handleClaimExisting} disabled={saving} type="button">
                  {saving ? "Claiming..." : "Claim Profile"}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="profile-section">
            <div className="flex justify-between items-center gap-3 flex-wrap mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Account Profile</h2>
                <p className="text-gray-300 m-0">Signed in as {session.user.email}</p>
              </div>
              <div className="flex gap-2">
                <button className="studio-back" onClick={goToApp} type="button">Go to App</button>
                <button className="profile-button-secondary" onClick={handleLogout} type="button">Logout</button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-white mb-2">Full Name</label>
                <input className="profile-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="block text-white mb-2">Username</label>
                <input className="profile-input" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-white mb-2">Fitness Level</label>
                <select className="profile-select" value={fitnessLevel} onChange={(e) => setFitnessLevel(e.target.value)}>
                  {FITNESS_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white mb-2">Primary Goal</label>
                <select className="profile-select" value={primaryGoal} onChange={(e) => setPrimaryGoal(e.target.value)}>
                  {PRIMARY_GOALS.map((goal) => (
                    <option key={goal} value={goal}>{goal}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button className="profile-button-update" onClick={handleProfileSave} disabled={saving} type="button">
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
