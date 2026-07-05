import React, { useEffect, useMemo, useState } from "react";
import { Banknote, ClipboardList, FileText, Gauge, PiggyBank, Receipt, RefreshCw, Scale } from "lucide-react";
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
  MobileHeader,
  MobileListCard,
  MobileMetricCard,
  MobileScreenShell,
  Skeleton,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import { chooseActiveMembership, memberDashboardTotals } from "./MemberDashboardPage.jsx";
import { memberMobileNavItems } from "./memberMobileNav.js";
import "../../styles/member-savings.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateTime = (value) => value ? String(value).slice(0, 19).replace("T", " ") : "-";
const titleCase = (value) => String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

function transactionTone(type) {
  const value = String(type || "");
  if (value.includes("INTEREST")) return "amber";
  if (value.includes("SOCIAL")) return "blue";
  if (value.includes("MEMBERSHIP")) return "purple";
  if (value.includes("SAVINGS")) return "green";
  return "gray";
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

function MemberSavingsMobileHero({ summary, activeMembership, setPage }) {
  const capPercent = summary.savingsCap > 0 ? Math.min(100, Math.round((summary.savingsPrincipal / summary.savingsCap) * 100)) : 0;
  return (
    <section className="member-savings-hero" aria-label="Savings account summary">
      <div className="member-savings-hero-head">
        <div>
          <span>{activeMembership?.cycle_name || "Active cycle"}</span>
          <h2>My Savings</h2>
        </div>
        <Badge text={titleCase(activeMembership?.cycle_status)} tone="green" />
      </div>

      <div className="member-savings-hero-main">
        <span>Accumulated Savings</span>
        <strong>{money(summary.accumulatedSavings)}</strong>
        <small>Principal Saved: {money(summary.savingsPrincipal)} of {money(summary.savingsCap)} cap</small>
        <div className="member-savings-progress" aria-label={`Principal savings cap progress ${capPercent}%`}>
          <span style={{ width: `${capPercent}%` }} />
        </div>
        <em>{capPercent}% of principal cap</em>
      </div>

      <div className="member-savings-progress-stats" aria-label="Savings progress details">
        <DetailValue label="Principal" value={money(summary.savingsPrincipal)} />
        <DetailValue label="Interest" value={money(summary.savingsInterest)} />
        <DetailValue label="Remaining" value={money(summary.savingsCapRemaining)} />
      </div>

      <div className="member-savings-hero-actions">
        <Button type="button" size="sm" onClick={() => setPage?.("my-declaration")}>Make Declaration</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setPage?.("my-statement")}>Statement</Button>
      </div>

      <div className="member-savings-hero-strip">
        <DetailValue label="Interest Earned" value={money(summary.savingsInterest)} />
        <DetailValue label="Cap Remaining" value={money(summary.savingsCapRemaining)} />
      </div>
    </section>
  );
}

export async function loadMemberSavingsData({ memberApi = api } = {}) {
  const me = await memberApi("/auth/me");
  const activeMembership = chooseActiveMembership(me.cycleMemberships || []);
  if (!activeMembership) {
    return { me, activeMembership: null, statement: null, savings: { data: [], totals: {}, member: null }, contributions: [] };
  }

  const [statement, savings, contributions] = await Promise.all([
    memberApi(`/reports/member-statement/${activeMembership.id}`),
    memberApi(`/savings/member/${activeMembership.id}`),
    memberApi(`/savings/contributions/member/${activeMembership.id}`).catch(() => ({ data: [] })),
  ]);

  return {
    me,
    activeMembership,
    statement: statement.data,
    savings,
    contributions: contributions.data || [],
  };
}

export function memberSavingsSummary(data) {
  const totals = data?.savings?.totals || {};
  const statementTotals = memberDashboardTotals({ activeMembership: data?.activeMembership, statement: data?.statement });
  const savingsPrincipal = Number(totals.savings_principal ?? statementTotals.savingsPrincipal ?? 0);
  const savingsInterest = Number(totals.savings_interest ?? statementTotals.savingsInterest ?? 0);
  const savingsCap = Number(totals.savings_cap ?? data?.activeMembership?.savings_cap ?? 0);
  return {
    savingsPrincipal,
    savingsInterest,
    accumulatedSavings: savingsPrincipal + savingsInterest,
    savingsCap,
    savingsCapRemaining: Number(totals.savings_cap_remaining ?? Math.max(0, savingsCap - savingsPrincipal)),
    socialFundPaid: Number(totals.social_fund_paid || 0),
    membershipFeePaid: Number(totals.membership_fee_paid || 0),
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
      empty="No savings ledger transactions found."
    />
  );
}

