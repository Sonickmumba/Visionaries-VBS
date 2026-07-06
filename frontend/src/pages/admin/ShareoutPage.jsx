import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, HandCoins, PiggyBank, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Modal,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/shareout.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const titleCase = (value) => String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

function memberName(row) {
  return `${row?.first_name || ""} ${row?.last_name || ""}`.trim() || "Member";
}

function initials(row) {
  return memberName(row).split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
}

function ShareoutHero({ shareout, surplus, isMember }) {
  const status = shareout?.shareout?.status || "DRAFT";
  return (
    <section className="shareout-hero rounded-app bg-gradient-to-br from-forest to-emerald p-5 text-cream shadow-lift md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-4">
      <div>
        <span className="text-xs font-extrabold uppercase text-cream/85">{isMember ? "My End-of-Cycle Shareout" : "Cycle Shareout"}</span>
        <h2 className="my-1.5 text-2xl font-black leading-tight text-cream">{surplus?.cycle?.name || shareout?.cycle?.name || "Visionaries Village Banking"}</h2>
        <p className="m-0 max-w-3xl text-sm font-semibold text-cream/85">Group surplus from social fund, membership fees, and penalties compounds monthly at 15% and is shared equally at cycle end.</p>
      </div>
      <div className="shareout-hero-stat mt-4 min-w-[180px] rounded-app border border-cream/20 bg-cream/15 p-3 md:mt-0">
        <span className="text-xs font-extrabold uppercase text-cream/85">Status</span>
        <strong className="my-1 block text-xl font-black text-cream">{titleCase(status)}</strong>
        <small className="text-xs font-bold text-cream/85">{money(shareout?.shareout?.total_net_shareout)} net shareout</small>
      </div>
    </section>
  );
}

function SurplusCards({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="shareout-mobile-cards" aria-label="Monthly surplus cards">
      {rows.map((row) => (
        <article key={row.cycle_month_id || row.month_number} className="shareout-card grid gap-3 rounded-app border border-mist bg-cream p-3.5 shadow-soft">
          <div className="shareout-card-head grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
            <div className="shareout-avatar grid h-[42px] w-[42px] place-items-center rounded-full bg-mist text-sm font-black text-emerald">M{row.month_number}</div>
            <div>
              <strong className="block text-sm font-black text-charcoal">Month {row.month_number}</strong>
              <span className="text-xs font-semibold text-charcoal/75">{titleCase(row.month_status || "calculated")}</span>
            </div>
            <Badge text="15%" tone="green" />
          </div>
          <div className="shareout-card-values grid grid-cols-2 gap-2.5">
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Opening</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(row.opening_balance ?? row.openingBalance)}</strong></div>
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Social</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(row.social_fund_collected ?? row.socialFundCollected)}</strong></div>
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Membership</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(row.membership_collected ?? row.membershipCollected)}</strong></div>
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Penalties</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(row.penalties_collected ?? row.penaltiesCollected)}</strong></div>
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Interest</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(row.interest_earned ?? row.interestEarned)}</strong></div>
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Closing</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(row.closing_balance ?? row.closingBalance)}</strong></div>
          </div>
        </article>
      ))}
    </div>
  );
}

function MemberCards({ members, onSelect }) {
  if (!members.length) return null;
  return (
    <div className="shareout-mobile-cards" aria-label="Member shareout cards">
      {members.map((member) => (
        <article key={member.id || member.cycle_member_id} className="shareout-card grid gap-3 rounded-app border border-mist bg-cream p-3.5 shadow-soft">
          <div className="shareout-card-head grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
            <div className="shareout-avatar grid h-[42px] w-[42px] place-items-center rounded-full bg-mist text-sm font-black text-emerald">{initials(member)}</div>
            <div>
              <strong className="block text-sm font-black text-charcoal">{memberName(member)}</strong>
              <span className="text-xs font-semibold text-charcoal/75">{member.member_code || "Cycle member"}</span>
            </div>
            <Badge text={titleCase(member.status || "Preview")} tone="blue" />
          </div>
          <div className="shareout-card-values grid grid-cols-2 gap-2.5">
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Savings</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(member.accumulated_savings ?? member.accumulatedSavings)}</strong></div>
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Surplus</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(member.group_surplus_share ?? member.groupSurplusShare)}</strong></div>
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Deductions</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(member.total_deductions ?? member.totalDeductions)}</strong></div>
            <div className="rounded-app bg-mist/60 p-2.5"><span className="text-xs font-bold text-charcoal/70">Net</span><strong className="mt-1 block text-sm font-black text-charcoal">{money(member.net_shareout ?? member.netShareout)}</strong></div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(member)}>View Details</Button>
        </article>
      ))}
    </div>
  );
}

