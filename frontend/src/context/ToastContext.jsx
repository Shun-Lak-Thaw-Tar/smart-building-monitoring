import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
const Context = createContext(null);
export const useToast = () => useContext(Context);
export function ToastProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const timers = useRef(new Set());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const remove = (id) =>
    setMessages((items) => items.filter((i) => i.id !== id));
  function toast(text) {
    const id = crypto.randomUUID();
    setMessages((items) => [...items, { id, text }]);
    const timer = setTimeout(() => {
      remove(id);
      timers.current.delete(timer);
    }, 5000);
    timers.current.add(timer);
  }
  return (
    <Context.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {messages.map((i) => (
          <div className="toast" key={i.id}>
            <CheckCircle2 size={20} />
            <span>{i.text}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => remove(i.id)}
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
