import { useEffect, useMemo, useRef, useState } from "react";
import useModalA11y from "../hooks/useModalA11y";

export default function PageWalkthroughModal({
  open,
  onClose,
  mode = "gym",
  userId,
  pageKey = "page",
  title = "Quick Walkthrough",
  steps = [],
  onStepAction,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [hideHints, setHideHints] = useState(false);
  const modalRef = useRef(null);
  useModalA11y({ open, onClose, modalRef });

  const safeSteps = Array.isArray(steps) && steps.length ? steps : [];
  const step = safeSteps[stepIndex] || safeSteps[0] || null;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === safeSteps.length - 1;

  const storageKey = useMemo(
    () =>
      `exervia_walkthrough_hidden_${String(userId || "guest")}_${String(mode || "gym")}_${String(
        pageKey || "page"
      )}`,
    [mode, pageKey, userId]
  );

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

  const handleStepAction = () => {
    if (!step) return;
    if (typeof onStepAction === "function") onStepAction(step);
    closeWalkthrough();
  };

  if (!open || !step || !safeSteps.length) return null;

  return (
    <div className="walkthrough-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeWalkthrough()}>
      <div
        ref={modalRef}
        className="walkthrough-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} walkthrough`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="walkthrough-head">
          <div>
            <div className="walkthrough-kicker">{title}</div>
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
          {safeSteps.map((item, idx) => (
            <span
              key={item.id || `${pageKey}-${idx}`}
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
            <button type="button" className="walkthrough-cta" onClick={handleStepAction}>
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
                onClick={() => setStepIndex((prev) => Math.min(safeSteps.length - 1, prev + 1))}
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
