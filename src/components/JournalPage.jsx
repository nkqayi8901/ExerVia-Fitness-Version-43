import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { recalcUserState } from "../services/stateEngine";
import { trackDailyActivity } from "../services/activityTracker";
import { grantXpEventSafe } from "../services/xpEvents";
import { emitToast } from "../utils/toast";
import useModalA11y from "../hooks/useModalA11y";
import PageWalkthroughModal from "./PageWalkthroughModal";
// Component: JournalPage - UI layout and interactions.
// This component renders the journalpage experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.
// this is the journal page which is a key part of both gym and athlete modes
// it allows users to set a morning intention and an evening reflection each day
// the journal entries are stored as structured JSON blobs in the database
// the UI layout and styling was adapted from Tailwind card and
// form components found on https://tailwindui.com/preview
// the data fetching and state management logic was adapted from 
//the patterns I learned in the SystemStatus and Navbar components
// the morning intention and evening reflection prompts were adapted 
// from the principles of effective journaling outlined in th
// e book "The Power of Daily Reflection" by Dr. John Demartini

const SLOT_PREFIX = {
  morning: "MORNING_PREP::",
  evening: "EVENING_REFLECTION::",
};

const FALLBACK_QUOTES = [
  { content: "Consistency creates identity.", author: "ExerVia" },
  { content: "Discipline is self-respect in action.", author: "ExerVia" },
  { content: "Recovery is part of performance.", author: "ExerVia" },
  { content: "Small wins compound faster than motivation fades.", author: "ExerVia" },
  { content: "Train with intent. Reflect with honesty.", author: "ExerVia" },
];

const emptyMorning = {
  intention: "",
  sessionFocus: "",
  nonNegotiable: "",
};

const emptyEvening = {
  wentWell: "",
  feltHard: "",
  adjustTomorrow: "",
  mood: "",
  tags: "",
};

const JOURNAL_WALKTHROUGH_STEPS = [
  {
    id: "morning",
    title: "Morning Preparation",
    what: "Set intention, session focus, and your non-negotiable for today.",
    why: "Starting with intent keeps training and recovery execution tighter.",
    firstAction: "Open Morning slot.",
  },
  {
    id: "evening",
    title: "Evening Reflection",
    what: "Capture wins, friction, and what to adjust tomorrow.",
    why: "Reflection turns each day into actionable feedback.",
    firstAction: "Open Evening slot.",
  },
  {
    id: "mood_trend",
    title: "Mood Trend",
    what: "Review mood bars and inspect day-level patterns over time.",
    why: "Mood changes often explain performance and recovery swings.",
    firstAction: "Review Mood Trend.",
  },
  {
    id: "history",
    title: "History and Search",
    what: "Use search and tags to revisit older entries and edit them.",
    why: "Long-term context helps improve decision quality.",
    firstAction: "Open Journal History.",
  },
];

function formatDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseStructuredEntry(entry) {
  const raw = entry?.notes || "";
  if (raw.startsWith(SLOT_PREFIX.morning)) {
    try {
      const data = JSON.parse(raw.slice(SLOT_PREFIX.morning.length));
      return { slot: "morning", data };
    } catch {
      return { slot: "morning", data: { ...emptyMorning } };
    }
  }
  if (raw.startsWith(SLOT_PREFIX.evening)) {
    try {
      const data = JSON.parse(raw.slice(SLOT_PREFIX.evening.length));
      return { slot: "evening", data };
    } catch {
      return { slot: "evening", data: { ...emptyEvening } };
    }
  }
  return null;
}

function buildStructuredNotes(slot, payload) {
  return `${SLOT_PREFIX[slot]}${JSON.stringify(payload)}`;
}

function pickFallbackQuote() {
  const day = new Date().getDate();
  return FALLBACK_QUOTES[day % FALLBACK_QUOTES.length];
}

function normalizeQuotePayload(raw) {
  if (!raw) return null;

  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (first?.q) return { content: String(first.q), author: String(first.a || "Unknown") };
    if (first?.quote) return { content: String(first.quote), author: String(first.author || "Unknown") };
    if (first?.content) return { content: String(first.content), author: String(first.author || "Unknown") };
  }

  if (raw?.q) return { content: String(raw.q), author: String(raw.a || "Unknown") };
  if (raw?.quote) return { content: String(raw.quote), author: String(raw.author || "Unknown") };
  if (raw?.content) return { content: String(raw.content), author: String(raw.author || "Unknown") };

  return null;
}

