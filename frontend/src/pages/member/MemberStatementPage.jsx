import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Banknote, Download, Eye, FileText, Gauge, PiggyBank, RefreshCw, Scale } from "lucide-react";
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
  Modal,
  Select,
  Skeleton,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import { buildCsv } from "../../utils/exportSafety.js";
import { chooseActiveMembership, memberDashboardTotals } from "./MemberDashboardPage.jsx";
import { memberMobileNavItems } from "./memberMobileNav.js";
import "../../styles/member-statement.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";
const dateTime = (value) => value ? String(value).slice(0, 19).replace("T", " ") : "-";
const titleCase = (value) => String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

function transactionTone(type) {
  if (String(type).includes("REPAYMENT") || String(type).includes("PAYMENT")) return "green";
  if (String(type).includes("LOAN")) return "blue";
  if (String(type).includes("PENALTY")) return "red";
  if (String(type).includes("COMMON")) return "amber";
  return "gray";
}

function statementRows(transactions = [], onView) {
  return transactions.map((tx) => [
    dateTime(tx.posted_at || tx.transaction_date),
    <Badge text={titleCase(tx.transaction_type)} tone={transactionTone(tx.transaction_type)} />,
    money(tx.amount),
    tx.description || "-",
    tx.source_table || "-",
    <Button type="button" size="sm" variant="secondary" icon={Eye} onClick={() => onView?.(tx)}>View</Button>,
  ]);
}

export function buildStatementCsvRows(transactions = []) {
  return transactions.map((tx) => [
    dateTime(tx.posted_at || tx.transaction_date),
    titleCase(tx.transaction_type),
    Number(tx.amount || 0).toFixed(2),
    tx.description || "",
    tx.source_table || "",
    tx.source_id || "",
  ]);
}

export async function loadMemberStatementData({ memberApi = api, cycleMonthId = "" } = {}) {
  const me = await memberApi("/auth/me");
  const activeMembership = chooseActiveMembership(me.cycleMemberships || []);
  if (!activeMembership) {
    return { me, activeMembership: null, cycleDetail: null, statement: null, selectedStatement: null, months: [] };
  }

  const params = cycleMonthId ? `?cycleMonthId=${encodeURIComponent(cycleMonthId)}` : "";
  const [cycleDetail, statement, selectedStatement] = await Promise.all([
    memberApi(`/cycles/${activeMembership.cycle_id}`),
    memberApi(`/reports/member-statement/${activeMembership.id}`),
    cycleMonthId
      ? memberApi(`/reports/member-statement/${activeMembership.id}${params}`)
      : Promise.resolve(null),
  ]);

  return {
    me,
    activeMembership,
    cycleDetail,
    statement: statement.data,
    selectedStatement: selectedStatement?.data || null,
    months: cycleDetail.months || [],
  };
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

function MemberStatementMobileHero({ cycleTotals, selectedMonth, activeMembership, exportStatement, setPage }) {
  return (
    <section className="member-statement-hero" aria-label="Statement summary">
      <div className="member-statement-topbar">
        <button type="button" aria-label="Back to dashboard" onClick={() => setPage?.("member-dashboard")}><ArrowLeft size={18} aria-hidden="true" /></button>
        <h1>Statement</h1>
        <button type="button" aria-label="Export statement" onClick={exportStatement}><Download size={18} aria-hidden="true" /></button>
      </div>
      <div className="member-statement-hero-head">
        <div>
          <span>{selectedMonth ? `Month ${selectedMonth.month_number}` : "Full Cycle"}</span>
          <h2>Statement</h2>
        </div>
        <Badge text={selectedMonth ? titleCase(selectedMonth.status) : titleCase(activeMembership?.cycle_status)} tone="blue" />
      </div>
      <div className="member-statement-hero-main">
        <span>Accumulated Savings</span>
        <strong>{money(cycleTotals.accumulatedSavings)}</strong>
        <small>{activeMembership?.cycle_name || "Active cycle"}</small>
      </div>
      <div className="member-statement-hero-actions">
        <Button type="button" size="sm" onClick={exportStatement}>Export CSV</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setPage?.("member-dashboard")}>Dashboard</Button>
      </div>
      <div className="member-statement-hero-strip">
        <DetailValue label="Loan Balance" value={money(cycleTotals.outstandingLoan)} />
        <DetailValue label="Penalty Due" value={money(cycleTotals.penaltyDue)} />
      </div>
    </section>
  );
}

