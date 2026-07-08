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
    <section className="panel savings-detail mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="savings-detail-hero mb-3.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="savings-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(detail?.member)}</div>
        <div>
          <span className="text-xs font-black uppercase text-emerald">Savings Ledger</span>
          <h2 className="my-0.5 text-xl font-extrabold text-charcoal">{memberName(detail?.member)}</h2>
          <p className="m-0 text-sm font-extrabold text-charcoal/75">Principal, interest, and one-time contributions</p>
        </div>
        <Badge text={`Remaining ${money(totals.savings_cap_remaining)}`} tone="blue" />
      </div>
      <div className="detail-grid savings-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Principal</strong><span className="text-sm font-extrabold text-charcoal">{money(totals.savings_principal)}</span></div>
        <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Interest</strong><span className="text-sm font-extrabold text-charcoal">{money(totals.savings_interest)}</span></div>
        <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Social Fund</strong><span className="text-sm font-extrabold text-charcoal">{money(totals.social_fund_paid)}</span></div>
        <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><strong className="text-xs font-black uppercase text-charcoal/70">Membership Fee</strong><span className="text-sm font-extrabold text-charcoal">{money(totals.membership_fee_paid)}</span></div>
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
    <section className="savings-hero mb-4 grid gap-4 rounded-mobile bg-gradient-to-br from-forest via-emerald to-forest p-5 text-cream shadow-lift md:grid-cols-[minmax(0,1fr)_auto]" aria-label="Savings posting overview">
      <div>
        <span className="text-xs font-black uppercase text-cream">Savings Operations</span>
        <h2 className="my-1 text-[25px] font-extrabold leading-tight text-cream">{context.cycle?.name || "No active cycle"}</h2>
        <p className="m-0 text-sm font-extrabold text-cream/85">{context.cycleMonth ? `Month ${context.cycleMonth.month_number} · ${String(context.cycleMonth.status || "OPEN").replaceAll("_", " ")}` : "Activate a cycle month to post savings."}</p>
      </div>
      <div className="savings-hero-stat grid min-w-40 content-center gap-1 rounded-mobile border border-cream/20 bg-white/10 p-3 backdrop-blur">
        <strong className="break-words text-[22px] font-extrabold text-cream">{metrics[0]?.value || "K0"}</strong>
        <span className="text-xs font-black uppercase text-cream">Principal Posted</span>
      </div>
    </section>
  );
}

function SelectedMemberCard({ member }) {
  if (!member) return null;
  return (
    <section className="savings-selected-member mb-3.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-mobile border border-mist bg-cream p-3 shadow-soft" aria-label="Selected member savings status">
      <div className="savings-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(member)}</div>
      <div>
        <span className="text-xs font-black uppercase text-emerald">Selected Member</span>
        <strong className="block break-words text-sm font-extrabold text-charcoal">{memberName(member)}</strong>
        <small className="block break-words text-xs font-extrabold text-charcoal/75">{member.member_code || "No code"} · Cap remaining {money(member.savings_cap_remaining)}</small>
      </div>
      <div className="savings-selected-flags flex flex-wrap justify-end gap-1.5">
        <Badge text={member.social_fund_paid ? "Social Paid" : "Social Due"} tone={member.social_fund_paid ? "green" : "amber"} />
        <Badge text={member.membership_fee_paid ? "Membership Paid" : "Membership Due"} tone={member.membership_fee_paid ? "green" : "amber"} />
      </div>
    </section>
  );
}

function SavingsMemberCards({ members, busy, onSelect, onLedger }) {
  if (!members.length) return null;
  return (
    <div className="savings-mobile-cards grid gap-3" aria-label="Member savings cards">
      {members.map((member) => (
        <article className="savings-member-card grid gap-3 rounded-mobile border border-mist bg-cream p-3 shadow-soft" key={member.cycle_member_id}>
          <div className="savings-card-head grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5">
            <div className="savings-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(member)}</div>
            <div>
              <strong>{memberName(member)}</strong>
              <span>{member.member_code || "No code"}</span>
            </div>
          </div>
          <div className="savings-card-values grid gap-2.5 md:grid-cols-2">
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Principal</span><strong className="break-words text-base font-extrabold text-charcoal">{money(member.savings_principal)}</strong></div>
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Remaining</span><strong className="break-words text-base font-extrabold text-charcoal">{money(member.savings_cap_remaining)}</strong></div>
          </div>
          <div className="savings-card-badges grid grid-cols-2 gap-2">
            <Badge text={member.social_fund_paid ? "Social Paid" : "Social Due"} tone={member.social_fund_paid ? "green" : "amber"} />
            <Badge text={member.membership_fee_paid ? "Membership Paid" : "Membership Due"} tone={member.membership_fee_paid ? "green" : "amber"} />
          </div>
          <div className="savings-card-actions grid grid-cols-2 gap-2">
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

      <div className="admin-mobile-action-row savings-mobile-actions mobile-only flex gap-2" aria-label="Savings quick actions">
        <Button type="button" icon={RefreshCw} onClick={loadContext} loading={loading}>Refresh</Button>
        <Button type="button" variant="secondary" icon={ClipboardList} onClick={() => setActiveTab("ledger")}>Ledger</Button>
      </div>

      <div className="metrics savings-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <Card key={metric.title} {...metric} />)}
      </div>

      {loading ? <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={8} /></section> : !context.cycle ? (
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
            <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-charcoal">Post Savings and Contributions</h2>
                {selectedMember ? <Badge text={`Remaining ${money(selectedMember.savings_cap_remaining)}`} tone={Number(selectedMember.savings_cap_remaining) <= 0 ? "red" : "green"} /> : null}
              </div>
              <SelectedMemberCard member={selectedMember} />
              <form onSubmit={submitSavings}>
                <div className="form-grid three grid gap-3 md:grid-cols-3">
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
                  <div className={`queue-note ${errors.amount ? "warn" : ""} grid min-h-[46px] content-center rounded-app border border-mist bg-mist px-3 text-sm font-extrabold text-charcoal`}>
                    Principal cap remaining: {money(selectedMember?.savings_cap_remaining)}
                  </div>
                </div>
                <Textarea label="Posting notes" value={notes} onChange={setNotes} rows={3} placeholder="Optional audit note" />
                {errors.contribution ? <Alert tone="warning" title="Contribution blocked">{errors.contribution}</Alert> : null}
                <div className="button-row savings-actions mt-3.5 flex flex-wrap items-center gap-2.5">
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
            <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-charcoal">Member Savings Status</h2>
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
                    <div className="button-row compact flex flex-wrap items-center gap-1.5">
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