async function fetchJsonWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function JournalMetaCards({ isDayComplete, dayInOneGlance, thisMonthEntries, quote }) {
  return (
    <div className="grid-2 journal-meta-grid">
      <div className={`hud-card journal-summary-card${isDayComplete ? " day-complete" : ""}`}>
        <div className="hud-card-title">YOUR DAY IN ONE GLANCE</div>
        {isDayComplete && <div className="journal-complete-pill">Day complete</div>}
        <div className="journal-summary-text">{dayInOneGlance}</div>
        <div className="journal-summary-foot">{thisMonthEntries} entries this month</div>
      </div>

      <div className="hud-card journal-quote-card">
        <div className="hud-card-title">QUOTE OF THE DAY</div>
        <div className="quote-box">
          <div className="quote-text">"{quote?.content || "..."}"</div>
          <div className="quote-author">- {quote?.author || "ExerVia"}</div>
        </div>
      </div>
    </div>
  );
}

const createMoodTrendLine = (rows, selectedMoodDay) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const yBottom = 34;
  const yTop = 8;
  const xOffset = 6;
  const usableWidth = 88;
  const step = safeRows.length > 1 ? usableWidth / (safeRows.length - 1) : 0;

  const points = safeRows.map((item, index) => {
    const mood = Number(item?.mood || 0);
    const clampedMood = Math.min(5, Math.max(1, mood || 1));
    const x = xOffset + index * step;
    const y = yBottom - ((clampedMood - 1) / 4) * (yBottom - yTop);
    return {
      key: item?.dayKey || `mood-${index}`,
      dayKey: item?.dayKey || "",
      label: item?.label || "",
      mood: clampedMood,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      active: selectedMoodDay === item?.dayKey,
    };
  });

  return {
    hasData: points.length > 0,
    points,
    polylinePoints: points.map((point) => `${point.x},${point.y}`).join(" "),
    areaPath:
      points.length > 0
        ? `M ${points[0].x} ${yBottom} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x} ${yBottom} Z`
        : "",
  };
};