function MemberDetail({ member }) {
  if (!member) return null;
  const lineItems = member.lineItems || member.line_items || [];
  return (
    <section className="shareout-detail grid gap-3.5">
      <div className="shareout-detail-hero grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
        <div className="shareout-avatar grid h-[42px] w-[42px] place-items-center rounded-full bg-mist text-sm font-black text-emerald">{initials(member)}</div>
        <div>
          <span className="text-xs font-bold text-charcoal/70">Shareout Detail</span>
          <h2 className="m-0 text-xl font-black text-charcoal">{memberName(member)}</h2>
          <p className="m-0 text-sm font-semibold text-charcoal/75">Every amount is stored as a line item for auditability.</p>
        </div>
        <Badge text={titleCase(member.status || "Preview")} tone="blue" />
      </div>
      <div className="shareout-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Accumulated savings</strong><span className="mt-1 block text-sm font-black text-charcoal">{money(member.accumulated_savings ?? member.accumulatedSavings)}</span></div>
        <div className="rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Group surplus share</strong><span className="mt-1 block text-sm font-black text-charcoal">{money(member.group_surplus_share ?? member.groupSurplusShare)}</span></div>
        <div className="rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Outstanding loan</strong><span className="mt-1 block text-sm font-black text-charcoal">{money(member.outstanding_loan_balance ?? member.outstandingLoanBalance)}</span></div>
        <div className="rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Unpaid penalties</strong><span className="mt-1 block text-sm font-black text-charcoal">{money(member.unpaid_penalties ?? member.unpaidPenalties)}</span></div>
        <div className="rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Unpaid common interest</strong><span className="mt-1 block text-sm font-black text-charcoal">{money(member.unpaid_common_interest ?? member.unpaidCommonInterest)}</span></div>
        <div className="rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Net shareout</strong><span className="mt-1 block text-sm font-black text-charcoal">{money(member.net_shareout ?? member.netShareout)}</span></div>
      </div>
      <DataTable
        columns={["Line Item", "Amount"]}
        rows={lineItems.map((item) => [item.label, money(item.amount)])}
        empty="No line items found."
      />
    </section>
  );
}

