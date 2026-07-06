import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Banknote, ClipboardList, FileText, Info, PiggyBank, Receipt, RefreshCw } from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  MobileActionTile,
  MobileBottomNav,
  MobileListCard,
  MobileMetricCard,
  MobileScreenShell,
  Skeleton,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import { chooseActiveMembership, memberDashboardTotals } from "./MemberDashboardPage.jsx";
import { memberMobileNavItems } from "./memberMobileNav.js";
import "../../styles/member-loans.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateTime = (value) => value ? String(value).slice(0, 19).replace("T", " ") : "-";
const titleCase = (value) => String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

function transactionTone(type) {
  const value = String(type || "");
  if (value.includes("REPAYMENT")) return "green";
  if (value.includes("INTEREST")) return "amber";
  if (value.includes("PENALTY")) return "red";
  if (value.includes("LOAN")) return "blue";
  return "gray";
}

function DetailValue({ label, value }) {
  return (
    <div className="grid gap-1 rounded-app border border-mist bg-cream p-3">
      <strong className="text-xs font-black uppercase text-charcoal/70">{label}</strong>
      <span className="break-words text-sm font-extrabold text-charcoal">{value}</span>
    </div>
  );
}

function MobileBreakdownValue({ label, value, icon: Icon = Banknote, tone = "green" }) {
  return (
    <div className={`member-loans-breakdown-row ${tone}`.trim()}>
      <span className="member-loans-breakdown-icon"><Icon size={14} aria-hidden="true" /></span>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function borrowingBadgeText(summary) {
  return summary.borrowingShortfall > 0 ? "Minimum Borrowing Pending" : "Minimum Borrowing Met";
}

function MemberLoansMobileHero({ summary, activeMembership, setPage }) {
  const statusTone = summary.borrowingShortfall > 0 ? "amber" : "green";

  return (
    <section className="member-loans-hero" aria-label="Loan account summary">
      <div className="member-loans-hero-head">
        <button type="button" aria-label="Back to dashboard" onClick={() => setPage?.("member-dashboard")}><ArrowLeft size={18} aria-hidden="true" /></button>
        <span hidden>Member Loans</span>
        <h2>Loans</h2>
        <button type="button" aria-label="Loan information"><Info size={18} aria-hidden="true" /></button>
      </div>

      <div className="member-loans-hero-main">
        <span>Outstanding Loan Balance</span>
        <strong>{money(summary.outstandingBalance)}</strong>
        <Badge text={borrowingBadgeText(summary)} tone={statusTone} />
        <small>{money(summary.cumulativeBorrowed)} cumulative borrowed</small>
      </div>
    </section>
  );
}

export async function loadMemberLoanData({ memberApi = api } = {}) {
  const me = await memberApi("/auth/me");
  const activeMembership = chooseActiveMembership(me.cycleMemberships || []);
  if (!activeMembership) {
    return { me, activeMembership: null, statement: null, ledger: { data: [], summary: {} } };
  }

  const [statement, ledger] = await Promise.all([
    memberApi(`/reports/member-statement/${activeMembership.id}`),
    memberApi(`/loans/member/${activeMembership.id}`),
  ]);

  return {
    me,
    activeMembership,
    statement: statement.data,
    ledger,
  };
}

export function memberLoanSummary(data) {
  const summary = data?.ledger?.summary || {};
  const totals = memberDashboardTotals({ activeMembership: data?.activeMembership, statement: data?.statement });
  return {
    cumulativeBorrowed: Number(summary.cumulative_borrowed ?? totals.borrowed ?? 0),
    originalLoans: Number(summary.original_loans || 0),
    topUps: Number(summary.top_ups || 0),
    convertedPenaltyLoans: Number(summary.converted_penalty_loans || 0),
    interestAssessed: Number(summary.interest_assessed || 0),
    principalRepaid: Number(summary.principal_repaid || 0),
    interestRepaid: Number(summary.interest_repaid || 0),
    outstandingBalance: Number(summary.outstanding_balance ?? totals.outstandingLoan ?? 0),
    borrowingShortfall: totals.borrowingShortfall,
    borrowingStatus: totals.borrowingStatus,
  };
}

function LedgerRows({ entries = [] }) {
  return (
    <DataTable
      columns={["Date", "Type", "Amount", "Description", "Reference"]}
      rows={entries.map((entry) => [
        dateTime(entry.posted_at || entry.transaction_date),
        <Badge text={titleCase(entry.transaction_type)} tone={transactionTone(entry.transaction_type)} />,
        money(entry.amount),
        entry.description || "-",
        entry.reference || entry.reference_number || entry.id || "-",
      ])}
      empty="No loan ledger entries found."
    />
  );
}

export function MemberLoansPage({
  setPage,
  memberApi = api,
  initialData = null,
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialData === null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await loadMemberLoanData({ memberApi }));
    } catch (err) {
      setError(err.message || "Member loans could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData === null) load();
  }, []);

  const activeMembership = data?.activeMembership;
  const summary = useMemo(() => memberLoanSummary(data), [data]);
  const entries = data?.ledger?.data || [];
  const unpaidInterest = Math.max(0, summary.interestAssessed - summary.interestRepaid);
  const bottomNav = (
    <MobileBottomNav
      active="my-loans"
      items={memberMobileNavItems}
      onChange={setPage}
    />
  );

  return (
    <Page
      className="member-loans-page grid gap-0"
      title="My Loans"
      actions={(
        <>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>Refresh</Button>
          <Button type="button" icon={ClipboardList} onClick={() => setPage?.("my-declaration")}>Request Loan</Button>
          <Button type="button" variant="secondary" onClick={() => setPage?.("member-dashboard")}>Back to Dashboard</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Loans failed">{error}</Alert> : null}

      {loading ? <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={8} /></section> : !activeMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into a cycle before loan details can appear." />
      ) : (
        <>
          <div className="member-loans-mobile">
            <MobileScreenShell bottomNav={bottomNav}>
              <MemberLoansMobileHero
                summary={summary}
                activeMembership={activeMembership}
                setPage={setPage}
              />

              <div className="member-loans-mobile-metrics member-loans-mobile-secondary" aria-label="Member loan summary">
                <MobileMetricCard label="Borrowing Shortfall" value={money(summary.borrowingShortfall)} note={titleCase(summary.borrowingStatus)} icon={PiggyBank} />
                <MobileMetricCard label="Interest Assessed" value={money(summary.interestAssessed)} note={`${money(summary.interestRepaid)} repaid`} icon={Receipt} tone="amber" />
                <MobileMetricCard label="Principal Repaid" value={money(summary.principalRepaid)} note="Paid toward balance" icon={Banknote} tone="green" />
                <MobileMetricCard label="Top-ups" value={money(summary.topUps)} note="Additional borrowing" icon={Banknote} tone="blue" />
              </div>

              <section className="member-mobile-section member-loans-mobile-secondary" aria-label="Loan actions">
                <div className="member-mobile-section-head">
                  <h2>Actions</h2>
                </div>
                <div className="member-loans-mobile-actions">
                  <MobileActionTile label="Request Loan" icon={ClipboardList} onClick={() => setPage?.("my-declaration")} />
                  <MobileActionTile label="Request Top-up" icon={Banknote} tone="blue" onClick={() => setPage?.("my-declaration")} />
                  <MobileActionTile label="Declare Repayment" icon={Receipt} tone="amber" onClick={() => setPage?.("my-declaration")} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Loan Balance Breakdown</h2>
                </div>
                <div className="member-loans-mobile-breakdown">
                  <MobileBreakdownValue label="Original Loans" value={money(summary.originalLoans)} icon={Banknote} />
                  <MobileBreakdownValue label="Top-ups" value={money(summary.topUps)} icon={PiggyBank} tone="amber" />
                  <MobileBreakdownValue label="Converted Penalty Loans" value={money(summary.convertedPenaltyLoans)} icon={AlertTriangle} tone="red" />
                  <MobileBreakdownValue label="Interest Assessed (Unpaid)" value={money(unpaidInterest)} icon={Receipt} tone="blue" />
                  <MobileBreakdownValue label="Principal Repaid" value={money(summary.principalRepaid)} icon={Banknote} />
                  <MobileBreakdownValue label="Interest Paid" value={money(summary.interestRepaid)} icon={Receipt} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Loan Ledger</h2>
                  <button type="button" className="member-mobile-text-link" onClick={() => setPage?.("my-statement")}>View All</button>
                </div>
                <div className="member-mobile-list">
                  {entries.length ? entries.map((entry) => (
                    <MobileListCard
                      key={entry.id}
                      title={titleCase(entry.transaction_type)}
                      subtitle={entry.description || entry.reference || "-"}
                      meta={dateTime(entry.posted_at || entry.transaction_date)}
                      value={money(entry.amount)}
                      status={{ label: entry.reference || "Ledger", tone: transactionTone(entry.transaction_type) }}
                      icon={FileText}
                    />
                  )) : <p className="muted">No loan ledger entries found.</p>}
                </div>
              </section>

              <div className="member-loans-bottom-actions" aria-label="Loan actions">
                <Button type="button" variant="secondary" className="loan-action request" icon={ClipboardList} onClick={() => setPage?.("my-declaration")}>Request Loan</Button>
                <Button type="button" variant="secondary" className="loan-action topup" icon={Banknote} onClick={() => setPage?.("my-declaration")}>Request Top-up</Button>
                <Button type="button" variant="secondary" className="loan-action repayment" icon={Receipt} onClick={() => setPage?.("my-declaration")}>Declare Repayment</Button>
              </div>
            </MobileScreenShell>
          </div>

          <div className="member-loans-desktop">
            <div className="metrics member-loans-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card title="My Loan Balance" value={money(summary.outstandingBalance)} note="Outstanding balance" tone="blue" icon={Banknote} />
              <Card title="Cumulative Borrowed" value={money(summary.cumulativeBorrowed)} note="Cycle borrowing" icon={PiggyBank} />
              <Card title="Interest Assessed" value={money(summary.interestAssessed)} note={`${money(summary.interestRepaid)} repaid`} tone="amber" icon={Receipt} />
              <Card title="Borrowing Shortfall" value={money(summary.borrowingShortfall)} note={titleCase(summary.borrowingStatus)} tone={summary.borrowingShortfall > 0 ? "amber" : "green"} icon={AlertTriangle} />
            </div>

            <section className="panel member-loans-context mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-extrabold text-charcoal">Loan Breakdown</h2>
                <Badge text={titleCase(summary.borrowingStatus)} tone={summary.borrowingShortfall > 0 ? "amber" : "green"} />
              </div>
              <div className="detail-grid member-loans-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailValue label="Original Loans" value={money(summary.originalLoans)} />
                <DetailValue label="Top-ups" value={money(summary.topUps)} />
                <DetailValue label="Converted Penalties" value={money(summary.convertedPenaltyLoans)} />
                <DetailValue label="Interest Assessed" value={money(summary.interestAssessed)} />
                <DetailValue label="Principal Repaid" value={money(summary.principalRepaid)} />
                <DetailValue label="Interest Repaid" value={money(summary.interestRepaid)} />
                <DetailValue label="Outstanding Balance" value={money(summary.outstandingBalance)} />
                <DetailValue label="Minimum Borrowing Shortfall" value={money(summary.borrowingShortfall)} />
              </div>
            </section>

            <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-extrabold text-charcoal">Loan Ledger</h2>
                <Badge text={`${entries.length} records`} tone="blue" />
              </div>
              <LedgerRows entries={entries} />
            </section>
          </div>
        </>
      )}
    </Page>
  );
}
