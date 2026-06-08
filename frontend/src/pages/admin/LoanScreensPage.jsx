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
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

function LoanLedger({ ledger }) {
  const summary = ledger?.summary || {};
  return (
    <section className="panel loan-ledger">
      <div className="panel-head">
        <h2>Member Loan Ledger</h2>
        <Badge text={`Outstanding ${money(summary.outstanding_balance)}`} tone={Number(summary.outstanding_balance || 0) > 0 ? "amber" : "green"} />
      </div>
      <div className="detail-grid loan-detail-grid">
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
    <div className="loan-form">
      <div className="form-grid two">
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
    <div className="loan-form">
      <div className="form-grid three">
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
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={loadRequests} loading={loading}>Refresh Queue</Button>
          <Button type="button" variant="secondary" icon={Banknote} onClick={openNewRequest}>New Loan Request</Button>
          <Button type="button" variant="secondary" icon={Send} onClick={openRepayment}>Record Repayment</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Loan action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Loan action failed">{error}</Alert> : null}
      {errors.context ? <Alert tone="danger" title="Loan context unavailable">{errors.context}</Alert> : null}

      <div className="metrics loan-metrics">
        {metrics.map((metric) => <Card key={metric.title} {...metric} />)}
      </div>

      {selected ? (
        <section className="panel loan-detail-panel">
          <div className="panel-head">
            <h2>Loan Request Detail: {memberName(selected)}</h2>
            <Badge text={selected.is_disbursed ? "DISBURSED" : selected.status} tone={statusTone(selected.status, selected.is_disbursed)} />
          </div>
          <div className="detail-grid loan-detail-grid">
            <DetailValue label="Type" value={String(selected.origin_type || "-").replaceAll("_", " ")} />
            <DetailValue label="Requested" value={money(selected.requested_amount)} />
            <DetailValue label="Approved" value={money(selected.approved_amount)} />
            <DetailValue label="Cumulative Borrowed" value={money(selected.cumulative_borrowed)} />
            <DetailValue label="Requested Date" value={dateOnly(selected.requested_at)} />
            <DetailValue label="Member Code" value={selected.member_code || "-"} />
          </div>
          <div className="form-grid two">
            <CurrencyInput label="Approved amount" value={approvedAmount} onChange={setApprovedAmount} error={errors.approvedAmount} />
            <Field label="Rejection reason" value={rejectionReason} onChange={setRejectionReason} error={errors.rejectionReason} placeholder="Required when rejecting" />
          </div>
          <div className="button-row">
            <Button type="button" icon={CheckCircle2} onClick={approveRequest} disabled={selected.status === "REJECTED" || selected.is_disbursed} loading={busy === "approve"}>Approve</Button>
            <Button type="button" variant="danger" icon={XCircle} onClick={rejectRequest} disabled={selected.status !== "PENDING" || selected.is_disbursed} loading={busy === "reject"}>Reject</Button>
            <Button type="button" icon={Banknote} onClick={disburseRequest} disabled={selected.status !== "APPROVED" || selected.is_disbursed} loading={busy === "disburse"}>Disburse Loan</Button>
            <Button type="button" variant="secondary" onClick={() => loadMemberLedger(selected.cycle_member_id)} loading={busy === `ledger-${selected.cycle_member_id}`}>View Member Ledger</Button>
            <Button type="button" variant="secondary" onClick={() => setSelected(null)}>Close Detail</Button>
          </div>
        </section>
      ) : null}

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
        <section className="panel">
          <div className="panel-head">
            <h2>Loan Approval Queue</h2>
            <Button type="button" size="sm" icon={Banknote} onClick={openNewRequest}>New Loan Request</Button>
          </div>
          {loading ? <Skeleton lines={7} /> : requests.length ? (
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
          ) : (
            <EmptyState title="No loan requests" message="Create requests from declarations or from this screen, then approve and disburse during the payout window." />
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
          <div className="button-row">
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
          <div className="button-row">
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
