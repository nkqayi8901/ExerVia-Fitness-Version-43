import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useModalA11y({ open, onClose, modalRef }) {
  const lastFocusedRef = useRef(null);

  useEffect(() => {
    if (!open || !modalRef?.current) return undefined;

    const modalEl = modalRef.current;
    lastFocusedRef.current = document.activeElement;

    const focusables = modalEl.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      modalEl.setAttribute("tabindex", "-1");
      modalEl.focus();
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = Array.from(modalEl.querySelectorAll(FOCUSABLE_SELECTOR));
      if (!nodes.length) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const toRestore = lastFocusedRef.current;
      if (toRestore && typeof toRestore.focus === "function") {
        toRestore.focus();
      }
    };
  }, [open, onClose, modalRef]);
}

