import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
// Component: JournalPage - UI layout and interactions.
// This component renders the journal experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.


export default function JournalPage({ mode = "gym" }) {
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  const userId = useMemo(() => localStorage.getItem("exervia_user_id"), []);

// formatDayKey manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const formatDayKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

// fetchQuote manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const fetchQuote = async () => {
    try {
      const res = await fetch("https://api.quotable.io/random");
      const json = await res.json();
      setQuote({ content: json.content, author: json.author });
    } catch {
      setQuote({ content: "Discipline is a form of self-respect.", author: "SYSTEM" });
    }
  };

// loadEntries manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const loadEntries = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setEntries(data || []);
  };

// loadRecentActivity manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const loadRecentActivity = async () => {
    if (!userId) return;
    const [sessionRes, liftRes] = await Promise.all([
      supabase
        .from("training_sessions")
        .select("id, created_at, duration_minutes, metrics, sport")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2),
      supabase
        .from("strength_logs")
        .select("id, created_at, reps, sets, weight, exercise_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2)
    ]);
// sessions manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const sessions = (sessionRes.data || []).map((row) => ({
      id: `session-${row.id}`,
      type: "session",
      created_at: row.created_at,
      title: row.sport ? row.sport.toUpperCase() : "SESSION",
      detail: `${row.duration_minutes || "--"} min · ${row.metrics?.distance || "--"} km`
    }));
// lifts manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const lifts = (liftRes.data || []).map((row) => ({
      id: `lift-${row.id}`,
      type: "lift",
      created_at: row.created_at,
      title: row.exercise_name ? row.exercise_name.toUpperCase() : "LIFT",
      detail: `${row.reps || "--"} reps · ${row.sets || "--"} sets${row.weight ? ` · ${row.weight}kg` : ""}`
    }));
    const combined = [...sessions, ...lifts]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 2);
    setRecentActivity(combined);
  };

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    fetchQuote();
    loadEntries();
    loadRecentActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

// saveJournal manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const saveJournal = async () => {
    if (!userId) return;
    setSaving(true);

    if (editingId) {
      await supabase
        .from("journal_entries")
        .update({
          notes,
        })
        .eq("id", editingId)
        .eq("user_id", userId);
    } else {
      await supabase.from("journal_entries").insert([{
        user_id: userId,
        mode,
        notes,
      }]);
    }

    setSaving(false);
    setNotes("");
    setEditingId(null);
    window.dispatchEvent(new Event("journal_updated"));
    loadEntries();
  };

// startEdit manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const startEdit = (entry) => {
    setEditingId(entry.id);
    setNotes(entry.notes || "");
  };

// cancelEdit manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const cancelEdit = () => {
    setEditingId(null);
    setNotes("");
  };

// deleteEntry manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const deleteEntry = async (entryId) => {
    if (!userId) return;
    await supabase
      .from("journal_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", userId);
    if (editingId === entryId) {
      cancelEdit();
    }
    loadEntries();
  };


  // Render
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Journal</h2>
        </div>
        <button
          className="hud-secondary-btn"
          onClick={() => navigate(mode === "athlete" ? `/athlete/${userId}` : `/gym/${userId}`)}
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid-2">
        <div className="hud-card">
          <div className="hud-card-title">RECENT TRAINING</div>
          <div className="hud-dim">Your last two sessions or lifts.</div>
          <div className="studio-recent-list" style={{ marginTop: 16 }}>
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => (
                <div key={item.id} className="studio-recent-row">
                  <div className="studio-recent-main">
                    <div className="studio-recent-title">{item.title}</div>
                    <div className="studio-recent-sub">{item.detail}</div>
                  </div>
                  <div className="studio-recent-meta">
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="studio-empty">No sessions logged yet.</div>
            )}
          </div>
        </div>

        <div className="hud-card">
          <div className="hud-card-title">QUOTE OF THE DAY</div>
          <div className="quote-box">
            <div className="quote-text">"{quote?.content || "..."}"</div>
            <div className="quote-author">- {quote?.author || "SYSTEM"}</div>
          </div>

          <div className="hud-divider" />

          <div className="hud-card-title">NOTES</div>
          <textarea
            className="hud-textarea"
            placeholder="Write what mattered today. Training, mindset, diet, stress..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button className="hud-primary-btn" onClick={saveJournal} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Entry" : "Save Journal Entry"}
          </button>
          {editingId && (
            <button className="hud-secondary-btn journal-cancel-btn" onClick={cancelEdit} type="button">
              Cancel edit
            </button>
          )}
        </div>
      </div>

      <div className="hud-card journal-entries">
        <div className="hud-card-title">RECENT ENTRIES</div>
        {entries.length === 0 && (
          <div className="hud-dim">No entries yet.</div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="journal-entry-row">
            <div>
              <div className="journal-entry-meta">
                {new Date(entry.created_at).toLocaleString()} - {entry.mode?.toUpperCase() || "MODE"}
              </div>
              <div className="journal-entry-notes">
                {entry.notes || "No notes added."}
              </div>
            </div>
            <div className="journal-entry-actions">
              <button className="hud-secondary-btn" onClick={() => startEdit(entry)} type="button">
                Edit
              </button>
              <button className="hud-secondary-btn danger" onClick={() => deleteEntry(entry.id)} type="button">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}