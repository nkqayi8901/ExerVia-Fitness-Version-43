export default function PromotionMoment({ moment, onClose, onOpenProfile }) {
  if (!moment) return null;

  return (
    <div className="promotion-moment" role="status" aria-live="polite" aria-atomic="true">
      <div className="promotion-moment-card">
        <div className="promotion-moment-kicker">Progression Update</div>
        <div className="promotion-moment-title">{moment.title}</div>
        <div className="promotion-moment-sub">{moment.subtitle}</div>
        <div className="promotion-moment-meta">
          <div className="promotion-moment-chip">{moment.primaryLabel}</div>
          <div className="promotion-moment-chip muted">Status live</div>
        </div>
        <div className="promotion-moment-actions">
          <button className="promotion-moment-btn primary" type="button" onClick={onOpenProfile}>
            View profile
          </button>
          <button className="promotion-moment-btn" type="button" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
