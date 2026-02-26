import { useRef } from "react";
import useModalA11y from "../../hooks/useModalA11y";

export default function CommunityModal({
  open,
  onClose,
  children,
  topLayer = false,
}) {
  const modalRef = useRef(null);
  useModalA11y({ open, onClose, modalRef });

  if (!open) return null;

  return (
    <div
      className={`community-modal-backdrop${topLayer ? " community-modal-backdrop-top" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        className="community-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

