import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, PiggyBank, Receipt, RefreshCw, Scale, Users } from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  CurrencyInput,
  DataTable,
  EmptyState,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/savings.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

function initials(member) {
  return memberName(member)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";
}

function contributionLabel(type) {
  return type === "SOCIAL_FUND" ? "Social Fund" : "Membership Fee";
}

export function validateSavingsDeposit({ amount, selectedMember }) {
  const errors = {};
  const value = Number(amount || 0);
  if (!selectedMember) errors.member = "Choose a member.";
  if (!Number.isFinite(value) || value <= 0) errors.amount = "Enter a savings amount greater than zero.";
  if (selectedMember && value > Number(selectedMember.savings_cap_remaining || 0)) {
    errors.amount = `Savings cap exceeded. Remaining cap is ${money(selectedMember.savings_cap_remaining)}.`;
  }
  return errors;
}

export function savingsDepositPayload({ context, selectedMember, amount, notes }) {
  return {
    cycleId: context.cycle.id,
    cycleMonthId: context.cycleMonth.id,
    cycleMemberId: selectedMember.cycle_member_id,
    amount: Number(amount || 0),
    notes: notes || "Posted from admin savings screen",
  };
}

export function contributionPayload({ context, selectedMember, contributionType, notes }) {
  const amount = contributionType === "SOCIAL_FUND"
    ? Number(context.cycle.social_fund_amount || 0)
    : Number(context.cycle.membership_fee_amount || 0);
  return {
    cycleId: context.cycle.id,
    cycleMonthId: context.cycleMonth?.id || null,
    cycleMemberId: selectedMember.cycle_member_id,
    contributionType,
    amount,
    notes: notes || `Posted ${contributionLabel(contributionType).toLowerCase()} from admin savings screen`,
  };
}

export async function postSavingsDeposit({ context, selectedMember, amount, notes, savingsApi = api }) {
  const errors = validateSavingsDeposit({ amount, selectedMember });
  if (!context.cycle || !context.cycleMonth) errors.context = "Savings posting context is not ready.";
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return savingsApi("/savings/deposits", {
    method: "POST",
    body: savingsDepositPayload({ context, selectedMember, amount, notes }),
  });
}

export async function postOneTimeContribution({ context, selectedMember, contributionType, notes, savingsApi = api }) {
  const errors = {};
  if (!context.cycle) errors.context = "Savings posting context is not ready.";
  if (!selectedMember) errors.member = "Choose a member.";
  if (selectedMember?.social_fund_paid && contributionType === "SOCIAL_FUND") errors.contribution = "Social fund is already paid.";
  if (selectedMember?.membership_fee_paid && contributionType === "MEMBERSHIP_FEE") errors.contribution = "Membership fee is already paid.";
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return savingsApi("/savings/contributions", {
    method: "POST",
    body: contributionPayload({ context, selectedMember, contributionType, notes }),
  });
}

function SavingsDetail({ detail }) {
  const transactions = detail?.data || [];
  const totals = detail?.totals || {};
  return (
    <section className="panel savings-detail">
      <div className="savings-detail-hero">
        <div className="savings-avatar" aria-hidden="true">{initials(detail?.member)}</div>
        <div>
          <span>Savings Ledger</span>
          <h2>{memberName(detail?.member)}</h2>
          <p>Principal, interest, and one-time contributions</p>
        </div>
        <Badge text={`Remaining ${money(totals.savings_cap_remaining)}`} tone="blue" />
      </div>
      <div className="detail-grid savings-detail-grid">
        <div><strong>Principal</strong><span>{money(totals.savings_principal)}</span></div>
        <div><strong>Interest</strong><span>{money(totals.savings_interest)}</span></div>
        <div><strong>Social Fund</strong><span>{money(totals.social_fund_paid)}</span></div>
        <div><strong>Membership Fee</strong><span>{money(totals.membership_fee_paid)}</span></div>
      </div>
      <DataTable
        columns={["Date", "Type", "Amount", "Description", "Reference"]}
        rows={transactions.map((item) => [
          dateOnly(item.posted_at),
          item.transaction_type,
          money(item.amount),
          item.description || "-",
          item.reference || item.id,
        ])}
        empty="No savings ledger transactions found."
      />
    </section>
  );
}

function SavingsHero({ context, metrics }) {
  return (
    <section className="savings-hero" aria-label="Savings posting overview">
      <div>
        <span>Savings Operations</span>
        <h2>{context.cycle?.name || "No active cycle"}</h2>
        <p>{context.cycleMonth ? `Month ${context.cycleMonth.month_number} · ${String(context.cycleMonth.status || "OPEN").replaceAll("_", " ")}` : "Activate a cycle month to post savings."}</p>
      </div>
      <div className="savings-hero-stat">
        <strong>{metrics[0]?.value || "K0"}</strong>
        <span>Principal Posted</span>
      </div>
    </section>
  );
}