export function MemberSavingsPage({
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
      setData(await loadMemberSavingsData({ memberApi }));
    } catch (err) {
      setError(err.message || "Member savings could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData === null) load();
  }, []);

  const activeMembership = data?.activeMembership;
  const summary = useMemo(() => memberSavingsSummary(data), [data]);
  const entries = data?.savings?.data || [];
  const contributions = data?.contributions || [];
  const bottomNav = (
    <MobileBottomNav
      active="my-savings"
      items={memberMobileNavItems}
      onChange={setPage}
    />
  );

  return (
    <Page
      className="member-savings-page"
      title="My Savings"
      actions={(
        <>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>Refresh</Button>
          <Button type="button" icon={ClipboardList} onClick={() => setPage?.("my-declaration")}>Declare Savings</Button>
          <Button type="button" variant="secondary" onClick={() => setPage?.("member-dashboard")}>Back to Dashboard</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Savings failed">{error}</Alert> : null}

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !activeMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into a cycle before savings details can appear." />
      ) : (
        <>
          <div className="member-savings-mobile">
            <MobileScreenShell bottomNav={bottomNav}>
              <MobileHeader
                eyebrow="Member Savings"
                title={memberName(data?.me?.member || data?.savings?.member)}
                subtitle={activeMembership.cycle_name || "Active cycle"}
              />

              <MemberSavingsMobileHero
                summary={summary}
                activeMembership={activeMembership}
                setPage={setPage}
              />

              <div className="member-savings-mobile-metrics" aria-label="Member savings summary">
                <MobileMetricCard label="Savings Interest" value={money(summary.savingsInterest)} note="Compounded monthly" icon={Receipt} tone="amber" />
                <MobileMetricCard label="Cap Remaining" value={money(summary.savingsCapRemaining)} note={`${money(summary.savingsCap)} cycle cap`} icon={Scale} tone="blue" />
                <MobileMetricCard label="Social Fund" value={money(summary.socialFundPaid)} note="Once per cycle" icon={PiggyBank} />
                <MobileMetricCard label="Membership Fee" value={money(summary.membershipFeePaid)} note="Once per cycle" icon={FileText} tone="purple" />
              </div>

              <section className="member-mobile-section" aria-label="Savings actions">
                <div className="member-mobile-section-head">
                  <h2>Actions</h2>
                </div>
                <div className="member-savings-mobile-actions">
                  <MobileActionTile label="Declare" icon={ClipboardList} onClick={() => setPage?.("my-declaration")} />
                  <MobileActionTile label="Statement" icon={Receipt} tone="blue" onClick={() => setPage?.("my-statement")} />
                  <MobileActionTile label="Refresh" icon={RefreshCw} tone="amber" onClick={load} disabled={loading} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Savings Breakdown</h2>
                  <Badge text={`Remaining ${money(summary.savingsCapRemaining)}`} tone="blue" />
                </div>
                <div className="member-savings-mobile-breakdown">
                  <DetailValue label="Principal" value={money(summary.savingsPrincipal)} />
                  <DetailValue label="Interest" value={money(summary.savingsInterest)} />
                  <DetailValue label="Accumulated" value={money(summary.accumulatedSavings)} />
                  <DetailValue label="Savings Cap" value={money(summary.savingsCap)} />
                  <DetailValue label="Social Fund" value={money(summary.socialFundPaid)} />
                  <DetailValue label="Membership Fee" value={money(summary.membershipFeePaid)} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Savings Ledger</h2>
                  <Badge text={`${entries.length} records`} tone="blue" />
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
                  )) : <p className="muted">No savings ledger transactions found.</p>}
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>One-Time Contributions</h2>
                  <Badge text={`${contributions.length} records`} tone="blue" />
                </div>
                <div className="member-mobile-list">
                  {contributions.length ? contributions.map((contribution) => (
                    <MobileListCard
                      key={contribution.id}
                      title={titleCase(contribution.contribution_type)}
                      subtitle={dateTime(contribution.paid_at || contribution.posted_at)}
                      value={money(contribution.amount)}
                      status={{ label: titleCase(contribution.status || contribution.transaction_type || "Paid"), tone: "green" }}
                      icon={Receipt}
                    />
                  )) : <p className="muted">No one-time contributions found.</p>}
                </div>
              </section>
            </MobileScreenShell>
          </div>

          <div className="member-savings-desktop">
            <div className="metrics member-savings-metrics">
              <Card title="My Accumulated Savings" value={money(summary.accumulatedSavings)} note={`${money(summary.savingsPrincipal)} principal`} icon={PiggyBank} />
              <Card title="Savings Interest" value={money(summary.savingsInterest)} note="Compounded monthly" tone="amber" icon={Receipt} />
              <Card title="Cap Remaining" value={money(summary.savingsCapRemaining)} note={`${money(summary.savingsCap)} cycle cap`} tone="blue" icon={Scale} />
              <Card title="One-Time Contributions" value={money(summary.socialFundPaid + summary.membershipFeePaid)} note="Social fund + membership" tone="teal" icon={FileText} />
            </div>

            <section className="panel member-savings-context">
              <div className="panel-head">
                <h2>Savings Breakdown</h2>
                <Badge text={`Remaining ${money(summary.savingsCapRemaining)}`} tone="blue" />
              </div>
              <div className="detail-grid member-savings-detail-grid">
                <DetailValue label="Principal" value={money(summary.savingsPrincipal)} />
                <DetailValue label="Interest" value={money(summary.savingsInterest)} />
                <DetailValue label="Accumulated Savings" value={money(summary.accumulatedSavings)} />
                <DetailValue label="Savings Cap" value={money(summary.savingsCap)} />
                <DetailValue label="Social Fund" value={money(summary.socialFundPaid)} />
                <DetailValue label="Membership Fee" value={money(summary.membershipFeePaid)} />
                <DetailValue label="Ledger Entries" value={entries.length} />
                <DetailValue label="Contribution Records" value={contributions.length} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Savings Ledger</h2>
                <Badge text={`${entries.length} records`} tone="blue" />
              </div>
              <LedgerRows entries={entries} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>One-Time Contributions</h2>
                <Badge text={`${contributions.length} records`} tone="blue" />
              </div>
              <DataTable
                columns={["Date", "Type", "Amount", "Status"]}
                rows={contributions.map((contribution) => [
                  dateTime(contribution.paid_at || contribution.posted_at),
                  titleCase(contribution.contribution_type),
                  money(contribution.amount),
                  <Badge text={titleCase(contribution.status || contribution.transaction_type || "Paid")} tone="green" />,
                ])}
                empty="No one-time contributions found."
              />
            </section>
          </div>
        </>
      )}
    </Page>
  );
}
