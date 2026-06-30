import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
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
import "../../styles/declarations.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";
const dateTime = (value) => value ? String(value).slice(0, 19).replace("T", " ") : "-";
const proofTypeLabels = {
  SAVINGS_PAYMENT_PROOF: "Savings proof",
  PRINCIPAL_REPAYMENT_PROOF: "Principal repayment proof",
  LOAN_INTEREST_PAYMENT_PROOF: "Loan interest proof",
  COMMON_INTEREST_PAYMENT_PROOF: "Common-interest proof",
};

const EMPTY_FORM = {
  cycleMemberId: "",
  savingsAmount: "",
  loanRequestAmount: "",
  loanTopUpAmount: "",
  principalRepaymentAmount: "",
  loanInterestRepaymentAmount: "",
  commonInterestPaymentAmount: "",
  otherObligationAmount: "",
  notes: "",
};

function memberName(item) {
  return `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "Member";
}

function initials(item) {
  return memberName(item)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";
}

function statusTone(status) {
  if (status === "APPROVED") return "green";
  if (status === "SUBMITTED" || status === "LATE" || status === "DRAFT") return "amber";
  if (status === "MISSED" || status === "CANCELLED") return "red";
  return "gray";
}

function numberError(value, label) {
  if (String(value ?? "").trim() === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} must be a valid number.`;
  if (number < 0) return `${label} cannot be negative.`;
  return "";
}

export function validateDeclarationForm(form, { creating = true } = {}) {
  const errors = {};
  if (creating && !form.cycleMemberId) errors.cycleMemberId = "Choose a member.";
  [
    ["savingsAmount", "Savings amount"],
    ["loanRequestAmount", "Loan request"],
    ["loanTopUpAmount", "Loan top-up"],
    ["principalRepaymentAmount", "Principal repayment"],
    ["loanInterestRepaymentAmount", "Interest repayment"],
    ["commonInterestPaymentAmount", "Common interest"],
    ["otherObligationAmount", "Other obligation"],
  ].forEach(([key, label]) => {
    const error = numberError(form[key], label);
    if (error) errors[key] = error;
  });
  return errors;
}

export function declarationPayload({ form, cycleId, cycleMonthId }) {
  return {
    cycleId,
    cycleMonthId,
    cycleMemberId: form.cycleMemberId,
    savingsAmount: Number(form.savingsAmount || 0),
    loanRequestAmount: Number(form.loanRequestAmount || 0),
    loanTopUpAmount: Number(form.loanTopUpAmount || 0),
    principalRepaymentAmount: Number(form.principalRepaymentAmount || 0),
    loanInterestRepaymentAmount: Number(form.loanInterestRepaymentAmount || 0),
    commonInterestPaymentAmount: Number(form.commonInterestPaymentAmount || 0),
    otherObligationAmount: Number(form.otherObligationAmount || 0),
    notes: form.notes || null,
  };
}

export async function saveDeclarationForm({ form, cycleId, cycleMonthId, detail = null, declarationApi = api }) {
  const creating = !detail;
  const errors = validateDeclarationForm(form, { creating });
  if (!cycleId) errors.cycleId = "Choose a cycle.";
  if (!cycleMonthId) errors.cycleMonthId = "Choose a month.";
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  const payload = declarationPayload({ form, cycleId, cycleMonthId });
  if (detail) return declarationApi(`/declarations/${detail.id}`, { method: "PATCH", body: payload });
  return declarationApi("/declarations", { method: "POST", body: payload });
}

export async function approveDeclarationInputs({ declarationId, reason = "Reviewed and approved declaration inputs", declarationApi = api }) {
  return declarationApi(`/declarations/${declarationId}/approve-inputs`, { method: "POST", body: { reason } });
}

export async function createDeclarationLoanRequest({ declarationId, declarationApi = api }) {
  return declarationApi(`/declarations/${declarationId}/create-loan-request`, { method: "POST" });
}

export async function cancelDeclarationById({ declarationId, reason, declarationApi = api }) {
  return declarationApi(`/declarations/${declarationId}/cancel`, { method: "POST", body: { reason } });
}

export async function markMissedDeclaration({ member, cycleMonthId, declarationApi = api }) {
  return declarationApi("/declarations/missed", {
    method: "POST",
    body: {
      cycleId: member.cycle_id,
      cycleMonthId,
      cycleMemberId: member.cycle_member_id,
      penaltyTypeId: member.failure_penalty_type_id,
      amount: Number(member.failure_penalty_amount || 0),
      notes: "Marked missed and assessed from declaration queue",
    },
  });
}