function SelectedMemberCard({ member }) {
  if (!member) return null;
  return (
    <section className="savings-selected-member" aria-label="Selected member savings status">
      <div className="savings-avatar" aria-hidden="true">{initials(member)}</div>
      <div>
        <span>Selected Member</span>
        <strong>{memberName(member)}</strong>
        <small>{member.member_code || "No code"} · Cap remaining {money(member.savings_cap_remaining)}</small>
      </div>
      <div className="savings-selected-flags">
        <Badge text={member.social_fund_paid ? "Social Paid" : "Social Due"} tone={member.social_fund_paid ? "green" : "amber"} />
        <Badge text={member.membership_fee_paid ? "Membership Paid" : "Membership Due"} tone={member.membership_fee_paid ? "green" : "amber"} />
      </div>
    </section>
  );
}

function SavingsMemberCards({ members, busy, onSelect, onLedger }) {
  if (!members.length) return null;
  return (
    <div className="savings-mobile-cards" aria-label="Member savings cards">
      {members.map((member) => (
        <article className="savings-member-card" key={member.cycle_member_id}>
          <div className="savings-card-head">
            <div className="savings-avatar" aria-hidden="true">{initials(member)}</div>
            <div>
              <strong>{memberName(member)}</strong>
              <span>{member.member_code || "No code"}</span>
            </div>
          </div>
          <div className="savings-card-values">
            <div><span>Principal</span><strong>{money(member.savings_principal)}</strong></div>
            <div><span>Remaining</span><strong>{money(member.savings_cap_remaining)}</strong></div>
          </div>
          <div className="savings-card-badges">
            <Badge text={member.social_fund_paid ? "Social Paid" : "Social Due"} tone={member.social_fund_paid ? "green" : "amber"} />
            <Badge text={member.membership_fee_paid ? "Membership Paid" : "Membership Due"} tone={member.membership_fee_paid ? "green" : "amber"} />
          </div>
          <div className="savings-card-actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(member.cycle_member_id)}>Select</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onLedger(member.cycle_member_id)} loading={busy === `detail-${member.cycle_member_id}`}>Ledger</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function SavingsContributionPage({
  savingsApi = api,
  initialContext = undefined,
  initialDetail = null,
}) {
  const [context, setContext] = useState(initialContext || { cycle: null, cycleMonth: null, members: [] });
  const [selectedMemberId, setSelectedMemberId] = useState(initialContext?.members?.[0]?.cycle_member_id || "");
  const [savingsAmount, setSavingsAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState(initialDetail ? "ledger" : "posting");
  const [detail, setDetail] = useState(initialDetail);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialContext === undefined);
  const [busy, setBusy] = useState("");

  const selectedMember = context.members.find((member) => member.cycle_member_id === selectedMemberId);

  async function loadContext() {
    setLoading(true);
    setError("");
    try {
      const response = await savingsApi("/savings/posting-context");
      setContext(response.data || { cycle: null, cycleMonth: null, members: [] });
      const first = response.data?.members?.[0];
      if (!selectedMemberId && first) setSelectedMemberId(first.cycle_member_id);
    } catch (err) {
      setError(err.message || "Savings posting context could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialContext === undefined) loadContext();
  }, []);

  async function submitSavings(event) {
    event.preventDefault();
    setBusy("savings");
    setErrors({});
    setMessage("");
    setError("");
    try {
      await postSavingsDeposit({ context, selectedMember, amount: savingsAmount, notes, savingsApi });
      setMessage("Savings deposit posted.");
      setSavingsAmount("");
      setNotes("");
      await loadContext();
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Savings deposit could not be posted.");
    } finally {
      setBusy("");
    }
  }

  async function submitContribution(contributionType) {
    setBusy(contributionType);
    setErrors({});
    setMessage("");
    setError("");
    try {
      await postOneTimeContribution({ context, selectedMember, contributionType, notes, savingsApi });
      setMessage(`${contributionLabel(contributionType)} posted.`);
      setNotes("");
      await loadContext();
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || `${contributionLabel(contributionType)} could not be posted.`);
    } finally {
      setBusy("");
    }
  }

  async function loadMemberSavings(cycleMemberId) {
    setBusy(`detail-${cycleMemberId}`);
    setError("");
    try {
      const [ledger, contributions] = await Promise.all([
        savingsApi(`/savings/member/${cycleMemberId}`),
        savingsApi(`/savings/contributions/member/${cycleMemberId}`).catch(() => ({ data: [] })),
      ]);
      setDetail({ ...ledger, contributions: contributions.data || [] });
      setSelectedMemberId(cycleMemberId);
      setActiveTab("ledger");
    } catch (err) {
      setError(err.message || "Member savings ledger could not load.");
    } finally {
      setBusy("");
    }
  }

  const metrics = useMemo(() => {
    const members = context.members || [];
    const totalPrincipal = members.reduce((sum, member) => sum + Number(member.savings_principal || 0), 0);
    const socialPaid = members.filter((member) => member.social_fund_paid).length;
    const membershipPaid = members.filter((member) => member.membership_fee_paid).length;
    return [
      { title: "Savings Principal", value: money(totalPrincipal), note: "Cycle deposits", icon: PiggyBank },
      { title: "Savings Cap", value: money(context.cycle?.savings_cap), note: "Per member", tone: "blue", icon: Scale },
      { title: "Social Fund Paid", value: `${socialPaid}/${members.length}`, note: money(context.cycle?.social_fund_amount), tone: "teal", icon: Receipt },
      { title: "Membership Paid", value: `${membershipPaid}/${members.length}`, note: money(context.cycle?.membership_fee_amount), tone: "amber", icon: Users },
    ];
  }, [context]);

  return (
    <Page
      title="Savings"
      className="savings-page"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={loadContext} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={ClipboardList} onClick={() => setActiveTab("ledger")}>View Ledger</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Savings action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Savings action failed">{error}</Alert> : null}
      {errors.context ? <Alert tone="danger" title="Posting unavailable">{errors.context}</Alert> : null}

      <SavingsHero context={context} metrics={metrics} />

      <div className="metrics savings-metrics">
        {metrics.map((metric) => <Card key={metric.title} {...metric} />)}
      </div>

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !context.cycle ? (
        <EmptyState title="No active cycle" message="Activate a cycle and generate months before posting savings and contributions." />
      ) : (
        <>
          <Tabs
            active={activeTab}
            onChange={setActiveTab}
            label="Savings tabs"
            tabs={[
              { id: "posting", label: "Posting" },
              { id: "members", label: "Member Status" },
              { id: "ledger", label: "Ledger" },
            ]}
          />

          {activeTab === "posting" ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Post Savings and Contributions</h2>
                {selectedMember ? <Badge text={`Remaining ${money(selectedMember.savings_cap_remaining)}`} tone={Number(selectedMember.savings_cap_remaining) <= 0 ? "red" : "green"} /> : null}
              </div>
              <SelectedMemberCard member={selectedMember} />
              <form onSubmit={submitSavings}>
                <div className="form-grid three">
                  <Select
                    label="Member"
                    value={selectedMemberId}
                    onChange={setSelectedMemberId}
                    placeholder="Choose member"
                    error={errors.member}
                    options={context.members.map((member) => ({
                      value: member.cycle_member_id,
                      label: `${memberName(member)}${member.member_code ? ` (${member.member_code})` : ""}`,
                    }))}
                  />
                  <CurrencyInput label="Savings deposit" value={savingsAmount} onChange={setSavingsAmount} error={errors.amount} />
                  <div className={`queue-note ${errors.amount ? "warn" : ""}`}>
                    Principal cap remaining: {money(selectedMember?.savings_cap_remaining)}
                  </div>
                </div>
                <Textarea label="Posting notes" value={notes} onChange={setNotes} rows={3} placeholder="Optional audit note" />
                {errors.contribution ? <Alert tone="warning" title="Contribution blocked">{errors.contribution}</Alert> : null}
                <div className="button-row savings-actions">
                  <Button type="submit" loading={busy === "savings"} disabled={!selectedMember}>Post Savings</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!selectedMember || selectedMember.social_fund_paid}
                    onClick={() => submitContribution("SOCIAL_FUND")}
                    loading={busy === "SOCIAL_FUND"}
                  >
                    {selectedMember?.social_fund_paid ? "Social Fund Paid" : "Post Social Fund"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!selectedMember || selectedMember.membership_fee_paid}
                    onClick={() => submitContribution("MEMBERSHIP_FEE")}
                    loading={busy === "MEMBERSHIP_FEE"}
                  >
                    {selectedMember?.membership_fee_paid ? "Membership Paid" : "Post Membership Fee"}
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          {activeTab === "members" ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Member Savings Status</h2>
              </div>
              <SavingsMemberCards members={context.members} busy={busy} onSelect={setSelectedMemberId} onLedger={loadMemberSavings} />
              <div className="savings-desktop-table">
                <DataTable
                  columns={["Member", "Principal", "Cap Remaining", "Social Fund", "Membership", "Action"]}
                  rows={context.members.map((member) => [
                    memberName(member),
                    money(member.savings_principal),
                    money(member.savings_cap_remaining),
                    <Badge text={member.social_fund_paid ? "PAID" : "UNPAID"} tone={member.social_fund_paid ? "green" : "amber"} />,
                    <Badge text={member.membership_fee_paid ? "PAID" : "UNPAID"} tone={member.membership_fee_paid ? "green" : "amber"} />,
                    <div className="button-row compact">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedMemberId(member.cycle_member_id)}>Select</Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => loadMemberSavings(member.cycle_member_id)} loading={busy === `detail-${member.cycle_member_id}`}>View Ledger</Button>
                    </div>,
                  ])}
                  empty="No active members are enrolled in this cycle."
                />
              </div>
            </section>
          ) : null}

          {activeTab === "ledger" ? (
            detail ? <SavingsDetail detail={detail} /> : (
              <EmptyState
                title="Select member ledger"
                message="Open a member from the status table to view savings deposits, interest, social fund, and membership fee entries."
                action={selectedMember ? <Button type="button" onClick={() => loadMemberSavings(selectedMember.cycle_member_id)}>View Selected Member Ledger</Button> : null}
              />
            )
          ) : null}
        </>
      )}
    </Page>
  );
}
