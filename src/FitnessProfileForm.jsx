import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import heroImage from "./assets/exervia-hero.webp";

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

const MAPS_KEY = String(process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();

export default function FitnessProfileForm({ settingsOnly = false }) {
  const navigate = useNavigate();
  const hasAutoRedirectedRef = useRef(false);
  const settingsSnapshotRef = useRef(null);
  const placesServiceRef = useRef(null);
  const placesSessionRef = useRef(null);
  const placesDebounceRef = useRef(null);

  const [mode, setMode] = useState("login");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerState, setBannerState] = useState({ message: "", type: "info" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("Beginner");
  const [primaryGoal, setPrimaryGoal] = useState("Build Muscle");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [gymName, setGymName] = useState("");
  const [gymPlaceId, setGymPlaceId] = useState("");
  const [gymAddress, setGymAddress] = useState("");
  const [gymLat, setGymLat] = useState("");
  const [gymLng, setGymLng] = useState("");
  const [gymQuery, setGymQuery] = useState("");
  const [gymSuggestions, setGymSuggestions] = useState([]);
  const [gymSearchLoading, setGymSearchLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [showGymAdvanced, setShowGymAdvanced] = useState(false);

  const [profile, setProfile] = useState(null);
  const heroBackgroundStyle = { "--exervia-hero-bg": `url(${heroImage})` };
  const hasSessionUser = Boolean(session?.user);
  const banner = bannerState.message;
  const bannerVariant = bannerState.type || "info";
  const setBanner = useCallback((message, type = "info") => {
    setBannerState({ message: String(message || ""), type });
  }, []);

  const resolvedUsername = useMemo(() => slugifyUsername(username || fullName), [username, fullName]);
  const isSettingsDirty = useMemo(() => {
    if (!settingsOnly || !session?.user || !profile?.id) return false;
    const snapshot = settingsSnapshotRef.current;
    if (!snapshot) return false;
    return (
      String(fullName || "").trim() !== snapshot.fullName ||
      String(username || "").trim() !== snapshot.username ||
      String(fitnessLevel || "").trim() !== snapshot.fitnessLevel ||
      String(primaryGoal || "").trim() !== snapshot.primaryGoal ||
      String(gymName || "").trim() !== snapshot.gymName ||
      String(gymPlaceId || "").trim() !== snapshot.gymPlaceId ||
      String(gymAddress || "").trim() !== snapshot.gymAddress ||
      String(gymLat || "").trim() !== snapshot.gymLat ||
      String(gymLng || "").trim() !== snapshot.gymLng
    );
  }, [settingsOnly, session, profile, fullName, username, fitnessLevel, primaryGoal, gymName, gymPlaceId, gymAddress, gymLat, gymLng]);

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
      setBanner("Could not load your profile.", "error");
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
      setBanner("Could not create your profile yet. Try again.", "error");
      return null;
    }
    return created;
  };

  const syncSession = async (nextSession) => {
    try {
      setSession(nextSession || null);
      if (!nextSession?.user) {
        setProfile(null);
        clearUserStorage();
        return;
      }

      const row = await fetchProfileByAuthUser(nextSession.user);
      if (row) {
        setProfile(row);
        setFullName(row.full_name || "");
        setUsername(row.username || "");
        setFitnessLevel(row.fitness_level || "Beginner");
        setPrimaryGoal(row.primary_goal || "Build Muscle");
        setGymName(row.primary_gym_name || "");
        setGymPlaceId(row.primary_gym_place_id || "");
        setGymAddress(row.primary_gym_address || "");
        setGymLat(row.primary_gym_lat == null ? "" : String(row.primary_gym_lat));
        setGymLng(row.primary_gym_lng == null ? "" : String(row.primary_gym_lng));
        setGymQuery(row.primary_gym_name || row.primary_gym_address || "");
        setUserStorage(row, nextSession.user);
        settingsSnapshotRef.current = {
          fullName: String(row.full_name || "").trim(),
          username: String(row.username || "").trim(),
          fitnessLevel: String(row.fitness_level || "Beginner").trim(),
          primaryGoal: String(row.primary_goal || "Build Muscle").trim(),
          gymName: String(row.primary_gym_name || "").trim(),
          gymPlaceId: String(row.primary_gym_place_id || "").trim(),
          gymAddress: String(row.primary_gym_address || "").trim(),
          gymLat: row.primary_gym_lat == null ? "" : String(row.primary_gym_lat).trim(),
          gymLng: row.primary_gym_lng == null ? "" : String(row.primary_gym_lng).trim(),
        };
      }
    } catch (error) {
      console.error("syncSession failed:", error);
      setBanner("Could not load account right now.", "error");
      setProfile(null);
      clearUserStorage();
    } finally {
      setLoading(false);
    }
  };

  const resolveHomePath = useCallback(async (profileId) => {
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
  }, []);

  useEffect(() => {
    let mounted = true;
    let loadingGuardTimeout = null;

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        await syncSession(data?.session || null);
      } catch (error) {
        console.error("auth boot failed:", error);
        if (mounted) {
          setLoading(false);
          setBanner("Could not initialize auth session.", "error");
        }
      }
    };

    loadingGuardTimeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 7000);

    boot();

    const { data: authSub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await syncSession(nextSession);
    });

    return () => {
      mounted = false;
      if (loadingGuardTimeout) {
        clearTimeout(loadingGuardTimeout);
      }
      authSub?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    if (settingsOnly || loading || !session?.user || !profile?.id || hasAutoRedirectedRef.current) {
      return () => {
        active = false;
      };
    }
    hasAutoRedirectedRef.current = true;
    (async () => {
      const destination = await resolveHomePath(profile.id);
      if (active) {
        navigate(destination, { replace: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [settingsOnly, loading, session, profile, resolveHomePath, navigate]);

  useEffect(() => {
    if (!settingsOnly || !session?.user) return undefined;
    const beforeUnloadHandler = (event) => {
      if (!isSettingsDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [settingsOnly, session, isSettingsDirty]);

  useEffect(() => {
    if (!settingsOnly || !MAPS_KEY) return undefined;
    if (window.google?.maps?.places?.AutocompleteService) {
      setMapsReady(true);
      placesServiceRef.current = new window.google.maps.places.AutocompleteService();
      placesSessionRef.current = new window.google.maps.places.AutocompleteSessionToken();
      return undefined;
    }
    const existing = document.getElementById("exervia-google-maps-script");
    if (existing) {
      const onLoad = () => {
        if (window.google?.maps?.places?.AutocompleteService) {
          setMapsReady(true);
          placesServiceRef.current = new window.google.maps.places.AutocompleteService();
          placesSessionRef.current = new window.google.maps.places.AutocompleteSessionToken();
        }
      };
      existing.addEventListener("load", onLoad);
      return () => existing.removeEventListener("load", onLoad);
    }
    const script = document.createElement("script");
    script.id = "exervia-google-maps-script";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&libraries=places`;
    script.onload = () => {
      if (window.google?.maps?.places?.AutocompleteService) {
        setMapsReady(true);
        placesServiceRef.current = new window.google.maps.places.AutocompleteService();
        placesSessionRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
    };
    script.onerror = () => setMapsReady(false);
    document.body.appendChild(script);
    return undefined;
  }, [settingsOnly]);

  useEffect(() => {
    if (!settingsOnly || !mapsReady || !placesServiceRef.current) return undefined;
    const query = String(gymQuery || "").trim();
    if (query.length < 2) {
      setGymSuggestions([]);
      setGymSearchLoading(false);
      return undefined;
    }
    if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    placesDebounceRef.current = setTimeout(() => {
      setGymSearchLoading(true);
      placesServiceRef.current.getPlacePredictions(
        {
          input: query,
          sessionToken: placesSessionRef.current,
          types: ["gym"],
        },
        (predictions, status) => {
          setGymSearchLoading(false);
          if (status !== "OK" || !Array.isArray(predictions)) {
            setGymSuggestions([]);
            return;
          }
          setGymSuggestions(
            predictions.slice(0, 6).map((row) => ({
              placeId: String(row.place_id || ""),
              name: String(row.structured_formatting?.main_text || row.description || ""),
              address: String(row.description || ""),
            }))
          );
        }
      );
    }, 250);
    return () => {
      if (placesDebounceRef.current) clearTimeout(placesDebounceRef.current);
    };
  }, [gymQuery, mapsReady, settingsOnly]);

  const confirmDiscardIfDirty = () => {
    if (!isSettingsDirty) return true;
    return window.confirm("You have unsaved profile changes. Leave without saving?");
  };

  const goToApp = async () => {
    if (!confirmDiscardIfDirty()) return;
    if (!profile?.id) return;
    const destination = await resolveHomePath(profile.id);
    navigate(destination);
  };

  const pickGymSuggestion = (item) => {
    if (!item) return;
    setGymName(String(item.name || ""));
    setGymAddress(String(item.address || ""));
    setGymPlaceId(String(item.placeId || ""));
    setGymQuery(String(item.address || item.name || ""));
    setGymSuggestions([]);
    setBanner(`Gym linked: ${String(item.name || "Selected gym")}`, "success");
  };

  const clearGymLink = () => {
    setGymName("");
    setGymPlaceId("");
    setGymAddress("");
    setGymLat("");
    setGymLng("");
    setGymQuery("");
    setGymSuggestions([]);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setBanner("Enter your email and password.", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    setSaving(false);
    if (error) {
      setBanner(parseAuthError(error, "Login failed."), "error");
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
    setBanner("Logged in. Profile loading...", "success");
  };

  const handleSignup = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = resolvedUsername;

    if (!fullName.trim()) {
      setBanner("Add your full name.", "error");
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setBanner("Username must be at least 3 characters.", "error");
      return;
    }
    if (!cleanEmail || !password) {
      setBanner("Enter email and password.", "error");
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
      setBanner("That username is taken. Try another one.", "error");
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
      setBanner(parseAuthError(error, "Sign up failed."), "error");
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
      setBanner("Account created. Check your email to confirm, then log in.", "success");
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
    setBanner("Account created.", "success");
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setBanner("Enter your account email first.", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setSaving(false);
    if (error) {
      setBanner("Could not send reset email right now.", "error");
      return;
    }
    setBanner("Password reset email sent.", "success");
  };

  const handleProfileSave = async () => {
    if (!profile?.id) return;
    const cleanUsername = slugifyUsername(username);
    if (!fullName.trim()) {
      setBanner("Full name is required.", "error");
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setBanner("Username must be at least 3 characters.", "error");
      return;
    }
    if (gymName.trim() && !gymPlaceId.trim()) {
      setBanner("Pick a gym suggestion so Place ID is linked for leaderboard matching.", "error");
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
      setBanner("Username already in use.", "error");
      return;
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .update({
        full_name: fullName.trim(),
        display_name: fullName.trim(),
        username: cleanUsername,
        fitness_level: fitnessLevel,
        primary_goal: primaryGoal,
        primary_gym_name: gymName.trim() || null,
        primary_gym_place_id: gymPlaceId.trim() || null,
        primary_gym_address: gymAddress.trim() || null,
        primary_gym_lat: Number.isFinite(Number(gymLat)) ? Number(gymLat) : null,
        primary_gym_lng: Number.isFinite(Number(gymLng)) ? Number(gymLng) : null,
        primary_gym_linked_at: gymPlaceId.trim() ? new Date().toISOString() : null,
      })
      .eq("id", profile.id)
      .select("*")
      .single();

    setSaving(false);
    if (error || !data) {
      setBanner("Could not update profile.", "error");
      return;
    }

    setProfile(data);
    setUserStorage(data, session?.user || null);
    settingsSnapshotRef.current = {
      fullName: String(data.full_name || "").trim(),
      username: String(data.username || "").trim(),
      fitnessLevel: String(data.fitness_level || "Beginner").trim(),
      primaryGoal: String(data.primary_goal || "Build Muscle").trim(),
      gymName: String(data.primary_gym_name || "").trim(),
      gymPlaceId: String(data.primary_gym_place_id || "").trim(),
      gymAddress: String(data.primary_gym_address || "").trim(),
      gymLat: data.primary_gym_lat == null ? "" : String(data.primary_gym_lat).trim(),
      gymLng: data.primary_gym_lng == null ? "" : String(data.primary_gym_lng).trim(),
    };
    setBanner("Profile updated.", "success");
  };

  const handleLogout = async () => {
    if (!confirmDiscardIfDirty()) return;
    setSession(null);
    setProfile(null);
    setLoading(false);
    clearUserStorage();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout failed:", error.message);
    }
    setMode("login");
    setBanner("Logged out.", "info");
    navigate("/auth", { replace: true });
  };

  const handleDeleteAccount = async () => {
    if (!session?.user?.email) {
      setBanner("Missing account email. Please re-login and try again.", "error");
      return;
    }
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setBanner("Type DELETE to confirm account deletion.", "error");
      return;
    }
    if (!deletePassword) {
      setBanner("Enter your password to confirm account deletion.", "error");
      return;
    }
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) {
      return;
    }

    setDeletingAccount(true);
    setBanner("", "info");

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: String(session.user.email).trim().toLowerCase(),
      password: deletePassword,
    });

    if (reauthError) {
      setDeletingAccount(false);
      setBanner(parseAuthError(reauthError, "Password check failed."), "error");
      return;
    }

    const { error: deleteError } = await supabase.functions.invoke("delete-account");
    if (deleteError) {
      setDeletingAccount(false);
      setBanner("Could not delete account right now. Please try again.", "error");
      return;
    }

    clearUserStorage();
    setSession(null);
    setProfile(null);
    setLoading(false);
    setDeletingAccount(false);
    setMode("login");
    setBanner("Account deleted.", "success");
    navigate("/", { replace: true });
  };

  const handleBack = async () => {
    if (!confirmDiscardIfDirty()) return;
    if (settingsOnly && profile?.id) {
      const destination = await resolveHomePath(profile.id);
      navigate(destination);
      return;
    }
    navigate("/");
  };

  if (loading) {
    return (
      <div className="profile-body" style={heroBackgroundStyle}>
        <div className="profile-container">
          <div className="profile-section">
            <p className="text-white">Loading account...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-body" style={heroBackgroundStyle}>
      <div className="profile-container">
        <header className="profile-header">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div className="flex items-center space-x-3">
              <div className="landing-logo">E</div>
              <h1 className="text-2xl font-bold text-white">ExerVia Account</h1>
            </div>
            <button onClick={handleBack} className="studio-back" type="button">
              {"<- Back"}
            </button>
          </div>
        </header>

        {banner ? (
          <div className={`profile-feedback ${bannerVariant}`}>
            <p className="m-0">{banner}</p>
          </div>
        ) : null}

        {!hasSessionUser ? (
          settingsOnly ? (
            <div className="profile-section">
              <p className="text-white m-0">Signing out...</p>
            </div>
          ) : (
          <div className="profile-section">
            <div className="flex gap-2 flex-wrap mb-6">
              <button className={`studio-toggle-btn ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")} type="button">Login</button>
              <button className={`studio-toggle-btn ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")} type="button">Sign Up</button>
              <button className={`studio-toggle-btn ${mode === "forgot" ? "active" : ""}`} onClick={() => setMode("forgot")} type="button">Forgot Password</button>
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
            </div>
          </div>
          )
        ) : (
          <div className="profile-section">
            <div className="flex justify-between items-center gap-3 flex-wrap mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Account Profile</h2>
                <p className="text-gray-300 m-0">Signed in as {session?.user?.email || "Unknown user"}</p>
              </div>
              <div className="flex gap-2">
                <button className="studio-back" onClick={goToApp} type="button">Go to App</button>
                <button className="profile-button-secondary" onClick={handleLogout} type="button">Logout</button>
              </div>
            </div>
            {isSettingsDirty ? (
              <div className="hud-dim" style={{ marginBottom: 12 }}>
                You have unsaved changes.
              </div>
            ) : null}

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
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="hud-divider" />
                <label className="block text-white mb-2">Link Your Gym</label>
                <input
                  className="profile-input"
                  value={gymQuery}
                  onChange={(e) => setGymQuery(e.target.value)}
                  placeholder={MAPS_KEY ? "Search gym via Google Places" : "Gym name"}
                />
                <p className="text-xs text-gray-400 mt-2 mb-0">
                  {MAPS_KEY
                    ? "Pick a suggestion or fill fields manually."
                    : "Manual mode active. Add REACT_APP_GOOGLE_MAPS_API_KEY for autocomplete."}
                </p>
                {mapsReady && gymSearchLoading ? (
                  <div className="text-xs text-gray-300 mt-2">Searching gyms...</div>
                ) : null}
                {gymSuggestions.length > 0 ? (
                  <div className="grid gap-2 mt-2">
                    {gymSuggestions.map((item) => (
                      <button
                        key={`gym-${item.placeId || item.address}`}
                        type="button"
                        className="profile-button-secondary"
                        onClick={() => pickGymSuggestion(item)}
                        style={{ textAlign: "left" }}
                      >
                        {item.name}
                        <div className="text-xs text-gray-300">{item.address}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="block text-white mb-2">Gym Name</label>
                <input className="profile-input" value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="Mardyke Arena" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="block text-white mb-2">Address</label>
                <input className="profile-input" value={gymAddress} onChange={(e) => setGymAddress(e.target.value)} placeholder="Gym address" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  className="profile-button-secondary"
                  type="button"
                  onClick={() => setShowGymAdvanced((prev) => !prev)}
                >
                  {showGymAdvanced ? "Hide advanced gym fields" : "Advanced gym fields"}
                </button>
              </div>
              {showGymAdvanced ? (
                <>
                  <div>
                    <label className="block text-white mb-2">Google Place ID</label>
                    <input className="profile-input" value={gymPlaceId} onChange={(e) => setGymPlaceId(e.target.value)} placeholder="ChIJ..." />
                  </div>
                  <div>
                    <label className="block text-white mb-2">Latitude (optional)</label>
                    <input className="profile-input" value={gymLat} onChange={(e) => setGymLat(e.target.value)} placeholder="51.8985" />
                  </div>
                  <div>
                    <label className="block text-white mb-2">Longitude (optional)</label>
                    <input className="profile-input" value={gymLng} onChange={(e) => setGymLng(e.target.value)} placeholder="-8.4756" />
                  </div>
                </>
              ) : null}
              <div style={{ gridColumn: "1 / -1" }}>
                <p className="text-xs text-gray-300 m-0">
                  Leaderboards use Place ID. Use suggestion pick for reliable gym matching.
                </p>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <button className="profile-button-secondary" type="button" onClick={clearGymLink}>
                  Clear Gym Link
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button className="profile-button-update" onClick={handleProfileSave} disabled={saving} type="button">
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>

            <div className="profile-danger-zone">
              <div className="profile-danger-head">
                <h3>Danger Zone</h3>
                <p>Permanently delete your account and all app data.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-white mb-2">Type DELETE</label>
                  <input
                    className="profile-input"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2">Password</label>
                  <input
                    type="password"
                    className="profile-input"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  className="profile-button-danger"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  type="button"
                >
                  {deletingAccount ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