function DeclarationForm({ form, setForm, errors, members, editing }) {
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="declaration-form">
      <div className="form-grid three">
        <Select
          label="Member"
          value={form.cycleMemberId}
          onChange={set("cycleMemberId")}
          placeholder="Select member"
          disabled={editing}
          error={errors.cycleMemberId}
          required
          options={(members || []).map((member) => ({ value: member.id, label: `${memberName(member)}${member.member_code ? ` (${member.member_code})` : ""}` }))}
        />
        <CurrencyInput label="Savings amount" value={form.savingsAmount} onChange={set("savingsAmount")} error={errors.savingsAmount} />
        <CurrencyInput label="Loan request" value={form.loanRequestAmount} onChange={set("loanRequestAmount")} error={errors.loanRequestAmount} />
        <CurrencyInput label="Loan top-up" value={form.loanTopUpAmount} onChange={set("loanTopUpAmount")} error={errors.loanTopUpAmount} />
        <CurrencyInput label="Principal repayment" value={form.principalRepaymentAmount} onChange={set("principalRepaymentAmount")} error={errors.principalRepaymentAmount} />
        <CurrencyInput label="Interest repayment" value={form.loanInterestRepaymentAmount} onChange={set("loanInterestRepaymentAmount")} error={errors.loanInterestRepaymentAmount} />
        <CurrencyInput label="Common interest" value={form.commonInterestPaymentAmount} onChange={set("commonInterestPaymentAmount")} error={errors.commonInterestPaymentAmount} />
        <CurrencyInput label="Other obligation" value={form.otherObligationAmount} onChange={set("otherObligationAmount")} error={errors.otherObligationAmount} />
      </div>
      <Textarea label="Notes" value={form.notes} onChange={set("notes")} rows={3} placeholder="Optional review note" />
    </div>
  );
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

