import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  PiggyBank,
  Scale,
} from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button, Card, EmptyState, Skeleton } from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/dashboard.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function dashboardViewModel(data) {
  const totals = data?.totals || {};
  const declarations = data?.declarationStats || {};
  const pendingLoans = Number(data?.pendingLoans || 0);
  const missed = Number(declarations.current_month_missed || declarations.missed || 0);
  const awaitingReview = Number(declarations.awaiting_review || 0);
  const penalties = Number(totals.penalties || 0);

  return {
    cycleName: data?.cycle?.name || "No active cycle",
    monthLabel: data?.cycleMonth?.month_number ? `Month ${data.cycleMonth.month_number}` : "No active month",
    totals,
    declarations,
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

function DashboardLoading() {
  return (
    <>
      <div className="metrics">
        {Array.from({ length: 6 }, (_, index) => (
          <section className="metric" key={index}><Skeleton lines={3} /></section>
        ))}
      </div>
      <div className="grid two">
        <section className="panel"><Skeleton lines={6} /></section>
        <section className="panel"><Skeleton lines={5} /></section>
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
    <section className="panel dashboard-panel">
      <div className="panel-head">
        <h2>Monthly Closing Progress</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => setPage?.("closing")}>Open Closing</Button>
      </div>
      {steps.map(([title, note], index) => (
        <button className="dashboard-step" key={title} type="button" onClick={() => setPage?.("closing")}>
          <span>{index + 1}</span>
          <strong>{title}</strong>
          <small>{note}</small>
          <CheckCircle2 size={16} aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}

function PriorityPanel({ priorities, setPage }) {
  return (
    <section className="panel dashboard-panel">
      <div className="panel-head">
        <h2>Priority Queue</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => setPage?.("reports")}>View Reports</Button>
      </div>
      <div className="dashboard-priorities">
        {priorities.map((item) => (
          <button key={item.label} type="button" className={item.urgent ? "urgent" : ""} onClick={() => setPage?.(item.page)}>
            <span>{item.label}</span>
            <strong>{item.detail}</strong>
          </button>
        ))}
      </div>
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
          <section className="dashboard-context">
            <div>
              <span>Active Cycle</span>
              <strong>{view.cycleName}</strong>
            </div>
            <div>
              <span>Current Month</span>
              <strong>{view.monthLabel}</strong>
            </div>
            <div>
              <span>Declaration Status</span>
              <strong>{view.declarations.awaiting_review || 0} awaiting review</strong>
            </div>
          </section>

          <div className="metrics dashboard-metrics">
            {view.cards.map((card) => (
              <button className="dashboard-card" type="button" key={card.title} onClick={() => setPage?.(card.page)}>
                <Card {...card} />
              </button>
            ))}
          </div>

          <div className="grid two">
            <ProgressPanel setPage={setPage} />
            <PriorityPanel priorities={view.priorities} setPage={setPage} />
          </div>
        </>
      )}
    </Page>
  );
}
