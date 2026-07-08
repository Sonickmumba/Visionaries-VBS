import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  CurrencyInput,
  DataTable,
  EmptyState,
  Field,
  Modal,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/loans.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

const REQUEST_FORM = {
  cycleMemberId: "",
  requestedAmount: "",
  originType: "ORIGINAL_LOAN",
  notes: "",
};

const REPAYMENT_FORM = {
  cycleMemberId: "",
  principalAmount: "",
  interestAmount: "",
  notes: "",
};

function memberName(item) {
  return `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "Member";
}

function initials(item) {
  return memberName(item)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "M";
}

function statusTone(status, isDisbursed = false) {
  if (isDisbursed) return "green";
  if (status === "APPROVED") return "blue";
  if (status === "PENDING") return "amber";
  if (status === "REJECTED") return "red";
  return "gray";
}

function positiveAmountError(value, label) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return `${label} must be greater than zero.`;
  return "";
}

export function validateLoanRequestForm(form, context) {
  const errors = {};
  if (!context?.cycle || !context?.cycleMonth) errors.context = "Loan context is not ready.";
  if (!form.cycleMemberId) errors.cycleMemberId = "Choose a member.";
  const amountError = positiveAmountError(form.requestedAmount, "Requested amount");
  if (amountError) errors.requestedAmount = amountError;
  return errors;
}

export function loanRequestPayload({ form, context }) {
  return {
    cycleId: context.cycle.id,
    cycleMonthId: context.cycleMonth.id,
    cycleMemberId: form.cycleMemberId,
    requestedAmount: Number(form.requestedAmount || 0),
    originType: form.originType,
    notes: form.notes || null,
  };
}

export function validateRepaymentForm(form, context) {
  const errors = {};
  if (!context?.cycle || !context?.cycleMonth) errors.context = "Loan context is not ready.";
  if (!form.cycleMemberId) errors.cycleMemberId = "Choose a member.";
  const principal = Number(form.principalAmount || 0);
  const interest = Number(form.interestAmount || 0);
  if (!Number.isFinite(principal) || principal < 0) errors.principalAmount = "Principal repayment cannot be negative.";
  if (!Number.isFinite(interest) || interest < 0) errors.interestAmount = "Interest repayment cannot be negative.";
  if (principal <= 0 && interest <= 0) errors.amount = "Enter a principal or interest repayment amount.";
  return errors;
}

export function repaymentPayload({ form, context }) {
  return {
    cycleId: context.cycle.id,
    cycleMonthId: context.cycleMonth.id,
    cycleMemberId: form.cycleMemberId,
    principalAmount: Number(form.principalAmount || 0),
    interestAmount: Number(form.interestAmount || 0),
    notes: form.notes || null,
  };
}

export async function createLoanRequest({ form, context, loansApi = api }) {
  const errors = validateLoanRequestForm(form, context);
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return loansApi("/loans/requests", { method: "POST", body: loanRequestPayload({ form, context }) });
}

export async function approveLoanRequest({ requestId, approvedAmount, loansApi = api }) {
  const amountError = positiveAmountError(approvedAmount, "Approved amount");
  if (amountError) {
    const error = new Error("Validation failed");
    error.validationErrors = { approvedAmount: amountError };
    throw error;
  }
  return loansApi(`/loans/requests/${requestId}/approve`, { method: "POST", body: { approvedAmount: Number(approvedAmount) } });
}

export async function rejectLoanRequest({ requestId, reason, loansApi = api }) {
  if (!String(reason || "").trim()) {
    const error = new Error("Validation failed");
    error.validationErrors = { rejectionReason: "Rejection reason is required." };
    throw error;
  }
  return loansApi(`/loans/requests/${requestId}/reject`, { method: "POST", body: { reason: reason.trim() } });
}

export async function disburseLoanRequest({ request, loansApi = api }) {
  return loansApi("/loans/disbursements", {
    method: "POST",
    body: {
      loanRequestId: request.id,
      cycleId: request.cycle_id,
      cycleMonthId: request.cycle_month_id,
      cycleMemberId: request.cycle_member_id,
      originType: request.origin_type,
      amount: Number(request.approved_amount),
      notes: "Disbursed from loan approval queue",
    },
  });
}

export async function postLoanRepayment({ form, context, loansApi = api }) {
  const errors = validateRepaymentForm(form, context);
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return loansApi("/loans/repayments", { method: "POST", body: repaymentPayload({ form, context }) });
}

function DetailValue({ label, value }) {
  return (
    <div className="grid gap-1 rounded-app border border-mist bg-cream p-3">
      <strong className="text-xs font-black uppercase text-charcoal/70">{label}</strong>
      <span className="break-words text-sm font-extrabold text-charcoal">{value}</span>
    </div>
  );
}

function LoanHero({ context, metrics }) {
  const requestedTotal = metrics.find((metric) => metric.title === "Requested Total")?.value || money(0);
  return (
    <section className="loan-hero mb-4 grid gap-4 rounded-mobile bg-gradient-to-br from-forest via-emerald to-forest p-5 text-cream shadow-lift md:grid-cols-[minmax(0,1fr)_auto]" aria-label="Loan desk overview">
      <div>
        <span className="text-xs font-black uppercase text-cream">Loan Desk</span>
        <h2 className="my-1 text-[25px] font-extrabold leading-tight text-cream">{context?.cycle?.name || "Active Cycle"}</h2>
        <p className="m-0 text-sm font-extrabold text-cream/85">Review requests, approve payouts, disburse funds, and record repayments.</p>
      </div>
      <div className="loan-hero-stat grid min-w-40 content-center gap-1 rounded-mobile border border-cream/20 bg-white/10 p-3 backdrop-blur">
        <span className="text-xs font-black uppercase text-cream">Requested</span>
        <strong className="break-words text-[22px] font-extrabold text-cream">{requestedTotal}</strong>
        <small className="text-xs font-extrabold text-cream/85">{context?.cycleMonth ? `Month ${context.cycleMonth.month_number}` : "Current month"}</small>
      </div>
    </section>
  );
}

function LoanRequestCards({ requests, selected, busy, onChoose, onLedger }) {
  if (!requests.length) return null;
  return (
    <div className="loan-mobile-cards grid gap-3" aria-label="Mobile loan request cards">
      {requests.map((request) => (
        <article key={request.id} className={`loan-request-card grid gap-3 rounded-mobile border border-mist bg-cream p-3 shadow-soft ${selected?.id === request.id ? "selected border-emerald shadow-lift" : ""}`}>
          <div className="loan-card-head grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
            <div className="loan-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(request)}</div>
            <div>
              <strong className="block break-words text-sm font-extrabold text-charcoal">{memberName(request)}</strong>
              <span className="block break-words text-xs font-extrabold text-charcoal/70">{request.member_code || "No member code"}</span>
            </div>
            <Badge text={request.is_disbursed ? "DISBURSED" : request.status} tone={statusTone(request.status, request.is_disbursed)} />
          </div>
          <div className="loan-card-values grid grid-cols-2 gap-2.5">
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Requested</span><strong className="break-words text-base font-extrabold text-charcoal">{money(request.requested_amount)}</strong></div>
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Approved</span><strong className="break-words text-base font-extrabold text-charcoal">{money(request.approved_amount)}</strong></div>
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Borrowed</span><strong className="break-words text-base font-extrabold text-charcoal">{money(request.cumulative_borrowed)}</strong></div>
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Type</span><strong className="break-words text-base font-extrabold text-charcoal">{String(request.origin_type || "-").replaceAll("_", " ")}</strong></div>
          </div>
          <div className="loan-card-actions grid grid-cols-2 gap-2">
            <Button type="button" variant={selected?.id === request.id ? "primary" : "secondary"} size="sm" onClick={() => onChoose(request)}>Review</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onLedger(request.cycle_member_id)} loading={busy === `ledger-${request.cycle_member_id}`}>Ledger</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function LoanLedger({ ledger }) {
  const summary = ledger?.summary || {};
  return (
    <section className="panel loan-ledger mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="loan-ledger-hero mb-3.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div>
          <span className="text-xs font-black uppercase text-emerald">Ledger Detail</span>
          <h2 className="my-0.5 text-xl font-extrabold text-charcoal">Member Loan Ledger</h2>
          <p className="m-0 text-sm font-extrabold text-charcoal/75">Disbursements, interest, repayments, and outstanding balance.</p>
        </div>
        <Badge text={`Outstanding ${money(summary.outstanding_balance)}`} tone={Number(summary.outstanding_balance || 0) > 0 ? "amber" : "green"} />
      </div>
      <div className="detail-grid loan-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailValue label="Cumulative Borrowed" value={money(summary.cumulative_borrowed)} />
        <DetailValue label="Original Loans" value={money(summary.original_loans)} />
        <DetailValue label="Top-ups" value={money(summary.top_ups)} />
        <DetailValue label="Converted Penalties" value={money(summary.converted_penalty_loans)} />
        <DetailValue label="Interest Assessed" value={money(summary.interest_assessed)} />
        <DetailValue label="Principal Repaid" value={money(summary.principal_repaid)} />
        <DetailValue label="Interest Repaid" value={money(summary.interest_repaid)} />
        <DetailValue label="Outstanding Balance" value={money(summary.outstanding_balance)} />
      </div>
      <DataTable
        columns={["Date", "Type", "Amount", "Description", "Reference"]}
        rows={(ledger?.data || []).map((item) => [
          dateOnly(item.posted_at),
          item.transaction_type,
          money(item.amount),
          item.description || "-",
          item.reference || item.id,
        ])}
        empty="No loan ledger entries found."
      />
    </section>
  );
}

function RequestForm({ form, setForm, context, errors }) {
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="loan-form grid gap-3.5">
      <div className="form-grid two grid gap-3 md:grid-cols-2">
        <Select
          label="Member"
          value={form.cycleMemberId}
          onChange={set("cycleMemberId")}
          placeholder="Choose member"
          error={errors.cycleMemberId}
          options={(context.members || []).map((member) => ({
            value: member.cycle_member_id,
            label: `${memberName(member)}${member.member_code ? ` (${member.member_code})` : ""}`,
          }))}
        />
        <Select
          label="Loan type"
          value={form.originType}
          onChange={set("originType")}
          options={[
            { value: "ORIGINAL_LOAN", label: "Original loan" },
            { value: "TOP_UP", label: "Top-up" },
          ]}
        />
        <CurrencyInput label="Requested amount" value={form.requestedAmount} onChange={set("requestedAmount")} error={errors.requestedAmount} />
      </div>
      <Textarea label="Notes" value={form.notes} onChange={set("notes")} rows={3} />
    </div>
  );
}

function RepaymentForm({ form, setForm, context, errors }) {
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="loan-form grid gap-3.5">
      <div className="form-grid three grid gap-3 md:grid-cols-3">
        <Select
          label="Member"
          value={form.cycleMemberId}
          onChange={set("cycleMemberId")}
          placeholder="Choose member"
          error={errors.cycleMemberId}
          options={(context.members || []).map((member) => ({
            value: member.cycle_member_id,
            label: `${memberName(member)}${member.member_code ? ` (${member.member_code})` : ""}`,
          }))}
        />
        <CurrencyInput label="Principal repayment" value={form.principalAmount} onChange={set("principalAmount")} error={errors.principalAmount} />
        <CurrencyInput label="Interest repayment" value={form.interestAmount} onChange={set("interestAmount")} error={errors.interestAmount || errors.amount} />
      </div>
      <Textarea label="Notes" value={form.notes} onChange={set("notes")} rows={3} />
    </div>
  );
}

export function LoanScreensPage({
  loansApi = api,
  initialRequests = undefined,
  initialContext = undefined,
  initialLedger = null,
}) {
  const [requests, setRequests] = useState(initialRequests || []);
  const [context, setContext] = useState(initialContext || { cycle: null, cycleMonth: null, members: [] });
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState(initialLedger);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState(initialLedger ? "ledger" : "queue");
  const [modal, setModal] = useState("");
  const [requestForm, setRequestForm] = useState({ ...REQUEST_FORM });
  const [repaymentForm, setRepaymentForm] = useState({ ...REPAYMENT_FORM });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialRequests === undefined);
  const [busy, setBusy] = useState("");

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const response = await loansApi("/loans/requests");
      setRequests(response.data || []);
      if (selected) setSelected((response.data || []).find((item) => item.id === selected.id) || selected);
    } catch (err) {
      setError(err.message || "Loan requests could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function loadContext() {
    try {
      const response = await loansApi("/savings/posting-context");
      setContext(response.data || { cycle: null, cycleMonth: null, members: [] });
    } catch {
      setContext({ cycle: null, cycleMonth: null, members: [] });
    }
  }

  useEffect(() => {
    if (initialRequests === undefined) loadRequests();
    if (initialContext === undefined) loadContext();
  }, []);

  function chooseRequest(request) {
    setSelected(request);
    setApprovedAmount(String(request.approved_amount || request.requested_amount || ""));
    setRejectionReason("");
    setErrors({});
    setMessage("");
    setError("");
  }

  function openNewRequest() {
    const firstMember = context.members?.[0];
    setRequestForm({ ...REQUEST_FORM, cycleMemberId: firstMember?.cycle_member_id || "" });
    setErrors({});
    setModal("request");
  }

  function openRepayment() {
    const memberId = selected?.cycle_member_id || context.members?.[0]?.cycle_member_id || "";
    setRepaymentForm({ ...REPAYMENT_FORM, cycleMemberId: memberId });
    setErrors({});
    setModal("repayment");
  }

  async function submitNewRequest(event) {
    event.preventDefault();
    setBusy("request");
    setErrors({});
    setMessage("");
    setError("");
    try {
      await createLoanRequest({ form: requestForm, context, loansApi });
      setModal("");
      setMessage("Loan request created.");
      await loadRequests();
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Loan request could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function submitRepayment(event) {
    event.preventDefault();
    setBusy("repayment");
    setErrors({});
    setMessage("");
    setError("");
    try {
      await postLoanRepayment({ form: repaymentForm, context, loansApi });
      setModal("");
      setMessage("Loan repayment posted.");
      await loadRequests();
      if (repaymentForm.cycleMemberId) await loadMemberLedger(repaymentForm.cycleMemberId);
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Loan repayment could not be posted.");
    } finally {
      setBusy("");
    }
  }

  async function approveRequest() {
    if (!selected) return;
    setBusy("approve");
    setErrors({});
    setMessage("");
    setError("");
    try {
      await approveLoanRequest({ requestId: selected.id, approvedAmount, loansApi });
      setMessage("Loan request approved.");
      await loadRequests();
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Loan request could not be approved.");
    } finally {
      setBusy("");
    }
  }

  async function rejectRequest() {
    if (!selected) return;
    setBusy("reject");
    setErrors({});
    setMessage("");
    setError("");
    try {
      await rejectLoanRequest({ requestId: selected.id, reason: rejectionReason, loansApi });
      setMessage("Loan request rejected.");
      await loadRequests();
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Loan request could not be rejected.");
    } finally {
      setBusy("");
    }
  }

  async function disburseRequest() {
    if (!selected) return;
    setBusy("disburse");
    setMessage("");
    setError("");
    try {
      await disburseLoanRequest({ request: selected, loansApi });
      setMessage("Loan disbursed and posted to ledger.");
      await loadRequests();
      await loadMemberLedger(selected.cycle_member_id);
    } catch (err) {
      setError(err.message || "Loan could not be disbursed.");
    } finally {
      setBusy("");
    }
  }

  async function loadMemberLedger(cycleMemberId) {
    setBusy(`ledger-${cycleMemberId}`);
    setError("");
    try {
      const response = await loansApi(`/loans/member/${cycleMemberId}`);
      setLedger(response);
      setActiveTab("ledger");
    } catch (err) {
      setError(err.message || "Member loan ledger could not load.");
    } finally {
      setBusy("");
    }
  }

  const metrics = useMemo(() => {
    const pending = requests.filter((request) => request.status === "PENDING").length;
    const approved = requests.filter((request) => request.status === "APPROVED").length;
    const disbursed = requests.filter((request) => request.is_disbursed).length;
    const requestedTotal = requests.reduce((sum, request) => sum + Number(request.requested_amount || 0), 0);
    return [
      { title: "Pending", value: pending, note: "Needs review", tone: "amber", icon: ClipboardList },
      { title: "Approved", value: approved, note: "Ready for payout", tone: "blue", icon: CheckCircle2 },
      { title: "Disbursed", value: disbursed, note: "Posted to ledger", icon: Banknote },
      { title: "Requested Total", value: money(requestedTotal), note: "All requests", tone: "teal", icon: BadgeDollarSign },
    ];
  }, [requests]);

  return (
    <Page
      title="Loans"
      className="loans-page grid gap-0"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={loadRequests} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={Banknote} onClick={openNewRequest}>Create Loan Request</Button>
          <Button type="button" variant="secondary" icon={Send} onClick={openRepayment}>Record Repayment</Button>
        </>
      )}
    >
      <LoanHero context={context} metrics={metrics} />

      {message ? <Alert tone="success" title="Loan action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Loan action failed">{error}</Alert> : null}
      {errors.context ? <Alert tone="danger" title="Loan context unavailable">{errors.context}</Alert> : null}

      <div className="admin-mobile-action-row loan-mobile-actions mobile-only flex gap-2" aria-label="Loan quick actions">
        <Button type="button" icon={RefreshCw} onClick={loadRequests} loading={loading}>Refresh</Button>
        <Button type="button" variant="secondary" icon={Banknote} onClick={openNewRequest}>Create</Button>
        <Button type="button" variant="secondary" icon={Send} onClick={openRepayment}>Repayment</Button>
      </div>

      <div className="metrics loan-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <Card key={metric.title} {...metric} />)}
      </div>

      <Modal
        open={Boolean(selected)}
        title="Loan Request Details"
        size="lg"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="loan-detail-modal pr-0.5">
            <section className="loan-detail-panel mb-0 rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="loan-detail-hero mb-3.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <div className="loan-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(selected)}</div>
                <div>
                  <span className="text-xs font-black uppercase text-emerald">Loan Request Detail</span>
                  <h2 className="my-0.5 text-xl font-extrabold text-charcoal">{memberName(selected)}</h2>
                  <p className="m-0 text-sm font-extrabold text-charcoal/75">{selected.member_code || "No member code"} · {String(selected.origin_type || "-").replaceAll("_", " ")}</p>
                </div>
                <Badge text={selected.is_disbursed ? "DISBURSED" : selected.status} tone={statusTone(selected.status, selected.is_disbursed)} />
              </div>
              <div className="loan-detail-strip mb-3.5 grid gap-2.5 md:grid-cols-3">
                <DetailValue label="Requested" value={money(selected.requested_amount)} />
                <DetailValue label="Approved" value={money(selected.approved_amount)} />
                <DetailValue label="Borrowed" value={money(selected.cumulative_borrowed)} />
              </div>
              <div className="detail-grid loan-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailValue label="Type" value={String(selected.origin_type || "-").replaceAll("_", " ")} />
                <DetailValue label="Requested" value={money(selected.requested_amount)} />
                <DetailValue label="Approved" value={money(selected.approved_amount)} />
                <DetailValue label="Cumulative Borrowed" value={money(selected.cumulative_borrowed)} />
                <DetailValue label="Requested Date" value={dateOnly(selected.requested_at)} />
                <DetailValue label="Member Code" value={selected.member_code || "-"} />
              </div>
              <div className="form-grid two grid gap-3 md:grid-cols-2">
                <CurrencyInput label="Approved amount" value={approvedAmount} onChange={setApprovedAmount} error={errors.approvedAmount} />
                <Field label="Rejection reason" value={rejectionReason} onChange={setRejectionReason} error={errors.rejectionReason} placeholder="Required when rejecting" />
              </div>
              <div className="button-row flex flex-wrap items-center gap-2.5">
                <Button type="button" icon={CheckCircle2} onClick={approveRequest} disabled={selected.status === "REJECTED" || selected.is_disbursed} loading={busy === "approve"}>Approve</Button>
                <Button type="button" variant="danger" icon={XCircle} onClick={rejectRequest} disabled={selected.status !== "PENDING" || selected.is_disbursed} loading={busy === "reject"}>Reject</Button>
                <Button type="button" icon={Banknote} onClick={disburseRequest} disabled={selected.status !== "APPROVED" || selected.is_disbursed} loading={busy === "disburse"}>Disburse Loan</Button>
                <Button type="button" variant="secondary" onClick={() => loadMemberLedger(selected.cycle_member_id)} loading={busy === `ledger-${selected.cycle_member_id}`}>View Member Ledger</Button>
                <Button type="button" variant="secondary" onClick={() => setSelected(null)}>Close Detail</Button>
              </div>
            </section>
          </div>
        ) : null}
      </Modal>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        label="Loan tabs"
        tabs={[
          { id: "queue", label: "Approval Queue" },
          { id: "ledger", label: "Member Ledger" },
        ]}
      />

      {activeTab === "queue" ? (
        <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
          <div className="panel-head mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-extrabold text-charcoal">Loan Approval Queue</h2>
          </div>
          {loading ? <Skeleton lines={7} /> : requests.length ? (
            <>
              <LoanRequestCards requests={requests} selected={selected} busy={busy} onChoose={chooseRequest} onLedger={loadMemberLedger} />
              <div className="loan-desktop-table">
                <DataTable
                  columns={["Member", "Type", "Requested", "Approved", "Borrowed", "Status", "Action"]}
                  rows={requests.map((request) => [
                    memberName(request),
                    String(request.origin_type || "-").replaceAll("_", " "),
                    money(request.requested_amount),
                    money(request.approved_amount),
                    money(request.cumulative_borrowed),
                    <Badge text={request.is_disbursed ? "DISBURSED" : request.status} tone={statusTone(request.status, request.is_disbursed)} />,
                    <Button type="button" variant={selected?.id === request.id ? "primary" : "secondary"} size="sm" onClick={() => chooseRequest(request)}>Review</Button>,
                  ])}
                />
              </div>
            </>
          ) : (
            <EmptyState title="No loan requests" message="Create requests from declarations or from this screen, then approve and disburse approved requests when funds are available." />
          )}
        </section>
      ) : null}

      {activeTab === "ledger" ? (
        ledger ? <LoanLedger ledger={ledger} /> : (
          <EmptyState title="Select member ledger" message="Open a request and view the member ledger, or record a repayment for a selected member." />
        )
      ) : null}

      <Modal
        open={modal === "request"}
        title="New Loan Request"
        size="lg"
        onClose={() => setModal("")}
        footer={(
          <div className="button-row flex flex-wrap items-center gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setModal("")}>Cancel</Button>
            <Button type="button" onClick={submitNewRequest} loading={busy === "request"}>Save Request</Button>
          </div>
        )}
      >
        <form onSubmit={submitNewRequest}>
          <RequestForm form={requestForm} setForm={setRequestForm} context={context} errors={errors} />
        </form>
      </Modal>

      <Modal
        open={modal === "repayment"}
        title="Record Loan Repayment"
        size="lg"
        onClose={() => setModal("")}
        footer={(
          <div className="button-row flex flex-wrap items-center gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setModal("")}>Cancel</Button>
            <Button type="button" onClick={submitRepayment} loading={busy === "repayment"}>Record Repayment</Button>
          </div>
        )}
      >
        <form onSubmit={submitRepayment}>
          <RepaymentForm form={repaymentForm} setForm={setRepaymentForm} context={context} errors={errors} />
        </form>
      </Modal>
    </Page>
  );
}