function DeclarationDetail({ detail, onEdit, onApprove, onLoanRequest, onCancel, onClose, onViewAttachment, loading }) {
  const detailIsClosed = ["CANCELLED", "MISSED"].includes(detail.status);
  const hasLoanIntent = Number(detail.loan_request_amount || 0) > 0 || Number(detail.loan_top_up_amount || 0) > 0;
  const paymentTotal = Number(detail.principal_repayment_amount || 0)
    + Number(detail.loan_interest_repayment_amount || 0)
    + Number(detail.common_interest_payment_amount || 0);
  return (
    <section className="declaration-detail">
      <div className="declaration-detail-hero">
        <div className="declaration-avatar" aria-hidden="true">{initials(detail)}</div>
        <div>
          <span>Declaration Detail</span>
          <h2>{memberName(detail)}</h2>
          <p>{detail.cycle_name || "-"} · {detail.month_number ? `Month ${detail.month_number}` : "-"}</p>
        </div>
        <Badge text={detail.status} tone={statusTone(detail.status)} />
      </div>
      <div className="declaration-detail-strip" aria-label="Declaration financial summary">
        <DetailValue label="Savings" value={money(detail.savings_amount)} />
        <DetailValue label="Loan Intent" value={money(Number(detail.loan_request_amount || 0) + Number(detail.loan_top_up_amount || 0))} />
        <DetailValue label="Payments" value={money(paymentTotal)} />
      </div>
      <div className="detail-grid declaration-detail-grid">
        <DetailValue label="Cycle" value={detail.cycle_name || "-"} />
        <DetailValue label="Month" value={detail.month_number ? `Month ${detail.month_number}` : "-"} />
        <DetailValue label="Submitted" value={dateTime(detail.submitted_at)} />
        <DetailValue label="Savings" value={money(detail.savings_amount)} />
        <DetailValue label="Loan Request" value={money(detail.loan_request_amount)} />
        <DetailValue label="Top-up" value={money(detail.loan_top_up_amount)} />
        <DetailValue label="Principal Repay" value={money(detail.principal_repayment_amount)} />
        <DetailValue label="Interest Repay" value={money(detail.loan_interest_repayment_amount)} />
        <DetailValue label="Common Interest" value={money(detail.common_interest_payment_amount)} />
        <DetailValue label="Other Obligation" value={money(detail.other_obligation_amount)} />
        <DetailValue label="Loan Request Status" value={detail.has_loan_request ? "Created" : "Not created"} />
        <DetailValue label="Within Window" value={detail.is_within_window ? "Yes" : "No"} />
      </div>
      {detail.notes ? <p className="muted">{detail.notes}</p> : null}
      <section className="declaration-proof-review" aria-label="Payment proofs">
        <h3>Payment Proofs</h3>
        {detail.attachments?.length ? (
          <>
            <div className="declaration-proof-cards">
              {detail.attachments.map((attachment) => (
                <article className="declaration-proof-card" key={attachment.id}>
                  <Receipt size={18} aria-hidden="true" />
                  <div>
                    <strong>{proofTypeLabels[attachment.attachment_type] || attachment.attachment_type}</strong>
                    <span>{attachment.original_filename}</span>
                    <small>{dateTime(attachment.uploaded_at)}</small>
                  </div>
                  <Badge text={attachment.status} tone={attachment.status === "UPLOADED" ? "green" : "amber"} />
                  <Button type="button" size="sm" variant="secondary" icon={Eye} onClick={() => onViewAttachment(attachment)}>View</Button>
                </article>
              ))}
            </div>
            <div className="declaration-desktop-table">
              <DataTable
                columns={["Proof", "File", "Uploaded", "Status", "Action"]}
                rows={detail.attachments.map((attachment) => [
                  proofTypeLabels[attachment.attachment_type] || attachment.attachment_type,
                  attachment.original_filename,
                  dateTime(attachment.uploaded_at),
                  <Badge text={attachment.status} tone={attachment.status === "UPLOADED" ? "green" : "amber"} />,
                  <Button type="button" size="sm" variant="secondary" icon={Eye} onClick={() => onViewAttachment(attachment)}>View</Button>,
                ])}
              />
            </div>
          </>
        ) : (
          <p className="muted">No payment proof uploaded for this declaration.</p>
        )}
      </section>
      <div className="button-row declaration-detail-actions">
        <Button type="button" variant="secondary" icon={Edit3} onClick={onEdit} disabled={detailIsClosed}>Edit Declaration</Button>
        <Button type="button" icon={Banknote} onClick={onLoanRequest} disabled={detailIsClosed || detail.has_loan_request || !hasLoanIntent} loading={loading === "loan"}>
          {detail.has_loan_request ? "Loan Request Exists" : "Create Loan Request"}
        </Button>
        <Button type="button" icon={CheckCircle2} onClick={onApprove} disabled={detail.status === "APPROVED" || detailIsClosed} loading={loading === "approve"}>
          {detail.status === "APPROVED" ? "Inputs Approved" : "Approve Inputs"}
        </Button>
        <Button type="button" variant="danger" icon={XCircle} onClick={onCancel} disabled={detailIsClosed}>Cancel Declaration</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Close Detail</Button>
      </div>
    </section>
  );
}

function DeclarationHero({ queue, totals }) {
  return (
    <section className="declaration-hero" aria-label="Declaration queue overview">
      <div>
        <span>Declaration Queue</span>
        <h2>{queue.cycleMonth ? `${queue.cycleMonth.cycle_name} · Month ${queue.cycleMonth.month_number}` : "Select a declaration month"}</h2>
        <p>{queue.cycleMonth ? String(queue.cycleMonth.status || "OPEN").replaceAll("_", " ") : "Choose an active cycle month to review member submissions."}</p>
      </div>
      <div className="declaration-hero-stats">
        <strong>{totals.submitted}</strong>
        <span>Submitted</span>
        <strong>{totals.missed}</strong>
        <span>Missed</span>
      </div>
    </section>
  );
}

