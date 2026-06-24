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
    <section className="shareout-hero">
      <div>
        <span>{isMember ? "My End-of-Cycle Shareout" : "Cycle Shareout"}</span>
        <h2>{surplus?.cycle?.name || shareout?.cycle?.name || "Visionaries Village Banking"}</h2>
        <p>Group surplus from social fund, membership fees, and penalties compounds monthly at 15% and is shared equally at cycle end.</p>
      </div>
      <div className="shareout-hero-stat">
        <span>Status</span>
        <strong>{titleCase(status)}</strong>
        <small>{money(shareout?.shareout?.total_net_shareout)} net shareout</small>
      </div>
    </section>
  );
}

function SurplusCards({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="shareout-mobile-cards" aria-label="Monthly surplus cards">
      {rows.map((row) => (
        <article key={row.cycle_month_id || row.month_number} className="shareout-card">
          <div className="shareout-card-head">
            <div className="shareout-avatar">M{row.month_number}</div>
            <div>
              <strong>Month {row.month_number}</strong>
              <span>{titleCase(row.month_status || "calculated")}</span>
            </div>
            <Badge text="15%" tone="green" />
          </div>
          <div className="shareout-card-values">
            <div><span>Opening</span><strong>{money(row.opening_balance ?? row.openingBalance)}</strong></div>
            <div><span>Social</span><strong>{money(row.social_fund_collected ?? row.socialFundCollected)}</strong></div>
            <div><span>Membership</span><strong>{money(row.membership_collected ?? row.membershipCollected)}</strong></div>
            <div><span>Penalties</span><strong>{money(row.penalties_collected ?? row.penaltiesCollected)}</strong></div>
            <div><span>Interest</span><strong>{money(row.interest_earned ?? row.interestEarned)}</strong></div>
            <div><span>Closing</span><strong>{money(row.closing_balance ?? row.closingBalance)}</strong></div>
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
        <article key={member.id || member.cycle_member_id} className="shareout-card">
          <div className="shareout-card-head">
            <div className="shareout-avatar">{initials(member)}</div>
            <div>
              <strong>{memberName(member)}</strong>
              <span>{member.member_code || "Cycle member"}</span>
            </div>
            <Badge text={titleCase(member.status || "Preview")} tone="blue" />
          </div>
          <div className="shareout-card-values">
            <div><span>Savings</span><strong>{money(member.accumulated_savings ?? member.accumulatedSavings)}</strong></div>
            <div><span>Surplus</span><strong>{money(member.group_surplus_share ?? member.groupSurplusShare)}</strong></div>
            <div><span>Deductions</span><strong>{money(member.total_deductions ?? member.totalDeductions)}</strong></div>
            <div><span>Net</span><strong>{money(member.net_shareout ?? member.netShareout)}</strong></div>
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
    <section className="shareout-detail">
      <div className="shareout-detail-hero">
        <div className="shareout-avatar">{initials(member)}</div>
        <div>
          <span>Shareout Detail</span>
          <h2>{memberName(member)}</h2>
          <p>Every amount is stored as a line item for auditability.</p>
        </div>
        <Badge text={titleCase(member.status || "Preview")} tone="blue" />
      </div>
      <div className="shareout-detail-grid">
        <div><strong>Accumulated savings</strong><span>{money(member.accumulated_savings ?? member.accumulatedSavings)}</span></div>
        <div><strong>Group surplus share</strong><span>{money(member.group_surplus_share ?? member.groupSurplusShare)}</span></div>
        <div><strong>Outstanding loan</strong><span>{money(member.outstanding_loan_balance ?? member.outstandingLoanBalance)}</span></div>
        <div><strong>Unpaid penalties</strong><span>{money(member.unpaid_penalties ?? member.unpaidPenalties)}</span></div>
        <div><strong>Unpaid common interest</strong><span>{money(member.unpaid_common_interest ?? member.unpaidCommonInterest)}</span></div>
        <div><strong>Net shareout</strong><span>{money(member.net_shareout ?? member.netShareout)}</span></div>
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
      className="shareout-page"
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
        <section className="panel shareout-context">
          <Select
            label="Cycle"
            value={activeCycleId}
            onChange={setCycleId}
            placeholder="Select cycle"
            options={cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.name} - ${titleCase(cycle.status)}` }))}
          />
        </section>
      ) : null}

      <div className="metrics shareout-metrics">
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

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : null}

      {!loading && tab === "surplus" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Monthly Surplus Accumulation</h2>
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
        <section className="panel">
          <div className="panel-head">
            <h2>Member Shareout</h2>
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
        <section className="panel shareout-post-panel">
          <div className="panel-head">
            <h2>{readOnly ? "Shareout Status" : "Post Final Shareout"}</h2>
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