function TransactionDetail({ transaction }) {
  if (!transaction) return null;
  return (
    <div className="statement-detail-grid">
      <DetailValue label="Transaction Type" value={titleCase(transaction.transaction_type)} />
      <DetailValue label="Amount" value={money(transaction.amount)} />
      <DetailValue label="Posted At" value={dateTime(transaction.posted_at || transaction.transaction_date)} />
      <DetailValue label="Posted By" value={transaction.posted_by_email || transaction.posted_by || "-"} />
      <DetailValue label="Source Table" value={transaction.source_table || "-"} />
      <DetailValue label="Source ID" value={transaction.source_id || "-"} />
      <DetailValue label="Reference" value={transaction.reference_number || transaction.id || "-"} />
      <DetailValue label="Description" value={transaction.description || "-"} />
    </div>
  );
}

function monthLabel(month) {
  return month ? `Month ${month.month_number} - ${titleCase(month.status)}` : "Full cycle";
}

function downloadCsv(filename, rows) {
  const headers = ["Date", "Type", "Amount", "Description", "Source", "Source ID"];
  const csv = buildCsv([headers, ...rows]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function MemberStatementPage({
  setPage,
  memberApi = api,
  initialData = null,
}) {
  const [data, setData] = useState(initialData);
  const [selectedMonthId, setSelectedMonthId] = useState(initialData?.selectedMonthId || "");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialData === null);
  const [monthLoading, setMonthLoading] = useState(false);

  async function load(monthId = selectedMonthId) {
    setLoading(true);
    setError("");
    try {
      setData(await loadMemberStatementData({ memberApi, cycleMonthId: monthId }));
    } catch (err) {
      setError(err.message || "Member statement could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMonth(monthId) {
    setSelectedMonthId(monthId);
    setError("");
    if (!data?.activeMembership) return;
    if (!monthId) {
      setData((current) => ({ ...current, selectedStatement: null }));
      return;
    }
    setMonthLoading(true);
    try {
      const response = await memberApi(`/reports/member-statement/${data.activeMembership.id}?cycleMonthId=${encodeURIComponent(monthId)}`);
      setData((current) => ({ ...current, selectedStatement: response.data }));
    } catch (err) {
      setError(err.message || "Month statement could not load.");
    } finally {
      setMonthLoading(false);
    }
  }

  useEffect(() => {
    if (initialData === null) load();
  }, []);

  const activeMembership = data?.activeMembership;
  const statement = data?.statement;
  const focusedStatement = selectedMonthId ? data?.selectedStatement : statement;
  const cycleTotals = useMemo(() => memberDashboardTotals({ activeMembership, statement }), [activeMembership, statement]);
  const focusedTotals = useMemo(() => memberDashboardTotals({ activeMembership, statement: focusedStatement }), [activeMembership, focusedStatement]);
  const transactions = focusedStatement?.transactions || [];
  const snapshots = focusedStatement?.snapshots || [];
  const selectedMonth = (data?.months || []).find((month) => month.id === selectedMonthId);
  const bottomNav = (
    <MobileBottomNav
      active="my-statement"
      items={memberMobileNavItems}
      onChange={setPage}
    />
  );

  function exportStatement() {
    downloadCsv(
      selectedMonth ? `member-statement-month-${selectedMonth.month_number}.csv` : "member-statement-cycle.csv",
      buildStatementCsvRows(transactions),
    );
  }

  return (
    <Page
      className="member-statement-page"
      title="My Statement"
      actions={(
        <>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => load(selectedMonthId)} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={Download} onClick={exportStatement} disabled={!transactions.length}>Export CSV</Button>
          <Button type="button" onClick={() => setPage?.("member-dashboard")}>Back to Dashboard</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Statement failed">{error}</Alert> : null}

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !activeMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into a cycle before statements can appear." />
      ) : (
        <>
          <div className="member-statement-mobile">
            <MobileScreenShell bottomNav={bottomNav}>
              <MemberStatementMobileHero
                cycleTotals={cycleTotals}
                selectedMonth={selectedMonth}
                activeMembership={activeMembership}
                exportStatement={exportStatement}
                setPage={setPage}
              />

              <div className="member-statement-mobile-metrics" aria-label="Statement financial summary">
                <MobileMetricCard label="Outstanding Loan" value={money(cycleTotals.outstandingLoan)} note="Loan balance" icon={Banknote} tone="blue" />
                <MobileMetricCard label="Common Interest Due" value={money(cycleTotals.commonInterestDue)} note="Assessed less paid" icon={Scale} tone="amber" />
                <MobileMetricCard label="Penalty Due" value={money(cycleTotals.penaltyDue)} note="Outstanding penalties" icon={AlertTriangle} tone={cycleTotals.penaltyDue > 0 ? "red" : "green"} />
                <MobileMetricCard label="Borrowing Shortfall" value={money(cycleTotals.borrowingShortfall)} note="Minimum borrowing progress" icon={PiggyBank} />
              </div>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Statement Period</h2>
                  <Badge text={selectedMonth ? `Month ${selectedMonth.month_number}` : "Full Cycle"} tone="blue" />
                </div>
                <div className="member-statement-mobile-context">
                  <Select
                    label="Statement period"
                    value={selectedMonthId}
                    onChange={loadMonth}
                    placeholder="Full cycle"
                    options={(data?.months || []).map((month) => ({ value: month.id, label: monthLabel(month) }))}
                  />
                  <DetailValue label="Cycle" value={activeMembership.cycle_name || statement?.member?.cycle_name || "-"} />
                  <DetailValue label="Period Transactions" value={monthLoading ? "Loading..." : transactions.length} />
                </div>
              </section>

              <section className="member-mobile-section" aria-label="Statement actions">
                <div className="member-mobile-section-head">
                  <h2>Actions</h2>
                </div>
                <div className="member-statement-mobile-actions">
                  <MobileActionTile label="Refresh" icon={RefreshCw} onClick={() => load(selectedMonthId)} disabled={loading} />
                  <MobileActionTile label="Export CSV" icon={Download} tone="blue" onClick={exportStatement} disabled={!transactions.length} />
                  <MobileActionTile label="Dashboard" icon={Gauge} tone="amber" onClick={() => setPage?.("member-dashboard")} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>{selectedMonth ? "Selected Month Totals" : "Cycle Totals"}</h2>
                  <Badge text={selectedMonth ? titleCase(selectedMonth.status) : "All months"} tone="gray" />
                </div>
                <div className="member-statement-mobile-totals">
                  <DetailValue label="Savings Principal" value={money(focusedTotals.savingsPrincipal)} />
                  <DetailValue label="Savings Interest" value={money(focusedTotals.savingsInterest)} />
                  <DetailValue label="Borrowed" value={money(focusedTotals.borrowed)} />
                  <DetailValue label="Principal Repaid" value={money(focusedStatement?.totals?.principal_repaid)} />
                  <DetailValue label="Loan Interest Assessed" value={money(focusedStatement?.totals?.loan_interest_assessed)} />
                  <DetailValue label="Loan Interest Paid" value={money(focusedStatement?.totals?.loan_interest_repaid)} />
                  <DetailValue label="Common Interest" value={money(focusedStatement?.totals?.common_interest)} />
                  <DetailValue label="Penalties" value={money(focusedStatement?.totals?.penalties)} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Transaction Detail</h2>
                  <Badge text={`${transactions.length} records`} tone="blue" />
                </div>
                <div className="member-mobile-list">
                  {transactions.length ? transactions.map((tx) => (
                    <MobileListCard
                      key={tx.id || `${tx.transaction_type}-${tx.posted_at}`}
                      title={titleCase(tx.transaction_type)}
                      subtitle={tx.description || tx.source_table || "-"}
                      meta={dateTime(tx.posted_at || tx.transaction_date)}
                      value={money(tx.amount)}
                      status={{ label: tx.source_table || "Ledger", tone: transactionTone(tx.transaction_type) }}
                      icon={FileText}
                      actionLabel="View"
                      onAction={() => setSelectedTransaction(tx)}
                    />
                  )) : <p className="muted">{monthLoading ? "Loading statement..." : "No statement transactions found."}</p>}
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Monthly Snapshots</h2>
                  <Badge text={`${snapshots.length} records`} tone="blue" />
                </div>
                <div className="member-mobile-list">
                  {snapshots.length ? snapshots.map((snapshot, index) => (
                    <article key={`${snapshot.month_number || snapshot.created_at}-${index}`} className="member-statement-snapshot-card">
                      <header>
                        <strong>{snapshot.month_number ? `Month ${snapshot.month_number}` : dateOnly(snapshot.created_at)}</strong>
                        <Badge text={titleCase(snapshot.borrowing_compliance_status || snapshot.compliance_status)} tone={transactionTone(snapshot.borrowing_compliance_status)} />
                      </header>
                      <div>
                        <DetailValue label="Savings" value={money(snapshot.accumulated_savings || snapshot.closing_savings_balance)} />
                        <DetailValue label="Loan" value={money(snapshot.closing_loan_balance || snapshot.outstanding_loan_balance)} />
                        <DetailValue label="Common Interest" value={money(snapshot.common_interest_due || snapshot.common_interest_balance)} />
                        <DetailValue label="Penalty" value={money(snapshot.penalty_due || snapshot.penalty_balance)} />
                      </div>
                    </article>
                  )) : <p className="muted">No monthly snapshots found.</p>}
                </div>
              </section>
            </MobileScreenShell>
          </div>

          <div className="member-statement-desktop">
          <div className="metrics member-statement-metrics">
            <Card title="Accumulated Savings" value={money(cycleTotals.accumulatedSavings)} note="Cycle principal + interest" icon={PiggyBank} />
            <Card title="Outstanding Loan" value={money(cycleTotals.outstandingLoan)} note="Borrowed + interest less repayments" tone="blue" icon={Banknote} />
            <Card title="Common Interest Due" value={money(cycleTotals.commonInterestDue)} note="Assessed less paid" tone="amber" icon={Scale} />
            <Card title="Penalty Due" value={money(cycleTotals.penaltyDue)} note="Outstanding penalties" tone={cycleTotals.penaltyDue > 0 ? "red" : "green"} icon={AlertTriangle} />
          </div>

          <section className="panel member-statement-context">
            <div className="panel-head">
              <h2>Statement Context</h2>
              <Badge text={selectedMonth ? `Month ${selectedMonth.month_number}` : "Full Cycle"} tone="blue" />
            </div>
            <div className="form-grid three">
              <Select
                label="Statement period"
                value={selectedMonthId}
                onChange={loadMonth}
                placeholder="Full cycle"
                options={(data?.months || []).map((month) => ({
                  value: month.id,
                  label: monthLabel(month),
                }))}
              />
              <DetailValue label="Member" value={memberName(statement?.member || data?.me?.member)} />
              <DetailValue label="Cycle" value={activeMembership.cycle_name || statement?.member?.cycle_name || "-"} />
              <DetailValue label="Cycle Borrowed" value={money(cycleTotals.borrowed)} />
              <DetailValue label="Borrowing Shortfall" value={money(cycleTotals.borrowingShortfall)} />
              <DetailValue label="Period Transactions" value={monthLoading ? "Loading..." : transactions.length} />
            </div>
          </section>

          <section className="panel member-statement-context">
            <div className="panel-head">
              <h2>{selectedMonth ? "Selected Month Totals" : "Cycle Totals"}</h2>
              <Badge text={selectedMonth ? titleCase(selectedMonth.status) : "All months"} tone="gray" />
            </div>
            <div className="detail-grid member-statement-detail-grid">
              <DetailValue label="Savings Principal" value={money(focusedTotals.savingsPrincipal)} />
              <DetailValue label="Savings Interest" value={money(focusedTotals.savingsInterest)} />
              <DetailValue label="Borrowed" value={money(focusedTotals.borrowed)} />
              <DetailValue label="Principal Repaid" value={money(focusedStatement?.totals?.principal_repaid)} />
              <DetailValue label="Loan Interest Assessed" value={money(focusedStatement?.totals?.loan_interest_assessed)} />
              <DetailValue label="Loan Interest Paid" value={money(focusedStatement?.totals?.loan_interest_repaid)} />
              <DetailValue label="Common Interest" value={money(focusedStatement?.totals?.common_interest)} />
              <DetailValue label="Penalties" value={money(focusedStatement?.totals?.penalties)} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Transaction Detail</h2>
              <Badge text={`${transactions.length} records`} tone="blue" />
            </div>
            <DataTable
              columns={["Date", "Type", "Amount", "Description", "Source", "Action"]}
              rows={statementRows(transactions, setSelectedTransaction)}
              empty={monthLoading ? "Loading statement..." : "No statement transactions found."}
            />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Monthly Snapshots</h2>
              <Badge text={`${snapshots.length} records`} tone="blue" />
            </div>
            <DataTable
              columns={["Month", "Savings", "Loan", "Common Interest", "Penalty", "Compliance"]}
              rows={snapshots.map((snapshot) => [
                snapshot.month_number ? `Month ${snapshot.month_number}` : dateOnly(snapshot.created_at),
                money(snapshot.accumulated_savings || snapshot.closing_savings_balance),
                money(snapshot.closing_loan_balance || snapshot.outstanding_loan_balance),
                money(snapshot.common_interest_due || snapshot.common_interest_balance),
                money(snapshot.penalty_due || snapshot.penalty_balance),
                <Badge text={titleCase(snapshot.borrowing_compliance_status || snapshot.compliance_status)} tone={transactionTone(snapshot.borrowing_compliance_status)} />,
              ])}
              empty="No monthly snapshots found."
            />
          </section>

          </div>

          <Modal
            open={Boolean(selectedTransaction)}
            title="Transaction Detail"
            onClose={() => setSelectedTransaction(null)}
            footer={<Button type="button" variant="secondary" onClick={() => setSelectedTransaction(null)}>Close</Button>}
            size="lg"
          >
            <TransactionDetail transaction={selectedTransaction} />
          </Modal>
        </>
      )}
    </Page>
  );
}
