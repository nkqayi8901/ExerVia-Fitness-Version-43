import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";

const resolveProfilePath = (pathname, profileId) => {
  const match = String(pathname || "").match(/^\/(gym|athlete)\/[^/]+(\/.*)?$/);
  if (!match) return null;
  const mode = match[1];
  const suffix = match[2] || "";
  return `/${mode}/${profileId}${suffix}`;
};

export default function RequireAuth({ children }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [redirectPath, setRedirectPath] = useState("");

  const currentProfileId = String(localStorage.getItem("exervia_user_id") || "").trim();

  useEffect(() => {
    let cancelled = false;

    const validate = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session || null;
      if (!session?.user?.id) {
        if (!cancelled) {
          setAuthed(false);
          setReady(true);
        }
        return;
      }

      let profileId = currentProfileId;
      if (!profileId) {
        const { data: profileRow } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();
        if (profileRow?.id) {
          profileId = String(profileRow.id);
          localStorage.setItem("exervia_user_id", profileId);
        }
      }

      if (!cancelled) {
        const expectedPath = profileId ? resolveProfilePath(location.pathname, profileId) : null;
        if (expectedPath && expectedPath !== location.pathname) {
          setRedirectPath(expectedPath);
        } else {
          setRedirectPath("");
        }
        setAuthed(true);
        setReady(true);
      }
    };

    validate();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!cancelled) {
        setAuthed(Boolean(nextSession?.user?.id));
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      authSub?.subscription?.unsubscribe();
    };
  }, [currentProfileId, location.pathname]);

  if (!ready) {
    return (
      <div className="page-shell">
        <div className="hud-card">Checking account session...</div>
      </div>
    );
  }
  if (!authed) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  if (redirectPath) return <Navigate to={redirectPath} replace />;
  return children;
}
