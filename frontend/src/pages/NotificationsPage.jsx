import React, { useEffect, useMemo, useState } from "react";
import { Bell, FileBarChart, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { API_URL, api } from "../api/client.js";
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from "../components/ui/index.jsx";
import { Page } from "../layouts/AppLayouts.jsx";
import "../styles/notifications.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function titleCase(value) {
  return String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function eventTone(event) {
  if (event.severity === "WARNING") return "amber";
  if (event.severity === "DANGER") return "red";
  if (/APPROVED|COMPLETED|POSTED|DISBURSED/.test(event.type || "")) return "green";
  return "blue";
}

function eventAmount(event) {
  const metadata = event.metadata || {};
  const value = metadata.amount
    ?? metadata.approvedAmount
    ?? metadata.requestedAmount
    ?? metadata.savingsAmount
    ?? metadata.penaltyAmount
    ?? metadata.commonInterestPool
    ?? metadata.totalCommonInterestCharged;
  return value === null || value === undefined ? "" : money(value);
}

export function notificationsViewModel(events = []) {
  return {
    total: events.length,
    declarationCount: events.filter((event) => String(event.type || "").startsWith("DECLARATION")).length,
    loanCount: events.filter((event) => String(event.type || "").startsWith("LOAN")).length,
    financialCount: events.filter((event) => /PENALTY|COMMON_INTEREST|MONTHLY_CLOSING/.test(String(event.type || ""))).length,
  };
}

export async function loadNotifications({ notificationsApi = api } = {}) {
  const response = await notificationsApi("/notifications?limit=75");
  return response.data || [];
}

export function NotificationCard({ event, onOpenTarget }) {
  const amount = eventAmount(event);
  const month = event.metadata?.monthNumber ? `Month ${event.metadata.monthNumber}` : "";
  return (
    <article className="notification-card">
      <div className="notification-icon"><Bell size={18} aria-hidden="true" /></div>
      <div>
        <div className="notification-card-head">
          <strong>{event.title}</strong>
          <Badge text={titleCase(event.type)} tone={eventTone(event)} />
        </div>
        <p>{event.message}</p>
        <div className="notification-meta">
          <span>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "Just now"}</span>
          {amount ? <span>{amount}</span> : null}
          {month ? <span>{month}</span> : null}
        </div>
      </div>
      {event.actionTarget || event.actionUrl ? (
        <Button type="button" size="sm" variant="secondary" icon={FileBarChart} onClick={() => onOpenTarget?.(event)}>View</Button>
      ) : null}
    </article>
  );
}

export function NotificationsPage({ notificationsApi = api, initialEvents = null, setPage, role = "ADMIN" }) {
  const [events, setEvents] = useState(initialEvents || []);
  const [loading, setLoading] = useState(initialEvents === null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setEvents(await loadNotifications({ notificationsApi }));
    } catch (err) {
      setError(err.message || "Notifications could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialEvents === null) refresh();
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") return undefined;
    const stream = new EventSource(`${API_URL}/notifications/stream`, { withCredentials: true });
    stream.addEventListener("ready", () => setConnected(true));
    stream.addEventListener("heartbeat", () => setConnected(true));
    stream.addEventListener("notification", (message) => {
      const event = JSON.parse(message.data);
      setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, 75));
    });
    stream.onerror = () => setConnected(false);
    return () => {
      setConnected(false);
      stream.close();
    };
  }, []);

  const view = useMemo(() => notificationsViewModel(events), [events]);
  const openReports = () => setPage?.(role === "MEMBER" ? "my-reports" : "reports");
  const openTarget = (event) => {
    const target = event.actionTarget || {};
    const fallbackPage = role === "MEMBER" ? "my-reports" : "reports";
    const page = role === "MEMBER" ? target.memberPage : target.adminPage;
    setPage?.(page || fallbackPage, target.report ? { report: target.report } : null);
  };

  return (
    <Page
      title="Notifications"
      className="notifications-page"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={refresh} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={FileBarChart} onClick={openReports}>Open Reports</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Notifications failed">{error}</Alert> : null}
      <section className="notifications-hero">
        <div>
          <span>Real-time Activity</span>
          <h2>Group Transparency Feed</h2>
          <p>Live declarations, loan requests, approvals, disbursements, penalties, common interest, and monthly closing events.</p>
        </div>
        <Badge tone={connected ? "green" : "amber"} text={connected ? "Live" : "Reconnecting"} />
      </section>
      <div className="metrics notifications-metrics">
        <Card title="All Events" value={view.total} note="Recent activity" icon={Bell} />
        <Card title="Declarations" value={view.declarationCount} note="Submitted or approved" icon={connected ? Wifi : WifiOff} tone="green" />
        <Card title="Loans" value={view.loanCount} note="Requests and disbursements" icon={FileBarChart} tone="blue" />
        <Card title="Financial Posts" value={view.financialCount} note="Penalties, CI, closing" icon={Bell} tone="amber" />
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Recent Notifications</h2>
          <Badge text={connected ? "Streaming" : "Offline fallback"} tone={connected ? "green" : "amber"} />
        </div>
        {loading ? <Skeleton lines={8} /> : events.length ? (
          <div className="notification-list">
            {events.map((event) => <NotificationCard key={event.id} event={event} onOpenTarget={openTarget} />)}
          </div>
        ) : (
          <EmptyState title="No notifications yet" message="Submitted declarations and financial actions will appear here in real time." />
        )}
      </section>
    </Page>
  );
}
