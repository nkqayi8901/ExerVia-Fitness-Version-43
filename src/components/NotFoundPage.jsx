import { useNavigate } from "react-router-dom";

// Component: NotFoundPage - UI layout and interactions.
// This component renders the notfoundpage experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the not found page which is shown when a user navigates to a route that does not exist
// it provides options for the user to go back, go home, or go to the sign in page
// the UI layout and styling was adapted from Tailwind card components found on https://tailwindui.com/preview
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <div className="hud-card" style={{ display: "grid", gap: 12 }}>
        <div className="page-title">Page not found</div>
        <div className="page-subtitle">That route does not exist.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="studio-back" type="button" onClick={() => navigate(-1)}>
            {"Back"}
          </button>
          <button className="studio-back" type="button" onClick={() => navigate("/")}>
            Home
          </button>
          <button className="studio-back" type="button" onClick={() => navigate("/auth")}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

