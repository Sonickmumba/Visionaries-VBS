import React, { useEffect, useMemo, useState } from "react";
import { Bell, FileBarChart, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { api } from "../api/client.js";
import { Alert, Badge, Button, Card, EmptyState, MobileBottomNav, Skeleton } from "../components/ui/index.jsx";
import { useNotificationUnread } from "../contexts/NotificationUnreadContext.jsx";
import { Page } from "../layouts/AppLayouts.jsx";
import { memberMobileNavItems } from "./member/memberMobileNav.js";
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
    ?? metadata.approved_amount
    ?? metadata.requestedAmount
    ?? metadata.requested_amount
    ?? metadata.savingsAmount
    ?? metadata.savings_amount
    ?? metadata.penaltyAmount
    ?? metadata.penalty_amount
    ?? metadata.commonInterestPool
    ?? metadata.common_interest_pool
    ?? metadata.totalCommonInterestCharged
    ?? metadata.total_common_interest_charged;
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

export function NotificationCard({ event, onOpenTarget, onMarkRead }) {
  const amount = eventAmount(event);
  const month = event.metadata?.monthNumber ? `Month ${event.metadata.monthNumber}` : "";
  const unread = !event.readAt;
  return (
    <article className={`notification-card ${unread ? "unread" : "read"}`.trim()}>
      <div className="notification-icon"><Bell size={18} aria-hidden="true" /></div>
      <div>
        <div className="notification-card-head">
          <strong>{event.title}</strong>
          <div className="notification-card-badges">
            {unread ? <Badge text="Unread" tone="amber" /> : <Badge text="Read" tone="green" />}
            <Badge text={titleCase(event.type)} tone={eventTone(event)} />
          </div>
        </div>
        <p>{event.message}</p>
        <div className="notification-meta">
          <span>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "Just now"}</span>
          {amount ? <span>{amount}</span> : null}
          {month ? <span>{month}</span> : null}
        </div>
      </div>
      <div className="notification-actions">
        {event.actionTarget || event.actionUrl ? (
          <Button type="button" size="sm" variant="secondary" icon={FileBarChart} onClick={() => onOpenTarget?.(event)}>View</Button>
        ) : null}
        {unread ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onMarkRead?.(event)}>Mark read</Button>
        ) : null}
      </div>
    </article>
  );
}

export function NotificationsPage({ notificationsApi = api, initialEvents = null, setPage, role = "ADMIN" }) {
  const shared = useNotificationUnread();
  const useSharedTracker = initialEvents === null && notificationsApi === api;
  const [localEvents, setLocalEvents] = useState(initialEvents || []);
  const [localLoading, setLocalLoading] = useState(initialEvents === null && !useSharedTracker);
  const [localError, setLocalError] = useState("");
  const { markAllRead, markRead } = shared;
  const events = useSharedTracker ? shared.events : localEvents;
  const loading = useSharedTracker ? shared.loading : localLoading;
  const error = useSharedTracker ? shared.error : localError;
  const connected = useSharedTracker ? shared.connected : false;

  async function refresh() {
    if (useSharedTracker) {
      await shared.refresh();
      return;
    }
    setLocalLoading(true);
    setLocalError("");
    try {
      setLocalEvents(await loadNotifications({ notificationsApi }));
    } catch (err) {
      setLocalError(err.message || "Notifications could not load.");
    } finally {
      setLocalLoading(false);
    }
  }

  useEffect(() => {
    if (initialEvents === null && useSharedTracker) refresh();
    if (initialEvents === null && !useSharedTracker) refresh();
  }, [initialEvents, useSharedTracker]);

  const view = useMemo(() => notificationsViewModel(events), [events]);
  const openReports = () => setPage?.(role === "MEMBER" ? "my-reports" : "reports");
  async function markEventRead(event) {
    if (!event?.id || event.readAt) return;
    if (useSharedTracker) {
      await markRead(event);
      return;
    }
    const readAt = new Date().toISOString();
    setLocalEvents((current) => current.map((item) => (item.id === event.id ? { ...item, readAt } : item)));
    await notificationsApi("/notifications/read", {
      method: "POST",
      body: { notificationIds: [event.id] },
    }).catch(() => null);
  }
  async function markVisibleRead() {
    if (useSharedTracker) {
      await markAllRead(events);
      return;
    }
    const unreadEvents = events.filter((event) => event.id && !event.readAt);
    if (!unreadEvents.length) return;
    const readAt = new Date().toISOString();
    setLocalEvents((current) => current.map((event) => (!event.readAt ? { ...event, readAt } : event)));
    await notificationsApi("/notifications/read", {
      method: "POST",
      body: { notificationIds: unreadEvents.map((event) => event.id) },
    }).catch(() => null);
  }
  const openTarget = async (event) => {
    await markEventRead(event);
    const target = event.actionTarget || {};
    const fallbackPage = role === "MEMBER" ? "my-reports" : "reports";
    const page = role === "MEMBER" ? target.memberPage : target.adminPage;
    setPage?.(page || fallbackPage, target.report ? { report: target.report } : null);
  };
  const memberBottomNav = role === "MEMBER" ? (
    <MobileBottomNav active="my-notifications" items={memberMobileNavItems} onChange={setPage} />
  ) : null;

  return (
    <>
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
        <div className="admin-mobile-action-row notifications-mobile-actions mobile-only" aria-label="Notification quick actions">
          <Button type="button" icon={RefreshCw} onClick={refresh} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={FileBarChart} onClick={openReports}>Reports</Button>
        </div>
        <section className="panel">
          <div className="panel-head notifications-panel-head">
            <h2>Recent Notifications</h2>
            <div className="button-row compact">
              <Badge text={connected ? "Streaming" : "Offline fallback"} tone={connected ? "green" : "amber"} />
              <Button type="button" size="sm" variant="secondary" onClick={markVisibleRead} disabled={!events.some((event) => !event.readAt)}>Mark all read</Button>
            </div>
          </div>
          {loading ? <Skeleton lines={8} /> : events.length ? (
            <div className="notification-list">
              {events.map((event) => <NotificationCard key={event.id} event={event} onOpenTarget={openTarget} onMarkRead={markEventRead} />)}
            </div>
          ) : (
            <EmptyState title="No notifications yet" message="Submitted declarations and financial actions will appear here in real time." />
          )}
        </section>
      </Page>
      {memberBottomNav}
    </>
  );
}
