import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL, api } from "../api/client.js";

const NotificationUnreadContext = createContext({
  events: [],
  unreadCount: 0,
  connected: false,
  loading: false,
  error: "",
  refresh: async () => [],
  markAllRead: () => {},
});

function storageKey(user) {
  const id = user?.id || user?.email || user?.role || "anonymous";
  return `visionaries.notifications.read.${id}`;
}

function readStoredIds(user) {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(storageKey(user)) || "[]"));
  } catch {
    return new Set();
  }
}

function storeReadIds(user, ids) {
  if (typeof window === "undefined") return;
  const bounded = Array.from(ids).slice(-300);
  window.localStorage.setItem(storageKey(user), JSON.stringify(bounded));
}

function mergeEvents(current, nextEvent) {
  return [nextEvent, ...current.filter((item) => item.id !== nextEvent.id)].slice(0, 75);
}

export function NotificationUnreadProvider({ user, page, children, notificationsApi = api }) {
  const [events, setEvents] = useState([]);
  const [readIds, setReadIds] = useState(() => readStoredIds(user));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  const markAllRead = useCallback((items = []) => {
    setReadIds((current) => {
      const next = new Set(current);
      let changed = false;
      for (const event of items) {
        if (event?.id && !next.has(String(event.id))) {
          next.add(String(event.id));
          changed = true;
        }
      }
      if (!changed) return current;
      storeReadIds(user, next);
      return next;
    });
  }, [user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await notificationsApi("/notifications?limit=75");
      const nextEvents = response.data || [];
      setEvents(nextEvents);
      return nextEvents;
    } catch (err) {
      setError(err.message || "Notifications could not load.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [notificationsApi]);

  useEffect(() => {
    setReadIds(readStoredIds(user));
    setEvents([]);
    setConnected(false);
  }, [user?.id, user?.email, user?.role]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    refresh().then((nextEvents) => {
      if (active && ["notifications", "my-notifications"].includes(page)) markAllRead(nextEvents);
    });
    return () => {
      active = false;
    };
  }, [user, refresh]);

  useEffect(() => {
    if (!user || typeof EventSource === "undefined") return undefined;
    const stream = new EventSource(`${API_URL}/notifications/stream`, { withCredentials: true });
    stream.addEventListener("ready", () => setConnected(true));
    stream.addEventListener("heartbeat", () => setConnected(true));
    stream.addEventListener("notification", (message) => {
      const event = JSON.parse(message.data);
      setEvents((current) => mergeEvents(current, event));
    });
    stream.onerror = () => setConnected(false);
    return () => {
      setConnected(false);
      stream.close();
    };
  }, [user]);

  useEffect(() => {
    if (["notifications", "my-notifications"].includes(page) && events.length) {
      markAllRead(events);
    }
  }, [events, markAllRead, page]);

  const value = useMemo(() => ({
    events,
    unreadCount: events.filter((event) => event?.id && !readIds.has(String(event.id))).length,
    connected,
    loading,
    error,
    refresh,
    markAllRead,
  }), [connected, error, events, loading, markAllRead, readIds, refresh]);

  return (
    <NotificationUnreadContext.Provider value={value}>
      {children}
    </NotificationUnreadContext.Provider>
  );
}

export function useNotificationUnread() {
  return useContext(NotificationUnreadContext);
}
