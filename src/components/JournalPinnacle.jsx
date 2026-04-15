import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { recalcUserState } from "../services/stateEngine";
import { trackDailyActivity } from "../services/activityTracker";
import { grantXpEventSafe } from "../services/xpEvents";
import { emitToast } from "../utils/toast";
import useModalA11y from "../hooks/useModalA11y";
import PageWalkthroughModal from "./PageWalkthroughModal";

// Component: JournalPinnacle - Premium Design Transformation
// This component transforms the plain Journal interface into a pinnacle-level experience
// with premium design, advanced interactions, and enhanced user experience

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

function PinnacleMetaCards({ isDayComplete, dayInOneGlance, thisMonthEntries, quote }) {
  return (
    <div className="pinnacle-journal-grid">
      <div className={`pinnacle-card pinnacle-summary-card${isDayComplete ? " day-complete" : ""}`}>
        <div className="pinnacle-card-header">
          <div className="pinnacle-card-icon">🎯</div>
          <div className="pinnacle-card-title">YOUR DAY IN ONE GLANCE</div>
        </div>
        <div className="pinnacle-summary-content">
          <div className="pinnacle-summary-text">{dayInOneGlance}</div>
          {isDayComplete && <div className="pinnacle-complete-badge">Day Complete</div>}
          <div className="pinnacle-summary-stats">{thisMonthEntries} entries this month</div>
        </div>
      </div>

      <div className="pinnacle-card pinnacle-quote-card">
        <div className="pinnacle-card-header">
          <div className="pinnacle-card-icon">💭</div>
          <div className="pinnacle-card-title">QUOTE OF THE DAY</div>
        </div>
        <div className="pinnacle-quote-content">
          <div className="pinnacle-quote-text">"{quote?.content || "..."}"</div>
          <div className="pinnacle-quote-author">- {quote?.author || "ExerVia"}</div>
        </div>
      </div>
    </div>
  );
}

