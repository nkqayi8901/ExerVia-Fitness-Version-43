import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
// Component: CompanionChat - UI layout and interactions.
// This component renders the companionchat experience and wires up its local UI state.
// Sections below are grouped to keep the layout and user flow readable.
// Comment blocks explain intent without changing behavior.

// fetchExercise manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
const fetchExercise = async (query) => {
  const url = query
    ? `https://wger.de/api/v2/exerciseinfo/?language=2&limit=1&search=${encodeURIComponent(query)}`
    : "https://wger.de/api/v2/exerciseinfo/?language=2&limit=1";
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

// stripHtml manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
const stripHtml = (value) => {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "").replace(/\\s+/g, " ").trim();
};

export default function CompanionChat({ mode = "gym" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");

  const messagesEndRef = useRef(null);
  const userId = useMemo(() => localStorage.getItem("exervia_user_id"), []);

// scrollToBottom manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
// loadGreeting manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const loadGreeting = async () => {
      const data = await fetchExercise();
      const item = data?.results?.[0];
      if (item) {
        const desc = stripHtml(item.description);
        setMessages([
          {
            id: 1,
            sender: "bot",
            text: desc ? `${item.name}: ${desc.slice(0, 120)}...` : item.name
          }
        ]);
        setHint(item.name);
      }
    };
    loadGreeting();
  }, []);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
// handler manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
    const handler = (event) => {
      if (event?.detail?.text) setHint(event.detail.text);
    };
    window.addEventListener("companion_hint", handler);
    // Render
    return () => window.removeEventListener("companion_hint", handler);
  }, []);

// lifecycle hook for side effects,
// runs when dependencies change,
// keeps data and UI in sync,
// cleans up to prevent leaks
  useEffect(() => {
    scrollToBottom();
  }, [messages, open]);

// handleSend manages a focused piece of logic,
// it keeps behavior isolated for readability,
// inputs are validated before mutation when needed,
// and output feeds the UI state or data flow
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: inputText.trim()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    const data = await fetchExercise(userMsg.text);
    const item = data?.results?.[0];
    if (item) {
      const desc = stripHtml(item.description);
      const botMsg = {
        id: Date.now() + 1,
        sender: "bot",
        text: desc ? `${item.name}: ${desc.slice(0, 140)}...` : item.name
      };
      setMessages((prev) => [...prev, botMsg]);
    }

    setLoading(false);
  };

  const miniMessages = messages.slice(-2);

// The return statement below manages the UI layout and interactions,
// it uses the state and handlers defined above to create a responsive chat experience,
// the structure is designed for readability and maintainability,
// with clear class names for styling and potential future enhancements.
  return (
    <div className="companion-float">
      {!open && (
        <div className="companion-mini" onClick={() => setOpen(true)}>
          <div className="companion-mini-top">
            <div className="companion-mini-title">COMPANION</div>
            <div className="companion-mini-mode">{mode.toUpperCase()}</div>
          </div>

          <div className="companion-mini-body">
            {hint && <div className="companion-mini-hintline">{hint}</div>}
            {miniMessages.map((m) => (
              <div key={m.id} className={m.sender === "bot" ? "mini-bot" : "mini-user"}>
                {m.text}
              </div>
            ))}
          </div>

          <div className="companion-mini-hint">Click to expand</div>
        </div>
      )}

      {open && (
        <div className="companion-panel">
          <div className="companion-panel-top">
            <div>
              <div className="companion-panel-title">EXERVIA COMPANION</div>
              <div className="companion-panel-sub">Adaptive. Mode-aware. State-aware.</div>
            </div>
            <button className="companion-close" onClick={() => setOpen(false)}>
              x
            </button>
          </div>

          <div className="companion-thread">
            {messages.map((m) => (
              <div key={m.id} className={m.sender === "user" ? "msg-row right" : "msg-row left"}>
                <div className={m.sender === "user" ? "msg user" : "msg bot"}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="msg-row left">
                <div className="msg bot">...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="companion-inputbar">
            <input
              className="companion-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask. Plan. Reflect. Improve."
            />
            <button className="companion-send" onClick={handleSend}>
              SEND
            </button>
          </div>
        </div>
      )}
    </div>
  );
}