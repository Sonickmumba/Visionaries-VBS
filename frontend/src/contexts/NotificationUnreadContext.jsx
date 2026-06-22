import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

function mergeEvents(current, nextEvent) {
  return [nextEvent, ...current.filter((item) => item.id !== nextEvent.id)].slice(0, 75);
}

export function NotificationUnreadProvider({ user, page, children, notificationsApi = api }) {
  const [events, setEvents] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const pageRef = useRef(page);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const markAllRead = useCallback((items = []) => {
    const notificationIds = items.map((event) => event?.id).filter(Boolean);
    if (!notificationIds.length) return;
    setEvents((current) => current.map((event) => (
      notificationIds.includes(event.id) ? { ...event, readAt: event.readAt || new Date().toISOString() } : event
    )));
    setUnreadCount(0);
    notificationsApi("/notifications/read", {
      method: "POST",
      body: { notificationIds },
    })
      .then((response) => setUnreadCount(Number(response.unreadCount || 0)))
      .catch(() => null);
  }, [notificationsApi]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await notificationsApi("/notifications?limit=75");
      const nextEvents = response.data || [];
      setEvents(nextEvents);
      setUnreadCount(Number(response.unreadCount || 0));
      return nextEvents;
    } catch (err) {
      setError(err.message || "Notifications could not load.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [notificationsApi]);

  useEffect(() => {
    setEvents([]);
    setUnreadCount(0);
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
      let isNew = false;
      setEvents((current) => {
        isNew = !current.some((item) => item.id === event.id);
        return mergeEvents(current, event);
      });
      if (isNew) {
        setUnreadCount((current) => ["notifications", "my-notifications"].includes(pageRef.current) ? current : current + 1);
      }
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
    unreadCount,
    connected,
    loading,
    error,
    refresh,
    markAllRead,
  }), [connected, error, events, loading, markAllRead, refresh, unreadCount]);

  return (
    <NotificationUnreadContext.Provider value={value}>
      {children}
    </NotificationUnreadContext.Provider>
  );
}

export function useNotificationUnread() {
  return useContext(NotificationUnreadContext);
}
