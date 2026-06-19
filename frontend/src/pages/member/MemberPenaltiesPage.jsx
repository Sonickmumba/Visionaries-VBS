import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, ClipboardList, FileText, Gauge, PiggyBank, Receipt, RefreshCw } from "lucide-react";
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
  MobileHeroCard,
  MobileListCard,
  MobileMetricCard,
  MobileScreenShell,
  Skeleton,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import { chooseActiveMembership, memberDashboardTotals } from "./MemberDashboardPage.jsx";
import "../../styles/member-penalties.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";
const titleCase = (value) => String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

function statusTone(status) {
  if (status === "PAID" || status === "CONVERTED_TO_LOAN") return "green";
  if (status === "PARTIALLY_PAID") return "amber";
  if (status === "WAIVED" || status === "REVERSED") return "gray";
  return "red";
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

export async function loadMemberPenaltyData({ memberApi = api } = {}) {
  const me = await memberApi("/auth/me");
  const activeMembership = chooseActiveMembership(me.cycleMemberships || []);
  if (!activeMembership) {
    return { me, activeMembership: null, statement: null, penalties: [] };
  }

  const [statement, penalties] = await Promise.all([
    memberApi(`/reports/member-statement/${activeMembership.id}`),
    memberApi(`/penalties/member/${activeMembership.id}`),
  ]);

  return {
    me,
    activeMembership,
    statement: statement.data,
    penalties: penalties.data || [],
  };
}

export function memberPenaltySummary(data) {
  const penalties = data?.penalties || [];
  const totals = memberDashboardTotals({ activeMembership: data?.activeMembership, statement: data?.statement });
  return {
    assessed: penalties.reduce((sum, penalty) => sum + Number(penalty.amount_assessed || 0), 0),
    paid: penalties.reduce((sum, penalty) => sum + Number(penalty.amount_paid || 0), 0),
    outstanding: penalties.reduce((sum, penalty) => sum + Number(penalty.outstanding_amount ?? Number(penalty.amount_assessed || 0) - Number(penalty.amount_paid || 0)), 0),
    converted: penalties.filter((penalty) => penalty.status === "CONVERTED_TO_LOAN").reduce((sum, penalty) => sum + Number(penalty.outstanding_amount ?? Number(penalty.amount_assessed || 0) - Number(penalty.amount_paid || 0)), 0),
    totalDue: totals.penaltyDue,
    count: penalties.length,
  };
}

function PenaltyRows({ penalties = [] }) {
  return (
    <DataTable
      columns={["Month", "Type", "Assessed", "Paid", "Outstanding", "Status"]}
      rows={penalties.map((penalty) => [
        penalty.month_number ? `Month ${penalty.month_number}` : dateOnly(penalty.assessed_at),
        penalty.penalty_name || penalty.penalty_code || "-",
        money(penalty.amount_assessed),
        money(penalty.amount_paid),
        money(penalty.outstanding_amount ?? Number(penalty.amount_assessed || 0) - Number(penalty.amount_paid || 0)),
        <Badge text={titleCase(penalty.status)} tone={statusTone(penalty.status)} />,
      ])}
      empty="No penalties found."
    />
  );
}

export function MemberPenaltiesPage({
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
      setData(await loadMemberPenaltyData({ memberApi }));
    } catch (err) {
      setError(err.message || "Member penalties could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData === null) load();
  }, []);

  const activeMembership = data?.activeMembership;
  const penalties = data?.penalties || [];
  const summary = useMemo(() => memberPenaltySummary(data), [data]);
  const bottomNav = (
    <MobileBottomNav
      active="my-penalties"
      items={[
        { id: "member-dashboard", label: "Home", icon: Gauge },
        { id: "my-declaration", label: "Declare", icon: ClipboardList },
        { id: "my-statement", label: "Statement", icon: Receipt },
        { id: "my-loans", label: "Loans", icon: Banknote },
      ]}
      onChange={setPage}
    />
  );

  return (
    <Page
      className="member-penalties-page"
      title="My Penalties"
      actions={(
        <>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>Refresh</Button>
          <Button type="button" icon={Receipt} onClick={() => setPage?.("my-statement")}>View Statement</Button>
          <Button type="button" variant="secondary" onClick={() => setPage?.("member-dashboard")}>Back to Dashboard</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Penalties failed">{error}</Alert> : null}

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !activeMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into a cycle before penalty details can appear." />
      ) : (
        <>
          <div className="member-penalties-mobile">
            <MobileScreenShell bottomNav={bottomNav}>
              <MobileHeader
                eyebrow="Member Penalties"
                title={memberName(data?.me?.member)}
                subtitle={activeMembership.cycle_name || "Active cycle"}
              />

              <MobileHeroCard
                label="Penalty Due"
                value={money(summary.outstanding)}
                note={`${summary.count} penalty records`}
                tone={summary.outstanding > 0 ? "amber" : "green"}
                actionLabel="Statement"
                onAction={() => setPage?.("my-statement")}
              />

              <div className="member-penalties-mobile-metrics" aria-label="Member penalty summary">
                <MobileMetricCard label="Assessed" value={money(summary.assessed)} note="Total penalties" icon={AlertTriangle} tone="red" />
                <MobileMetricCard label="Paid" value={money(summary.paid)} note="Payments posted" icon={Receipt} tone="green" />
                <MobileMetricCard label="Converted" value={money(summary.converted)} note="Moved to loan balance" icon={Banknote} tone="blue" />
                <MobileMetricCard label="Statement Due" value={money(summary.totalDue)} note="Report total" icon={PiggyBank} tone={summary.totalDue > 0 ? "amber" : "green"} />
              </div>

              <section className="member-mobile-section" aria-label="Penalty actions">
                <div className="member-mobile-section-head">
                  <h2>Actions</h2>
                </div>
                <div className="member-penalties-mobile-actions">
                  <MobileActionTile label="Statement" icon={Receipt} onClick={() => setPage?.("my-statement")} />
                  <MobileActionTile label="Declare" icon={ClipboardList} tone="blue" onClick={() => setPage?.("my-declaration")} />
                  <MobileActionTile label="Refresh" icon={RefreshCw} tone="amber" onClick={load} disabled={loading} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Penalty Breakdown</h2>
                  <Badge text={summary.outstanding > 0 ? "Outstanding" : "Clear"} tone={summary.outstanding > 0 ? "red" : "green"} />
                </div>
                <div className="member-penalties-mobile-breakdown">
                  <DetailValue label="Assessed" value={money(summary.assessed)} />
                  <DetailValue label="Paid" value={money(summary.paid)} />
                  <DetailValue label="Outstanding" value={money(summary.outstanding)} />
                  <DetailValue label="Converted To Loan" value={money(summary.converted)} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Penalty Register</h2>
                  <Badge text={`${penalties.length} records`} tone="blue" />
                </div>
                <div className="member-mobile-list">
                  {penalties.length ? penalties.map((penalty) => (
                    <MobileListCard
                      key={penalty.id}
                      title={penalty.penalty_name || penalty.penalty_code || "Penalty"}
                      subtitle={penalty.month_number ? `Month ${penalty.month_number}` : dateOnly(penalty.assessed_at)}
                      meta={`Paid ${money(penalty.amount_paid)}`}
                      value={money(penalty.outstanding_amount ?? Number(penalty.amount_assessed || 0) - Number(penalty.amount_paid || 0))}
                      status={{ label: titleCase(penalty.status), tone: statusTone(penalty.status) }}
                      icon={FileText}
                    />
                  )) : <p className="muted">No penalties found.</p>}
                </div>
              </section>
            </MobileScreenShell>
          </div>

          <div className="member-penalties-desktop">
            <div className="metrics member-penalties-metrics">
              <Card title="Penalty Due" value={money(summary.outstanding)} note={`${summary.count} records`} tone={summary.outstanding > 0 ? "red" : "green"} icon={AlertTriangle} />
              <Card title="Assessed" value={money(summary.assessed)} note="Total penalties" tone="amber" icon={FileText} />
              <Card title="Paid" value={money(summary.paid)} note="Payments posted" icon={Receipt} />
              <Card title="Converted to Loan" value={money(summary.converted)} note="Added to loan balance" tone="blue" icon={Banknote} />
            </div>

            <section className="panel member-penalties-context">
              <div className="panel-head">
                <h2>Penalty Breakdown</h2>
                <Badge text={summary.outstanding > 0 ? "Outstanding" : "Clear"} tone={summary.outstanding > 0 ? "red" : "green"} />
              </div>
              <div className="detail-grid member-penalties-detail-grid">
                <DetailValue label="Assessed" value={money(summary.assessed)} />
                <DetailValue label="Paid" value={money(summary.paid)} />
                <DetailValue label="Outstanding" value={money(summary.outstanding)} />
                <DetailValue label="Statement Due" value={money(summary.totalDue)} />
                <DetailValue label="Converted To Loan" value={money(summary.converted)} />
                <DetailValue label="Penalty Records" value={summary.count} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Penalty Register</h2>
                <Badge text={`${penalties.length} records`} tone="blue" />
              </div>
              <PenaltyRows penalties={penalties} />
            </section>
          </div>
        </>
      )}
    </Page>
  );
}
