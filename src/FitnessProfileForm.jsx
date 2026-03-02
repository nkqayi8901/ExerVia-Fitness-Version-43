import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import heroImage from "./assets/exervia-hero.webp";
import { emitToast } from "./utils/toast";
import { clearAuthStorage, setAuthStorage } from "./utils/authStorage";

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

const toRegionKeyPart = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
const REGION_COUNTRIES = [
  { code: "IE", name: "Ireland" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "ZA", name: "South Africa" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IN", name: "India" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
  { code: "PH", name: "Philippines" },
];
const REGION_OPTIONS_BY_COUNTRY = {
  IE: ["Cork", "Dublin", "Galway", "Limerick", "Waterford", "Kerry", "Wexford", "Mayo", "Donegal"],
  GB: ["England", "Scotland", "Wales", "Northern Ireland", "London", "Manchester", "Birmingham", "Leeds", "Bristol"],
  US: ["California", "Texas", "Florida", "New York", "Illinois", "Georgia", "Washington", "Massachusetts", "Colorado"],
  ZA: ["Western Cape", "Gauteng", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo", "Mpumalanga"],
  CA: ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Nova Scotia"],
  AU: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania"],
  NZ: ["Auckland", "Wellington", "Canterbury", "Waikato", "Otago", "Bay of Plenty"],
  IN: ["Maharashtra", "Karnataka", "Tamil Nadu", "Delhi", "Gujarat", "West Bengal", "Punjab"],
  FR: ["Ile-de-France", "Provence-Alpes-Cote d'Azur", "Auvergne-Rhone-Alpes", "Occitanie", "Nouvelle-Aquitaine"],
  DE: ["Bavaria", "Berlin", "Hamburg", "Hesse", "North Rhine-Westphalia", "Saxony"],
  ES: ["Madrid", "Catalonia", "Andalusia", "Valencia", "Basque Country", "Galicia"],
  IT: ["Lombardy", "Lazio", "Sicily", "Veneto", "Emilia-Romagna", "Tuscany"],
  NL: ["North Holland", "South Holland", "Utrecht", "North Brabant", "Gelderland"],
  BR: ["Sao Paulo", "Rio de Janeiro", "Minas Gerais", "Bahia", "Parana", "Pernambuco"],
  MX: ["Mexico City", "Jalisco", "Nuevo Leon", "Puebla", "Yucatan", "Baja California"],
  NG: ["Lagos", "Abuja FCT", "Rivers", "Kano", "Oyo", "Kaduna"],
  KE: ["Nairobi", "Mombasa", "Kiambu", "Nakuru", "Kisumu", "Uasin Gishu"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah"],
  SG: ["Central Region", "East Region", "North Region", "North-East Region", "West Region"],
  PH: ["Metro Manila", "Cebu", "Davao del Sur", "Cavite", "Laguna", "Bulacan"],
};
const COUNTRY_NAME_TO_CODE = REGION_COUNTRIES.reduce((acc, item) => {
  acc[String(item.name || "").toLowerCase()] = item.code;
  return acc;
}, {});

export default function FitnessProfileForm({ settingsOnly = false }) {
  const navigate = useNavigate();
  const hasAutoRedirectedRef = useRef(false);
  const settingsSnapshotRef = useRef(null);
  const placesServiceRef = useRef(null);
  const placesSessionRef = useRef(null);
  const regionDebounceRef = useRef(null);
  const lastSyncRef = useRef({ userId: "", at: 0 });

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
  const [mapsReady, setMapsReady] = useState(false);
  const [regionName, setRegionName] = useState("");
  const [regionPlaceId, setRegionPlaceId] = useState("");
  const [regionCountryCode, setRegionCountryCode] = useState("");
  const [regionLat, setRegionLat] = useState("");
  const [regionLng, setRegionLng] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [regionSuggestions, setRegionSuggestions] = useState([]);
  const [regionSearchLoading, setRegionSearchLoading] = useState(false);
  const [regionCountrySelect, setRegionCountrySelect] = useState("");
  const [regionStateSelect, setRegionStateSelect] = useState("");
  const [regionCountrySearch, setRegionCountrySearch] = useState("");
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
    if (!banner) return;
    if (bannerVariant === "error") return;
    emitToast(banner, bannerVariant, 3000);
  }, [banner, bannerVariant]);

  const resolvedUsername = useMemo(() => slugifyUsername(username || fullName), [username, fullName]);
  const resolvedFallbackCountryCode = useMemo(() => {
    const explicit = String(regionCountrySelect || "").trim().toUpperCase();
    if (explicit) return explicit;
    const stored = String(regionCountryCode || "").trim().toUpperCase();
    if (stored) return stored;
    const suffix = String(regionName || "").split(",").pop()?.trim().toLowerCase() || "";
    return COUNTRY_NAME_TO_CODE[suffix] || "";
  }, [regionCountrySelect, regionCountryCode, regionName]);
  const fallbackCountryOptions = useMemo(() => {
    if (!resolvedFallbackCountryCode) return REGION_COUNTRIES;
    const exists = REGION_COUNTRIES.some((item) => item.code === resolvedFallbackCountryCode);
    if (exists) return REGION_COUNTRIES;
    return [{ code: resolvedFallbackCountryCode, name: resolvedFallbackCountryCode }, ...REGION_COUNTRIES];
  }, [resolvedFallbackCountryCode]);
  const filteredFallbackCountryOptions = useMemo(() => {
    const query = String(regionCountrySearch || "").trim().toLowerCase();
    if (!query) return fallbackCountryOptions;
    const filtered = fallbackCountryOptions.filter((item) => {
      const code = String(item.code || "").toLowerCase();
      const name = String(item.name || "").toLowerCase();
      return code.includes(query) || name.includes(query);
    });
    // Keep currently selected value visible even if it doesn't match the current search string.
    if (
      resolvedFallbackCountryCode &&
      !filtered.some((item) => item.code === resolvedFallbackCountryCode)
    ) {
      const selected = fallbackCountryOptions.find((item) => item.code === resolvedFallbackCountryCode);
      if (selected) return [selected, ...filtered];
    }
    return filtered;
  }, [fallbackCountryOptions, regionCountrySearch, resolvedFallbackCountryCode]);
  const fallbackRegionOptions = useMemo(() => {
    const selected = String(resolvedFallbackCountryCode || "").toUpperCase();
    const base = REGION_OPTIONS_BY_COUNTRY[selected] || [];
    const current = String(regionStateSelect || "").trim();
    if (!current || base.includes(current)) return base;
    return [current, ...base];
  }, [resolvedFallbackCountryCode, regionStateSelect]);
  const isSettingsDirty = useMemo(() => {
    if (!settingsOnly || !session?.user || !profile?.id) return false;
    const snapshot = settingsSnapshotRef.current;
    if (!snapshot) return false;
    return (
      String(fullName || "").trim() !== snapshot.fullName ||
      String(username || "").trim() !== snapshot.username ||
      String(fitnessLevel || "").trim() !== snapshot.fitnessLevel ||
      String(primaryGoal || "").trim() !== snapshot.primaryGoal ||
      String(regionName || "").trim() !== snapshot.regionName ||
      String(regionPlaceId || "").trim() !== snapshot.regionPlaceId ||
      String(regionCountryCode || "").trim() !== snapshot.regionCountryCode ||
      String(regionLat || "").trim() !== snapshot.regionLat ||
      String(regionLng || "").trim() !== snapshot.regionLng ||
      String(regionCountrySelect || "").trim() !== snapshot.regionCountrySelect ||
      String(regionStateSelect || "").trim() !== snapshot.regionStateSelect ||
      String(gymName || "").trim() !== snapshot.gymName ||
      String(gymPlaceId || "").trim() !== snapshot.gymPlaceId ||
      String(gymAddress || "").trim() !== snapshot.gymAddress ||
      String(gymLat || "").trim() !== snapshot.gymLat ||
      String(gymLng || "").trim() !== snapshot.gymLng
    );
  }, [settingsOnly, session, profile, fullName, username, fitnessLevel, primaryGoal, regionName, regionPlaceId, regionCountryCode, regionLat, regionLng, regionCountrySelect, regionStateSelect, gymName, gymPlaceId, gymAddress, gymLat, gymLng]);

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

  const fetchProfileByAuthUser = async (authUser) => {
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
  };

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
        setRegionName(row.primary_region_name || "");
        setRegionPlaceId(row.primary_region_place_id || "");
        setRegionCountryCode(row.primary_region_country_code || "");
        setRegionLat(row.primary_region_lat == null ? "" : String(row.primary_region_lat));
        setRegionLng(row.primary_region_lng == null ? "" : String(row.primary_region_lng));
        setRegionQuery(row.primary_region_name || "");
        setRegionCountrySelect(String(row.primary_region_country_code || "").toUpperCase());
        setRegionStateSelect(String(row.primary_region_name || "").split(",")[0].trim());
        setGymName(row.primary_gym_name || "");
        setGymPlaceId(row.primary_gym_place_id || "");
        setGymAddress(row.primary_gym_address || "");
        setGymLat(row.primary_gym_lat == null ? "" : String(row.primary_gym_lat));
        setGymLng(row.primary_gym_lng == null ? "" : String(row.primary_gym_lng));
        setUserStorage(row, nextSession.user);
        settingsSnapshotRef.current = {
          fullName: String(row.full_name || "").trim(),
          username: String(row.username || "").trim(),
          fitnessLevel: String(row.fitness_level || "Beginner").trim(),
          primaryGoal: String(row.primary_goal || "Build Muscle").trim(),
          regionName: String(row.primary_region_name || "").trim(),
          regionPlaceId: String(row.primary_region_place_id || "").trim(),
          regionCountryCode: String(row.primary_region_country_code || "").trim(),
          regionLat: row.primary_region_lat == null ? "" : String(row.primary_region_lat).trim(),
          regionLng: row.primary_region_lng == null ? "" : String(row.primary_region_lng).trim(),
          regionCountrySelect: String(row.primary_region_country_code || "").trim().toUpperCase(),
          regionStateSelect: String(row.primary_region_name || "").split(",")[0].trim(),
          gymName: String(row.primary_gym_name || "").trim(),
          gymPlaceId: String(row.primary_gym_place_id || "").trim(),
          gymAddress: String(row.primary_gym_address || "").trim(),
          gymLat: row.primary_gym_lat == null ? "" : String(row.primary_gym_lat).trim(),
          gymLng: row.primary_gym_lng == null ? "" : String(row.primary_gym_lng).trim(),
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

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (loadingGuardTimeout) {
        clearTimeout(loadingGuardTimeout);
        loadingGuardTimeout = null;
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
    const query = String(regionQuery || "").trim();
    if (query.length < 2) {
      setRegionSuggestions([]);
      setRegionSearchLoading(false);
      return undefined;
    }
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      setRegionSearchLoading(true);
      placesServiceRef.current.getPlacePredictions(
        {
          input: query,
          sessionToken: placesSessionRef.current,
          types: ["(regions)"],
        },
        (predictions, status) => {
          setRegionSearchLoading(false);
          if (status !== "OK" || !Array.isArray(predictions)) {
            setRegionSuggestions([]);
            return;
          }
          setRegionSuggestions(
            predictions.slice(0, 8).map((row) => {
              const terms = Array.isArray(row.terms) ? row.terms : [];
              const country = terms.length ? String(terms[terms.length - 1]?.value || "").trim().toUpperCase() : "";
              return {
                placeId: String(row.place_id || ""),
                name: String(row.structured_formatting?.main_text || row.description || ""),
                address: String(row.description || ""),
                countryCode: country.length === 2 ? country : "",
              };
            })
          );
        }
      );
    }, 250);
    return () => {
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    };
  }, [regionQuery, mapsReady, settingsOnly]);

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

  const pickRegionSuggestion = (item) => {
    if (!item) return;
    setRegionName(String(item.name || ""));
    setRegionPlaceId(String(item.placeId || ""));
    setRegionCountryCode(String(item.countryCode || "").toUpperCase());
    setRegionCountrySelect(String(item.countryCode || "").toUpperCase());
    setRegionStateSelect(String(item.name || ""));
    setRegionQuery(String(item.address || item.name || ""));
    setRegionSuggestions([]);
    setBanner(`Region linked: ${String(item.name || "Selected region")}`, "success");
  };

  const clearRegionLink = () => {
    setRegionName("");
    setRegionPlaceId("");
    setRegionCountryCode("");
    setRegionLat("");
    setRegionLng("");
    setRegionCountrySelect("");
    setRegionStateSelect("");
    setRegionQuery("");
    setRegionSuggestions([]);
    // Keep legacy location fields aligned with region state.
    setGymName("");
    setGymPlaceId("");
    setGymAddress("");
    setGymLat("");
    setGymLng("");
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

  const handleProfileSave = async () => {
    if (!profile?.id) return;
    const cleanUsername = slugifyUsername(username);
    const selectedCountry = REGION_COUNTRIES.find((item) => item.code === String(resolvedFallbackCountryCode || "").toUpperCase());
    const isManualRegionMode = !MAPS_KEY;
    const resolvedRegionCountry = isManualRegionMode
      ? String(resolvedFallbackCountryCode || "").toUpperCase()
      : String(regionCountryCode || "").trim().toUpperCase();
    const resolvedRegionName = isManualRegionMode
      ? `${String(regionStateSelect || "").trim()}${selectedCountry ? `, ${selectedCountry.name}` : ""}`.trim()
      : String(regionName || "").trim();
    const manualRegionPlaceId = isManualRegionMode
      ? `region:${toRegionKeyPart(resolvedRegionCountry)}:${toRegionKeyPart(regionStateSelect)}`
      : "";
    const resolvedRegionPlaceId = isManualRegionMode
      ? manualRegionPlaceId
      : String(regionPlaceId || "").trim();
    if (!fullName.trim()) {
      setBanner("Full name is required.", "error");
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setBanner("Username must be at least 3 characters.", "error");
      return;
    }
    if (isManualRegionMode && (!resolvedRegionCountry || !String(regionStateSelect || "").trim())) {
      setBanner("Select both country and state/region.", "error");
      return;
    }
    if (!isManualRegionMode && regionQuery.trim() && !resolvedRegionPlaceId) {
      setBanner("Select your region from suggestions to keep rankings accurate.", "error");
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

    const compatibilityPayload = {
      full_name: fullName.trim(),
      display_name: fullName.trim(),
      username: cleanUsername,
      fitness_level: fitnessLevel,
      primary_goal: primaryGoal,
      // Compatibility mirror for existing location-based flows
      primary_gym_name: resolvedRegionName || null,
      primary_gym_place_id: resolvedRegionPlaceId || null,
      primary_gym_address: resolvedRegionName || null,
      primary_gym_lat: Number.isFinite(Number(regionLat)) && !isManualRegionMode ? Number(regionLat) : null,
      primary_gym_lng: Number.isFinite(Number(regionLng)) && !isManualRegionMode ? Number(regionLng) : null,
      primary_gym_linked_at: resolvedRegionName ? new Date().toISOString() : null,
    };

    const regionPayload = {
      primary_region_name: resolvedRegionName || null,
      primary_region_place_id: resolvedRegionPlaceId || null,
      primary_region_country_code: resolvedRegionCountry || null,
      primary_region_lat: Number.isFinite(Number(regionLat)) && !isManualRegionMode ? Number(regionLat) : null,
      primary_region_lng: Number.isFinite(Number(regionLng)) && !isManualRegionMode ? Number(regionLng) : null,
      primary_region_linked_at: resolvedRegionName ? new Date().toISOString() : null,
        primary_region_verified: !isManualRegionMode && Boolean(resolvedRegionPlaceId),
    };

    let { data, error } = await supabase
      .from("user_profiles")
      .update({ ...compatibilityPayload, ...regionPayload })
      .eq("id", profile.id)
      .select("*")
      .single();

    const errorMessage = String(error?.message || "").toLowerCase();
    const missingRegionColumns =
      error &&
      (errorMessage.includes("primary_region_") ||
        (errorMessage.includes("column") && errorMessage.includes("does not exist")));

    let usedLegacyFallback = false;
    if (missingRegionColumns) {
      ({ data, error } = await supabase
        .from("user_profiles")
        .update(compatibilityPayload)
        .eq("id", profile.id)
        .select("*")
        .single());
      if (!error && data) {
        usedLegacyFallback = true;
        setBanner(
          "Profile saved using legacy location fields. Run supabase/region_linking.sql to enable verified region columns.",
          "warn"
        );
      }
    }

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
      regionName: String(data.primary_region_name || "").trim(),
      regionPlaceId: String(data.primary_region_place_id || "").trim(),
      regionCountryCode: String(data.primary_region_country_code || "").trim(),
      regionLat: data.primary_region_lat == null ? "" : String(data.primary_region_lat).trim(),
      regionLng: data.primary_region_lng == null ? "" : String(data.primary_region_lng).trim(),
      regionCountrySelect: String(data.primary_region_country_code || "").trim().toUpperCase(),
      regionStateSelect: String(data.primary_region_name || "").split(",")[0].trim(),
      gymName: String(data.primary_gym_name || "").trim(),
      gymPlaceId: String(data.primary_gym_place_id || "").trim(),
      gymAddress: String(data.primary_gym_address || "").trim(),
      gymLat: data.primary_gym_lat == null ? "" : String(data.primary_gym_lat).trim(),
      gymLng: data.primary_gym_lng == null ? "" : String(data.primary_gym_lng).trim(),
    };
    if (!usedLegacyFallback) {
      setBanner("Profile updated.", "success");
    }
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
                <label className="block text-white mb-2">Region (verified)</label>
                {MAPS_KEY ? (
                  <>
                    <input
                      className="profile-input"
                      value={regionQuery}
                      onChange={(e) => setRegionQuery(e.target.value)}
                      placeholder="Search region (e.g. Cork, Ireland)"
                    />
                    <p className="text-xs text-gray-400 mt-2 mb-0">
                      Pick from suggestions only. Free text is not used for ranked region leaderboards.
                    </p>
                    {mapsReady && regionSearchLoading ? (
                      <div className="text-xs text-gray-300 mt-2">Searching regions...</div>
                    ) : null}
                    {regionSuggestions.length > 0 ? (
                      <div className="grid gap-2 mt-2">
                        {regionSuggestions.map((item) => (
                          <button
                            key={`region-${item.placeId || item.address}`}
                            type="button"
                            className="profile-button-secondary"
                            onClick={() => pickRegionSuggestion(item)}
                            style={{ textAlign: "left" }}
                          >
                            {item.name}
                            <div className="text-xs text-gray-300">{item.address}</div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <input
                      className="profile-input"
                      placeholder="Search country (e.g. Ireland)"
                      value={regionCountrySearch}
                      onChange={(e) => setRegionCountrySearch(e.target.value)}
                    />
                    <div className="mt-2" />
                    <select
                      className="profile-select"
                      value={resolvedFallbackCountryCode}
                      onChange={(e) => {
                        setRegionCountrySelect(String(e.target.value || "").toUpperCase());
                        setRegionStateSelect("");
                      }}
                    >
                      <option value="">Select country</option>
                      {filteredFallbackCountryOptions.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2" />
                    <select
                      className="profile-select"
                      value={regionStateSelect}
                      onChange={(e) => setRegionStateSelect(e.target.value)}
                      disabled={!resolvedFallbackCountryCode}
                    >
                      <option value="">{resolvedFallbackCountryCode ? "Select state/region" : "Select country first"}</option>
                      {fallbackRegionOptions.map((item) => (
                        <option key={`${resolvedFallbackCountryCode}-${item}`} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-2 mb-0">
                      Dropdown fallback mode is active because REACT_APP_GOOGLE_MAPS_API_KEY is missing.
                    </p>
                  </>
                )}
                {(regionPlaceId || regionName) ? (
                  <div className="text-xs text-gray-300 mt-2">
                    Linked region: {regionName || "Region"} {regionCountryCode ? `(${regionCountryCode})` : ""}
                  </div>
                ) : null}
                <div className="mt-2">
                  <button className="profile-button-secondary" type="button" onClick={clearRegionLink}>
                    Clear Region
                  </button>
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <p className="text-xs text-gray-300 m-0">
                  Region powers discovery + rankings. It is also mirrored to legacy location fields for compatibility.
                </p>
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
