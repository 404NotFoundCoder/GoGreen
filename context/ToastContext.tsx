"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastApi = {
  show: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DISMISS_MS = 3200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setMessage(msg);
    setOpen(true);
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      clearTimer.current = setTimeout(() => setMessage(null), 220);
    }, DISMISS_MS);
  }, []);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-20 z-[100] flex justify-center px-4 lg:top-24"
          aria-live="polite"
        >
          <div
            className={[
              "max-w-md rounded-2xl border-[0.5px] border-[var(--color-muted)] bg-[var(--color-ink)] px-4 py-3 text-center text-sm font-medium text-[var(--color-white)] shadow-md transition duration-200 ease-out",
              open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
            ].join(" ")}
            role="status"
          >
            {message}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast 需在 ToastProvider 內使用");
  }
  return ctx;
}
