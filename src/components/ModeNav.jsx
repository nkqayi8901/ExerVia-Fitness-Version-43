import { useLocation, useNavigate } from "react-router-dom";

const IconHome = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M3 10.5l9-7 9 7v9.5a1 1 0 0 1-1 1h-5.5a1 1 0 0 1-1-1v-5.5h-3V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const IconDumbbell = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 9v6M7 8v8M17 8v8M20 9v6M7 12h10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const IconJournal = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const IconNutrition = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7 4c0 6 4 9 4 16M14 4c0 7-4 10-4 16M17 6c0 5-2 8-2 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const IconProfile = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M4 20a8 8 0 0 1 16 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const IconCommunity = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6.5 11.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm11 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM3 20a5 5 0 0 1 7-4.6M14 15.4A5 5 0 0 1 21 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const IconModeSwitch = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5 7h11a3 3 0 0 1 0 6H8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M9 3l-4 4 4 4M19 21l4-4-4-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ModeNav({ mode, userId, placement = "inline" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const id = userId || "";
  const base = mode === "gym" ? `/gym/${id}` : `/athlete/${id}`;
  const switchPath = mode === "gym" ? `/athlete/${id}` : `/gym/${id}`;

  const items = [
    { key: "home", label: "Home", icon: IconHome, path: base },
    {
      key: "primary",
      label: mode === "gym" ? "Progress" : "Training",
      icon: IconDumbbell,
      path: mode === "gym" ? `${base}/progress` : `${base}/training`,
    },
    { key: "journal", label: "Journal", icon: IconJournal, path: `${base}/journal` },
    { key: "nutrition", label: "Nutrition", icon: IconNutrition, path: "/nutrition" },
    { key: "profile", label: "Profile", icon: IconProfile, path: `/athlete/${id}/profile` },
    { key: "community", label: "Community", icon: IconCommunity, path: `/athlete/${id}/community` },
    {
      key: "mode",
      label: mode === "gym" ? "Athlete Mode" : "Gym Mode",
      icon: IconModeSwitch,
      path: switchPath,
    },
  ];

  return (
    <div className={`mode-nav mode-nav-${placement}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === "mode"
          ? false
          : item.path === base
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
        const nextMode = item.key === "mode" ? (mode === "gym" ? "athlete" : "gym") : mode;
        return (
          <button
            key={item.key}
            type="button"
            className={`mode-nav-btn ${isActive ? "active" : ""}`}
            onClick={() => {
              if (item.key === "mode") {
                localStorage.setItem("exervia_active_mode", nextMode);
              }
              navigate(item.path);
            }}
          >
            <span className="mode-nav-icon">
              <Icon />
            </span>
            <span className="mode-nav-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