function JournalMoodCard({ averageMood, selectedMoodDay, setSelectedMoodDay, moodTrend }) {
  const moodLine = useMemo(
    () => createMoodTrendLine(moodTrend, selectedMoodDay),
    [moodTrend, selectedMoodDay]
  );
  const activeMoodPoint = useMemo(
    () => moodLine.points.find((point) => point.active) || null,
    [moodLine]
  );

  return (
    <div className="hud-card journal-mood-card">
      <div className="journal-mood-top">
        <div className="journal-trend-head">
          <div className="hud-card-title">MOOD TREND</div>
          <div className="journal-trend-value-pill">
            {activeMoodPoint ? `${activeMoodPoint.mood}/5` : averageMood ? `${averageMood}/5 avg` : "No mood logs yet"}
          </div>
        </div>
        <div className="journal-mood-actions">
          <div className="journal-mood-average">{averageMood ? `${averageMood}/5 avg` : "No mood logs yet"}</div>
          {selectedMoodDay && (
            <button className="studio-back journal-action-btn" type="button" onClick={() => setSelectedMoodDay("")}>
              Clear day filter
            </button>
          )}
        </div>
      </div>
      <div className="journal-mood-bars">
        {moodTrend.length ? (
          <>
            <div className="journal-trend-line-wrap">
              <svg className="journal-trend-line-svg" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
                <rect className="journal-trend-grid-fill" x="0" y="0" width="100" height="42" rx="8" />
                <line className="journal-trend-grid-line" x1="6" y1="34" x2="94" y2="34" />
                {moodLine.hasData ? (
                  <>
                    <path className="journal-trend-area-fill" d={moodLine.areaPath} />
                    <polyline className="journal-trend-line-path" points={moodLine.polylinePoints} />
                  </>
                ) : null}
                {moodLine.points.map((point) => (
                  <circle
                    key={`mood-point-${point.key}`}
                    className={`journal-trend-point${point.active ? " active" : ""}`}
                    cx={point.x}
                    cy={point.y}
                    r={point.active ? 1.9 : 1.5}
                  />
                ))}
              </svg>
            </div>
            <div className="journal-trend-axis">
              {moodLine.points.map((point) => (
                <button
                  type="button"
                  key={point.key}
                  className={`journal-mood-col-btn journal-trend-axis-btn${point.active ? " active" : ""}`}
                  onClick={() => setSelectedMoodDay(point.dayKey)}
                >
                  <div className="journal-mood-label">{point.label}</div>
                  <span className="journal-trend-tip">{point.mood}/5</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="hud-dim">Log evening mood to unlock your trend.</div>
        )}
      </div>
    </div>
  );
}

function JournalDailyCheckinCard({
  activeSlot,
  setActiveSlot,
  editingTarget,
  cancelHistoryEdit,
  morning,
  setMorning,
  evening,
  setEvening,
  saveSlot,
  savingSlot,
  todayMorningEntry,
  todayEveningEntry,
}) {
  return (
    <div className="journal-premium-grid">
      <div className="hud-card journal-slot-card">
        <div className="journal-slot-top">
          <div className="hud-card-title">DAILY CHECK-IN</div>
          <div className="journal-slot-pill">
            {editingTarget?.slot === activeSlot
              ? `Editing ${new Date(editingTarget.dayKey).toLocaleDateString()}`
              : activeSlot === "morning"
                ? todayMorningEntry
                  ? "Updated today"
                  : "Open"
                : todayEveningEntry
                  ? "Updated today"
                  : "Open"}
          </div>
        </div>

        {editingTarget && (
          <div className="journal-editing-row">
            <div className="hud-dim">Editing history entry</div>
            <button className="studio-back journal-action-btn" type="button" onClick={cancelHistoryEdit}>
              Cancel
            </button>
          </div>
        )}

        <div className="journal-switch" role="tablist" aria-label="Daily check-in sections">
          <button
            className={`journal-switch-btn${activeSlot === "morning" ? " active" : ""}`}
            onClick={() => setActiveSlot("morning")}
            type="button"
          >
            Morning Prep
          </button>
          <button
            className={`journal-switch-btn${activeSlot === "evening" ? " active" : ""}`}
            onClick={() => setActiveSlot("evening")}
            type="button"
          >
            Evening Reflection
          </button>
        </div>

        {activeSlot === "morning" ? (
          <>
            <div className="journal-field-block">
              <label className="journal-field-label">Today&apos;s intention</label>
              <input
                className="journal-input"
                placeholder="What matters most today?"
                value={morning.intention}
                onChange={(e) => setMorning((prev) => ({ ...prev, intention: e.target.value }))}
              />
            </div>

            <div className="journal-field-block">
              <label className="journal-field-label">Session focus</label>
              <input
                className="journal-input"
                placeholder="Main training or health focus"
                value={morning.sessionFocus}
                onChange={(e) => setMorning((prev) => ({ ...prev, sessionFocus: e.target.value }))}
              />
            </div>

            <div className="journal-field-block">
              <label className="journal-field-label">One non-negotiable</label>
              <input
                className="journal-input"
                placeholder="One thing you will complete"
                value={morning.nonNegotiable}
                onChange={(e) => setMorning((prev) => ({ ...prev, nonNegotiable: e.target.value }))}
              />
            </div>

            <button className="hud-primary-btn" onClick={() => saveSlot("morning")} disabled={savingSlot === "morning"}>
              {savingSlot === "morning" ? "Saving..." : todayMorningEntry ? "Update Morning Prep" : "Save Morning Prep"}
            </button>
          </>
        ) : (
          <>
            <div className="journal-field-block">
              <label className="journal-field-label">What went well</label>
              <textarea
                className="journal-textarea"
                placeholder="Highlight one win from today"
                value={evening.wentWell}
                onChange={(e) => setEvening((prev) => ({ ...prev, wentWell: e.target.value }))}
              />
            </div>

            <div className="journal-field-block">
              <label className="journal-field-label">What felt hard</label>
              <textarea
                className="journal-textarea"
                placeholder="Name the friction honestly"
                value={evening.feltHard}
                onChange={(e) => setEvening((prev) => ({ ...prev, feltHard: e.target.value }))}
              />
            </div>

            <div className="journal-field-block">
              <label className="journal-field-label">Adjust for tomorrow</label>
              <textarea
                className="journal-textarea"
                placeholder="One change for tomorrow"
                value={evening.adjustTomorrow}
                onChange={(e) => setEvening((prev) => ({ ...prev, adjustTomorrow: e.target.value }))}
              />
            </div>

            <div className="journal-field-block">
              <label className="journal-field-label">Mood score (1-5)</label>
              <select
                className="journal-input"
                value={evening.mood || ""}
                onChange={(e) => setEvening((prev) => ({ ...prev, mood: e.target.value }))}
              >
                <option value="">Select mood</option>
                <option value="1">1 - rough day</option>
                <option value="2">2 - off</option>
                <option value="3">3 - neutral</option>
                <option value="4">4 - good</option>
                <option value="5">5 - locked in</option>
              </select>
            </div>

            <div className="journal-field-block">
              <label className="journal-field-label">Tags (comma separated)</label>
              <input
                className="journal-input"
                placeholder="legs day, recovery, sleep"
                value={evening.tags || ""}
                onChange={(e) => setEvening((prev) => ({ ...prev, tags: e.target.value }))}
              />
            </div>

            <button className="hud-primary-btn" onClick={() => saveSlot("evening")} disabled={savingSlot === "evening"}>
              {savingSlot === "evening" ? "Saving..." : todayEveningEntry ? "Update Evening Reflection" : "Save Evening Reflection"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function JournalHistoryCard({
  historySearch,
  setHistorySearch,
  availableTags,
  selectedTag,
  setSelectedTag,
  filteredHistoryDays,
  startEditFromHistory,
}) {
  return (
    <div className="hud-card journal-entries">
      <div className="journal-history-top">
        <div className="hud-card-title">ENTRY HISTORY</div>
        <input
          className="studio-form-input journal-history-search"
          value={historySearch}
          onChange={(event) => setHistorySearch(event.target.value)}
          placeholder="Search entries, focus, wins, tags..."
        />
      </div>
      {availableTags.length > 0 && (
        <div className="journal-tags-row">
          <button
            type="button"
            className={`journal-tag-pill${selectedTag === "all" ? " active" : ""}`}
            onClick={() => setSelectedTag("all")}
          >
            All tags
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`journal-tag-pill${selectedTag === tag ? " active" : ""}`}
              onClick={() => setSelectedTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      {filteredHistoryDays.length === 0 && <div className="hud-dim">No entries match this filter yet.</div>}

      {filteredHistoryDays.map((day) => (
        <div key={day.dayKey} className="journal-history-day">
          <div className="journal-history-date">{new Date(day.dayKey).toLocaleDateString()}</div>

          <div className="journal-history-slot">
            <div className="journal-history-slot-title">Morning Prep</div>
            {day.morning ? (
              <>
                <div className="journal-history-line"><span>Intention:</span> {day.morning.data?.intention || "-"}</div>
                <div className="journal-history-line"><span>Focus:</span> {day.morning.data?.sessionFocus || "-"}</div>
                <div className="journal-history-line"><span>Non-negotiable:</span> {day.morning.data?.nonNegotiable || "-"}</div>
                <div className="journal-history-actions">
                  <button
                    className="studio-back journal-action-btn"
                    type="button"
                    onClick={() => startEditFromHistory("morning", day.morning.entry, day.morning.data)}
                  >
                    Edit
                  </button>
                </div>
              </>
            ) : (
              <div className="journal-history-empty">No morning entry</div>
            )}
          </div>

          <div className="journal-history-slot">
            <div className="journal-history-slot-title">Evening Reflection</div>
            {day.evening ? (
              <>
                <div className="journal-history-line"><span>Went well:</span> {day.evening.data?.wentWell || "-"}</div>
                <div className="journal-history-line"><span>Felt hard:</span> {day.evening.data?.feltHard || "-"}</div>
                <div className="journal-history-line"><span>Adjust:</span> {day.evening.data?.adjustTomorrow || "-"}</div>
                <div className="journal-history-line"><span>Mood:</span> {day.evening.data?.mood || "-"}</div>
                <div className="journal-history-line"><span>Tags:</span> {day.evening.data?.tags || "-"}</div>
                <div className="journal-history-actions">
                  <button
                    className="studio-back journal-action-btn"
                    type="button"
                    onClick={() => startEditFromHistory("evening", day.evening.entry, day.evening.data)}
                  >
                    Edit
                  </button>
                </div>
              </>
            ) : (
              <div className="journal-history-empty">No evening entry</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function JournalPage({ mode = "gym" }) {
  const navigate = useNavigate();
  const userId = useMemo(() => localStorage.getItem("exervia_user_id"), []);
  const pageMode = useMemo(() => {
    const storedMode = localStorage.getItem("exervia_active_mode");
    if (storedMode === "athlete" || storedMode === "gym") return storedMode;
    return mode === "athlete" ? "athlete" : "gym";
  }, [mode]);

  const [quote, setQuote] = useState(null);
  const [entries, setEntries] = useState([]);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);

  const [morning, setMorning] = useState({ ...emptyMorning });
  const [evening, setEvening] = useState({ ...emptyEvening });
  const [activeSlot, setActiveSlot] = useState("morning");
  const [editingTarget, setEditingTarget] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedMoodDay, setSelectedMoodDay] = useState("");

  const [savingSlot, setSavingSlot] = useState("");
  const [bannerState, setBannerState] = useState({ message: "", type: "info" });
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const confirmRef = useRef(null);
  const quoteRequestRef = useRef(0);
  const entriesRequestRef = useRef(0);
  const banner = bannerState.message;
  const bannerVariant = bannerState.type || "info";
  const setBanner = useCallback((message, type = "info") => {
    setBannerState({ message, type });
  }, []);

  const withTimeout = async (promise, timeoutMs, label = "Request timed out") => {
    let timeoutHandle = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  const todayKey = formatDayKey(new Date());

  useEffect(() => {
    if (!banner) return;
    const timeout = setTimeout(() => setBanner("", "info"), 2800);
    return () => clearTimeout(timeout);
  }, [banner, setBanner]);

  useEffect(() => {
    if (!banner) return;
    if (bannerVariant === "error") return;
    emitToast(banner, bannerVariant, 3200);
  }, [banner, bannerVariant]);

  useModalA11y({
    open: Boolean(pendingConfirm),
    onClose: () => setPendingConfirm(null),
    modalRef: confirmRef,
  });

  const structuredEntries = useMemo(
    () => entries.map((entry) => ({ entry, structured: parseStructuredEntry(entry) })),
    [entries]
  );

  const todayMorningEntry = useMemo(
    () =>
      structuredEntries.find(
        ({ entry, structured }) => structured?.slot === "morning" && formatDayKey(entry.created_at) === todayKey
      )?.entry || null,
    [structuredEntries, todayKey]
  );

  const todayEveningEntry = useMemo(
    () =>
      structuredEntries.find(
        ({ entry, structured }) => structured?.slot === "evening" && formatDayKey(entry.created_at) === todayKey
      )?.entry || null,
    [structuredEntries, todayKey]
  );

  const thisMonthEntries = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return structuredEntries.filter(({ entry, structured }) => {
      if (!structured) return false;
      const d = new Date(entry.created_at);
      return d.getMonth() === month && d.getFullYear() === year;
    }).length;
  }, [structuredEntries]);

  const historyDays = useMemo(() => {
    const map = new Map();

    structuredEntries.forEach(({ entry, structured }) => {
      const dayKey = formatDayKey(entry.created_at);
      if (!dayKey) return;
      if (!map.has(dayKey)) {
        map.set(dayKey, {
          dayKey,
          morning: null,
          evening: null,
        });
      }
      if (!structured) return;
      const row = map.get(dayKey);
      if (structured.slot === "morning") row.morning = { entry, data: structured.data };
      if (structured.slot === "evening") row.evening = { entry, data: structured.data };
    });

    return Array.from(map.values())
      .filter((d) => d.morning || d.evening)
      .sort((a, b) => new Date(b.dayKey) - new Date(a.dayKey));
  }, [structuredEntries]);

  const moodTrend = useMemo(() => {
    return historyDays
      .map((day) => {
        const mood = Number(day.evening?.data?.mood || 0);
        if (!mood || mood < 1 || mood > 5) return null;
        return {
          dayKey: day.dayKey,
          label: new Date(day.dayKey).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          mood,
        };
      })
      .filter(Boolean)
      .slice(0, 7)
      .reverse();
  }, [historyDays]);

  const averageMood = useMemo(() => {
    if (!moodTrend.length) return null;
    const total = moodTrend.reduce((sum, row) => sum + row.mood, 0);
    return (total / moodTrend.length).toFixed(1);
  }, [moodTrend]);

  const availableTags = useMemo(() => {
    const tags = new Set();
    historyDays.forEach((day) => {
      const rawTags = String(day.evening?.data?.tags || "");
      rawTags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [historyDays]);

  const filteredHistoryDays = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return historyDays.filter((day) => {
      const morningBlob = `${day.morning?.data?.intention || ""} ${day.morning?.data?.sessionFocus || ""} ${day.morning?.data?.nonNegotiable || ""}`.toLowerCase();
      const eveningBlob = `${day.evening?.data?.wentWell || ""} ${day.evening?.data?.feltHard || ""} ${day.evening?.data?.adjustTomorrow || ""}`.toLowerCase();
      const tagsBlob = String(day.evening?.data?.tags || "").toLowerCase();
      const passesSearch = !query || morningBlob.includes(query) || eveningBlob.includes(query) || tagsBlob.includes(query);
      const passesTag = selectedTag === "all" || tagsBlob.split(",").map((tag) => tag.trim()).includes(selectedTag);
      const passesMoodDay = !selectedMoodDay || day.dayKey === selectedMoodDay;
      return passesSearch && passesTag && passesMoodDay;
    });
  }, [historyDays, historySearch, selectedTag, selectedMoodDay]);

  const dayInOneGlance = useMemo(() => {
    const morningData = todayMorningEntry ? parseStructuredEntry(todayMorningEntry)?.data : null;
    const eveningData = todayEveningEntry ? parseStructuredEntry(todayEveningEntry)?.data : null;

    if (!morningData && !eveningData) {
      return "Set your morning intention to start the day with clear direction.";
    }
    if (morningData && !eveningData) {
      return "Morning is set. Close the day with a short evening reflection.";
    }
    if (!morningData && eveningData) {
      return "You reflected tonight. Add tomorrow's morning prep for a full daily cycle.";
    }

    return `Today: ${morningData?.intention || "steady focus"}. Next adjustment: ${eveningData?.adjustTomorrow || "keep building consistency"}.`;
  }, [todayMorningEntry, todayEveningEntry]);

  const isDayComplete = Boolean(todayMorningEntry && todayEveningEntry);
  const isBootLoading = quoteLoading || entriesLoading;

  const fetchQuote = async () => {
    const requestId = quoteRequestRef.current + 1;
    quoteRequestRef.current = requestId;
    setQuoteLoading(true);
    const legacyCacheKey = `exervia_quote_${todayKey}`;
    const cacheKey = `exervia_quote_v2_${todayKey}`;
    localStorage.removeItem(legacyCacheKey);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        if (parsedCache?.source === "api" && parsedCache?.content) {
          if (quoteRequestRef.current !== requestId) return;
          setQuote(parsedCache);
          setQuoteLoading(false);
          return;
        }
        localStorage.removeItem(cacheKey);
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    const sources = [
      "https://quoteslate.vercel.app/api/quotes/random",
      "https://api.quotable.io/random",
      "https://zenquotes.io/api/today",
      "https://api.allorigins.win/raw?url=https://zenquotes.io/api/today",
    ];

    for (const source of sources) {
      const json = await fetchJsonWithTimeout(source);
      const parsed = normalizeQuotePayload(json);
      if (parsed?.content) {
        if (quoteRequestRef.current !== requestId) return;
        const payload = { ...parsed, source: "api" };
        setQuote(payload);
        localStorage.setItem(cacheKey, JSON.stringify(payload));
        setQuoteLoading(false);
        return;
      }
    }

    if (quoteRequestRef.current !== requestId) return;
    const fallback = pickFallbackQuote();
    setQuote(fallback);
    setQuoteLoading(false);
  };

  const loadEntries = async () => {
    const requestId = entriesRequestRef.current + 1;
    entriesRequestRef.current = requestId;
    setEntriesLoading(true);
    if (!userId) {
      setEntriesLoading(false);
      return;
    }
    try {
      const { data } = await withTimeout(
        supabase
          .from("journal_entries")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(120),
        7000,
        "Journal entries load timed out"
      );
      if (entriesRequestRef.current !== requestId) return;
      setEntries(data || []);
    } catch (error) {
      console.error("Journal entries load failed:", error);
      if (entriesRequestRef.current === requestId) {
        setBanner("Could not refresh journal right now.", "warn");
      }
    } finally {
      if (entriesRequestRef.current === requestId) {
        setEntriesLoading(false);
      }
    }
  };

  useEffect(() => {
    Promise.all([fetchQuote(), loadEntries()]).catch(() => {
      setQuoteLoading(false);
      setEntriesLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editingTarget) return;
    const morningStructured = todayMorningEntry ? parseStructuredEntry(todayMorningEntry) : null;
    const eveningStructured = todayEveningEntry ? parseStructuredEntry(todayEveningEntry) : null;

    setMorning({ ...emptyMorning, ...(morningStructured?.data || {}) });
    setEvening({ ...emptyEvening, ...(eveningStructured?.data || {}) });
  }, [todayMorningEntry, todayEveningEntry, editingTarget]);

  const resetToTodayState = () => {
    const morningStructured = todayMorningEntry ? parseStructuredEntry(todayMorningEntry) : null;
    const eveningStructured = todayEveningEntry ? parseStructuredEntry(todayEveningEntry) : null;
    setMorning({ ...emptyMorning, ...(morningStructured?.data || {}) });
    setEvening({ ...emptyEvening, ...(eveningStructured?.data || {}) });
  };

  const startEditFromHistory = (slot, entry, data) => {
    setEditingTarget({ id: entry.id, slot, dayKey: formatDayKey(entry.created_at) });
    setActiveSlot(slot);
    if (slot === "morning") {
      setMorning({ ...emptyMorning, ...(data || {}) });
    } else {
      setEvening({ ...emptyEvening, ...(data || {}) });
    }
  };

  const cancelHistoryEdit = () => {
    setEditingTarget(null);
    resetToTodayState();
  };

  const saveSlot = async (slot, skipConfirm = false) => {
    if (!userId) return;

    const payload = slot === "morning" ? morning : evening;
    const hasContent = Object.values(payload).some((v) => String(v || "").trim().length > 0);
    if (!hasContent) return;

    const notes = buildStructuredNotes(slot, payload);
    const existingEntry = editingTarget?.slot === slot
      ? { id: editingTarget.id, created_at: editingTarget.dayKey }
      : (slot === "morning" ? todayMorningEntry : todayEveningEntry);

    if (existingEntry && !skipConfirm) {
      const confirmMessage =
        editingTarget?.slot === slot
          ? `Update this ${slot === "morning" ? "Morning Prep" : "Evening Reflection"} entry?`
          : (slot === "morning"
            ? "Update today\u2019s Morning Prep?"
            : "Update today\u2019s Evening Reflection?");
      setPendingConfirm({ slot, message: confirmMessage });
      return;
    }

    setSavingSlot(slot);

    let error = null;
    try {
      if (existingEntry) {
        const result = await withTimeout(
          supabase
            .from("journal_entries")
            .update({ notes })
            .eq("id", existingEntry.id)
            .eq("user_id", userId),
          7000,
          "Journal update timed out"
        );
        error = result.error;
      } else {
        const result = await withTimeout(
          supabase.from("journal_entries").insert([
            {
              user_id: userId,
              mode,
              notes,
            },
          ]),
          7000,
          "Journal save timed out"
        );
        error = result.error;
      }

      if (!error) {
        const entryDayKey =
          formatDayKey(existingEntry?.created_at || editingTarget?.dayKey || todayKey) || todayKey;
        const xpResult = await withTimeout(grantXpEventSafe({
          userId,
          eventType: "streak_bonus",
          baseXp: 20,
          idempotencyKey: `journal_entry:${entryDayKey}:${slot}`,
          sourceTable: "journal_entries",
          sourceId: String(existingEntry?.id || `${entryDayKey}:${slot}`),
          meta: { slot, day: entryDayKey, mode },
        }), 4500, "Journal XP timed out");
        await withTimeout(trackDailyActivity(userId, "journal_entry"), 3500, "Journal activity timed out");
        await withTimeout(recalcUserState(userId), 3500, "Journal state sync timed out");
        window.dispatchEvent(new Event("user_state_updated"));
        window.dispatchEvent(new Event("journal_updated"));
        await loadEntries();
        if (xpResult.error) {
          setBanner("Journal saved. XP sync pending.", "warn");
        } else if (Number(xpResult.awardedXp || 0) > 0) {
          setBanner(`Journal saved. +${Number(xpResult.awardedXp)} XP earned.`, "success");
        } else {
          setBanner("Journal saved.", "info");
        }
        if (editingTarget?.slot === slot) {
          setEditingTarget(null);
        }
      } else {
        setBanner("Could not save journal entry right now.", "error");
      }
    } catch (error) {
      console.error("Journal save failed:", error);
      setBanner("Could not save journal entry right now.", "error");
    } finally {
      setSavingSlot("");
    }
  };

  const handleConfirmSaveUpdate = async () => {
    if (!pendingConfirm?.slot) return;
    const slot = pendingConfirm.slot;
    setPendingConfirm(null);
    await saveSlot(slot, true);
  };

  const handleWalkthroughAction = (step) => {
    const stepId = String(step?.id || "");
    if (stepId === "morning") {
      setActiveSlot("morning");
      return;
    }
    if (stepId === "evening") {
      setActiveSlot("evening");
      return;
    }
    if (stepId === "mood_trend") {
      setSelectedMoodDay("");
      return;
    }
    if (stepId === "history") {
      setHistorySearch("");
      setSelectedTag("all");
    }
  };

  return (
    <div className={`hud-bg mode-${pageMode}`}>
      <div className="page-shell journal-shell">
        <div className="page-header">
          <div>
            <button
              className="studio-back"
              onClick={() => navigate(pageMode === "athlete" ? `/athlete/${userId}` : `/gym/${userId}`)}
              type="button"
            >
              {"Back"}
            </button>
            <h2 className="page-title">Journal</h2>
            <div className="page-subtitle">Morning preparation. Evening reflection. Clear rhythm.</div>
          </div>
          <div className="studio-header-actions">
            <button className="studio-back studio-header-action-btn" type="button" onClick={() => setWalkthroughOpen(true)}>
              Walkthrough
            </button>
          </div>
        </div>
        {banner ? <div className={`exervia-banner studio-banner ${bannerVariant}`}>{banner}</div> : null}
        {pendingConfirm ? (
          <div
            ref={confirmRef}
            className="exervia-banner warn"
            role="dialog"
            aria-label="Confirm journal update"
            aria-modal="true"
          >
            <div>{pendingConfirm.message}</div>
            <div className="exervia-banner-actions">
              <button type="button" className="studio-back exervia-banner-btn" onClick={() => setPendingConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="hud-primary-btn exervia-banner-btn" onClick={handleConfirmSaveUpdate}>
                Confirm
              </button>
            </div>
          </div>
        ) : null}

        {isBootLoading ? (
          <div className="journal-loading-skeleton" aria-hidden="true">
            <div className="journal-skeleton-card">
              <div className="journal-skeleton-line w-60" />
              <div className="journal-skeleton-line w-90" />
              <div className="journal-skeleton-line w-70" />
            </div>
            <div className="journal-skeleton-card">
              <div className="journal-skeleton-line w-55" />
              <div className="journal-skeleton-row" />
              <div className="journal-skeleton-row" />
              <div className="journal-skeleton-row" />
            </div>
          </div>
        ) : (
          <>
            <JournalMetaCards
              isDayComplete={isDayComplete}
              dayInOneGlance={dayInOneGlance}
              thisMonthEntries={thisMonthEntries}
              quote={quote}
            />

            <JournalMoodCard
              averageMood={averageMood}
              selectedMoodDay={selectedMoodDay}
              setSelectedMoodDay={setSelectedMoodDay}
              moodTrend={moodTrend}
            />

            <JournalDailyCheckinCard
              activeSlot={activeSlot}
              setActiveSlot={setActiveSlot}
              editingTarget={editingTarget}
              cancelHistoryEdit={cancelHistoryEdit}
              morning={morning}
              setMorning={setMorning}
              evening={evening}
              setEvening={setEvening}
              saveSlot={saveSlot}
              savingSlot={savingSlot}
              todayMorningEntry={todayMorningEntry}
              todayEveningEntry={todayEveningEntry}
            />

            <JournalHistoryCard
              historySearch={historySearch}
              setHistorySearch={setHistorySearch}
              availableTags={availableTags}
              selectedTag={selectedTag}
              setSelectedTag={setSelectedTag}
              filteredHistoryDays={filteredHistoryDays}
              startEditFromHistory={startEditFromHistory}
            />
          </>
        )}
        <PageWalkthroughModal
          open={walkthroughOpen}
          onClose={() => setWalkthroughOpen(false)}
          mode={pageMode}
          userId={userId}
          pageKey="journal"
          title="Journal Walkthrough"
          steps={JOURNAL_WALKTHROUGH_STEPS}
          onStepAction={handleWalkthroughAction}
        />
      </div>
    </div>
  );
}

