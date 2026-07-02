import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL, api } from "../api/client.js";

const NotificationUnreadContext = createContext({
  events: [],
  unreadCount: 0,
  connected: false,
  loading: false,
  error: "",
  refresh: async () => [],
  markRead: async () => {},
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

  const markRead = useCallback(async (items = []) => {
    const list = Array.isArray(items) ? items : [items];
    const notificationIds = list
      .filter((event) => event?.id && !event.readAt)
      .map((event) => event.id);
    if (!notificationIds.length) return { read: 0 };
    const readAt = new Date().toISOString();
    setError("");
    setEvents((current) => current.map((event) => (
      notificationIds.includes(event.id) && !event.readAt ? { ...event, readAt } : event
    )));
    setUnreadCount((current) => Math.max(0, current - notificationIds.length));
    try {
      const response = await notificationsApi("/notifications/read", {
        method: "POST",
        body: { notificationIds },
      });
      setUnreadCount(Number(response.unreadCount || 0));
      return response;
    } catch (err) {
      setError(err.message || "Notifications could not be marked read.");
      return { read: 0, error: err };
    }
  }, [notificationsApi]);

  const markAllRead = useCallback((items = []) => markRead(items), [markRead]);

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
    refresh();
    return undefined;
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
        setUnreadCount((current) => event.readAt ? current : current + 1);
      }
    });
    stream.onerror = () => setConnected(false);
    return () => {
      setConnected(false);
      stream.close();
    };
  }, [user]);

  const value = useMemo(() => ({
    events,
    unreadCount,
    connected,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  }), [connected, error, events, loading, markAllRead, markRead, refresh, unreadCount]);

  return (
    <NotificationUnreadContext.Provider value={value}>
      {children}
    </NotificationUnreadContext.Provider>
  );
}

export function useNotificationUnread() {
  return useContext(NotificationUnreadContext);
}
