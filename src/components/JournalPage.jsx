import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { recalcUserState } from "../services/stateEngine";
import { trackDailyActivity } from "../services/activityTracker";
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

export default function JournalPage({ mode = "gym" }) {
  const navigate = useNavigate();
  const userId = useMemo(() => localStorage.getItem("exervia_user_id"), []);

  const [quote, setQuote] = useState(null);
  const [entries, setEntries] = useState([]);

  const [morning, setMorning] = useState({ ...emptyMorning });
  const [evening, setEvening] = useState({ ...emptyEvening });
  const [activeSlot, setActiveSlot] = useState("morning");
  const [editingTarget, setEditingTarget] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedMoodDay, setSelectedMoodDay] = useState("");

  const [savingSlot, setSavingSlot] = useState("");

  const todayKey = formatDayKey(new Date());

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

  const fetchQuote = async () => {
    const legacyCacheKey = `exervia_quote_${todayKey}`;
    const cacheKey = `exervia_quote_v2_${todayKey}`;
    localStorage.removeItem(legacyCacheKey);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        if (parsedCache?.source === "api" && parsedCache?.content) {
          setQuote(parsedCache);
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
        const payload = { ...parsed, source: "api" };
        setQuote(payload);
        localStorage.setItem(cacheKey, JSON.stringify(payload));
        return;
      }
    }

    const fallback = pickFallbackQuote();
    setQuote(fallback);
  };

  const loadEntries = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(120);
    setEntries(data || []);
  };

  useEffect(() => {
    fetchQuote();
    loadEntries();
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

  const saveSlot = async (slot) => {
    if (!userId) return;

    const payload = slot === "morning" ? morning : evening;
    const hasContent = Object.values(payload).some((v) => String(v || "").trim().length > 0);
    if (!hasContent) return;

    const notes = buildStructuredNotes(slot, payload);
    const existingEntry = editingTarget?.slot === slot
      ? { id: editingTarget.id, created_at: editingTarget.dayKey }
      : (slot === "morning" ? todayMorningEntry : todayEveningEntry);

    if (existingEntry) {
      const confirmed = window.confirm(
        editingTarget?.slot === slot
          ? `Update this ${slot === "morning" ? "Morning Prep" : "Evening Reflection"} entry?`
          : (slot === "morning"
            ? "Update today\u2019s Morning Prep?"
            : "Update today\u2019s Evening Reflection?")
      );
      if (!confirmed) return;
    }

    setSavingSlot(slot);

    let error = null;
    try {
      if (existingEntry) {
        const result = await supabase
          .from("journal_entries")
          .update({ notes })
          .eq("id", existingEntry.id)
          .eq("user_id", userId);
        error = result.error;
      } else {
        const result = await supabase.from("journal_entries").insert([
          {
            user_id: userId,
            mode,
            notes,
          },
        ]);
        error = result.error;
      }

      if (!error) {
        await trackDailyActivity(userId, "journal_entry");
        await recalcUserState(userId);
        window.dispatchEvent(new Event("user_state_updated"));
        window.dispatchEvent(new Event("journal_updated"));
        await loadEntries();
        if (editingTarget?.slot === slot) {
          setEditingTarget(null);
        }
      }
    } finally {
      setSavingSlot("");
    }
  };

  return (
    <div className="page-shell journal-shell">
      <div className="page-header">
        <div>
          <button
            className="studio-back"
            onClick={() => navigate(mode === "athlete" ? `/athlete/${userId}` : `/gym/${userId}`)}
            type="button"
          >
            {'Back'}
          </button>
          <h2 className="page-title">Journal</h2>
          <div className="page-subtitle">Morning preparation. Evening reflection. Clear rhythm.</div>
        </div>
      </div>

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

      <div className="hud-card journal-mood-card">
        <div className="journal-mood-top">
          <div className="hud-card-title">MOOD TREND</div>
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
            moodTrend.map((item) => (
              <button
                type="button"
                key={item.dayKey}
                className={`journal-mood-col journal-mood-col-btn${selectedMoodDay === item.dayKey ? " active" : ""}`}
                onClick={() => setSelectedMoodDay(item.dayKey)}
              >
                <div className="journal-mood-track">
                  <div className="journal-mood-fill" style={{ height: `${(item.mood / 5) * 100}%` }} />
                </div>
                <div className="journal-mood-score">{item.mood}</div>
                <div className="journal-mood-label">{item.label}</div>
              </button>
            ))
          ) : (
            <div className="hud-dim">Log evening mood to unlock your trend.</div>
          )}
        </div>
      </div>

      <div className="journal-premium-grid">
        <div className="hud-card journal-slot-card">
          <div className="journal-slot-top">
            <div className="hud-card-title">DAILY CHECK-IN</div>
            <div className="journal-slot-pill">
              {editingTarget?.slot === activeSlot
                ? `Editing ${new Date(editingTarget.dayKey).toLocaleDateString()}`
                : (activeSlot === "morning"
                ? (todayMorningEntry ? "Updated today" : "Open")
                : (todayEveningEntry ? "Updated today" : "Open"))}
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
    </div>
  );
}

