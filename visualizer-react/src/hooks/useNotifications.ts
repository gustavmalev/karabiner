import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type NoticeType = 'success' | 'error' | 'info' | 'warning';
export type Notice = {
  id: string;
  type: NoticeType;
  message: string;
  description?: string;
  duration?: number; // ms
};

type Ctx = {
  notices: Notice[];
  notify: (n: Omit<Notice, 'id'> & { id?: string }) => string;
  remove: (id: string) => void;
  clear: () => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const timers = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setNotices((arr) => arr.filter((n) => n.id !== id));
    const t = timers.current[id];
    if (t) window.clearTimeout(t);
    delete timers.current[id];
  }, []);

  const notify = useCallback((n: Omit<Notice, 'id'> & { id?: string }) => {
    const id = n.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const notice: Notice = { duration: 4000, ...n, id };
    setNotices((arr) => {
      // simple de-dup by message/type within short window
      const exists = arr.find((x) => x.message === notice.message && x.type === notice.type);
      if (exists) return arr; // dedupe
      return [...arr, notice];
    });
    if (notice.duration && notice.duration > 0) {
      timers.current[id] = window.setTimeout(() => remove(id), notice.duration);
    }
    return id;
  }, [remove]);

  const clear = useCallback(() => {
    setNotices([]);
    Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    timers.current = {};
  }, []);

  const value = useMemo<Ctx>(() => ({ notices, notify, remove, clear }), [notices, notify, remove, clear]);
  return React.createElement(NotificationsContext.Provider, { value }, children as any);
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
