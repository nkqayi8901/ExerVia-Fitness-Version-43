import { useEffect, useState } from "react";

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (event) => {
      const detail = event?.detail || {};
      const message = String(detail.message || "").trim();
      if (!message) return;
      const toast = {
        id: nextId(),
        message,
        type: String(detail.type || "info"),
        duration: Math.max(1200, Number(detail.duration) || 3200),
      };
      setToasts((prev) => [...prev, toast].slice(-4));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, toast.duration);
    };

    window.addEventListener("exervia:toast", handleToast);
    return () => window.removeEventListener("exervia:toast", handleToast);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="exervia-toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`exervia-toast ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

