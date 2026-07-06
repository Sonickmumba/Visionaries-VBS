import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, Bell, CheckCircle2, ClipboardList, FileBarChart, FileText, Menu, PiggyBank, Receipt, RefreshCw, Scale } from "lucide-react";
import { api } from "../../api/client.js";
import { BrandMark } from "../../components/BrandMark.jsx";
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
import { memberMobileNavItems } from "./memberMobileNav.js";
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
  return <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">{label}</strong><span className="break-words text-sm font-extrabold text-charcoal">{value}</span></div>;
}

function nextRequiredAction(totals) {
  if (totals.penaltyDue > 0) return "Resolve penalty";
  if (totals.commonInterestDue > 0) return "Declare common interest";
  if (totals.outstandingLoan > 0) return "Track repayment";
  return "Ready for declaration";
}

function declarationDisplay(transactions) {
  return transactions?.length ? "Submitted" : "Open";
}

function MemberMobileHero({ portal, totals, activeMembership, setPage }) {
  const name = memberName(portal?.me?.member);
  return (
    <section className="member-mobile-hero grid min-h-[246px] content-start gap-5 rounded-b-[34px] bg-gradient-to-br from-forest to-emerald px-[18px] pb-[84px] pt-[18px] text-cream shadow-lift" aria-label="Member dashboard summary">
      <div className="member-mobile-hero-head grid grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-3">
        <button type="button" className="member-mobile-menu inline-grid h-[38px] w-[38px] place-items-center rounded-app border border-cream/20 bg-white/10 text-cream" onClick={() => setPage?.("member-more")} aria-label="Open menu">
          <Menu size={18} aria-hidden="true" />
        </button>
        <div>
          <span hidden>Good Morning</span>
          <span>Good morning,</span>
          <h2>{name}</h2>
        </div>
        <button type="button" className="member-mobile-bell inline-grid h-[38px] w-[38px] place-items-center rounded-app border border-cream/20 bg-white/10 text-cream" onClick={() => setPage?.("my-notifications")} aria-label="Notifications">
          <Bell size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="member-mobile-community-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-mobile border border-cream/20 bg-white/10 p-3 backdrop-blur" aria-label="Cycle identity">
        <div className="member-mobile-community-pin grid h-[34px] w-[34px] place-items-center rounded-full bg-white/10 text-cream" aria-hidden="true">
          <PiggyBank size={16} />
        </div>
        <div>
          <strong>Visionaries Savings Group</strong>
          <small>{activeMembership?.cycle_name || "Cycle 2026"}</small>
        </div>
        <Badge text={`${activeMembership?.current_month_label || totals.groupPoolScope}`} tone="green" />
      </div>
    </section>
  );
}

