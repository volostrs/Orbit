"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

type Toast = { id: number; message: string };
const ToastContext = createContext<(message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

// Minimal toast stack: a polite live region at the bottom-centre that clears each message after a few seconds.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const show = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-full items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 shadow-lg"
          >
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="truncate">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
