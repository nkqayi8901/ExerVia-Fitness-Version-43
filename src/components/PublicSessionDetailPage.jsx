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

const isCardioExercise = (exercise) => String(exercise?.type || "").toLowerCase() === "cardio";
const formatCardioSummary = (exercise) => {
  const bits = [];
  const duration = String(exercise?.reps || "").trim();
  const distance = String(exercise?.distance || "").trim();
  const incline = String(exercise?.incline || "").trim();
  const calories = String(exercise?.calories || "").trim();
  if (duration) bits.push(duration);
  if (distance) bits.push(`${distance} km`);
  if (incline) bits.push(`${incline}% incline`);
  if (calories) bits.push(`${calories} cal`);
  return bits.length ? bits.join(" · ") : "-";
};
const renderCardioBadge = (exercise) =>
  isCardioExercise(exercise) ? <span className="exervia-cardio-badge">Cardio</span> : null;

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
    <div className="page-shell public-session-page">
      <div className="page-header">
        <div>
          <button className="studio-back" onClick={() => navigate(backPath)} type="button">
            {"Back"}
          </button>
          <h2 className="page-title">Training Report</h2>
          <p className="page-subtitle">Session summary and exercise breakdown.</p>
        </div>
      </div>

      {banner ? <div className="exervia-banner error">{banner}</div> : null}

      {!entry ? null : isStrength ? (
        <div className="hud-card">
          <div className="hud-card-title">TRAINING REPORT</div>
          <div className="logs-report-title">{String(entry.exercise_name || "Strength").toUpperCase()}</div>
          <div className="hud-dim mt-2">{formatDateTime(strengthReportDate || entry.created_at)}</div>
          <div className="logs-program-report mt-3">
            <div className="logs-program-report-head">
              <span className="logs-program-report-col exercise">Exercise</span>
              <span className="logs-program-report-col">Sets</span>
              <span className="logs-program-report-col">Rep Range</span>
              <span className="logs-program-report-col">Weight (kg)</span>
            </div>
            <div className="logs-program-report-body">
              {(sameDayStrength.length ? sameDayStrength : [entry]).map((row) => (
                <div key={row.id} className="logs-program-report-row">
                  <span className="logs-program-report-col exercise">{row.exercise_name || "Exercise"}</span>
                  <span className="logs-program-report-col">{Number(row.sets || 0)}</span>
                  <span className="logs-program-report-col">{row.reps || "-"}</span>
                  <span className="logs-program-report-col">{Number(row.weight || 0) > 0 ? row.weight : "-"}</span>
                </div>
              ))}
            </div>
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
              <div className="logs-program-report mt-3">
                <div className="logs-program-report-head">
                  <span className="logs-program-report-col exercise">Exercise</span>
                  <span className="logs-program-report-col">Sets</span>
                  <span className="logs-program-report-col">Target</span>
                  <span className="logs-program-report-col">Load / Metric</span>
                </div>
                <div className="logs-program-report-body">
                  {exerciseRows.map((exercise, index) => (
                    <div key={`${exercise?.id || exercise?.name || "exercise"}-${index}`} className="logs-program-report-row">
                      <span className="logs-program-report-col exercise">{exercise?.name || `Exercise ${index + 1}`}{renderCardioBadge(exercise)}</span>
                      <span className="logs-program-report-col">{Number(exercise?.sets || 0)}</span>
                      <span className="logs-program-report-col">{isCardioExercise(exercise) ? formatCardioSummary(exercise) : (exercise?.reps || "-")}</span>
                      <span className="logs-program-report-col">
                        {isCardioExercise(exercise)
                          ? formatCardioSummary({ distance: exercise?.distance, incline: exercise?.incline, calories: exercise?.calories })
                          : (Number(exercise?.weight || 0) > 0 ? exercise.weight : "-")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
