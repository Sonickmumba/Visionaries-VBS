import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  Gauge,
  Lock,
  LogOut,
  Menu,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  HandCoins,
  Users,
  X,
} from "lucide-react";
import { api } from "../api/client.js";
import { BrandMark } from "../components/BrandMark.jsx";
import { Badge, IconButton, Select } from "../components/ui/index.jsx";
import { useNotificationUnread } from "../contexts/NotificationUnreadContext.jsx";
import "../styles/layouts.css";

export const adminNav = [
  ["dashboard", "Dashboard", Gauge],
  ["cycles", "Cycles", CalendarDays],
  ["members", "Members", Users],
  ["declarations", "Declarations", ClipboardList],
  ["savings", "Savings", PiggyBank],
  ["loans", "Loans", Banknote],
  ["common-interest", "Common Interest", Scale],
  ["penalties", "Penalties", AlertTriangle],
  ["closing", "Monthly Closing", CheckCircle2],
  ["ledger", "Ledger", BookOpen],
  ["reports", "Reports", FileBarChart],
  ["shareout", "Shareout", HandCoins],
  ["audit", "Audit Trail", Activity],
  ["notifications", "Notifications", Bell],
  ["settings", "Settings", Settings],
];

export const memberNav = [
  ["member-dashboard", "My Dashboard", Gauge],
  ["my-declaration", "My Declaration", ClipboardList],
  ["my-statement", "My Statement", Receipt],
  ["my-savings", "My Savings", PiggyBank],
  ["my-loans", "My Loans", Banknote],
  ["my-penalties", "My Penalties", AlertTriangle],
  ["my-reports", "Reports", FileBarChart],
  ["my-shareout", "My Shareout", HandCoins],
  ["my-notifications", "Notifications", Bell],
];

export function routeLabel(page) {
  return [...adminNav, ...memberNav].find(([id]) => id === page)?.[1] || "Dashboard";
}

function roleTone(role) {
  if (role === "ADMIN") return "green";
  if (role === "AUDITOR") return "amber";
  return "blue";
}

function portalLabel(role) {
  return role === "MEMBER" ? "Member Portal" : "Admin Portal";
}

export function ProtectedRoute({ user, children, fallback = null }) {
  if (!user) return fallback;
  if (user.is_active === false) {
    return (
      <AuthLayout>
        <section className="auth-card">
          <h2>Account disabled</h2>
          <p>Your account is not active. Contact an administrator before continuing.</p>
        </section>
      </AuthLayout>
    );
  }
  return children;
}

export function AuthLayout({ children }) {
  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <BrandMark size="lg" className="auth-brand-mark" />
        <div className="auth-brand-copy">
          <span>Save Together. Grow Together.</span>
          <h1>Visionaries Village Banking</h1>
          <p>Run transparent savings, lending, declarations, common interest, penalties, reports, and monthly closing from one audit-ready mobile platform.</p>
        </div>
        <div className="auth-brand-stats" aria-label="Platform highlights">
          <div><strong>15%</strong><span>Monthly rules</span></div>
          <div><strong>Audit</strong><span>Ledger-first</span></div>
          <div><strong>Mobile</strong><span>Member ready</span></div>
        </div>
        <div className="auth-note">Built as a financial operations system with auditability at the center.</div>
      </section>
      {children}
    </main>
  );
}

function Sidebar({ nav, page, setPage, open, setOpen, user }) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label={`${user.role === "MEMBER" ? "Member" : "Admin"} navigation`} aria-hidden={!open && undefined}>
      <div className="sidebar-head">
        <div className="brand"><BrandMark size="sm" /> <span>Visionaries Village Banking</span></div>
        <IconButton className="sidebar-close" label="Close navigation" icon={X} variant="ghost" onClick={() => setOpen(false)} />
      </div>
      <div className="sidebar-profile">
        <span>{user.role === "MEMBER" ? "Member Portal" : "Admin Portal"}</span>
        <strong>{user.email || "Visionaries user"}</strong>
        <Badge tone={roleTone(user.role)} text={user.role} />
      </div>
      <nav>
        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            aria-current={page === id ? "page" : undefined}
            onClick={() => { setPage(id); setOpen(false); }}
          >
            <Icon size={17} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function MobileBottomNav({ nav, page, setPage, user }) {
  const priorityIds = user.role === "MEMBER"
    ? ["member-dashboard", "my-declaration", "my-savings", "my-loans", "my-reports"]
    : ["dashboard", "members", "declarations", "loans", "reports"];
  const items = priorityIds
    .map((id) => nav.find(([navId]) => navId === id))
    .filter(Boolean);

  return (
    <nav className="mobile-bottom-nav" aria-label={`${user.role === "MEMBER" ? "Member" : "Admin"} quick navigation`}>
      {items.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          className={page === id ? "active" : ""}
          aria-current={page === id ? "page" : undefined}
          onClick={() => setPage(id)}
        >
          <span className="mobile-nav-icon-wrap">
            <Icon size={18} aria-hidden="true" />
          </span>
          <span className="mobile-nav-label">{label.replace("My ", "").replace("Monthly ", "")}</span>
        </button>
      ))}
    </nav>
  );
}

