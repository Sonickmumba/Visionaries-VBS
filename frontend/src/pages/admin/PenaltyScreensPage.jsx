import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  ClipboardList,
  RefreshCw,
  Receipt,
  RotateCcw,
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
  Pagination,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/penalties.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

const ASSESS_FORM = {
  cycleMemberId: "",
  penaltyTypeId: "",
  amount: "",
  notes: "",
};

function memberName(item) {
  return `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "Member";
}

function outstanding(penalty) {
  return Math.max(0, Number(penalty?.amount_assessed || 0) - Number(penalty?.amount_paid || 0));
}

function statusTone(status) {
  if (status === "PAID" || status === "CONVERTED_TO_LOAN") return "green";
  if (status === "PARTIALLY_PAID") return "amber";
  if (status === "WAIVED" || status === "REVERSED") return "gray";
  return "red";
}

function canAct(penalty) {
  return penalty && !["PAID", "CONVERTED_TO_LOAN", "WAIVED", "REVERSED"].includes(penalty.status);
}

export function validatePenaltyAssessment(form, context) {
  const errors = {};
  if (!context?.cycle?.id || !context?.cycleMonth?.id) errors.context = "Penalty context is not ready.";
  if (!form.cycleMemberId) errors.cycleMemberId = "Choose a member.";
  if (!form.penaltyTypeId) errors.penaltyTypeId = "Choose a penalty type.";
  if (form.amount !== "" && Number(form.amount) <= 0) errors.amount = "Penalty amount must be greater than zero.";
  return errors;
}

export function penaltyAssessmentPayload({ form, context }) {
  return {
    cycleId: context.cycle.id,
    cycleMonthId: context.cycleMonth.id,
    cycleMemberId: form.cycleMemberId,
    penaltyTypeId: form.penaltyTypeId,
    amount: form.amount === "" ? null : Number(form.amount),
    notes: form.notes || null,
  };
}

export function validatePenaltyPayment({ penalty, amount }) {
  const errors = {};
  const value = Number(amount || 0);
  if (!penalty) errors.penalty = "Choose a penalty.";
  if (!Number.isFinite(value) || value <= 0) errors.paymentAmount = "Payment amount must be greater than zero.";
  if (penalty && value > outstanding(penalty)) errors.paymentAmount = `Payment exceeds outstanding balance of ${money(outstanding(penalty))}.`;
  return errors;
}

export async function assessPenalty({ form, context, penaltiesApi = api }) {
  const errors = validatePenaltyAssessment(form, context);
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return penaltiesApi("/penalties", { method: "POST", body: penaltyAssessmentPayload({ form, context }) });
}

export async function payPenalty({ penalty, amount, penaltiesApi = api }) {
  const errors = validatePenaltyPayment({ penalty, amount });
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return penaltiesApi(`/penalties/${penalty.id}/pay`, { method: "POST", body: { amount: Number(amount) } });
}

export async function convertPenaltyToLoan({ penalty, reason, penaltiesApi = api }) {
  if (!String(reason || "").trim()) {
    const error = new Error("Validation failed");
    error.validationErrors = { conversionReason: "Conversion reason is required." };
    throw error;
  }
  return penaltiesApi(`/penalties/${penalty.id}/convert-to-loan`, { method: "POST", body: { reason: reason.trim() } });
}

export async function waivePenaltyById({ penalty, reason, penaltiesApi = api }) {
  if (!String(reason || "").trim()) {
    const error = new Error("Validation failed");
    error.validationErrors = { waiveReason: "Waive reason is required." };
    throw error;
  }
  return penaltiesApi(`/penalties/${penalty.id}/waive`, { method: "POST", body: { reason: reason.trim() } });
}

export async function reversePenaltyById({ penalty, reason, penaltiesApi = api }) {
  if (!String(reason || "").trim()) {
    const error = new Error("Validation failed");
    error.validationErrors = { reverseReason: "Reverse reason is required." };
    throw error;
  }
  return penaltiesApi(`/penalties/${penalty.id}/reverse`, { method: "POST", body: { reason: reason.trim() } });
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

function PenaltyDetail({
  selected,
  paymentAmount,
  setPaymentAmount,
  conversionReason,
  setConversionReason,
  waiveReason,
  setWaiveReason,
  reverseReason,
  setReverseReason,
  errors,
  onPay,
  onConvert,
  onWaive,
  onReverse,
  onClose,
  busy,
}) {
  return (
    <section className="panel penalty-detail">
      <div className="panel-head">
        <h2>Penalty Detail: {memberName(selected)}</h2>
        <Badge text={selected.status} tone={statusTone(selected.status)} />
      </div>
      <div className="detail-grid penalty-detail-grid">
        <DetailValue label="Type" value={selected.penalty_name || "-"} />
        <DetailValue label="Assessed" value={money(selected.amount_assessed)} />
        <DetailValue label="Paid" value={money(selected.amount_paid)} />
        <DetailValue label="Outstanding" value={money(outstanding(selected))} />
        <DetailValue label="Assessed Date" value={dateOnly(selected.assessed_at)} />
        <DetailValue label="Cycle Month" value={selected.cycle_month_id ? String(selected.cycle_month_id).slice(0, 8) : "-"} />
      </div>
      <div className="form-grid four">
        <CurrencyInput label="Payment amount" value={paymentAmount} onChange={setPaymentAmount} error={errors.paymentAmount} />
        <Field label="Conversion reason" value={conversionReason} onChange={setConversionReason} error={errors.conversionReason} />
        <Field label="Waive reason" value={waiveReason} onChange={setWaiveReason} error={errors.waiveReason} />
        <Field label="Reverse reason" value={reverseReason} onChange={setReverseReason} error={errors.reverseReason} />
      </div>
      <div className="button-row">
        <Button type="button" onClick={onPay} disabled={!canAct(selected)} loading={busy === "pay"}>Mark Paid</Button>
        <Button type="button" variant="danger" onClick={onConvert} disabled={!canAct(selected) || outstanding(selected) <= 0} loading={busy === "convert"}>Convert to Loan</Button>
        <Button type="button" variant="secondary" onClick={onWaive} disabled={!canAct(selected)} loading={busy === "waive"}>Waive</Button>
        <Button type="button" variant="secondary" icon={RotateCcw} onClick={onReverse} disabled={selected.status !== "ASSESSED" || Number(selected.amount_paid || 0) > 0} loading={busy === "reverse"}>Reverse</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Close Detail</Button>
      </div>
    </section>
  );
}

function AssessmentForm({ form, setForm, context, penaltyTypes, errors }) {
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedType = penaltyTypes.find((type) => type.id === form.penaltyTypeId);
  return (
    <div className="penalty-form">
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
        <Select
          label="Penalty type"
          value={form.penaltyTypeId}
          onChange={(value) => {
            const type = penaltyTypes.find((item) => item.id === value);
            setForm((current) => ({ ...current, penaltyTypeId: value, amount: type?.amount ? String(type.amount) : current.amount }));
          }}
          placeholder="Choose penalty type"
          error={errors.penaltyTypeId}
          options={penaltyTypes.map((type) => ({ value: type.id, label: `${type.name} - ${money(type.amount)}` }))}
        />
        <CurrencyInput label="Amount" value={form.amount} onChange={set("amount")} error={errors.amount} hint={selectedType ? `Default ${money(selectedType.amount)}` : ""} />
      </div>
      <Textarea label="Notes" value={form.notes} onChange={set("notes")} rows={3} placeholder="Optional audit note" />
    </div>
  );
}

export function PenaltyScreensPage({
  penaltiesApi = api,
  initialPenalties = undefined,
  initialContext = undefined,
  initialPenaltyTypes = [],
}) {
  const [penalties, setPenalties] = useState(initialPenalties || []);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [context, setContext] = useState(initialContext || { cycle: null, cycleMonth: null, members: [] });
  const [penaltyTypes, setPenaltyTypes] = useState(initialPenaltyTypes);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("register");
  const [modal, setModal] = useState("");
  const [assessForm, setAssessForm] = useState({ ...ASSESS_FORM });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [conversionReason, setConversionReason] = useState("Unpaid penalty converted by admin review");
  const [waiveReason, setWaiveReason] = useState("Waived by admin review");
  const [reverseReason, setReverseReason] = useState("Reversed after admin review");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialPenalties === undefined);
  const [busy, setBusy] = useState("");

  async function loadPenalties(page = pagination.page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (statusFilter) params.set("status", statusFilter);
      const response = await penaltiesApi(`/penalties?${params.toString()}`);
      setPenalties(response.data || []);
      setPagination(response.pagination || { page, totalPages: 1 });
      if (selected) setSelected((response.data || []).find((item) => item.id === selected.id) || selected);
    } catch (err) {
      setError(err.message || "Penalties could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function loadContext() {
    try {
      const response = await penaltiesApi("/savings/posting-context");
      const data = response.data || { cycle: null, cycleMonth: null, members: [] };
      setContext(data);
      if (data.cycle?.id) {
        const settings = await penaltiesApi(`/settings/context?cycleId=${data.cycle.id}`).catch(() => ({ data: { penaltyTypes: [] } }));
        setPenaltyTypes(settings.data?.penaltyTypes || []);
      }
    } catch {
      setContext({ cycle: null, cycleMonth: null, members: [] });
    }
  }

  useEffect(() => {
    if (initialPenalties === undefined) loadPenalties(1);
    if (initialContext === undefined) loadContext();
  }, []);

  function choosePenalty(penalty) {
    setSelected(penalty);
    const remaining = outstanding(penalty);
    setPaymentAmount(remaining > 0 ? String(remaining) : "");
    setConversionReason("Unpaid penalty converted by admin review");
    setWaiveReason("Waived by admin review");
    setReverseReason("Reversed after admin review");
    setErrors({});
    setMessage("");
    setError("");
  }

  function openAssessment() {
    const member = context.members?.[0];
    const type = penaltyTypes?.[0];
    setAssessForm({
      ...ASSESS_FORM,
      cycleMemberId: member?.cycle_member_id || "",
      penaltyTypeId: type?.id || "",
      amount: type?.amount ? String(type.amount) : "",
    });
    setErrors({});
    setModal("assess");
  }

  async function submitAssessment(event) {
    event.preventDefault();
    setBusy("assess");
    setErrors({});
    setMessage("");
    setError("");
    try {
      await assessPenalty({ form: assessForm, context, penaltiesApi });
      setModal("");
      setMessage("Penalty assessed.");
      await loadPenalties(1);
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Penalty could not be assessed.");
    } finally {
      setBusy("");
    }
  }

  async function runAction(kind, action) {
    if (!selected) return;
    setBusy(kind);
    setErrors({});
    setMessage("");
    setError("");
    try {
      await action();
      const labels = {
        pay: "Penalty payment posted.",
        convert: "Penalty converted to loan.",
        waive: "Penalty waived.",
        reverse: "Penalty reversed.",
      };
      setMessage(labels[kind]);
      await loadPenalties(pagination.page);
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Penalty action failed.");
    } finally {
      setBusy("");
    }
  }

  const totals = useMemo(() => {
    const assessed = penalties.reduce((sum, penalty) => sum + Number(penalty.amount_assessed || 0), 0);
    const paid = penalties.reduce((sum, penalty) => sum + Number(penalty.amount_paid || 0), 0);
    const remaining = penalties.reduce((sum, penalty) => sum + outstanding(penalty), 0);
    return {
      assessed,
      paid,
      outstanding: remaining,
      converted: penalties.filter((penalty) => penalty.status === "CONVERTED_TO_LOAN").length,
    };
  }, [penalties]);

  return (
    <Page
      title="Penalties"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={() => loadPenalties(pagination.page)} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={AlertTriangle} onClick={openAssessment}>Assess Penalty</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Penalty action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Penalty action failed">{error}</Alert> : null}
      {errors.context ? <Alert tone="danger" title="Penalty context unavailable">{errors.context}</Alert> : null}

      <div className="metrics penalty-metrics">
        <Card title="Assessed" value={money(totals.assessed)} note={`${penalties.length} penalties`} tone="amber" icon={AlertTriangle} />
        <Card title="Paid" value={money(totals.paid)} note="Collected penalties" icon={Receipt} />
        <Card title="Outstanding" value={money(totals.outstanding)} note="Needs action" tone="red" icon={BadgeDollarSign} />
        <Card title="Converted" value={totals.converted} note="Penalty loans" tone="blue" icon={Banknote} />
      </div>

      {selected ? (
        <PenaltyDetail
          selected={selected}
          paymentAmount={paymentAmount}
          setPaymentAmount={setPaymentAmount}
          conversionReason={conversionReason}
          setConversionReason={setConversionReason}
          waiveReason={waiveReason}
          setWaiveReason={setWaiveReason}
          reverseReason={reverseReason}
          setReverseReason={setReverseReason}
          errors={errors}
          busy={busy}
          onPay={() => runAction("pay", () => payPenalty({ penalty: selected, amount: paymentAmount, penaltiesApi }))}
          onConvert={() => runAction("convert", () => convertPenaltyToLoan({ penalty: selected, reason: conversionReason, penaltiesApi }))}
          onWaive={() => runAction("waive", () => waivePenaltyById({ penalty: selected, reason: waiveReason, penaltiesApi }))}
          onReverse={() => runAction("reverse", () => reversePenaltyById({ penalty: selected, reason: reverseReason, penaltiesApi }))}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        label="Penalty tabs"
        tabs={[
          { id: "register", label: "Penalty Register" },
          { id: "types", label: "Penalty Types" },
        ]}
      />

      {activeTab === "register" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Penalty Register</h2>
            <div className="button-row compact">
              <Select
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All"
                options={["ASSESSED", "PARTIALLY_PAID", "PAID", "CONVERTED_TO_LOAN", "WAIVED", "REVERSED"]}
                className="inline-field"
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => loadPenalties(1)}>Apply</Button>
            </div>
          </div>
          {loading ? <Skeleton lines={7} /> : penalties.length ? (
            <>
              <DataTable
                columns={["Member", "Type", "Assessed", "Paid", "Outstanding", "Status", "Action"]}
                rows={penalties.map((penalty) => [
                  memberName(penalty),
                  penalty.penalty_name,
                  money(penalty.amount_assessed),
                  money(penalty.amount_paid),
                  money(outstanding(penalty)),
                  <Badge text={penalty.status} tone={statusTone(penalty.status)} />,
                  <Button type="button" size="sm" variant={selected?.id === penalty.id ? "primary" : "secondary"} onClick={() => choosePenalty(penalty)}>View Details</Button>,
                ])}
              />
              <Pagination
                page={pagination.page || 1}
                totalPages={pagination.totalPages || 1}
                disabled={loading}
                onPageChange={loadPenalties}
              />
            </>
          ) : (
            <EmptyState title="No penalties found" message="Assess penalties manually or from missed declarations, then collect, waive, reverse, or convert unpaid balances into loans." />
          )}
        </section>
      ) : null}

      {activeTab === "types" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Penalty Types</h2>
          </div>
          <DataTable
            columns={["Code", "Name", "Amount", "Convertible", "Status"]}
            rows={(penaltyTypes || []).map((type) => [
              type.code,
              type.name,
              money(type.amount),
              type.is_convertible_to_loan ? "Yes" : "No",
              <Badge text={type.is_active === false ? "Inactive" : "Active"} tone={type.is_active === false ? "gray" : "green"} />,
            ])}
            empty="No penalty types found for the active cycle."
          />
        </section>
      ) : null}

      <Modal
        open={modal === "assess"}
        title="Assess Penalty"
        size="lg"
        onClose={() => setModal("")}
        footer={(
          <div className="button-row">
            <Button type="button" variant="secondary" onClick={() => setModal("")}>Cancel</Button>
            <Button type="button" onClick={submitAssessment} loading={busy === "assess"}>Assess Penalty</Button>
          </div>
        )}
      >
        <form onSubmit={submitAssessment}>
          <AssessmentForm form={assessForm} setForm={setAssessForm} context={context} penaltyTypes={penaltyTypes} errors={errors} />
        </form>
      </Modal>
    </Page>
  );
}