export function ShareoutPage({ readOnly = false, title = "Shareout", apiClient = api }) {
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState("");
  const [tab, setTab] = useState("surplus");
  const [surplus, setSurplus] = useState(null);
  const [shareout, setShareout] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeCycleId = cycleId || cycles.find((cycle) => cycle.status === "ACTIVE")?.id || cycles[0]?.id || "";
  const isMember = readOnly;

  async function loadCycles() {
    if (readOnly) return;
    const response = await apiClient("/cycles");
    const rows = response.data || [];
    setCycles(rows);
    const selected = rows.find((cycle) => cycle.status === "ACTIVE") || rows[0];
    if (selected && !cycleId) setCycleId(selected.id);
  }

  async function loadData(id = activeCycleId) {
    setLoading(true);
    setError("");
    try {
      const query = id ? `?cycleId=${id}` : "";
      const [surplusResponse, shareoutResponse] = await Promise.all([
        apiClient(`/shareout/surplus${query}`),
        apiClient(`/shareout${query}`),
      ]);
      setSurplus(surplusResponse.data || null);
      setShareout(shareoutResponse.data || null);
    } catch (err) {
      setError(err.message || "Shareout data could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function generatePreview() {
    if (!activeCycleId) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiClient("/shareout/preview", {
        method: "POST",
        body: { cycleId: activeCycleId },
      });
      setShareout(response.data || null);
      setSurplus({ cycle: response.data?.cycle, rows: response.data?.surplusRows || [], totals: response.data?.surplusTotals || {} });
      setSuccess("Shareout preview generated.");
      setTab("members");
    } catch (err) {
      setError(err.message || "Shareout preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function postFinalShareout() {
    if (!activeCycleId) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await apiClient("/shareout/post", {
        method: "POST",
        body: { cycleId: activeCycleId, notes },
      });
      setShareout(response.data || null);
      setSuccess("Shareout posted and cycle closed.");
      setTab("members");
    } catch (err) {
      setError(err.message || "Shareout posting failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadCycles().catch((err) => setError(err.message || "Cycles could not load."));
  }, []);

  useEffect(() => {
    loadData(activeCycleId).catch(() => {});
  }, [activeCycleId]);

  const surplusRows = useMemo(() => surplus?.rows || [], [surplus]);
  const members = useMemo(() => shareout?.members || [], [shareout]);
  const warnings = shareout?.readiness?.warnings || shareout?.shareout?.warnings || [];
  const summary = shareout?.shareout || {};

  return (
    <Page
      title={title}
      className="shareout-page grid gap-4"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} variant="secondary" onClick={() => loadData(activeCycleId)} loading={loading}>Refresh</Button>
          {!readOnly ? <Button type="button" icon={Scale} onClick={generatePreview} loading={busy}>Generate Preview</Button> : null}
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Shareout failed">{error}</Alert> : null}
      {success ? <Alert tone="success" title="Shareout updated">{success}</Alert> : null}

      <ShareoutHero shareout={shareout} surplus={surplus} isMember={isMember} />

      <div className="admin-mobile-action-row shareout-mobile-actions mobile-only">
        <Button type="button" icon={RefreshCw} variant="secondary" onClick={() => loadData(activeCycleId)} loading={loading}>Refresh</Button>
        {!readOnly ? <Button type="button" icon={Scale} onClick={generatePreview} loading={busy}>Preview</Button> : null}
      </div>

      {!readOnly ? (
        <section className="panel shareout-context max-w-[420px] rounded-app border border-mist bg-cream p-4 shadow-soft">
          <Select
            label="Cycle"
            value={activeCycleId}
            onChange={setCycleId}
            placeholder="Select cycle"
            options={cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.name} - ${titleCase(cycle.status)}` }))}
          />
        </section>
      ) : null}

      <div className="metrics shareout-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Group Surplus" value={money(shareout?.surplusTotals?.closingBalance ?? summary.total_group_surplus ?? surplus?.totals?.closingBalance)} note="Final accumulated fund" icon={HandCoins} />
        <Card title="Accumulated Savings" value={money(summary.total_accumulated_savings)} note="Member savings total" icon={PiggyBank} />
        <Card title="Total Deductions" value={money(summary.total_deductions)} note="Loans and unpaid charges" tone="amber" icon={ShieldCheck} />
        <Card title="Net Shareout" value={money(summary.total_net_shareout)} note={`${summary.eligible_member_count || members.length} active members`} tone="blue" icon={CheckCircle2} />
      </div>

      {warnings.length ? (
        <Alert tone="warning" title="Readiness checks">
          {warnings.map((warning) => <div key={warning}>{warning}</div>)}
        </Alert>
      ) : null}

      <Tabs
        active={tab}
        onChange={setTab}
        label="Shareout sections"
        tabs={[
          { id: "surplus", label: "Surplus Fund" },
          { id: "members", label: "Member Shareout" },
          { id: "post", label: readOnly ? "Status" : "Post Shareout" },
        ]}
      />

      {loading ? <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={8} /></section> : null}

      {!loading && tab === "surplus" ? (
        <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
          <div className="panel-head mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-extrabold text-charcoal">Monthly Surplus Accumulation</h2>
            <Badge text="15% compound monthly" tone="green" />
          </div>
          {surplusRows.length ? (
            <>
              <SurplusCards rows={surplusRows} />
              <div className="shareout-desktop-table">
                <DataTable
                  columns={["Month", "Opening", "Social Fund", "Membership", "Penalties", "Interest", "Closing"]}
                  rows={surplusRows.map((row) => [
                    `Month ${row.month_number}`,
                    money(row.opening_balance ?? row.openingBalance),
                    money(row.social_fund_collected ?? row.socialFundCollected),
                    money(row.membership_collected ?? row.membershipCollected),
                    money(row.penalties_collected ?? row.penaltiesCollected),
                    money(row.interest_earned ?? row.interestEarned),
                    money(row.closing_balance ?? row.closingBalance),
                  ])}
                />
              </div>
            </>
          ) : <EmptyState title="No surplus schedule" message="Generate a preview after monthly closing data exists." />}
        </section>
      ) : null}

      {!loading && tab === "members" ? (
        <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
          <div className="panel-head mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-extrabold text-charcoal">Member Shareout</h2>
            <Badge text={titleCase(summary.status || "Not generated")} tone="blue" />
          </div>
          {members.length ? (
            <>
              <MemberCards members={members} onSelect={setSelectedMember} />
              <div className="shareout-desktop-table">
                <DataTable
                  columns={["Member", "Accumulated Savings", "Surplus Share", "Loan Balance", "Unpaid Charges", "Net Shareout", "Action"]}
                  rows={members.map((member) => [
                    <><strong>{memberName(member)}</strong><br /><span className="muted">{member.member_code}</span></>,
                    money(member.accumulated_savings ?? member.accumulatedSavings),
                    money(member.group_surplus_share ?? member.groupSurplusShare),
                    money(member.outstanding_loan_balance ?? member.outstandingLoanBalance),
                    money(Number(member.unpaid_penalties ?? member.unpaidPenalties ?? 0) + Number(member.unpaid_common_interest ?? member.unpaidCommonInterest ?? 0)),
                    money(member.net_shareout ?? member.netShareout),
                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedMember(member)}>Details</Button>,
                  ])}
                />
              </div>
            </>
          ) : <EmptyState title="No shareout preview" message={readOnly ? "Shareout has not been posted yet." : "Generate a preview to calculate each member's shareout."} />}
        </section>
      ) : null}

      {!loading && tab === "post" ? (
        <section className="panel shareout-post-panel max-w-[760px] rounded-app border border-mist bg-cream p-4 shadow-soft">
          <div className="panel-head mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-extrabold text-charcoal">{readOnly ? "Shareout Status" : "Post Final Shareout"}</h2>
            <Badge text={titleCase(summary.status || "Not generated")} tone={summary.status === "POSTED" ? "green" : "amber"} />
          </div>
          {readOnly ? (
            <p className="muted">Members can review the posted shareout and monthly surplus fund. Posting remains an administrator-only action.</p>
          ) : (
            <>
              <Textarea label="Posting notes" value={notes} onChange={setNotes} rows={3} placeholder="Reason or meeting approval reference" />
              <div className="button-row">
                <Button type="button" icon={CheckCircle2} onClick={postFinalShareout} loading={busy} disabled={!members.length || summary.status === "POSTED" || warnings.length > 0}>
                  Post Shareout and Close Cycle
                </Button>
              </div>
              <p className="muted">Posting freezes the shareout, creates shareout ledger postings, and marks the cycle closed.</p>
            </>
          )}
        </section>
      ) : null}

      <Modal open={Boolean(selectedMember)} title="Shareout Details" size="lg" onClose={() => setSelectedMember(null)}>
        <MemberDetail member={selectedMember} />
      </Modal>
    </Page>
  );
}