function Topbar({ user, page, setPage, onLogout }) {
  const { unreadCount } = useNotificationUnread();
  const [cycles, setCycles] = useState([]);
  const [months, setMonths] = useState([]);
  const [cycleId, setCycleId] = useState("");
  const [monthId, setMonthId] = useState("");

  useEffect(() => {
    if (user.role === "MEMBER") return;
    api("/cycles")
      .then((response) => {
        const list = response.data || [];
        setCycles(list);
        const selected = list.find((cycle) => cycle.status === "ACTIVE") || list[0];
        setCycleId(selected?.id || "");
      })
      .catch(() => setCycles([]));
  }, [user.role]);

  useEffect(() => {
    if (!cycleId || user.role === "MEMBER") return;
    api(`/cycles/${cycleId}`)
      .then((response) => {
        const list = response.months || [];
        setMonths(list);
        const selected = list.find((month) => ["DECLARATION_PERIOD", "OPEN", "PAYOUT_PERIOD"].includes(month.status)) || list[0];
        setMonthId(selected?.id || "");
      })
      .catch(() => setMonths([]));
  }, [cycleId, user.role]);

  const selectedCycle = cycles.find((cycle) => cycle.id === cycleId);
  const selectedMonth = months.find((month) => month.id === monthId);
  const isMember = user.role === "MEMBER";
  const notificationsPage = isMember ? "my-notifications" : "notifications";

  return (
    <header className="topbar">
      <IconButton className="mobile-only" label="Open navigation" icon={Menu} onClick={() => window.dispatchEvent(new CustomEvent("open-mobile-nav"))} />
      <div className="top-context">
        <div className="top-title-block">
          <span className="top-eyebrow">Visionaries Village Banking</span>
          <strong>{portalLabel(user.role)}</strong>
          <span>{isMember ? "Transparent member access" : "Financial operations workspace"}</span>
        </div>
        {isMember ? (
          <div className="top-member-summary" aria-label="Member account context">
            <span>Signed in as</span>
            <strong>{user.email || "Visionaries member"}</strong>
            <small>Member access</small>
          </div>
        ) : (
          <div className="top-selectors" aria-label="Cycle and month context">
            <Select
              label="Cycle"
              value={cycleId}
              onChange={setCycleId}
              options={cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
              placeholder="Select cycle"
            />
            <Select
              label="Month"
              value={monthId}
              onChange={setMonthId}
              options={months.map((month) => ({
                value: month.id,
                label: `Month ${month.month_number} · ${String(month.status || "").replaceAll("_", " ")}`,
              }))}
              placeholder="Select month"
            />
            <span className="top-cycle-summary">
              <strong>{selectedCycle?.name || "Cycle context"}</strong>
              <span>{selectedMonth ? `Month ${selectedMonth.month_number} · ${String(selectedMonth.status || "").replaceAll("_", " ")}` : "No month selected"}</span>
            </span>
          </div>
        )}
      </div>
      <div className="top-actions">
        <Badge tone={roleTone(user.role)} text={user.role} />
        <span className="top-notification-action">
          <IconButton label="Open notifications" icon={Bell} onClick={() => setPage?.(notificationsPage)} />
          {unreadCount > 0 ? <span className="top-unread-badge" aria-label={`${unreadCount} unread notifications`}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
        </span>
        <IconButton label="Log out" icon={LogOut} onClick={onLogout} />
      </div>
    </header>
  );
}

export function AppLayout({ user, page, setPage, onLogout, children }) {
  const [open, setOpen] = useState(false);
  const nav = user.role === "MEMBER" ? memberNav : adminNav;

  useEffect(() => {
    const openNav = () => setOpen(true);
    window.addEventListener("open-mobile-nav", openNav);
    return () => window.removeEventListener("open-mobile-nav", openNav);
  }, []);

  return (
    <div className={`app-shell ${user.role === "MEMBER" ? "member-shell" : "admin-shell"}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Sidebar nav={nav} page={page} setPage={setPage} open={open} setOpen={setOpen} user={user} />
      <div className="main">
        <Topbar user={user} page={page} setPage={setPage} onLogout={onLogout} />
        {open && <button className="overlay" aria-label="Close navigation" onClick={() => setOpen(false)}><X aria-hidden="true" /></button>}
        <main id="main-content" className="content" tabIndex="-1">{children}</main>
        {user.role !== "MEMBER" ? <MobileBottomNav nav={nav} page={page} setPage={setPage} user={user} /> : null}
      </div>
    </div>
  );
}

export function Page({ title, actions, children, className = "" }) {
  const titleId = useMemo(() => `page-title-${String(title || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, [title]);
  const renderedActions = useMemo(() => actions, [actions]);
  return (
    <section className={className || undefined} aria-labelledby={titleId}>
      <div className="page-head">
        <h1 id={titleId}>{title}</h1>
        {renderedActions ? <div className="button-row" aria-label={`${title} actions`}>{renderedActions}</div> : null}
      </div>
      {children}
    </section>
  );
}
