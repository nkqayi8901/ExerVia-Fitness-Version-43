import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
// Component: CompanionOrb - UI layout and interactions.
// This component renders the companionorb experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

// fetchExercise manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
const fetchExercise = async (query) => {
  const url = query
    ? `https://wger.de/api/v2/exerciseinfo/?language=2&limit=10&search=${encodeURIComponent(query)}`
    : "https://wger.de/api/v2/exerciseinfo/?language=2&limit=1";
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

// stripHtml manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
const stripHtml = (value) => {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "").replace(/\\s+/g, " ").trim();
};

export default function CompanionOrb() {
  const location = useLocation();
  const [tooltip, setTooltip] = useState("");
  const [popOpen, setPopOpen] = useState(false);
  const [popLoading, setPopLoading] = useState(false);
  const [popData, setPopData] = useState(null);
  const [hintText, setHintText] = useState("");
  const [chatInput, setChatInput] = useState("");

  const userId = useMemo(() => localStorage.getItem("exervia_user_id"), []);
  const mode = useMemo(() => {
    if (location.pathname.startsWith("/gym")) return "gym";
    if (location.pathname.startsWith("/athlete")) return "athlete";
    return "general";
  }, [location.pathname]);

  const loadPopout = useCallback(async (query = "") => {
    setPopLoading(true);
    const data = await fetchExercise(query);
    const item = data?.results?.[0];
    if (item) {
      const desc = stripHtml(item.description);
      setPopData({
        title: item.name,
        message: desc || "Exercise details available."
      });
    } else if (hintText) {
      setPopData({ title: "Companion", message: hintText });
    } else {
      setPopData(null);
    }
    setPopLoading(false);
  }, [hintText]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    let active = true;
// loadTooltip manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const loadTooltip = async () => {
      if (hintText) {
        setTooltip(hintText);
        return;
      }
      const data = await fetchExercise();
      if (!active) return;
      const item = data?.results?.[0];
      if (!item) return;
      const name = item.name;
      const desc = stripHtml(item.description);
      setTooltip(desc ? `${name}: ${desc.slice(0, 90)}...` : name);
    };
    loadTooltip();
    // Render
    return () => {
      active = false;
    };
  }, [location.pathname, mode, userId, hintText, loadPopout]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
// handler manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const handler = async (event) => {
      const context = event?.detail || {};
      const query = context.name || "";
      setHintText(context.text || "");
      setPopOpen(true);
      await loadPopout(query);
    };
    window.addEventListener("companion_knowledge", handler);
    return () => window.removeEventListener("companion_knowledge", handler);
  }, [location.pathname, mode, userId, hintText]);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
// handler manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const handler = (event) => {
      const nextText = event?.detail?.text || "";
      setHintText(nextText);
      if (nextText) {
        setTooltip(nextText);
      }
    };
    window.addEventListener("companion_hint", handler);
    return () => window.removeEventListener("companion_hint", handler);
  }, []);


  return (
    <div className="companion-orb-shell">
      <button
        className="companion-orb"
        onClick={async () => {
          if (!popOpen && !popData && !popLoading) {
            await loadPopout();
          }
          setPopOpen((prev) => !prev);
        }}
        type="button"
        aria-label="Companion"
      >
        <span className="companion-orb-core" />
      </button>
      {tooltip && (
        <div className="companion-tooltip">
          {tooltip}
        </div>
      )}
      {popOpen && (
        <div className="companion-popout">
          {popLoading && <div className="companion-popout-body">Loading...</div>}
          {!popLoading && popData && (
            <>
              {popData.title && <div className="companion-popout-title">{popData.title}</div>}
              {popData.message && <div className="companion-popout-body">{popData.message}</div>}
              {Array.isArray(popData.bullets) && popData.bullets.length > 0 && (
                <ul className="companion-popout-list">
                  {popData.bullets.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {!popLoading && !popData && (
            <div className="companion-popout-body">No exercise info found.</div>
          )}
          <div className="companion-popout-chat">
            <input
              className="companion-popout-input"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const next = chatInput.trim();
                  if (!next) return;
                  loadPopout(next);
                  setChatInput("");
                }
              }}
              placeholder="Ask about an exercise..."
            />
            <button
              className="companion-popout-btn"
              onClick={() => {
                const next = chatInput.trim();
                if (!next) return;
                loadPopout(next);
                setChatInput("");
              }}
              type="button"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}