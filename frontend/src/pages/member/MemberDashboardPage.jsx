import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, ClipboardList, PiggyBank, RefreshCw, Scale } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Badge, Button, Card, DataTable, EmptyState, Skeleton } from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/member-dashboard.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

function titleCase(value) {
  return String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

function monthScope(financialPosition) {
  return financialPosition?.month_number ? `up to Month ${financialPosition.month_number}` : "latest calculated";
}

export function chooseActiveMembership(memberships = []) {
  return memberships.find((membership) => membership.cycle_status === "ACTIVE")
    || memberships.find((membership) => membership.status === "ACTIVE")
    || memberships[0]
    || null;
}

export async function loadMemberPortalData({ memberApi = api } = {}) {
  const me = await memberApi("/auth/me");
  const activeMembership = chooseActiveMembership(me.cycleMemberships || []);
  if (!activeMembership) {
    return { me, activeMembership: null, statement: null, savings: [], loans: [], penalties: [] };
  }

  const [statement, savings, loans, penalties] = await Promise.all([
    memberApi(`/reports/member-statement/${activeMembership.id}`),
    memberApi(`/savings/member/${activeMembership.id}`),
    memberApi(`/loans/member/${activeMembership.id}`),
    memberApi(`/penalties/member/${activeMembership.id}`),
  ]);

  return {
    me,
    activeMembership,
    statement: statement.data,
    savings: savings.data || [],
    loans: loans.data || [],
    penalties: penalties.data || [],
  };
}

export function memberDashboardTotals(portal) {
  const totals = portal?.statement?.totals || {};

  const borrowed = Number(totals.borrowed || 0);
  const principalRepaid = Number(totals.principal_repaid || 0);
  const loanInterest = Number(totals.loan_interest_assessed || 0);
  const loanInterestRepaid = Number(totals.loan_interest_repaid || 0);
  const penalties = Number(totals.penalties || 0);
  const penaltiesPaid = Number(totals.penalties_paid || 0);
  const commonInterest = Number(totals.common_interest || 0);
  const commonInterestPaid = Number(totals.common_interest_paid || 0);
  const savingsPrincipal = Number(totals.savings_principal || 0);
  const savingsInterest = Number(totals.savings_interest || 0);
  const minimumBorrowing = Number(portal?.activeMembership?.minimum_borrowing_amount || 0);
  const savingsCap = Number(portal?.activeMembership?.savings_cap || 0);
  const financialPosition = portal?.statement?.financialPosition || {};
  const groupPoolScope = monthScope(financialPosition);

  return {
    savingsPrincipal,
    savingsInterest,
    accumulatedSavings: savingsPrincipal + savingsInterest,
    savingsCap,
    savingsCapRemaining: Math.max(0, savingsCap - savingsPrincipal),
    borrowed,
    outstandingLoan: borrowed + loanInterest - principalRepaid - loanInterestRepaid,
    commonInterestDue: commonInterest - commonInterestPaid,
    penaltyDue: penalties - penaltiesPaid,
    borrowingShortfall: Math.max(0, minimumBorrowing - borrowed),
    borrowingStatus: borrowed <= 0 ? "NEVER_BORROWED" : borrowed < minimumBorrowing ? "BORROWED_BELOW_MINIMUM" : "AT_OR_ABOVE_MINIMUM",
    groupPoolScope,
    groupPool: {
      poolContributions: Number(financialPosition.pool_contributions || 0),
      loansIssued: Number(financialPosition.loans_issued || 0),
      unborrowedMoney: Number(financialPosition.unborrowed_money || 0),
      commonInterestPool: Number(financialPosition.common_interest_pool || 0),
      totalAccumulatedSavings: Number(financialPosition.total_accumulated_savings || 0),
    },
  };
}

function statusTone(status) {
  if (status === "AT_OR_ABOVE_MINIMUM") return "green";
  if (status === "BORROWED_BELOW_MINIMUM") return "amber";
  if (status === "NEVER_BORROWED") return "red";
  return "blue";
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

export function MemberDashboardPage({
  setPage,
  memberApi = api,
  initialPortal = null,
}) {
  const [portal, setPortal] = useState(initialPortal);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialPortal === null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setPortal(await loadMemberPortalData({ memberApi }));
    } catch (err) {
      setError(err.message || "Member dashboard could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialPortal === null) load();
  }, []);

  const totals = useMemo(() => memberDashboardTotals(portal), [portal]);
  const transactions = portal?.statement?.transactions || [];
  const penalties = portal?.penalties || [];
  const activeMembership = portal?.activeMembership;
  const hasMembership = Boolean(activeMembership);

  return (
    <Page
      title="My Dashboard"
      actions={(
        <>
          <Button type="button" icon={ClipboardList} onClick={() => setPage?.("my-declaration")}>Submit Declaration</Button>
          <Button type="button" variant="secondary" onClick={() => setPage?.("my-statement")}>View Statement</Button>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>Refresh</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Member dashboard failed">{error}</Alert> : null}

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !hasMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into a cycle before declarations, savings, loans, and statements can appear." />
      ) : (
        <>
          <div className="metrics member-dashboard-metrics">
            <Card title="My Accumulated Savings" value={money(totals.accumulatedSavings)} note={`${money(totals.savingsPrincipal)} principal`} icon={PiggyBank} />
            <Card title="My Loan Balance" value={money(totals.outstandingLoan)} note={`${money(totals.borrowingShortfall)} shortfall`} tone="blue" icon={Banknote} />
            <Card title="Common Interest Due" value={money(totals.commonInterestDue)} note="Assessed less paid" tone="amber" icon={Scale} />
            <Card title="Penalty Due" value={money(totals.penaltyDue)} note="Outstanding penalties" tone={totals.penaltyDue > 0 ? "red" : "green"} icon={AlertTriangle} />
          </div>

          <section className="panel member-pool-panel">
            <div className="panel-head">
              <h2>Group Pool Snapshot {totals.groupPoolScope}</h2>
              <Badge text="Latest Calculated" tone="blue" />
            </div>
            <div className="metrics member-pool-metrics">
              <Card title="Pool Contributions" value={money(totals.groupPool.poolContributions)} note={`Calculated ${totals.groupPoolScope}`} icon={PiggyBank} />
              <Card title="Loans Issued" value={money(totals.groupPool.loansIssued)} note={`Calculated ${totals.groupPoolScope}`} tone="blue" icon={Banknote} />
              <Card title="Unborrowed Money" value={money(totals.groupPool.unborrowedMoney)} note={`Balance ${totals.groupPoolScope}`} tone="amber" icon={Scale} />
              <Card title="CI Pool" value={money(totals.groupPool.commonInterestPool)} note="Latest calculated month" tone="teal" icon={Scale} />
              <Card title="Group Accumulated Savings" value={money(totals.groupPool.totalAccumulatedSavings)} note="All members" icon={PiggyBank} />
            </div>
          </section>

          <section className="panel member-cycle-panel">
            <div className="panel-head">
              <h2>Cycle Position</h2>
              <Badge text={titleCase(totals.borrowingStatus)} tone={statusTone(totals.borrowingStatus)} />
            </div>
            <div className="detail-grid member-dashboard-detail-grid">
              <DetailValue label="Member" value={memberName(portal?.me?.member)} />
              <DetailValue label="Cycle" value={activeMembership?.cycle_name || "-"} />
              <DetailValue label="Savings Cap" value={money(activeMembership?.savings_cap)} />
              <DetailValue label="Cap Remaining" value={money(totals.savingsCapRemaining)} />
              <DetailValue label="Minimum Borrowing" value={money(activeMembership?.minimum_borrowing_amount)} />
              <DetailValue label="Cumulative Borrowed" value={money(totals.borrowed)} />
              <DetailValue label="Borrowing Shortfall" value={money(totals.borrowingShortfall)} />
              <DetailValue label="Cycle Status" value={titleCase(activeMembership?.cycle_status)} />
            </div>
          </section>

          <div className="member-dashboard-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>Recent Transactions</h2>
                <Badge text={`${transactions.length} records`} tone="blue" />
              </div>
              <DataTable
                columns={["Date", "Type", "Amount", "Description"]}
                rows={transactions.slice(0, 6).map((tx) => [
                  dateOnly(tx.transaction_date),
                  <Badge text={titleCase(tx.transaction_type)} />,
                  money(tx.amount),
                  tx.description || "-",
                ])}
                empty="No transactions found."
              />
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Penalty Snapshot</h2>
                <Badge text={`${penalties.length} records`} tone={totals.penaltyDue > 0 ? "red" : "green"} />
              </div>
              <DataTable
                columns={["Type", "Assessed", "Paid", "Outstanding", "Status"]}
                rows={penalties.slice(0, 5).map((penalty) => [
                  penalty.penalty_name || penalty.penalty_type || "-",
                  money(penalty.amount_assessed),
                  money(penalty.amount_paid),
                  money(penalty.outstanding_amount ?? Number(penalty.amount_assessed || 0) - Number(penalty.amount_paid || 0)),
                  <Badge text={titleCase(penalty.status)} />,
                ])}
                empty="No penalties found."
              />
            </section>
          </div>
        </>
      )}
    </Page>
  );
}
