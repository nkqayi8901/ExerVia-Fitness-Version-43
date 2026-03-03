import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const startOfDayIso = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const endOfDayIso = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
};

export default function PublicSessionDetailPage({ mode = "athlete", viewerId }) {
  const navigate = useNavigate();
  const { id, targetId, sessionType, sessionId } = useParams();
  const resolvedViewerId = Number(viewerId || id);
  const resolvedTargetId = Number(targetId);
  const isStrength = String(sessionType || "").toLowerCase() === "strength";
  const backPath =
    mode === "gym"
      ? `/gym/${resolvedViewerId}/profile/${resolvedTargetId}`
      : `/athlete/${resolvedViewerId}/profile/${resolvedTargetId}`;

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");
  const [entry, setEntry] = useState(null);
  const [sameDayStrength, setSameDayStrength] = useState([]);
  const [strengthReportDate, setStrengthReportDate] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!resolvedTargetId || !sessionId) return;
      setLoading(true);
      setBanner("");
      setEntry(null);
      setSameDayStrength([]);

      if (isStrength) {
        const { data, error } = await supabase
          .from("strength_logs")
          .select("id,created_at,exercise_name,exercise_type,sets,reps,weight,notes,mood_emoji")
          .eq("id", sessionId)
          .eq("user_id", resolvedTargetId)
          .maybeSingle();
        if (error || !data) {
          setBanner("Could not load this session.");
          setLoading(false);
          return;
        }
        setEntry(data);
        setStrengthReportDate(data.created_at || "");
        const fromIso = startOfDayIso(data.created_at);
        const toIso = endOfDayIso(data.created_at);
        if (fromIso && toIso) {
          const { data: strengthRows } = await supabase
            .from("strength_logs")
            .select("id,created_at,exercise_name,sets,reps,weight")
            .eq("user_id", resolvedTargetId)
            .gte("created_at", fromIso)
            .lte("created_at", toIso)
            .order("created_at", { ascending: true })
            .limit(60);
          setSameDayStrength(strengthRows || []);
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("training_sessions")
        .select("id,created_at,sport,duration_minutes,notes,mood_emoji,metrics")
        .eq("id", sessionId)
        .eq("user_id", resolvedTargetId)
        .maybeSingle();
      if (error || !data) {
        setBanner("Could not load this session.");
        setLoading(false);
        return;
      }

      setEntry(data);

      const fromIso = startOfDayIso(data.created_at);
      const toIso = endOfDayIso(data.created_at);
      if (fromIso && toIso) {
        const { data: strengthRows } = await supabase
          .from("strength_logs")
          .select("id,created_at,exercise_name,sets,reps,weight")
          .eq("user_id", resolvedTargetId)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false })
          .limit(20);
        setSameDayStrength(strengthRows || []);
      }

      setLoading(false);
    };

    run();
  }, [isStrength, resolvedTargetId, sessionId]);

  const exerciseRows = useMemo(() => {
    if (!entry || isStrength) return [];
    const direct = Array.isArray(entry?.metrics?.exercises) ? entry.metrics.exercises : [];
    const nested = Array.isArray(entry?.metrics?.report?.exercises) ? entry.metrics.report.exercises : [];
    return direct.length ? direct : nested;
  }, [entry, isStrength]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="hud-card">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <button className="studio-back" onClick={() => navigate(backPath)} type="button">
            {"Back"}
          </button>
          <h2 className="page-title">Session Detail</h2>
          <p className="page-subtitle">Read-only training detail.</p>
        </div>
      </div>

      {banner ? <div className="exervia-banner error">{banner}</div> : null}

      {!entry ? null : isStrength ? (
        <div className="hud-card">
          <div className="hud-card-title">TRAINING REPORT</div>
          <div className="hud-big">{String(entry.exercise_name || "Strength").toUpperCase()}</div>
          <div className="hud-dim mt-2">{formatDateTime(strengthReportDate || entry.created_at)}</div>
          <div className="table-shell mt-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Sets</th>
                  <th>Rep Range</th>
                  <th>Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {(sameDayStrength.length ? sameDayStrength : [entry]).map((row) => (
                  <tr key={row.id}>
                    <td>{row.exercise_name || "Exercise"}</td>
                    <td>{Number(row.sets || 0)}</td>
                    <td>{row.reps || "-"}</td>
                    <td>{Number(row.weight || 0) > 0 ? row.weight : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entry.notes ? <div className="mt-2">{entry.notes}</div> : null}
        </div>
      ) : (
        <>
          <div className="hud-card">
            <div className="hud-card-title">TRAINING SESSION</div>
            <div className="hud-big">{String(entry.sport || "Training").toUpperCase()}</div>
            <div className="hud-dim mt-2">{formatDateTime(entry.created_at)}</div>
            <div className="mt-3">
              Duration: {Number(entry.duration_minutes || 0) > 0 ? `${entry.duration_minutes} min` : "Not logged"}
            </div>
            {entry.notes ? <div className="mt-2">{entry.notes}</div> : null}
          </div>

          {exerciseRows.length ? (
            <div className="hud-card mt-4">
              <div className="hud-card-title">EXERCISES</div>
              {exerciseRows.map((exercise, index) => (
                <div key={`${exercise?.id || exercise?.name || "exercise"}-${index}`} className="flex items-center justify-between mt-2">
                  <span>{exercise?.name || `Exercise ${index + 1}`}</span>
                  <span className="hud-dim">
                    {Number(exercise?.sets || 0)} sets · {exercise?.reps || "-"} reps ·{" "}
                    {Number(exercise?.weight || 0) > 0 ? `${exercise.weight} kg` : "-"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {sameDayStrength.length ? (
            <div className="hud-card mt-4">
              <div className="hud-card-title">SAME-DAY STRENGTH LOGS</div>
              {sameDayStrength.map((row) => (
                <div key={row.id} className="flex items-center justify-between mt-2">
                  <span>{row.exercise_name || "Exercise"}</span>
                  <span className="hud-dim">
                    {Number(row.sets || 0)} sets · {row.reps || 0} reps
                    {Number(row.weight || 0) > 0 ? ` · ${row.weight} kg` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