function MemberDashboardMobile({ portal, totals, transactions, penalties, activeMembership, setPage, loading, load }) {
  const bottomNav = (
    <MobileBottomNav
      active="member-dashboard"
      items={memberMobileNavItems}
      onChange={setPage}
    />
  );

  return (
    <div className="member-mobile-dashboard">
      <MobileScreenShell bottomNav={bottomNav}>
        <MemberMobileHero portal={portal} totals={totals} activeMembership={activeMembership} setPage={setPage} />

        <div className="member-mobile-metrics mockup-grid grid grid-cols-2 gap-2.5" aria-label="Member financial summary">
          <MobileMetricCard label="Accumulated Savings" value={money(totals.accumulatedSavings)} note="Total with interest" icon={PiggyBank} tone="green" />
          <MobileMetricCard label="My Loan Balance" value={money(totals.outstandingLoan)} note="Outstanding loan" icon={Banknote} tone="amber" />
          <MobileMetricCard label="Declaration Status" value={declarationDisplay(transactions)} note="Latest activity" icon={CheckCircle2} tone="green" />
          <MobileMetricCard label="Next Required Action" value={nextRequiredAction(totals)} note="Cycle task" icon={Receipt} tone="amber" />
        </div>

        <section className="member-mobile-section" aria-label="Quick actions">
          <div className="member-mobile-section-head flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-charcoal">Quick Actions</h2>
          </div>
          <div className="member-mobile-actions command grid grid-cols-2 gap-2.5">
            <MobileActionTile label="Make Declaration" icon={ClipboardList} onClick={() => setPage?.("my-declaration")} />
            <MobileActionTile label="Request Loan" icon={Banknote} tone="blue" onClick={() => setPage?.("my-declaration")} />
            <MobileActionTile label="My Statement" icon={Receipt} tone="amber" onClick={() => setPage?.("my-statement")} />
            <MobileActionTile label="View Reports" icon={FileBarChart} tone="purple" onClick={() => setPage?.("my-reports")} />
          </div>
        </section>

        <section className="member-mobile-section">
          <div className="member-mobile-section-head flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-charcoal">Recent Activity</h2>
            <button type="button" className="member-mobile-text-link" onClick={() => setPage?.("my-statement")}>View All</button>
          </div>
          <div className="member-mobile-list grid gap-2.5">
            {transactions.slice(0, 4).length ? transactions.slice(0, 4).map((tx, index) => (
              <MobileListCard
                key={`${tx.transaction_date}-${tx.transaction_type}-${index}`}
                title={titleCase(tx.transaction_type)}
                subtitle={tx.description || dateOnly(tx.transaction_date)}
                meta={dateOnly(tx.transaction_date)}
                value={money(tx.amount)}
                icon={FileText}
              />
            )) : <p className="muted">No recent activity found.</p>}
          </div>
        </section>

        <section className="member-mobile-section member-mobile-secondary" aria-label={`Group Pool Snapshot ${totals.groupPoolScope}`}>
          <div className="member-mobile-section-head">
            <h2>Group Pool Snapshot {totals.groupPoolScope}</h2>
            <Badge text="Latest Calculated" tone="blue" />
          </div>
          <div className="member-mobile-pool">
            <MobileMetricCard label="Pool Contributions" value={money(totals.groupPool.poolContributions)} note={totals.groupPoolScope} icon={PiggyBank} />
            <MobileMetricCard label="Loans Issued" value={money(totals.groupPool.loansIssued)} note={totals.groupPoolScope} icon={Banknote} tone="blue" />
            <MobileMetricCard label="Unborrowed Money" value={money(totals.groupPool.unborrowedMoney)} note="Carried-forward pool" icon={Scale} tone="amber" />
            <MobileMetricCard label="CI Pool" value={money(totals.groupPool.commonInterestPool)} note="Common interest charge" icon={Scale} tone="purple" />
            <MobileMetricCard label="Group Accumulated Savings" value={money(totals.groupPool.totalAccumulatedSavings)} note="All members" icon={PiggyBank} />
          </div>
        </section>

        <section className="member-mobile-section member-mobile-secondary">
          <div className="member-mobile-section-head">
            <h2>Cycle Position</h2>
            <Badge text={titleCase(totals.borrowingStatus)} tone={statusTone(totals.borrowingStatus)} />
          </div>
          <div className="member-mobile-position">
            <DetailValue label="Minimum Borrowing" value={money(activeMembership?.minimum_borrowing_amount)} />
            <DetailValue label="Cumulative Borrowed" value={money(totals.borrowed)} />
            <DetailValue label="Borrowing Shortfall" value={money(totals.borrowingShortfall)} />
            <DetailValue label="Cycle Status" value={titleCase(activeMembership?.cycle_status)} />
          </div>
        </section>

        <section className="member-mobile-section member-mobile-secondary">
          <div className="member-mobile-section-head">
            <h2>Penalty Snapshot</h2>
            <Badge text={`${penalties.length} records`} tone={totals.penaltyDue > 0 ? "red" : "green"} />
          </div>
          <div className="member-mobile-list">
            {penalties.slice(0, 3).length ? penalties.slice(0, 3).map((penalty, index) => (
              <MobileListCard
                key={`${penalty.penalty_name || penalty.penalty_type}-${index}`}
                title={penalty.penalty_name || penalty.penalty_type || "Penalty"}
                subtitle={titleCase(penalty.status)}
                value={money(penalty.outstanding_amount ?? Number(penalty.amount_assessed || 0) - Number(penalty.amount_paid || 0))}
                status={{ label: titleCase(penalty.status), tone: totals.penaltyDue > 0 ? "red" : "green" }}
                icon={AlertTriangle}
              />
            )) : <p className="muted">No penalties found.</p>}
          </div>
        </section>
      </MobileScreenShell>
    </div>
  );
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
      className="member-dashboard-page grid gap-0"
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

      {loading ? <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={8} /></section> : !hasMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into a cycle before declarations, savings, loans, and statements can appear." />
      ) : (
        <>
          <MemberDashboardMobile
            portal={portal}
            totals={totals}
            transactions={transactions}
            penalties={penalties}
            activeMembership={activeMembership}
            setPage={setPage}
            loading={loading}
            load={load}
          />

          <div className="member-desktop-dashboard">
            <section className="member-dashboard-hero mb-5 grid items-end gap-4 rounded-mobile bg-gradient-to-br from-emerald to-forest p-5 text-cream shadow-lift lg:grid-cols-[minmax(0,1fr)_minmax(220px,auto)]" aria-label="Member dashboard welcome">
              <div>
                <BrandMark size="sm" showText className="member-dashboard-brand" />
                <span className="text-xs font-black uppercase text-cream">Transparent member access</span>
                <h2 className="my-1 text-[27px] font-extrabold leading-tight text-cream">Welcome back, {memberName(portal?.me?.member)}</h2>
                <p className="m-0 text-sm font-extrabold text-cream/90">{activeMembership?.cycle_name || "Active cycle"} · {titleCase(totals.borrowingStatus)}</p>
              </div>
              <div className="member-dashboard-hero-value grid gap-1 rounded-mobile border border-cream/20 bg-white/10 p-4 backdrop-blur">
                <span className="text-xs font-black uppercase text-cream">My Accumulated Savings</span>
                <strong className="break-words text-[26px] font-extrabold leading-tight text-cream">{money(totals.accumulatedSavings)}</strong>
                <small className="font-extrabold text-cream/85">{money(totals.savingsPrincipal)} savings principal</small>
              </div>
            </section>

            <div className="metrics member-dashboard-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card title="My Accumulated Savings" value={money(totals.accumulatedSavings)} note={`${money(totals.savingsPrincipal)} principal`} icon={PiggyBank} />
              <Card title="My Loan Balance" value={money(totals.outstandingLoan)} note={`${money(totals.borrowingShortfall)} shortfall`} tone="blue" icon={Banknote} />
              <Card title="Common Interest Due" value={money(totals.commonInterestDue)} note="Assessed less paid" tone="amber" icon={Scale} />
              <Card title="Penalty Due" value={money(totals.penaltyDue)} note="Outstanding penalties" tone={totals.penaltyDue > 0 ? "red" : "green"} icon={AlertTriangle} />
            </div>

          <section className="panel member-pool-panel mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
            <div className="panel-head mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-charcoal">Group Pool Snapshot {totals.groupPoolScope}</h2>
              <Badge text="Latest Calculated" tone="blue" />
            </div>
            <div className="metrics member-pool-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Card title="Pool Contributions" value={money(totals.groupPool.poolContributions)} note={`Calculated ${totals.groupPoolScope}`} icon={PiggyBank} />
              <Card title="Loans Issued" value={money(totals.groupPool.loansIssued)} note={`Calculated ${totals.groupPoolScope}`} tone="blue" icon={Banknote} />
              <Card title="Unborrowed Money" value={money(totals.groupPool.unborrowedMoney)} note={`Balance ${totals.groupPoolScope}`} tone="amber" icon={Scale} />
              <Card title="CI Pool" value={money(totals.groupPool.commonInterestPool)} note="Latest calculated month" tone="teal" icon={Scale} />
              <Card title="Group Accumulated Savings" value={money(totals.groupPool.totalAccumulatedSavings)} note="All members" icon={PiggyBank} />
            </div>
          </section>

          <section className="panel member-cycle-panel mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
            <div className="panel-head mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-charcoal">Cycle Position</h2>
              <Badge text={titleCase(totals.borrowingStatus)} tone={statusTone(totals.borrowingStatus)} />
            </div>
            <div className="detail-grid member-dashboard-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

          <div className="member-dashboard-grid grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-charcoal">Recent Transactions</h2>
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

            <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-charcoal">Penalty Snapshot</h2>
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
          </div>
        </>
      )}
    </Page>
  );
}