function SubmittedDeclarationCards({ declarations, selectedId, busy, onOpen }) {
  return (
    <div className="declaration-mobile-cards" aria-label="Submitted declaration cards">
      {!declarations.length ? <EmptyState title="No submitted declarations" message="No submitted declarations for this month." /> : null}
      {declarations.map((item) => (
        <article className={`declaration-queue-card ${selectedId === item.id ? "selected" : ""}`} key={item.id}>
          <div className="declaration-card-head">
            <div className="declaration-avatar" aria-hidden="true">{initials(item)}</div>
            <div>
              <strong>{memberName(item)}</strong>
              <span>{item.member_code || "Member"} · {dateOnly(item.submitted_at)}</span>
            </div>
            <Badge text={item.status} tone={statusTone(item.status)} />
          </div>
          <div className="declaration-card-values">
            <DetailValue label="Savings" value={money(item.savings_amount)} />
            <DetailValue label="Loan" value={money(Number(item.loan_request_amount || 0) + Number(item.loan_top_up_amount || 0))} />
            <DetailValue label="Repayments" value={money(Number(item.principal_repayment_amount || 0) + Number(item.loan_interest_repayment_amount || 0))} />
          </div>
          <div className="declaration-card-foot">
            <span>{item.has_loan_request ? "Loan request created" : item.has_loan_intent ? "Loan request needed" : "No loan intent"}</span>
            <Button type="button" variant={selectedId === item.id ? "primary" : "secondary"} size="sm" onClick={() => onOpen(item.id)} loading={busy === `detail-${item.id}`}>View Details</Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function MissedDeclarationCards({ members, busy, onAssess }) {
  return (
    <div className="declaration-mobile-cards" aria-label="Missed declaration cards">
      {!members.length ? <EmptyState title="No missed declarations" message="No missed declarations for this month." /> : null}
      {members.map((item) => (
        <article className="declaration-queue-card missed" key={item.cycle_member_id}>
          <div className="declaration-card-head">
            <div className="declaration-avatar" aria-hidden="true">{initials(item)}</div>
            <div>
              <strong>{memberName(item)}</strong>
              <span>{item.member_code || "Member code unavailable"}</span>
            </div>
            <Badge text={item.has_failure_penalty ? "PENALTY ASSESSED" : "MISSED"} tone={item.has_failure_penalty ? "green" : "red"} />
          </div>
          <div className="declaration-card-values">
            <DetailValue label="Penalty" value={money(item.failure_penalty_amount)} />
            <DetailValue label="Status" value={item.has_failure_penalty ? "Assessed" : "Pending"} />
          </div>
          <div className="declaration-card-foot">
            <span>Failure-to-declare review</span>
            <Button
              type="button"
              variant={item.has_failure_penalty ? "secondary" : "danger"}
              size="sm"
              disabled={item.has_failure_penalty}
              onClick={() => onAssess(item)}
              loading={busy === `missed-${item.cycle_member_id}`}
            >
              {item.has_failure_penalty ? "Penalty Assessed" : "Assess Penalty"}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DeclarationScreensPage({
  declarationApi = api,
  initialCycles = undefined,
  initialCycleDetail = null,
  initialQueue = null,
}) {
  const [cycles, setCycles] = useState(initialCycles || []);
  const [cycleDetail, setCycleDetail] = useState(initialCycleDetail || { months: [], members: [] });
  const [cycleId, setCycleId] = useState(initialCycles?.[0]?.id || "");
  const [cycleMonthId, setCycleMonthId] = useState(initialCycleDetail?.months?.[0]?.id || "");
  const [queue, setQueue] = useState(initialQueue || { cycleMonth: null, declarations: [], missed: [] });
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState("submitted");
  const [formMode, setFormMode] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [cancelReason, setCancelReason] = useState("Cancelled after admin review");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [loading, setLoading] = useState(initialQueue === null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadCycles() {
    setError("");
    try {
      const response = await declarationApi("/cycles");
      const rows = response.data || [];
      setCycles(rows);
      const selected = rows.find((cycle) => cycle.status === "ACTIVE") || rows[0];
      if (selected && !cycleId) setCycleId(selected.id);
    } catch (err) {
      setError(err.message || "Cycles could not load.");
    }
  }

  async function loadCycleDetail(id = cycleId) {
    if (!id) return;
    setError("");
    try {
      const response = await declarationApi(`/cycles/${id}`);
      setCycleDetail({ months: response.months || [], members: response.members || [] });
      const month = (response.months || []).find((item) => item.status === "DECLARATION_PERIOD")
        || (response.months || []).find((item) => item.status === "OPEN")
        || response.months?.[0];
      if (month) setCycleMonthId(month.id);
    } catch (err) {
      setError(err.message || "Cycle months and members could not load.");
    }
  }

  async function loadQueue(monthId = cycleMonthId) {
    if (!monthId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("cycleMonthId", monthId);
      if (cycleId) params.set("cycleId", cycleId);
      const response = await declarationApi(`/declarations/queue?${params.toString()}`);
      setQueue(response.data || { cycleMonth: null, declarations: [], missed: [] });
      setDetail((current) => {
        if (!current) return current;
        return response.data?.declarations?.find((item) => item.id === current.id) || current;
      });
    } catch (err) {
      setError(err.message || "Declaration queue could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialCycles === undefined) loadCycles();
  }, []);

  useEffect(() => {
    if (cycleId && initialCycleDetail === null) loadCycleDetail(cycleId);
  }, [cycleId]);

  useEffect(() => {
    if (cycleMonthId && initialQueue === null) loadQueue(cycleMonthId);
  }, [cycleMonthId]);

  function startNewDeclaration() {
    const firstMember = cycleDetail.members?.find((member) => member.status === "ACTIVE") || cycleDetail.members?.[0];
    setForm({ ...EMPTY_FORM, cycleMemberId: firstMember?.id || "" });
    setFormErrors({});
    setFormMode("new");
    setMessage("");
    setError("");
  }

  function startEditDeclaration() {
    if (!detail) return;
    setForm({
      cycleMemberId: detail.cycle_member_id,
      savingsAmount: String(detail.savings_amount || ""),
      loanRequestAmount: String(detail.loan_request_amount || ""),
      loanTopUpAmount: String(detail.loan_top_up_amount || ""),
      principalRepaymentAmount: String(detail.principal_repayment_amount || ""),
      loanInterestRepaymentAmount: String(detail.loan_interest_repayment_amount || ""),
      commonInterestPaymentAmount: String(detail.common_interest_payment_amount || ""),
      otherObligationAmount: String(detail.other_obligation_amount || ""),
      notes: detail.notes || "",
    });
    setFormErrors({});
    setFormMode("edit");
  }

  async function submitDeclaration(event) {
    event.preventDefault();
    setBusy("save");
    setMessage("");
    setError("");
    try {
      const response = await saveDeclarationForm({
        form,
        cycleId,
        cycleMonthId,
        detail: formMode === "edit" ? detail : null,
        declarationApi,
      });
      const saved = response.data || response;
      setFormMode("");
      await loadQueue();
      if (saved?.id) await openDeclaration(saved.id);
      setMessage(formMode === "edit" ? "Declaration updated. Review and approve inputs again if needed." : "Declaration submitted.");
    } catch (err) {
      if (err.validationErrors) setFormErrors(err.validationErrors);
      else setError(err.message || "Declaration could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function openDeclaration(id) {
    setSelectedId(id);
    setMessage("");
    setError("");
    setBusy(`detail-${id}`);
    try {
      const [response, attachmentsResponse] = await Promise.all([
        declarationApi(`/declarations/${id}`),
        declarationApi(`/declarations/${id}/attachments`),
      ]);
      setDetail({ ...response.data, attachments: attachmentsResponse.data || [] });
      setActiveTab("submitted");
    } catch (err) {
      setError(err.message || "Declaration detail could not load.");
    } finally {
      setBusy("");
    }
  }

  async function viewAttachment(attachment) {
    setBusy(`attachment-${attachment.id}`);
    setError("");
    try {
      const response = await declarationApi(`/declarations/attachments/${attachment.id}/download-url`);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Payment proof could not be opened.");
    } finally {
      setBusy("");
    }
  }

  async function approveInputs() {
    if (!detail) return;
    setBusy("approve");
    setMessage("");
    setError("");
    try {
      await approveDeclarationInputs({ declarationId: detail.id, declarationApi });
      setMessage("Declaration inputs approved and financial postings processed.");
      await openDeclaration(detail.id);
      await loadQueue();
    } catch (err) {
      setError(err.message || "Declaration inputs could not be approved.");
    } finally {
      setBusy("");
    }
  }

  async function createLoanRequest() {
    if (!detail) return;
    setBusy("loan");
    setMessage("");
    setError("");
    try {
      await createDeclarationLoanRequest({ declarationId: detail.id, declarationApi });
      setMessage("Loan request created from declaration.");
      await openDeclaration(detail.id);
      await loadQueue();
    } catch (err) {
      setError(err.message || "Loan request could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function cancelDeclaration() {
    if (!detail) return;
    setBusy("cancel");
    setMessage("");
    setError("");
    try {
      await cancelDeclarationById({ declarationId: detail.id, reason: cancelReason || "Cancelled after admin review", declarationApi });
      setCancelOpen(false);
      setMessage("Declaration cancelled.");
      await openDeclaration(detail.id);
      await loadQueue();
    } catch (err) {
      setError(err.message || "Declaration could not be cancelled.");
    } finally {
      setBusy("");
    }
  }

  async function assessMissedPenalty(member) {
    setBusy(`missed-${member.cycle_member_id}`);
    setMessage("");
    setError("");
    try {
      if (!queue.cycleMonth?.id) throw new Error("No cycle month selected.");
      if (!member.failure_penalty_type_id) throw new Error("Failure-to-declare penalty type is not configured for this cycle.");
      await markMissedDeclaration({ member, cycleMonthId: queue.cycleMonth.id, declarationApi });
      setMessage(`${memberName(member)} marked missed and penalty assessed.`);
      await loadQueue();
    } catch (err) {
      setError(err.message || "Missed declaration penalty could not be assessed.");
    } finally {
      setBusy("");
    }
  }

  const totals = useMemo(() => {
    const declarations = queue.declarations || [];
    return {
      submitted: declarations.length,
      missed: queue.missed?.length || 0,
      approved: declarations.filter((item) => item.status === "APPROVED").length,
      savings: declarations.reduce((sum, item) => sum + Number(item.savings_amount || 0), 0),
      loanIntent: declarations.reduce((sum, item) => sum + Number(item.loan_request_amount || 0) + Number(item.loan_top_up_amount || 0), 0),
      repayments: declarations.reduce((sum, item) => sum + Number(item.principal_repayment_amount || 0) + Number(item.loan_interest_repayment_amount || 0), 0),
    };
  }, [queue]);

  return (
    <Page
      title="Declarations"
      className="declarations-page"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={() => loadQueue()} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={Plus} onClick={startNewDeclaration}>Create Declaration</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Declaration action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Declaration action failed">{error}</Alert> : null}

      <DeclarationHero queue={queue} totals={totals} />

      <section className="panel declaration-filters">
        <div className="form-grid three">
          <Select
            label="Cycle"
            value={cycleId}
            onChange={setCycleId}
            placeholder="Choose cycle"
            options={cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.name} - ${cycle.status}` }))}
          />
          <Select
            label="Month"
            value={cycleMonthId}
            onChange={setCycleMonthId}
            placeholder="Choose month"
            options={(cycleDetail.months || []).map((month) => ({ value: month.id, label: `Month ${month.month_number} - ${String(month.status || "OPEN").replaceAll("_", " ")}` }))}
          />
          <div className="queue-note">
            {queue.cycleMonth ? `${queue.cycleMonth.cycle_name} - Month ${queue.cycleMonth.month_number}` : "Select an active cycle month"}
          </div>
        </div>
      </section>

      <div className="metrics declaration-metrics">
        <Card title="Submitted" value={totals.submitted} note={`${totals.approved} approved`} icon={ClipboardList} />
        <Card title="Missed" value={totals.missed} note="Members not declared" tone="amber" icon={AlertTriangle} />
        <Card title="Declared Savings" value={money(totals.savings)} note="Pending or posted" tone="green" icon={PiggyBank} />
        <Card title="Loan Intent" value={money(totals.loanIntent)} note={`${money(totals.repayments)} repayments`} tone="blue" icon={Banknote} />
      </div>

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : null}

      <div className="admin-mobile-action-row declaration-mobile-actions mobile-only" aria-label="Declaration quick actions">
        <Button type="button" icon={RefreshCw} onClick={() => loadQueue()} loading={loading}>Refresh</Button>
        <Button type="button" variant="secondary" icon={Plus} onClick={startNewDeclaration}>New</Button>
      </div>

      <Modal
        open={Boolean(detail)}
        title="Declaration Details"
        size="lg"
        onClose={() => { setDetail(null); setSelectedId(""); }}
      >
        {detail ? (
          <div className="declaration-detail-modal">
            <DeclarationDetail
              detail={detail}
              onEdit={startEditDeclaration}
              onApprove={approveInputs}
              onLoanRequest={createLoanRequest}
              onCancel={() => setCancelOpen(true)}
              onClose={() => { setDetail(null); setSelectedId(""); }}
              onViewAttachment={viewAttachment}
              loading={busy}
            />
          </div>
        ) : null}
      </Modal>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        label="Declaration queue tabs"
        tabs={[
          { id: "submitted", label: "Submitted" },
          { id: "missed", label: "Missed" },
          { id: "summary", label: "Summary" },
        ]}
      />

      {activeTab === "submitted" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Submitted Declarations</h2>
          </div>
          <SubmittedDeclarationCards declarations={queue.declarations || []} selectedId={selectedId} busy={busy} onOpen={openDeclaration} />
          <div className="declaration-desktop-table">
            <DataTable
              columns={["Member", "Submitted", "Savings", "Loan", "Repayments", "Status", "Loan Request", "Action"]}
              rows={(queue.declarations || []).map((item) => [
                memberName(item),
                dateOnly(item.submitted_at),
                money(item.savings_amount),
                money(Number(item.loan_request_amount || 0) + Number(item.loan_top_up_amount || 0)),
                money(Number(item.principal_repayment_amount || 0) + Number(item.loan_interest_repayment_amount || 0)),
                <Badge text={item.status} tone={statusTone(item.status)} />,
                item.has_loan_request ? "Created" : item.has_loan_intent ? "Needed" : "-",
                <Button type="button" variant={selectedId === item.id ? "primary" : "secondary"} size="sm" onClick={() => openDeclaration(item.id)} loading={busy === `detail-${item.id}`}>View Details</Button>,
              ])}
              empty="No submitted declarations for this month."
            />
          </div>
        </section>
      ) : null}

      {activeTab === "missed" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Missed Declarations</h2>
          </div>
          <MissedDeclarationCards members={queue.missed || []} busy={busy} onAssess={assessMissedPenalty} />
          <div className="declaration-desktop-table">
            <DataTable
              columns={["Member", "Code", "Penalty", "Status", "Action"]}
              rows={(queue.missed || []).map((item) => [
                memberName(item),
                item.member_code || "-",
                money(item.failure_penalty_amount),
                <Badge text={item.has_failure_penalty ? "PENALTY ASSESSED" : "MISSED"} tone={item.has_failure_penalty ? "green" : "red"} />,
                <Button
                  type="button"
                  variant={item.has_failure_penalty ? "secondary" : "danger"}
                  size="sm"
                  disabled={item.has_failure_penalty}
                  onClick={() => assessMissedPenalty(item)}
                  loading={busy === `missed-${item.cycle_member_id}`}
                >
                  {item.has_failure_penalty ? "Penalty Assessed" : "Assess Penalty"}
                </Button>,
              ])}
              empty="No missed declarations for this month."
            />
          </div>
        </section>
      ) : null}

      {activeTab === "summary" ? (
        <section className="panel">
          <h2>Monthly Declaration Summary</h2>
          {queue.cycleMonth ? (
            <div className="detail-grid declaration-detail-grid">
              <DetailValue label="Cycle Month" value={`Month ${queue.cycleMonth.month_number}`} />
              <DetailValue label="Status" value={String(queue.cycleMonth.status || "-").replaceAll("_", " ")} />
              <DetailValue label="Period" value={`${dateOnly(queue.cycleMonth.start_date)} to ${dateOnly(queue.cycleMonth.end_date)}`} />
              <DetailValue label="Submitted" value={totals.submitted} />
              <DetailValue label="Missed" value={totals.missed} />
              <DetailValue label="Approved" value={totals.approved} />
              <DetailValue label="Declared Savings" value={money(totals.savings)} />
              <DetailValue label="Loan Intent" value={money(totals.loanIntent)} />
              <DetailValue label="Repayments" value={money(totals.repayments)} />
            </div>
          ) : (
            <EmptyState title="No declaration month" message="Choose a cycle and generated month to view declaration progress." />
          )}
        </section>
      ) : null}

      <Modal
        open={Boolean(formMode)}
        title={formMode === "edit" ? "Edit Declaration" : "New Declaration"}
        size="lg"
        onClose={() => setFormMode("")}
        footer={(
          <div className="button-row">
            <Button type="button" variant="secondary" onClick={() => setFormMode("")}>Cancel</Button>
            <Button type="button" onClick={submitDeclaration} loading={busy === "save"}>
              {formMode === "edit" ? "Save Declaration" : "Submit Declaration"}
            </Button>
          </div>
        )}
      >
        <form onSubmit={submitDeclaration}>
          <DeclarationForm form={form} setForm={setForm} errors={formErrors} members={cycleDetail.members} editing={formMode === "edit"} />
        </form>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel Declaration"
        message="This keeps the audit history and removes the declaration from normal monthly processing."
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onCancel={() => setCancelOpen(false)}
        onConfirm={cancelDeclaration}
        confirmLabel="Cancel Declaration"
        loading={busy === "cancel"}
      />
    </Page>
  );
}
