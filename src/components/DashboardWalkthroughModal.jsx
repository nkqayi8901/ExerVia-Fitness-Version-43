import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useModalA11y from "../hooks/useModalA11y";

const WALKTHROUGH_STEPS = [
  {
    id: "training",
    title: "Training Studio",
    what: "Log sessions with structure so your effort becomes usable data.",
    why: "Every logged session powers XP, streaks, trends, and better coaching prompts.",
    firstAction: "Complete one session and save it with notes.",
  },
  {
    id: "progress",
    title: "Progress System",
    what: "Track sets, reps, loads, and personal records over time.",
    why: "You can only improve what you can measure consistently.",
    firstAction: "Open Progress and log one full lift entry.",
  },
  {
    id: "fuel",
    title: "Nutritional Fuel Board",
    what: "Build your day across Morning, Midday, Pre-Training, and Recovery slots.",
    why: "Nutrition plays a big part of performance.",
    firstAction: "Fill the Recovery slot after your next session.",
  },
  {
    id: "community",
    title: "Community Social Loop",
    what: "Use groups, asks questions, add friends and view leaderboards for accountability.",
    why: "Social pressure and shared goals drive consistency.",
    firstAction: "Join one group and post one question.",
  },
  {
    id: "xp",
    title: "Rank and XP",
    what: "XP is awarded across training, logs, nutrition, and community actions.",
    why: "It makes consistency visible and gives users a clear progression path.",
    firstAction: "Build a 3-day streak with at least one meaningful action daily.",
  },
];

export default function DashboardWalkthroughModal({ open, onClose, mode = "gym", userId }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [hideHints, setHideHints] = useState(false);
  const modalRef = useRef(null);
  useModalA11y({ open, onClose, modalRef });

  const storageKey = useMemo(
    () => `exervia_walkthrough_hidden_${String(userId || "guest")}_${String(mode || "gym")}`,
    [mode, userId]
  );
  const step = WALKTHROUGH_STEPS[stepIndex] || WALKTHROUGH_STEPS[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WALKTHROUGH_STEPS.length - 1;

  const buildPath = (suffix = "") => {
    const safeId = String(userId || "");
    if (!safeId) return "";
    const root = mode === "athlete" ? `/athlete/${safeId}` : `/gym/${safeId}`;
    return suffix ? `${root}/${suffix}` : root;
  };

  const handleDoThisFirst = () => {
    const stepId = String(step?.id || "");
    let target = "";
    if (stepId === "training") {
      target = mode === "athlete" ? buildPath("training") : buildPath("progress");
    } else if (stepId === "progress") {
      target = buildPath("progress");
    } else if (stepId === "fuel") {
      target = "/nutrition";
    } else if (stepId === "community") {
      target = buildPath("community");
    } else if (stepId === "xp") {
      target = buildPath("profile");
    }
    if (!target) return;
    closeWalkthrough();
    navigate(target);
  };

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setHideHints(localStorage.getItem(storageKey) === "1");
  }, [open, storageKey]);

  const closeWalkthrough = () => {
    if (hideHints) localStorage.setItem(storageKey, "1");
    else localStorage.removeItem(storageKey);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="walkthrough-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeWalkthrough()}>
      <div
        ref={modalRef}
        className="walkthrough-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard walkthrough"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="walkthrough-head">
          <div>
            <div className="walkthrough-kicker">Quick Walkthrough</div>
            <div className="walkthrough-title">{step.title}</div>
          </div>
          <button
            type="button"
            className="studio-back walkthrough-close"
            data-modal-initial-focus="true"
            onClick={closeWalkthrough}
          >
            Close
          </button>
        </div>

        <div className="walkthrough-progress" aria-hidden="true">
          {WALKTHROUGH_STEPS.map((item, idx) => (
            <span
              key={item.id}
              className={`walkthrough-dot ${idx === stepIndex ? "active" : ""} ${idx < stepIndex ? "done" : ""}`}
            />
          ))}
        </div>

        <div className="walkthrough-body">
          <div className="walkthrough-row">
            <div className="walkthrough-label">What it is</div>
            <p>{step.what}</p>
          </div>
          <div className="walkthrough-row">
            <div className="walkthrough-label">Why it matters</div>
            <p>{step.why}</p>
          </div>
          <div className="walkthrough-row">
            <div className="walkthrough-label">Do this first</div>
            <button type="button" className="walkthrough-cta" onClick={handleDoThisFirst}>
              {step.firstAction}
            </button>
          </div>
        </div>

        <div className="walkthrough-foot">
          <div className="walkthrough-foot-left">
            <label className="walkthrough-check">
              <input
                type="checkbox"
                checked={hideHints}
                onChange={(event) => setHideHints(event.target.checked)}
              />
              <span>Don&apos;t show intro hints again</span>
            </label>
          </div>
          <div className="walkthrough-actions">
            <button
              type="button"
              className="studio-back dashboard-switch-btn walkthrough-nav-btn"
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={isFirst}
            >
              Back
            </button>
            {!isLast ? (
              <button
                type="button"
                className="studio-back dashboard-switch-btn walkthrough-nav-btn"
                onClick={() => setStepIndex((prev) => Math.min(WALKTHROUGH_STEPS.length - 1, prev + 1))}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="studio-back dashboard-switch-btn walkthrough-nav-btn"
                onClick={closeWalkthrough}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