function PinnacleDailyCheckinCard({
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
    <div className="pinnacle-journal-grid">
      <div className="pinnacle-card pinnacle-checkin-card">
        <div className="pinnacle-checkin-header">
          <div className="pinnacle-checkin-title">DAILY CHECK-IN</div>
          <div className="pinnacle-checkin-status">
            {editingTarget?.slot === activeSlot
              ? `Editing ${new Date(editingTarget.dayKey).toLocaleDateString()}`
              : activeSlot === "morning"
                ? todayMorningEntry
                  ? "Updated today"
                  : "Ready to set"
                : todayEveningEntry
                  ? "Updated today"
                  : "Ready to reflect"}
          </div>
        </div>

        {editingTarget && (
          <div className="pinnacle-editing-notice">
            <div className="pinnacle-editing-text">Editing history entry</div>
            <button className="pinnacle-cancel-btn" type="button" onClick={cancelHistoryEdit}>
              Cancel
            </button>
          </div>
        )}

        <div className="pinnacle-slot-switch">
          <button
            className={`pinnacle-slot-btn${activeSlot === "morning" ? " active" : ""}`}
            onClick={() => setActiveSlot("morning")}
            type="button"
          >
            <span className="pinnacle-slot-icon">🌅</span>
            Morning Prep
          </button>
          <button
            className={`pinnacle-slot-btn${activeSlot === "evening" ? " active" : ""}`}
            onClick={() => setActiveSlot("evening")}
            type="button"
          >
            <span className="pinnacle-slot-icon">🌙</span>
            Evening Reflection
          </button>
        </div>

        {activeSlot === "morning" ? (
          <>
            <div className="pinnacle-field-group">
              <label className="pinnacle-field-label">
                <span className="pinnacle-field-icon">🎯</span>
                Today's intention
              </label>
              <input
                className="pinnacle-input"
                placeholder="What matters most today?"
                value={morning.intention}
                onChange={(e) => setMorning((prev) => ({ ...prev, intention: e.target.value }))}
              />
            </div>

            <div className="pinnacle-field-group">
              <label className="pinnacle-field-label">
                <span className="pinnacle-field-icon">💪</span>
                Session focus
              </label>
              <input
                className="pinnacle-input"
                placeholder="Main training or health focus"
                value={morning.sessionFocus}
                onChange={(e) => setMorning((prev) => ({ ...prev, sessionFocus: e.target.value }))}
              />
            </div>

            <div className="pinnacle-field-group">
              <label className="pinnacle-field-label">
                <span className="pinnacle-field-icon">✅</span>
                One non-negotiable
              </label>
              <input
                className="pinnacle-input"
                placeholder="One thing you will complete"
                value={morning.nonNegotiable}
                onChange={(e) => setMorning((prev) => ({ ...prev, nonNegotiable: e.target.value }))}
              />
            </div>

            <button className="pinnacle-primary-btn" onClick={() => saveSlot("morning")} disabled={savingSlot === "morning"}>
              {savingSlot === "morning" ? "Saving..." : todayMorningEntry ? "Update Morning Prep" : "Save Morning Prep"}
            </button>
          </>
        ) : (
          <>
            <div className="pinnacle-field-group">
              <label className="pinnacle-field-label">
                <span className="pinnacle-field-icon">✨</span>
                What went well
              </label>
              <textarea
                className="pinnacle-textarea"
                placeholder="Highlight one win from today"
                value={evening.wentWell}
                onChange={(e) => setEvening((prev) => ({ ...prev, wentWell: e.target.value }))}
              />
            </div>

            <div className="pinnacle-field-group">
              <label className="pinnacle-field-label">
                <span className="pinnacle-field-icon">🔥</span>
                What felt hard
              </label>
              <textarea
                className="pinnacle-textarea"
                placeholder="Name the friction honestly"
                value={evening.feltHard}
                onChange={(e) => setEvening((prev) => ({ ...prev, feltHard: e.target.value }))}
              />
            </div>

            <div className="pinnacle-field-group">
              <label className="pinnacle-field-label">
                <span className="pinnacle-field-icon">🔧</span>
                Adjust for tomorrow
              </label>
              <textarea
                className="pinnacle-textarea"
                placeholder="One change for tomorrow"
                value={evening.adjustTomorrow}
                onChange={(e) => setEvening((prev) => ({ ...prev, adjustTomorrow: e.target.value }))}
              />
            </div>

            <div className="pinnacle-field-group">
              <label className="pinnacle-field-label">
                <span className="pinnacle-field-icon">😊</span>
                Mood score (1-5)
              </label>
              <select
                className="pinnacle-input"
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

            <div className="pinnacle-field-group">
              <label className="pinnacle-field-label">
                <span className="pinnacle-field-icon">🏷️</span>
                Tags (comma separated)
              </label>
              <input
                className="pinnacle-input"
                placeholder="legs day, recovery, sleep"
                value={evening.tags || ""}
                onChange={(e) => setEvening((prev) => ({ ...prev, tags: e.target.value }))}
              />
            </div>

            <button className="pinnacle-primary-btn" onClick={() => saveSlot("evening")} disabled={savingSlot === "evening"}>
              {savingSlot === "evening" ? "Saving..." : todayEveningEntry ? "Update Evening Reflection" : "Save Evening Reflection"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PinnacleHistoryCard({
  historySearch,
  setHistorySearch,
  availableTags,
  selectedTag,
  setSelectedTag,
  filteredHistoryDays,
  startEditFromHistory,
}) {
  return (
    <div className="pinnacle-card pinnacle-history-card">
      <div className="pinnacle-history-header">
        <div className="pinnacle-history-title">ENTRY HISTORY</div>
        <div className="pinnacle-search-group">
          <input
            className="pinnacle-search-input"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="Search entries, focus, wins, tags..."
          />
        </div>
      </div>
      
      {availableTags.length > 0 && (
        <div className="pinnacle-tags-container">
          <button
            type="button"
            className={`pinnacle-tag-pill${selectedTag === "all" ? " active" : ""}`}
            onClick={() => setSelectedTag("all")}
          >
            All tags
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`pinnacle-tag-pill${selectedTag === tag ? " active" : ""}`}
              onClick={() => setSelectedTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      
      {filteredHistoryDays.length === 0 && <div className="pinnacle-empty-state">No entries match this filter yet.</div>}

      <div className="pinnacle-history-list">
        {filteredHistoryDays.map((day) => (
          <div key={day.dayKey} className="pinnacle-history-item">
            <div className="pinnacle-history-date">{new Date(day.dayKey).toLocaleDateString()}</div>

            <div className="pinnacle-history-section">
              <div className="pinnacle-history-section-title">Morning Prep</div>
              {day.morning ? (
                <>
                  <div className="pinnacle-history-field">
                    <span className="pinnacle-field-label">Intention:</span>
                    <span className="pinnacle-field-value">{day.morning.data?.intention || "-"}</span>
                  </div>
                  <div className="pinnacle-history-field">
                    <span className="pinnacle-field-label">Focus:</span>
                    <span className="pinnacle-field-value">{day.morning.data?.sessionFocus || "-"}</span>
                  </div>
                  <div className="pinnacle-history-field">
                    <span className="pinnacle-field-label">Non-negotiable:</span>
                    <span className="pinnacle-field-value">{day.morning.data?.nonNegotiable || "-"}</span>
                  </div>
                  <div className="pinnacle-history-actions">
                    <button
                      className="pinnacle-edit-btn"
                      type="button"
                      onClick={() => startEditFromHistory("morning", day.morning.entry, day.morning.data)}
                    >
                      Edit
                    </button>
                  </div>
                </>
              ) : (
                <div className="pinnacle-history-empty">No morning entry</div>
              )}
            </div>

            <div className="pinnacle-history-section">
              <div className="pinnacle-history-section-title">Evening Reflection</div>
              {day.evening ? (
                <>
                  <div className="pinnacle-history-field">
                    <span className="pinnacle-field-label">Went well:</span>
                    <span className="pinnacle-field-value">{day.evening.data?.wentWell || "-"}</span>
                  </div>
                  <div className="pinnacle-history-field">
                    <span className="pinnacle-field-label">Felt hard:</span>
                    <span className="pinnacle-field-value">{day.evening.data?.feltHard || "-"}</span>
                  </div>
                  <div className="pinnacle-history-field">
                    <span className="pinnacle-field-label">Adjust:</span>
                    <span className="pinnacle-field-value">{day.evening.data?.adjustTomorrow || "-"}</span>
                  </div>
                  <div className="pinnacle-history-field">
                    <span className="pinnacle-field-label">Mood:</span>
                    <span className="pinnacle-field-value">{day.evening.data?.mood || "-"}</span>
                  </div>
                  <div className="pinnacle-history-field">
                    <span className="pinnacle-field-label">Tags:</span>
                    <span className="pinnacle-field-value">{day.evening.data?.tags || "-"}</span>
                  </div>
                  <div className="pinnacle-history-actions">
                    <button
                      className="pinnacle-edit-btn"
                      type="button"
                      onClick={() => startEditFromHistory("evening", day.evening.entry, day.evening.data)}
                    >
                      Edit
                    </button>
                  </div>
                </>
              ) : (
                <div className="pinnacle-history-empty">No evening entry</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JournalPinnacle({ viewerId, mode = "gym" }) {
  const userId = useMemo(() => viewerId || localStorage.getItem("exervia_user_id"), [viewerId]);
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
      return passesSearch && passesTag;
    });
  }, [historyDays, historySearch, selectedTag]);

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
        if ('vibrate' in navigator) navigator.vibrate([60, 30, 60]);
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
    if (stepId === "history") {
      setHistorySearch("");
      setSelectedTag("all");
    }
  };

  return (
    <div className="pinnacle-journal">
      <div className="pinnacle-journal-header">
        <div className="pinnacle-branding">
          <div className="pinnacle-logo">
            <span className="pinnacle-logo-icon">📓</span>
            <span className="pinnacle-logo-text">Journal</span>
          </div>
          <div className="pinnacle-subtitle">Morning preparation. Evening reflection. Clear rhythm.</div>
        </div>
        <div className="pinnacle-actions">
          <button className="pinnacle-walkthrough-btn" type="button" onClick={() => setWalkthroughOpen(true)}>
            Walkthrough
          </button>
        </div>
      </div>

      {banner ? <div className={`pinnacle-banner ${bannerVariant}`}>{banner}</div> : null}

      {pendingConfirm ? (
        <div
          ref={confirmRef}
          className="pinnacle-confirm-modal"
          role="dialog"
          aria-label="Confirm journal update"
          aria-modal="true"
        >
          <div className="pinnacle-confirm-content">
            <div className="pinnacle-confirm-message">{pendingConfirm.message}</div>
            <div className="pinnacle-confirm-actions">
              <button type="button" className="pinnacle-cancel-btn" onClick={() => setPendingConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="pinnacle-confirm-btn" onClick={handleConfirmSaveUpdate}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isBootLoading ? (
        <div className="pinnacle-loading">
          <div className="pinnacle-spinner"></div>
          <div className="pinnacle-loading-text">Loading journal...</div>
        </div>
      ) : (
        <>
          <PinnacleMetaCards
            isDayComplete={isDayComplete}
            dayInOneGlance={dayInOneGlance}
            thisMonthEntries={thisMonthEntries}
            quote={quote}
          />

          <PinnacleDailyCheckinCard
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

          <PinnacleHistoryCard
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
  );
}
