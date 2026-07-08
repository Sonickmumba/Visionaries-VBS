import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  PiggyBank,
  Scale,
  Send,
  Users,
} from "lucide-react";
import { api } from "../../api/client.js";
import { BrandMark } from "../../components/BrandMark.jsx";
import { Alert, Button, Card, EmptyState, Skeleton } from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/dashboard.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function monthScope(financialPosition) {
  return financialPosition?.month_number ? `up to Month ${financialPosition.month_number}` : "latest calculated";
}

export function dashboardViewModel(data) {
  const totals = data?.totals || {};
  const declarations = data?.declarationStats || {};
  const pendingLoans = Number(data?.pendingLoans || 0);
  const missed = Number(declarations.current_month_missed || declarations.missed || 0);
  const awaitingReview = Number(declarations.awaiting_review || 0);
  const penalties = Number(totals.penalties || 0);
  const financialPosition = data?.financialPosition || {};
  const financialPositionScope = monthScope(financialPosition);

  return {
    cycleName: data?.cycle?.name || "No active cycle",
    monthLabel: data?.cycleMonth?.month_number ? `Month ${data.cycleMonth.month_number}` : "No active month",
    monthStatus: data?.cycleMonth?.status ? String(data.cycleMonth.status).replaceAll("_", " ") : "No active month",
    totals,
    declarations,
    financialPosition,
    financialPositionScope,
    heroStats: [
      { label: "Savings", value: money(totals.savings), icon: PiggyBank },
      { label: "Loans", value: money(totals.loans), icon: Banknote },
      { label: "Pending", value: awaitingReview + pendingLoans, icon: ClipboardList },
    ],
    quickActions: [
      { label: "Review Declarations", detail: `${awaitingReview} awaiting`, page: "declarations", icon: ClipboardList, tone: "green" },
      { label: "Approve Loans", detail: `${pendingLoans} pending`, page: "loans", icon: Banknote, tone: "amber" },
      { label: "Run Monthly Closing", detail: viewMonthStatus(data?.cycleMonth?.status), page: "closing", icon: CalendarDays, tone: "blue" },
      { label: "View Reports", detail: "Cycle insights", page: "reports", icon: FileBarChart, tone: "teal" },
    ],
    poolCards: [
      {
        title: "Pool Contributions",
        value: money(financialPosition.pool_contributions),
        note: `Calculated ${financialPositionScope}`,
        icon: PiggyBank,
      },
      {
        title: "Loans Issued",
        value: money(financialPosition.loans_issued),
        note: `Calculated ${financialPositionScope}`,
        tone: "blue",
        icon: Banknote,
      },
      {
        title: "Unborrowed Money",
        value: money(financialPosition.unborrowed_money),
        note: `Balance ${financialPositionScope}`,
        tone: "amber",
        icon: Scale,
      },
      {
        title: "CI Pool",
        value: money(financialPosition.common_interest_pool),
        note: `Latest calculated month`,
        tone: "teal",
        icon: Scale,
      },
      {
        title: "Total Accumulated Savings",
        value: money(financialPosition.total_accumulated_savings),
        note: `Through ${financialPositionScope.replace("up to ", "")}`,
        tone: "green",
        icon: PiggyBank,
      },
    ],
    cards: [
      {
        title: "Savings Collected",
        value: money(totals.savings),
        note: "Cycle principal",
        icon: PiggyBank,
        page: "savings",
      },
      {
        title: "Loans Outstanding",
        value: money(totals.loans),
        note: `${pendingLoans} pending requests`,
        tone: "blue",
        icon: Banknote,
        page: "loans",
      },
      {
        title: "Declarations Approved",
        value: declarations.approved || 0,
        note: `${awaitingReview} awaiting review`,
        tone: "green",
        icon: ClipboardList,
        page: "declarations",
      },
      {
        title: "Missed Declarations",
        value: missed,
        note: `${declarations.current_month_approved || 0} approved this month`,
        tone: "amber",
        icon: AlertTriangle,
        page: "declarations",
      },
      {
        title: "Common Interest",
        value: money(totals.common_interest),
        note: "Assessed to date",
        tone: "teal",
        icon: Scale,
        page: "common-interest",
      },
      {
        title: "Unpaid Penalties",
        value: money(penalties),
        note: "Needs follow-up",
        tone: penalties > 0 ? "red" : "amber",
        icon: AlertTriangle,
        page: "penalties",
      },
    ],
    priorities: [
      {
        label: "Review Declarations",
        detail: `${awaitingReview} waiting for approval`,
        page: "declarations",
        urgent: awaitingReview > 0,
      },
      {
        label: "Approve Loans",
        detail: `${pendingLoans} pending loan requests`,
        page: "loans",
        urgent: pendingLoans > 0,
      },
      {
        label: "Follow Up Penalties",
        detail: `${money(penalties)} outstanding`,
        page: "penalties",
        urgent: penalties > 0,
      },
      {
        label: "Run Monthly Closing",
        detail: `${data?.cycleMonth?.status ? String(data.cycleMonth.status).replaceAll("_", " ") : "Choose a month"} before locking`,
        page: "closing",
        urgent: false,
      },
    ],
  };
}

