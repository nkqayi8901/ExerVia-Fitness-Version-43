import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { clearAuthStorage, getStoredProfileId, setStoredProfileId } from "../utils/authStorage";

// Component: RequireAuth - UI layout and interactions.
// This component renders the authentication gate experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is a wrapper component that checks if the user is authenticated before allowing access to certain routes
// if the user is not authenticated, they are redirected to the login page
// if they are authenticated but do not have a profile, they are redirected to the create profile page
// this component is used to protect routes that require authentication and profile access
// the authentication check is done by checking the Supabase auth session and
//  then verifying if there is a corresponding user profile in the database
// the logic for resolving the correct profile path based on the current URL 
// and user profile is handled in the resolveProfilePath function
// the UI layout for the loading state is a simple card that says "Checking account session..."
const resolveProfilePath = (pathname, profileId) => {
  const match = String(pathname || "").match(/^\/(gym|athlete)\/[^/]+(\/.*)?$/);
  if (!match) return null;
  const mode = match[1];
  const suffix = match[2] || "";
  return `/${mode}/${profileId}${suffix}`;
};

const withTimeout = async (promise, timeoutMs, message = "Request timed out") => {
  let handle = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        handle = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (handle) clearTimeout(handle);
  }
};

export default function RequireAuth({ children }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [redirectPath, setRedirectPath] = useState("");
  const [resolvedProfileId, setResolvedProfileId] = useState(getStoredProfileId());
  const cachedProfileId = getStoredProfileId();
  const cachedProfilePath = cachedProfileId
    ? resolveProfilePath(location.pathname, cachedProfileId)
    : null;

  useEffect(() => {
    let cancelled = false;
    let validateSeq = 0;

    const validate = async (sessionOverride = null) => {
      const currentSeq = validateSeq + 1;
      validateSeq = currentSeq;
      let hasSessionUser = false;
      try {
        let session =
          sessionOverride ||
          (await withTimeout(supabase.auth.getSession(), 6000, "Session check timed out")).data
            ?.session ||
          null;
        hasSessionUser = Boolean(session?.user?.id);
        if (!session?.user?.id) {
          // Confirm sign-out to avoid transient null-session races during token refresh.
          try {
            const confirmed =
              (await withTimeout(
                supabase.auth.getSession(),
                2000,
                "Session confirm timed out"
              ))?.data?.session || null;
            if (confirmed?.user?.id) {
              session = confirmed;
              hasSessionUser = true;
            }
          } catch {
            // continue and treat as signed out
          }
        }
        if (!session?.user?.id || cancelled || validateSeq !== currentSeq) {
          if (!cancelled) {
            clearAuthStorage();
            setResolvedProfileId("");
            setRedirectPath("");
            setAuthed(false);
            setReady(true);
          }
          return;
        }

        let profileId = "";
        const authUid = String(session.user.id || "").trim();
        const cachedId = getStoredProfileId();

        let profileByAuth = null;
        try {
          const { data } = await withTimeout(
            supabase
              .from("user_profiles")
              .select("id")
              .eq("auth_user_id", authUid)
              .maybeSingle(),
            6000,
            "Profile lookup timed out"
          );
          profileByAuth = data || null;
        } catch {
          profileByAuth = null;
        }

        if (profileByAuth?.id) {
          profileId = String(profileByAuth.id);
          setStoredProfileId(profileId);
        } else {
          const sessionEmail = String(session.user.email || "").trim().toLowerCase();
          if (sessionEmail) {
            try {
              const { data: byEmail } = await withTimeout(
                supabase
                  .from("user_profiles")
                  .select("id,email")
                  .eq("email", sessionEmail)
                  .maybeSingle(),
                6000,
                "Profile lookup timed out"
              );
              if (byEmail?.id) {
                profileId = String(byEmail.id);
                setStoredProfileId(profileId);
              }
            } catch {
              // continue to cached fallback below
            }
          }
          if (cachedId) {
            try {
              const { data: cachedProfile } = await supabase
                .from("user_profiles")
                .select("id,auth_user_id,email")
                .eq("id", Number(cachedId))
                .maybeSingle();
              const cachedAuthUid = String(cachedProfile?.auth_user_id || "").trim();
              const cachedEmail = String(cachedProfile?.email || "").trim().toLowerCase();
              const sessionEmail = String(session.user.email || "").trim().toLowerCase();
              if (cachedProfile?.id && (cachedAuthUid === authUid || (sessionEmail && cachedEmail === sessionEmail))) {
                profileId = String(cachedProfile.id);
              } else {
                clearAuthStorage();
              }
            } catch {
              // If profile lookup is temporarily unavailable, fall back to cached id
              // so navigation remains usable instead of hanging behind auth checks.
              profileId = cachedId;
            }
          }
        }

        if (!cancelled && validateSeq === currentSeq) {
          setResolvedProfileId(profileId);
          if (profileId) {
            setRedirectPath("");
          }
          setAuthed(true);
          setReady(true);
        }
      } catch (error) {
        console.error("RequireAuth validate failed:", error);
        let fallbackHasSession = hasSessionUser;
        if (!fallbackHasSession) {
          try {
            const fallbackSession = (await supabase.auth.getSession())?.data?.session || null;
            fallbackHasSession = Boolean(fallbackSession?.user?.id);
          } catch {
            fallbackHasSession = false;
          }
        }
        if (!cancelled && validateSeq === currentSeq) {
          if (!fallbackHasSession) {
            clearAuthStorage();
            setResolvedProfileId("");
            setAuthed(false);
          } else {
            // Preserve previous resolved profile id on transient failures so route
            // normalization can still push tampered URLs back to the signed-in user.
            setAuthed(true);
          }
          setRedirectPath("");
          setReady(true);
        }
      }
    };

    validate();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      // Always validate, even when nextSession is null, to avoid transient null-session races.
      validate(nextSession);
    });

    return () => {
      cancelled = true;
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authed || !resolvedProfileId) return;
    const expectedPath = resolveProfilePath(location.pathname, resolvedProfileId);
    if (expectedPath && expectedPath !== location.pathname) {
      setRedirectPath(expectedPath);
      return;
    }
    setRedirectPath("");
  }, [authed, location.pathname, resolvedProfileId]);

  if (!ready) {
    return (
      <div className="page-shell">
        <div className="hud-card">Checking account session...</div>
      </div>
    );
  }
  if (!authed && cachedProfilePath && cachedProfilePath !== location.pathname) {
    return <Navigate to={cachedProfilePath} replace />;
  }
  if (!authed) return <Navigate to="/auth" replace />;
  if (
    authed &&
    !resolvedProfileId &&
    (location.pathname.startsWith("/gym/") || location.pathname.startsWith("/athlete/"))
  ) {
    return <Navigate to="/create-profile" replace />;
  }
  if (redirectPath) return <Navigate to={redirectPath} replace />;
  return children;
}
