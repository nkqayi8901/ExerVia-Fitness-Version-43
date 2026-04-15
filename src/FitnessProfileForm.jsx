import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import heroImage from "./assets/exervia-hero.webp";
import { emitToast } from "./utils/toast";
import { clearAuthStorage, getStoredProfileId, setAuthStorage } from "./utils/authStorage";

const FITNESS_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const PRIMARY_GOALS = ["Build Muscle", "Lose Weight", "Improve Endurance", "General Fitness"];
const SESSION_BOOT_TIMEOUT_MS = 6000;
const PROFILE_LOAD_TIMEOUT_MS = 7000;

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

export default function FitnessProfileForm({ settingsOnly = false }) {
  const navigate = useNavigate();
  const hasAutoRedirectedRef = useRef(false);
  const settingsSnapshotRef = useRef(null);
  const lastSyncRef = useRef({ userId: "", at: 0 });

  const [mode, setMode] = useState("login");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oauthSaving, setOauthSaving] = useState(false);
  const [bannerState, setBannerState] = useState({ message: "", type: "info" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("Beginner");
  const [primaryGoal, setPrimaryGoal] = useState("Build Muscle");
  const [city, setCity] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmBanner, setConfirmBanner] = useState(null);

  const [profile, setProfile] = useState(null);
  const heroBackgroundStyle = { "--exervia-hero-bg": `url(${heroImage})` };
  const hasSessionUser = Boolean(session?.user);
  const banner = bannerState.message;
  const bannerVariant = bannerState.type || "info";
  const setBanner = useCallback((message, type = "info") => {
    setBannerState({ message: String(message || ""), type });
  }, []);

  useEffect(() => {
    if (session?.user?.id) return;
    hasAutoRedirectedRef.current = false;
  }, [session?.user?.id]);

  useEffect(() => {
    if (!banner) return;
    if (bannerVariant === "error") return;
    emitToast(banner, bannerVariant, 3000);
  }, [banner, bannerVariant]);

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
      String(city || "").trim() !== (snapshot.city || "")
    );
  }, [settingsOnly, session, profile, fullName, username, fitnessLevel, primaryGoal, city]);
  const setUserStorage = (profileRow, authUser) => setAuthStorage(profileRow, authUser);
  const clearUserStorage = () => clearAuthStorage();

  const withTimeout = async (promise, timeoutMs, message = "Request timed out") => {
    let timeoutHandle = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  const fetchProfileByAuthUser = useCallback(async (authUser) => {
    if (!authUser?.id) return null;
    const authUserId = String(authUser.id);
    const authEmail = String(authUser.email || "").trim().toLowerCase();

    const { data: existing, error: existingError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (existing) return existing;

    // If auth_user_id lookup fails or returns empty, attempt a safe email-based recovery.
    if (authEmail) {
      const { data: byEmail } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", authEmail)
        .maybeSingle();
      if (byEmail) {
        const linkedAuthId = String(byEmail.auth_user_id || "").trim();
        // Never hijack another linked account.
        if (!linkedAuthId || linkedAuthId === authUserId) {
          if (linkedAuthId !== authUserId) {
            const { data: relinked } = await supabase
              .from("user_profiles")
              .update({ auth_user_id: authUserId })
              .eq("id", byEmail.id)
              .select("*")
              .single();
            if (relinked) return relinked;
          }
          return byEmail;
        }
      }
    }

    // Last safe fallback: cached profile id only if it belongs to this auth user/email.
    const cachedProfileId = Number(localStorage.getItem("exervia_user_id") || 0);
    if (cachedProfileId > 0) {
      const { data: byId } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", cachedProfileId)
        .maybeSingle();
      const rowAuthId = String(byId?.auth_user_id || "").trim();
      const rowEmail = String(byId?.email || "").trim().toLowerCase();
      if (byId && (rowAuthId === authUserId || (authEmail && rowEmail === authEmail))) {
        return byId;
      }
    }

    if (existingError) {
      setBanner("Could not load your profile right now. Retrying profile link...", "warn");
    }

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
      if (String(createError?.code || "") === "23505") {
        const { data: recoveredByAuth } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("auth_user_id", authUser.id)
          .maybeSingle();
        if (recoveredByAuth) return recoveredByAuth;
        if (authEmail) {
          const { data: recoveredByEmail } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("email", authEmail)
            .maybeSingle();
          if (recoveredByEmail) return recoveredByEmail;
        }
      }
      setBanner("Could not create your profile yet. Try again.", "error");
      return null;
    }
    return created;
  }, [setBanner]);

  const syncSession = async (nextSession) => {
    const previousProfile = profile;
    try {
      setSession(nextSession || null);
      if (!nextSession?.user) {
        setProfile(null);
        clearUserStorage();
        return;
      }

      const nextUserId = String(nextSession.user.id || "");
      const now = Date.now();
      if (
        nextUserId &&
        previousProfile &&
        String(previousProfile.auth_user_id || "") === nextUserId &&
        now - Number(lastSyncRef.current.at || 0) < 3000
      ) {
        setLoading(false);
        return;
      }

      const row = await withTimeout(
        fetchProfileByAuthUser(nextSession.user),
        PROFILE_LOAD_TIMEOUT_MS,
        "Profile loading timed out"
      );
      if (row) {
        setProfile(row);
        setFullName(row.full_name || "");
        setUsername(row.username || "");
        setFitnessLevel(row.fitness_level || "Beginner");
        setPrimaryGoal(row.primary_goal || "Build Muscle");
        setCity(row.city || "");
        setUserStorage(row, nextSession.user);
        settingsSnapshotRef.current = {
          fullName: String(row.full_name || "").trim(),
          username: String(row.username || "").trim(),
          fitnessLevel: String(row.fitness_level || "Beginner").trim(),
          primaryGoal: String(row.primary_goal || "Build Muscle").trim(),
          city: String(row.city || "").trim(),
        };
        lastSyncRef.current = { userId: nextUserId, at: Date.now() };
      }
    } catch (error) {
      console.error("syncSession failed:", error);
      setBanner("Could not fully load account right now. Retrying in background.", "warn");
      // Keep session/profile state intact on transient failures to avoid accidental sign-out UX.
      if (
        previousProfile &&
        (!nextSession?.user?.id ||
          String(previousProfile.auth_user_id || "").trim() === String(nextSession.user.id).trim())
      ) {
        setProfile(previousProfile);
      } else if (nextSession?.user) {
        setProfile({
          id: null,
          full_name: nextSession.user.user_metadata?.full_name || nextSession.user.email?.split("@")[0] || "Athlete",
          display_name: nextSession.user.user_metadata?.full_name || nextSession.user.email?.split("@")[0] || "Athlete",
          username: slugifyUsername(nextSession.user.user_metadata?.username || nextSession.user.email?.split("@")[0] || "athlete"),
          auth_user_id: nextSession.user.id,
          email: nextSession.user.email || null,
        });
      }
      if (nextSession?.user?.id) {
        lastSyncRef.current = { userId: String(nextSession.user.id), at: Date.now() };
      }
    } finally {
      setLoading(false);
    }
  };

  const resolveHomePath = useCallback(async (profileId) => {
    if (!profileId) return "/create-profile";
    try {
      const { data } = await withTimeout(
        supabase
          .from("user_state")
          .select("active_mode")
          .eq("user_id", profileId)
          .maybeSingle(),
        1600,
        "Home path resolution timed out"
      );
      const modeFromState = data?.active_mode;
      const modeFromStorage = localStorage.getItem("exervia_active_mode");
      const preferredMode = modeFromState || modeFromStorage || "gym";
      localStorage.setItem("exervia_active_mode", preferredMode);
      return preferredMode === "athlete" ? `/athlete/${profileId}` : `/gym/${profileId}`;
    } catch {
      const modeFromStorage = localStorage.getItem("exervia_active_mode") || "gym";
      return modeFromStorage === "athlete" ? `/athlete/${profileId}` : `/gym/${profileId}`;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let loadingGuardTimeout = null;

    const boot = async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_BOOT_TIMEOUT_MS,
          "Session check timed out"
        );
        if (!mounted) return;
        await syncSession(data?.session || null);
        if (loadingGuardTimeout) {
          clearTimeout(loadingGuardTimeout);
          loadingGuardTimeout = null;
        }
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
        setBanner("Loading account is taking longer than usual. You can still continue.", "warn");
      }
    }, 5000);

    boot();

    const { data: authSub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (loadingGuardTimeout) {
        clearTimeout(loadingGuardTimeout);
        loadingGuardTimeout = null;
      }
      // Avoid clearing active auth state from transient null-session events
      // (for example INITIAL_SESSION while tokens are refreshing).
      if (!nextSession?.user?.id) {
        if (event === "SIGNED_OUT") {
          syncSession(null);
        }
        return;
      }
      syncSession(nextSession);
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
    if (settingsOnly || loading || !session?.user || hasAutoRedirectedRef.current) {
      return () => {
        active = false;
      };
    }
    hasAutoRedirectedRef.current = true;
    (async () => {
      try {
        let resolvedProfileId = Number(profile?.id || 0);
        if (!resolvedProfileId) {
          const cached = Number(getStoredProfileId() || 0);
          if (cached > 0) {
            resolvedProfileId = cached;
          }
        }
        if (!resolvedProfileId && session?.user) {
          const row = await withTimeout(
            fetchProfileByAuthUser(session.user),
            PROFILE_LOAD_TIMEOUT_MS,
            "Profile lookup timed out"
          );
          if (row?.id) {
            resolvedProfileId = Number(row.id);
            setProfile(row);
            setUserStorage(row, session.user);
          }
        }
        if (!active) return;
        if (!resolvedProfileId) {
          navigate("/create-profile", { replace: true });
          return;
        }
        const destination = await resolveHomePath(resolvedProfileId);
        if (active) {
          navigate(destination, { replace: true });
        }
      } catch {
        if (active) {
          hasAutoRedirectedRef.current = false;
          setBanner("Could not finish loading your account. Please try again.", "error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [settingsOnly, loading, session, profile, resolveHomePath, navigate, fetchProfileByAuthUser, setBanner]);

  useEffect(() => {
    if (settingsOnly) return;
    const searchParams = new URLSearchParams(window.location.search);
    const hashRaw = String(window.location.hash || "");
    const hashParams = hashRaw.startsWith("#") ? new URLSearchParams(hashRaw.slice(1)) : null;
    const oauthError =
      searchParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams?.get("error_description") ||
      hashParams?.get("error");
    if (!oauthError) return;
    const cleaned = decodeURIComponent(String(oauthError || "")).replace(/\+/g, " ").trim();
    if (!cleaned) return;
    setBanner(`Google sign-in failed: ${cleaned}`, "error");
  }, [settingsOnly, setBanner]);

  useEffect(() => {
    if (!settingsOnly || loading) return;
    if (!hasSessionUser) {
      navigate("/auth", { replace: true });
    }
  }, [settingsOnly, loading, hasSessionUser, navigate]);

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

  const confirmDiscardIfDirty = (nextAction = "") => {
    if (!isSettingsDirty) return true;
    setConfirmBanner({
      kind: "discard_changes",
      message: "You have unsaved profile changes. Leave without saving?",
      action: String(nextAction || ""),
    });
    return false;
  };

  const executeGoToApp = async () => {
    try {
      let resolvedProfileId = Number(profile?.id || 0);
      const authUser = session?.user || null;

      if (!resolvedProfileId && authUser) {
        const row = await withTimeout(
          fetchProfileByAuthUser(authUser),
          PROFILE_LOAD_TIMEOUT_MS,
          "Profile lookup timed out"
        );
        if (row?.id) {
          resolvedProfileId = Number(row.id);
          setProfile(row);
          setUserStorage(row, authUser);
        }
      }

      if (!resolvedProfileId) {
        const cached = Number(localStorage.getItem("exervia_user_id") || 0);
        if (cached > 0) {
          resolvedProfileId = cached;
        }
      }

      if (!resolvedProfileId) {
        setBanner("Could not resolve your profile id. Opening profile setup.", "warn");
        navigate("/create-profile");
        return;
      }

      const destination = await resolveHomePath(resolvedProfileId);
      navigate(destination);
    } catch (error) {
      console.error("executeGoToApp failed:", error);
      const cached = Number(localStorage.getItem("exervia_user_id") || 0);
      if (cached > 0) {
        const mode = localStorage.getItem("exervia_active_mode") || "gym";
        navigate(mode === "athlete" ? `/athlete/${cached}` : `/gym/${cached}`);
        return;
      }
      setBanner("Could not open app right now. Please try again.", "error");
    }
  };
  const goToApp = async () => {
    if (!confirmDiscardIfDirty("go_to_app")) return;
    await executeGoToApp();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setBanner("Enter your email and password.", "error");
      return;
    }
    setSaving(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        }),
        12000,
        "Login request timed out"
      );
      if (error) {
        setBanner(parseAuthError(error, "Login failed."), "error");
        return;
      }
      // Single post-auth path: onAuthStateChange -> syncSession -> auto-redirect effect.
      setBanner("Logged in. Loading account...", "success");
    } catch (error) {
      const timeoutLike = String(error?.message || "").toLowerCase().includes("timed out");
      setBanner(timeoutLike ? "Login timed out. Check your connection and try again." : "Login failed.", "error");
    } finally {
      setSaving(false);
    }
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
    try {
      const { data: usernameCollision } = await withTimeout(
        supabase
          .from("user_profiles")
          .select("id")
          .eq("username", cleanUsername)
          .maybeSingle(),
        8000,
        "Username check timed out"
      );

      if (usernameCollision) {
        setBanner("That username is taken. Try another one.", "error");
        return;
      }

      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              username: cleanUsername
            }
          }
        }),
        15000,
        "Sign up request timed out"
      );

      if (error) {
        const signupError = String(error?.message || "").toLowerCase();
        if (
          signupError.includes("already registered") ||
          signupError.includes("already been registered") ||
          signupError.includes("already in use") ||
          signupError.includes("user already") ||
          (signupError.includes("email address") && signupError.includes("already"))
        ) {
          setBanner("Account already linked. Use Login or Continue with Google.", "warn");
          setMode("login");
          return;
        }
        setBanner(parseAuthError(error, "Sign up failed."), "error");
        return;
      }

      if (!data?.session) {
        setBanner("Account created. Check your email to confirm, then log in.", "success");
        setMode("login");
        return;
      }
      // Single post-auth path: onAuthStateChange -> syncSession -> auto-redirect effect.
      setBanner("Account created. Loading account...", "success");
    } catch (error) {
      const timeoutLike = String(error?.message || "").toLowerCase().includes("timed out");
      setBanner(timeoutLike ? "Sign up timed out. Please retry." : "Sign up failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setBanner("Enter your account email first.", "error");
      return;
    }
    setSaving(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`
        }),
        12000,
        "Reset email request timed out"
      );
      if (error) {
        setBanner("Could not send reset email right now.", "error");
        return;
      }
      setBanner("Password reset email sent.", "success");
    } catch (error) {
      const timeoutLike = String(error?.message || "").toLowerCase().includes("timed out");
      setBanner(timeoutLike ? "Reset email timed out. Try again." : "Could not send reset email right now.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (saving || oauthSaving) return;
    setOauthSaving(true);
    try {
      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        }),
        12000,
        "Google auth request timed out"
      );
      if (error) {
        setBanner(parseAuthError(error, "Could not start Google sign-in."), "error");
        return;
      }
      setBanner("Redirecting to Google...", "info");
    } catch (error) {
      const timeoutLike = String(error?.message || "").toLowerCase().includes("timed out");
      setBanner(timeoutLike ? "Google sign-in timed out. Try again." : "Could not start Google sign-in.", "error");
    } finally {
      setOauthSaving(false);
    }
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

    const profilePayload = {
      full_name: fullName.trim(),
      display_name: fullName.trim(),
      username: cleanUsername,
      fitness_level: fitnessLevel,
      primary_goal: primaryGoal,
      city: city.trim(),
    };

    const { data, error } = await supabase
      .from("user_profiles")
      .update(profilePayload)
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
    setCity(String(data.city || "").trim());
    settingsSnapshotRef.current = {
      fullName: String(data.full_name || "").trim(),
      username: String(data.username || "").trim(),
      fitnessLevel: String(data.fitness_level || "Beginner").trim(),
      primaryGoal: String(data.primary_goal || "Build Muscle").trim(),
      city: String(data.city || "").trim(),
    };
    setBanner("Profile updated.", "success");
  };

  const executeLogout = async () => {
    setSession(null);
    setProfile(null);
    setLoading(false);
    clearUserStorage();
    try {
      await withTimeout(supabase.auth.signOut(), 2500, "Logout timed out");
    } catch (error) {
      console.error("Logout failed:", error?.message || error);
    }
    setMode("login");
    setBanner("Logged out.", "info");
    navigate("/auth", { replace: true });
  };
  const handleLogout = async () => {
    if (!confirmDiscardIfDirty("logout")) return;
    await executeLogout();
  };

  const executeDeleteAccount = async () => {
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
    setConfirmBanner({
      kind: "delete_account",
      message: "Delete your account permanently? This cannot be undone.",
    });
  };

  const executeBack = async () => {
    if (settingsOnly && profile?.id) {
      const destination = await resolveHomePath(profile.id);
      navigate(destination);
      return;
    }
    navigate("/");
  };
  const handleBack = async () => {
    if (!confirmDiscardIfDirty("back")) return;
    await executeBack();
  };

  const handleConfirmBannerAction = async () => {
    const pending = confirmBanner;
    if (!pending) return;
    setConfirmBanner(null);
    if (pending.kind === "delete_account") {
      await executeDeleteAccount();
      return;
    }
    if (pending.kind === "discard_changes") {
      if (pending.action === "go_to_app") {
        await executeGoToApp();
      } else if (pending.action === "logout") {
        await executeLogout();
      } else if (pending.action === "back") {
        await executeBack();
      }
    }
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
          <div className={`exervia-banner profile-feedback ${bannerVariant}`}>
            <p className="m-0">{banner}</p>
          </div>
        ) : null}
        {confirmBanner ? (
          <div className="exervia-banner warn">
            <p className="m-0">{confirmBanner.message}</p>
            <div className="exervia-banner-actions">
              <button
                className="studio-back exervia-banner-btn"
                onClick={() => setConfirmBanner(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="profile-button-primary exervia-banner-btn"
                onClick={handleConfirmBannerAction}
                type="button"
              >
                Confirm
              </button>
            </div>
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
                <button className="profile-button-primary" onClick={handleLogin} disabled={saving || oauthSaving} type="button">
                  {saving ? "Logging in..." : "Login"}
                </button>
              ) : null}
              {mode === "signup" ? (
                <button className="profile-button-primary" onClick={handleSignup} disabled={saving || oauthSaving} type="button">
                  {saving ? "Creating account..." : "Create Account"}
                </button>
              ) : null}
              {mode === "forgot" ? (
                <button className="profile-button-primary" onClick={handleForgotPassword} disabled={saving || oauthSaving} type="button">
                  {saving ? "Sending..." : "Send Reset Email"}
                </button>
              ) : null}
            </div>
            {mode !== "forgot" ? (
              <>
                <div className="profile-oauth-divider">
                  <span>or</span>
                </div>
                <button
                  className="profile-button-secondary profile-google-btn"
                  onClick={handleGoogleAuth}
                  disabled={saving || oauthSaving}
                  type="button"
                >
                  <span className="profile-google-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" focusable="false" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.2 14.5 2.3 12 2.3 6.8 2.3 2.6 6.6 2.6 12s4.2 9.7 9.4 9.7c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.1-1.6H12z"
                      />
                      <path fill="#34A853" d="M3.7 7.5l3.2 2.3C7.7 8 9.7 6.6 12 6.6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 4.1 14.5 3.2 12 3.2 8.4 3.2 5.2 5.2 3.7 7.5z" />
                      <path fill="#FBBC05" d="M12 20.8c2.4 0 4.4-.8 5.8-2.2l-2.8-2.3c-.8.6-1.8 1-3 1-2.2 0-4.1-1.4-4.8-3.3L4 16.5c1.5 2.5 4.4 4.3 8 4.3z" />
                      <path fill="#4285F4" d="M21 12c0-.6-.1-1.1-.1-1.6H12v3.9h5.4c-.2 1.1-.8 2-1.6 2.7l2.8 2.3C20.3 17.8 21 15.2 21 12z" />
                    </svg>
                  </span>
                  <span>{oauthSaving ? "Opening Google..." : "Continue with Google"}</span>
                </button>
              </>
            ) : null}
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
                <button className="studio-back" onClick={goToApp} type="button">
                  Go to App
                </button>
                <button className="studio-back" onClick={handleLogout} type="button">Logout</button>
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
                <label className="block text-white mb-2">City</label>
                <input className="profile-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. London, Lagos, New York..." maxLength={60} />
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
