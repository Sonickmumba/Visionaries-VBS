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

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

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
    <main className="auth-shell min-h-screen !grid-cols-1 bg-cream text-charcoal md:!p-0">
      {children}
    </main>
  );
}

function Sidebar({ nav, page, setPage, open, setOpen, user }) {
  return (
    <aside
      className={cx(
        "sidebar h-screen overflow-y-auto bg-charcoal px-3.5 py-5 text-cream md:sticky md:top-0",
        user.role === "MEMBER" && "bg-forest",
        open && "open"
      )}
      aria-label={`${user.role === "MEMBER" ? "Member" : "Admin"} navigation`}
      aria-hidden={!open && undefined}
    >
      <div className="sidebar-head flex items-start justify-between gap-2.5">
        <div className="brand flex min-w-0 items-center gap-2.5 px-2.5 pb-6 pt-2.5 text-lg font-extrabold"><BrandMark size="sm" /> <span className="truncate">Visionaries Village Banking</span></div>
        <IconButton className="sidebar-close" label="Close navigation" icon={X} variant="ghost" onClick={() => setOpen(false)} />
      </div>
      <div className="sidebar-profile mx-2.5 mb-4 grid gap-1.5 rounded-app border border-cream/10 bg-cream/10 p-3">
        <span className="text-[11px] font-black uppercase text-cream">{user.role === "MEMBER" ? "Member Portal" : "Admin Portal"}</span>
        <strong className="break-words text-sm leading-tight text-cream">{user.email || "Visionaries user"}</strong>
        <Badge tone={roleTone(user.role)} text={user.role} />
      </div>
      <nav className="grid gap-1">
        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            className={cx(
              "flex min-h-11 items-center gap-2.5 rounded-app border-0 bg-transparent px-3 py-2.5 text-left text-sm font-extrabold text-mist transition hover:bg-emerald hover:text-cream",
              page === id && "active bg-emerald text-cream shadow-[inset_4px_0_0_#D9A227]"
            )}
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
    <nav className="mobile-bottom-nav fixed bottom-[max(10px,env(safe-area-inset-bottom))] left-1/2 z-[9] hidden w-[min(452px,calc(100vw-20px))] -translate-x-1/2 grid-cols-5 gap-1 rounded-mobile border border-mist bg-cream/95 p-1.5 shadow-lift backdrop-blur md:hidden" aria-label={`${user.role === "MEMBER" ? "Member" : "Admin"} quick navigation`}>
      {items.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          className={cx(
            "grid min-h-[52px] min-w-0 place-items-center gap-1 rounded-[16px] border-0 bg-transparent text-[10px] font-black text-charcoal",
            page === id && "active bg-cream text-emerald shadow-[inset_0_-3px_0_#D9A227]"
          )}
          aria-current={page === id ? "page" : undefined}
          onClick={() => setPage(id)}
        >
          <span className="mobile-nav-icon-wrap relative inline-grid min-h-[22px] min-w-[22px] place-items-center overflow-visible">
            <Icon size={18} aria-hidden="true" />
          </span>
          <span className="mobile-nav-label max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{label.replace("My ", "").replace("Monthly ", "")}</span>
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
    <header className="topbar sticky top-0 z-[4] flex min-h-[76px] items-center justify-between gap-4 border-b border-mist bg-cream/95 px-6 py-3 shadow-soft backdrop-blur">
      <IconButton className="mobile-only" label="Open navigation" icon={Menu} onClick={() => window.dispatchEvent(new CustomEvent("open-mobile-nav"))} />
      <div className="top-context grid min-w-0 flex-1 grid-cols-[minmax(220px,0.9fr)_minmax(320px,1.7fr)] items-center gap-4">
        <div className="top-title-block grid min-w-0 gap-1">
          <span className="top-eyebrow text-[11px] font-black uppercase text-emerald">Visionaries Village Banking</span>
          <strong className="text-[17px] font-extrabold leading-tight text-forest">{portalLabel(user.role)}</strong>
          <span className="truncate text-xs font-extrabold text-charcoal">{isMember ? "Transparent member access" : "Financial operations workspace"}</span>
        </div>
        {isMember ? (
          <div className="top-member-summary grid w-[min(100%,480px)] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 justify-self-end rounded-app border border-emerald bg-cream px-3 py-2 shadow-soft" aria-label="Member account context">
            <span className="whitespace-nowrap text-[11px] font-black uppercase text-charcoal">Signed in as</span>
            <strong className="truncate text-sm font-extrabold text-charcoal">{user.email || "Visionaries member"}</strong>
            <small className="whitespace-nowrap border-l border-mist pl-2 text-[11px] font-black text-charcoal">Member access</small>
          </div>
        ) : (
          <div className="top-selectors grid min-w-0 grid-cols-[minmax(170px,220px)_minmax(150px,220px)_minmax(170px,1fr)] items-center gap-2.5" aria-label="Cycle and month context">
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
            <span className="top-cycle-summary grid min-w-0 gap-0.5 border-l border-mist pl-3">
              <strong className="truncate text-sm font-extrabold text-charcoal">{selectedCycle?.name || "Cycle context"}</strong>
              <span className="truncate text-xs font-bold text-charcoal">{selectedMonth ? `Month ${selectedMonth.month_number} · ${String(selectedMonth.status || "").replaceAll("_", " ")}` : "No month selected"}</span>
            </span>
          </div>
        )}
      </div>
      <div className="top-actions flex shrink-0 items-center gap-2">
        <Badge tone={roleTone(user.role)} text={user.role} />
        <span className="top-notification-action relative inline-grid place-items-center overflow-visible">
          <IconButton label="Open notifications" icon={Bell} onClick={() => setPage?.(notificationsPage)} />
          {unreadCount > 0 ? <span className="top-unread-badge absolute -right-2 -top-2 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-cream bg-alert px-1 text-[10px] font-black leading-none text-cream" aria-label={`${unreadCount} unread notifications`}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
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
    <div className={cx("app-shell grid min-h-screen grid-cols-1 bg-cream text-charcoal md:grid-cols-[248px_1fr]", user.role === "MEMBER" ? "member-shell" : "admin-shell")}>
      <a className="skip-link fixed left-3 top-3 z-[100] -translate-y-[160%] bg-charcoal px-3 py-2.5 font-extrabold text-cream no-underline focus:translate-y-0" href="#main-content">Skip to main content</a>
      <Sidebar nav={nav} page={page} setPage={setPage} open={open} setOpen={setOpen} user={user} />
      <div className="main min-w-0">
        <Topbar user={user} page={page} setPage={setPage} onLogout={onLogout} />
        {open && <button className="overlay" aria-label="Close navigation" onClick={() => setOpen(false)}><X aria-hidden="true" /></button>}
        <main id="main-content" className="content px-6 py-6" tabIndex="-1">{children}</main>
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
      <div className="page-head mb-5 flex min-w-0 items-center justify-between gap-4 border-l-4 border-emerald pl-3.5">
        <h1 id={titleId} className="text-2xl font-extrabold leading-tight text-charcoal">{title}</h1>
        {renderedActions ? <div className="button-row flex flex-wrap items-center gap-2.5" aria-label={`${title} actions`}>{renderedActions}</div> : null}
      </div>
      {children}
    </section>
  );
}
