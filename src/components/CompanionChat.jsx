import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const fetchExercise = async (query) => {
  const url = query
    ? `https://wger.de/api/v2/exerciseinfo/?language=2&limit=1&search=${encodeURIComponent(query)}`
    : "https://wger.de/api/v2/exerciseinfo/?language=2&limit=1";
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
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

  useEffect(() => {
    const handler = (event) => {
      if (event?.detail?.text) setHint(event.detail.text);
    };
    window.addEventListener("companion_hint", handler);
    return () => window.removeEventListener("companion_hint", handler);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, open]);

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
