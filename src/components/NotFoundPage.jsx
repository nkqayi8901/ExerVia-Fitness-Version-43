import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell">
      <div className="hud-card" style={{ display: "grid", gap: 12 }}>
        <div className="page-title">Page not found</div>
        <div className="page-subtitle">That route does not exist.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="studio-back" type="button" onClick={() => navigate(-1)}>
            {"<- Back"}
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