function viewMonthStatus(status) {
  return status ? String(status).replaceAll("_", " ") : "Choose month";
}

function DashboardLoading() {
  return (
    <>
      <div className="metrics grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <section className="metric" key={index}><Skeleton lines={3} /></section>
        ))}
      </div>
      <div className="grid two mt-5 grid gap-4 lg:grid-cols-2">
        <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={6} /></section>
        <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={5} /></section>
      </div>
    </>
  );
}

function ProgressPanel({ setPage }) {
  const steps = [
    ["Validate inputs", "Review declarations, savings, loans, contributions, and penalties."],
    ["Assess declarations", "Confirm missed declarations and penalty candidates."],
    ["Calculate savings interest", "Post monthly compound savings interest."],
    ["Calculate loan interest", "Post interest from brought-forward loan balances."],
    ["Allocate common interest", "Calculate charges from unborrowed pool money."],
    ["Review and lock", "Approve the closing run and lock the month."],
  ];

  return (
    <section className="panel dashboard-panel rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="panel-head mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-charcoal">Monthly Closing Progress</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => setPage?.("closing")}>Open Closing</Button>
      </div>
      {steps.map(([title, note], index) => (
        <button className="dashboard-step grid w-full grid-cols-[28px_minmax(0,0.7fr)_minmax(0,1fr)_22px] items-center gap-2.5 border-0 border-b border-mist bg-cream py-2.5 text-left" key={title} type="button" onClick={() => setPage?.("closing")}>
          <span className="grid h-6 w-6 place-items-center rounded-full bg-mist text-xs font-extrabold text-emerald">{index + 1}</span>
          <strong className="text-sm font-extrabold text-charcoal">{title}</strong>
          <small className="text-xs font-semibold text-charcoal/75">{note}</small>
          <CheckCircle2 size={16} aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}

function PriorityPanel({ priorities, setPage }) {
  return (
    <section className="panel dashboard-panel rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="panel-head mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-charcoal">Priority Queue</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => setPage?.("reports")}>View Reports</Button>
      </div>
      <div className="dashboard-priorities grid gap-2.5">
        {priorities.map((item) => (
          <button key={item.label} type="button" className={cx("rounded-app border border-mist border-l-4 bg-cream p-3 text-left shadow-soft", item.urgent ? "urgent border-l-alert" : "border-l-emerald")} onClick={() => setPage?.(item.page)}>
            <span className="text-xs font-black uppercase text-charcoal/75">{item.label}</span>
            <strong className="mt-1 block text-sm font-extrabold text-charcoal">{item.detail}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function DashboardHero({ view, setPage }) {
  return (
    <section className="admin-dashboard-hero mb-4 grid overflow-hidden rounded-mobile bg-gradient-to-br from-forest via-emerald to-forest p-5 text-cream shadow-lift md:grid-cols-[minmax(0,1fr)_auto]" aria-label="Admin dashboard summary">
      <div className="admin-hero-copy grid gap-1">
        <BrandMark size="sm" showText className="admin-hero-brand" />
        <span className="text-xs font-black uppercase text-cream">Good day</span>
        <h2 className="m-0 text-[28px] font-extrabold leading-tight text-cream">Visionaries Operations</h2>
        <p className="m-0 text-sm font-extrabold text-cream/90">{view.cycleName} · {view.monthLabel}</p>
      </div>
      <div className="admin-hero-status grid min-w-[150px] self-start rounded-app border border-cream/20 bg-white/10 p-3 backdrop-blur" aria-label="Month status">
        <span className="text-xs font-black uppercase text-cream">Status</span>
        <strong className="text-sm font-extrabold capitalize text-cream">{view.monthStatus}</strong>
      </div>
      <div className="admin-hero-stats col-span-full mt-4 grid grid-cols-3 gap-2.5">
        {view.heroStats.map(({ label, value, icon: Icon }) => (
          <button key={label} type="button" className="grid min-h-[82px] content-start gap-1.5 rounded-app border border-cream/20 bg-white/10 p-3 text-left text-cream transition hover:bg-white/20" onClick={() => setPage?.(label === "Savings" ? "savings" : label === "Loans" ? "loans" : "declarations")}>
            <Icon size={18} className="text-gold" aria-hidden="true" />
            <span className="text-xs font-black uppercase text-cream">{label}</span>
            <strong className="break-words text-lg font-extrabold leading-tight text-cream">{value}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function QuickActions({ actions, setPage }) {
  return (
    <section className="admin-quick-actions mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Quick actions">
      {actions.map(({ label, detail, page, icon: Icon, tone }) => (
        <button key={label} type="button" className={cx("grid min-h-[94px] grid-cols-[auto_1fr_auto] items-center gap-x-2.5 rounded-mobile border border-mist bg-cream p-3 text-left text-charcoal shadow-soft transition hover:border-emerald hover:shadow-lift", tone)} onClick={() => setPage?.(page)}>
          <span className="grid h-10 w-10 place-items-center rounded-app bg-mist text-emerald"><Icon size={18} aria-hidden="true" /></span>
          <strong className="text-sm font-extrabold text-charcoal">{label}</strong>
          <small className="col-start-2 text-xs font-extrabold capitalize text-charcoal/75">{detail}</small>
          <Send size={15} aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}

export function AdminDashboardPage({ setPage, dashboardApi = api, initialData = undefined }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(initialData === undefined);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const response = await dashboardApi("/reports/dashboard");
      setData(response.data);
    } catch (err) {
      setError(err.message || "Dashboard could not load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData === undefined) loadDashboard();
  }, []);

  const view = useMemo(() => dashboardViewModel(data), [data]);

  return (
    <Page
      title="Admin Dashboard"
      className="admin-dashboard-page"
      actions={(
        <>
          <Button type="button" onClick={() => setPage?.("declarations")}>Review Declarations</Button>
          <Button type="button" variant="secondary" onClick={() => setPage?.("loans")}>Approve Loans</Button>
          <Button type="button" variant="secondary" onClick={() => setPage?.("closing")}>Run Monthly Closing</Button>
          <Button type="button" variant="secondary" icon={FileBarChart} onClick={() => setPage?.("reports")}>View Reports</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Dashboard unavailable">{error}</Alert> : null}
      {loading ? <DashboardLoading /> : !data ? (
        <EmptyState
          title="No active cycle"
          message="Activate a cycle and generate months before the dashboard can show operational statistics."
          action={<Button type="button" onClick={() => setPage?.("cycles")}>Open Cycles</Button>}
        />
      ) : (
        <>
          <DashboardHero view={view} setPage={setPage} />
          <QuickActions actions={view.quickActions} setPage={setPage} />

          <section className="dashboard-context mb-5 grid gap-3 lg:grid-cols-3">
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 rounded-app border border-mist bg-cream p-3 shadow-soft">
              <CalendarDays size={18} aria-hidden="true" />
              <span className="text-xs font-black uppercase text-charcoal/75">Active Cycle</span>
              <strong className="font-extrabold text-charcoal">{view.cycleName}</strong>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 rounded-app border border-mist bg-cream p-3 shadow-soft">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span className="text-xs font-black uppercase text-charcoal/75">Current Month</span>
              <strong className="font-extrabold text-charcoal">{view.monthLabel}</strong>
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 rounded-app border border-mist bg-cream p-3 shadow-soft">
              <Users size={18} aria-hidden="true" />
              <span className="text-xs font-black uppercase text-charcoal/75">Declaration Status</span>
              <strong className="font-extrabold text-charcoal">{view.declarations.awaiting_review || 0} awaiting review</strong>
            </div>
          </section>

          <div className="metrics dashboard-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {view.cards.map((card) => (
              <button className="dashboard-card block border-0 bg-transparent p-0 text-left" type="button" key={card.title} onClick={() => setPage?.(card.page)}>
                <Card {...card} />
              </button>
            ))}
          </div>

          <section className="panel dashboard-panel dashboard-financial-position mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
            <div className="panel-head mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-charcoal">Cycle Financial Position {view.financialPositionScope}</h2>
              <Button type="button" size="sm" variant="secondary" onClick={() => setPage?.("common-interest")}>Open Common Interest</Button>
            </div>
            <div className="metrics dashboard-pool-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {view.poolCards.map((card) => <Card key={card.title} {...card} />)}
            </div>
          </section>

          <div className="grid two grid gap-4 lg:grid-cols-2">
            <ProgressPanel setPage={setPage} />
            <PriorityPanel priorities={view.priorities} setPage={setPage} />
          </div>
        </>
      )}
    </Page>
  );
}
