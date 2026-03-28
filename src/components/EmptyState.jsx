import React from 'react';

function EmptyState({ title, description, actionLabel, onAction, className = '', icon = null }) {
  return (
    <div className={`studio-empty ${className}`.trim()}>
      {icon ? <div className="studio-session-empty-title">{icon}</div> : null}
      {title ? <div className="studio-session-empty-title">{title}</div> : null}
      {description ? <div className="studio-session-empty-copy">{description}</div> : null}
      {actionLabel && typeof onAction === 'function' ? (
        <button className="studio-queue-btn ghost" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export default EmptyState;
