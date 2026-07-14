import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

const TITLES = {
  success: "Успешно",
  error: "Ошибка",
  warning: "Предупреждение",
  info: "Информация",
};

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const lastShownRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, message, { title, duration = 4000 } = {}) => {
      const dedupeKey = `${type}:${message}`;
      const now = Date.now();
      const last = lastShownRef.current.get(dedupeKey) || 0;
      if (now - last < 500) {
        return null;
      }
      lastShownRef.current.set(dedupeKey, now);
      const id = ++idCounter;
      const toast = {
        id,
        type,
        message,
        title: title || TITLES[type],
        duration,
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => dismiss(id), duration + 300);
      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (message, opts) => show("success", message, opts),
    [show],
  );
  const error = useCallback(
    (message, opts) => show("error", message, opts),
    [show],
  );
  const warning = useCallback(
    (message, opts) => show("warning", message, opts),
    [show],
  );
  const info = useCallback(
    (message, opts) => show("info", message, opts),
    [show],
  );

  const value = useMemo(
    () => ({ show, success, error, warning, info, dismiss }),
    [show, success, error, warning, info, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            style={{ "--toast-duration": `${t.duration}ms` }}
          >
            <div className="toast__body">
              {t.title && <div className="toast__title">{t.title}</div>}
              <div className="toast__message">{t.message}</div>
            </div>
            <button
              className="toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Закрыть"
            >
              x
            </button>
            <div className="toast__progress" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
