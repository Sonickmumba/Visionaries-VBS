import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Edit3,
  FolderPlus,
  Lock,
  Plus,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  CurrencyInput,
  DataTable,
  DateInput,
  EmptyState,
  Field,
  Modal,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/cycles.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const percent = (value) => `${(Number(value || 0) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

const DEFAULT_FORM = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  savingsCap: "30000",
  minimumBorrowingAmount: "20000",
  savingsInterestRate: "0.15",
  loanInterestRate: "0.15",
  commonInterestRate: "0.15",
  socialFundAmount: "240",
  membershipFeeAmount: "80",
  declarationStartDay: "28",
  declarationEndDay: "3",
  payoutStartDay: "4",
  payoutEndDay: "5",
  reason: "",
};

const ruleFields = [
  "savingsCap",
  "minimumBorrowingAmount",
  "savingsInterestRate",
  "loanInterestRate",
  "commonInterestRate",
  "socialFundAmount",
  "membershipFeeAmount",
  "declarationStartDay",
  "declarationEndDay",
  "payoutStartDay",
  "payoutEndDay",
];

function statusTone(status) {
  if (status === "ACTIVE") return "green";
  if (status === "CLOSED" || status === "ARCHIVED") return "gray";
  return "amber";
}

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formFromCycle(cycle) {
  if (!cycle) return DEFAULT_FORM;
  return {
    name: cycle.name || "",
    description: cycle.description || "",
    startDate: normalizeDate(cycle.start_date),
    endDate: normalizeDate(cycle.end_date),
    savingsCap: String(cycle.savings_cap ?? ""),
    minimumBorrowingAmount: String(cycle.minimum_borrowing_amount ?? ""),
    savingsInterestRate: String(cycle.savings_interest_rate ?? ""),
    loanInterestRate: String(cycle.loan_interest_rate ?? ""),
    commonInterestRate: String(cycle.common_interest_rate ?? ""),
    socialFundAmount: String(cycle.social_fund_amount ?? ""),
    membershipFeeAmount: String(cycle.membership_fee_amount ?? ""),
    declarationStartDay: String(cycle.declaration_start_day ?? ""),
    declarationEndDay: String(cycle.declaration_end_day ?? ""),
    payoutStartDay: String(cycle.payout_start_day ?? ""),
    payoutEndDay: String(cycle.payout_end_day ?? ""),
    reason: "",
  };
}

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

function numericError(value, label, { min = 0, max = Infinity } = {}) {
  if (isBlank(value)) return `${label} is required.`;
  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} must be a valid number.`;
  if (number < min) return `${label} cannot be below ${min}.`;
  if (number > max) return `${label} cannot exceed ${max}.`;
  return "";
}

export function validateCycleForm(form, { requiresReason = false } = {}) {
  const errors = {};
  if (isBlank(form.name)) errors.name = "Cycle name is required.";
  if (isBlank(form.startDate)) errors.startDate = "Start date is required.";
  if (isBlank(form.endDate)) errors.endDate = "End date is required.";
  if (form.startDate && form.endDate && form.endDate < form.startDate) errors.endDate = "End date must be after the start date.";

  [
    ["savingsCap", "Savings cap"],
    ["minimumBorrowingAmount", "Minimum borrowing"],
    ["socialFundAmount", "Social fund"],
    ["membershipFeeAmount", "Membership fee"],
  ].forEach(([key, label]) => {
    const error = numericError(form[key], label);
    if (error) errors[key] = error;
  });

  [
    ["savingsInterestRate", "Savings interest rate"],
    ["loanInterestRate", "Loan interest rate"],
    ["commonInterestRate", "Common-interest rate"],
  ].forEach(([key, label]) => {
    const error = numericError(form[key], label, { min: 0, max: 1 });
    if (error) errors[key] = error;
  });

  [
    ["declarationStartDay", "Declaration start day"],
    ["declarationEndDay", "Declaration end day"],
    ["payoutStartDay", "Payout start day"],
    ["payoutEndDay", "Payout end day"],
  ].forEach(([key, label]) => {
    const error = numericError(form[key], label, { min: 1, max: 31 });
    if (error) errors[key] = error;
  });

  if (requiresReason && isBlank(form.reason)) errors.reason = "A reason is required when changing rules after draft.";
  return errors;
}

export function cyclePayload(form) {
  const payload = {
    name: form.name.trim(),
    description: form.description.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
  };
  ruleFields.forEach((key) => {
    payload[key] = Number(form[key]);
  });
  if (!isBlank(form.reason)) payload.reason = form.reason.trim();
  return payload;
}

export async function saveCycleForm({ form, selectedCycle = null, cycleApi = api }) {
  const requiresReason = Boolean(selectedCycle && selectedCycle.status !== "DRAFT");
  const errors = validateCycleForm(form, { requiresReason });
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }

  const payload = cyclePayload(form);
  if (selectedCycle) {
    return cycleApi(`/cycles/${selectedCycle.id}`, { method: "PATCH", body: payload });
  }
  return cycleApi("/cycles", { method: "POST", body: payload });
}

export async function generateCycleMonths({ cycleId, cycleApi = api }) {
  return cycleApi(`/cycles/${cycleId}/months/generate`, { method: "POST" });
}

export async function enrollCycleMember({ cycleId, memberId, cycleApi = api }) {
  if (!memberId) {
    const error = new Error("Choose a member to enroll.");
    error.validationErrors = { memberId: "Choose a member to enroll." };
    throw error;
  }
  return cycleApi(`/cycles/${cycleId}/members`, { method: "POST", body: { memberId } });
}

function DetailValue({ label, value }) {
  return (
    <div className="grid gap-1 rounded-app border border-mist bg-cream p-3">
      <strong className="text-xs font-black uppercase text-charcoal/70">{label}</strong>
      <span className="break-words text-sm font-extrabold text-charcoal">{value}</span>
    </div>
  );
}

function CycleForm({ form, setForm, errors, editing, selectedCycle }) {
  const needsReason = editing && selectedCycle?.status !== "DRAFT";
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="cycle-form grid gap-3.5">
      <div className="form-grid two grid gap-3 md:grid-cols-2">
        <Field label="Cycle name" value={form.name} onChange={set("name")} error={errors.name} required placeholder="2026 Main Cycle" />
        <Field label="Description" value={form.description} onChange={set("description")} placeholder="Operational note" />
        <DateInput label="Start date" value={form.startDate} onChange={set("startDate")} error={errors.startDate} required />
        <DateInput label="End date" value={form.endDate} onChange={set("endDate")} error={errors.endDate} required />
      </div>

      <h3 className="mb-2 mt-3.5 text-sm font-black uppercase text-charcoal">Cycle Rules</h3>
      <div className="form-grid three grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <CurrencyInput label="Savings cap" value={form.savingsCap} onChange={set("savingsCap")} error={errors.savingsCap} required />
        <CurrencyInput label="Minimum borrowing" value={form.minimumBorrowingAmount} onChange={set("minimumBorrowingAmount")} error={errors.minimumBorrowingAmount} required />
        <CurrencyInput label="Social fund" value={form.socialFundAmount} onChange={set("socialFundAmount")} error={errors.socialFundAmount} required />
        <CurrencyInput label="Membership fee" value={form.membershipFeeAmount} onChange={set("membershipFeeAmount")} error={errors.membershipFeeAmount} required />
        <Field type="number" step="0.01" min="0" max="1" label="Savings interest rate" value={form.savingsInterestRate} onChange={set("savingsInterestRate")} error={errors.savingsInterestRate} required />
        <Field type="number" step="0.01" min="0" max="1" label="Loan interest rate" value={form.loanInterestRate} onChange={set("loanInterestRate")} error={errors.loanInterestRate} required />
        <Field type="number" step="0.01" min="0" max="1" label="Common-interest rate" value={form.commonInterestRate} onChange={set("commonInterestRate")} error={errors.commonInterestRate} required />
      </div>

      <h3 className="mb-2 mt-3.5 text-sm font-black uppercase text-charcoal">Operational Windows</h3>
      <div className="form-grid four grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field type="number" min="1" max="31" label="Declaration start day" value={form.declarationStartDay} onChange={set("declarationStartDay")} error={errors.declarationStartDay} required />
        <Field type="number" min="1" max="31" label="Declaration end day" value={form.declarationEndDay} onChange={set("declarationEndDay")} error={errors.declarationEndDay} required />
        <Field type="number" min="1" max="31" label="Payout start day" value={form.payoutStartDay} onChange={set("payoutStartDay")} error={errors.payoutStartDay} required />
        <Field type="number" min="1" max="31" label="Payout end day" value={form.payoutEndDay} onChange={set("payoutEndDay")} error={errors.payoutEndDay} required />
      </div>

      {needsReason ? (
        <Textarea
          label="Reason for rule edit"
          value={form.reason}
          onChange={set("reason")}
          error={errors.reason}
          required
          rows={3}
          placeholder="Explain why these cycle rules are being changed."
        />
      ) : null}
    </div>
  );
}

function RulesTab({ cycle, onEdit }) {
  return (
    <section className="panel cycle-tab-panel rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="panel-head mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-charcoal">Configured Rules</h2>
        <Button type="button" variant="secondary" size="sm" icon={Edit3} onClick={onEdit}>Edit Rules</Button>
      </div>
      <div className="detail-grid cycle-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DetailValue label="Savings Cap" value={money(cycle.savings_cap)} />
        <DetailValue label="Minimum Borrowing" value={money(cycle.minimum_borrowing_amount)} />
        <DetailValue label="Savings Interest" value={percent(cycle.savings_interest_rate)} />
        <DetailValue label="Loan Interest" value={percent(cycle.loan_interest_rate)} />
        <DetailValue label="Common Interest" value={percent(cycle.common_interest_rate)} />
        <DetailValue label="Social Fund" value={money(cycle.social_fund_amount)} />
        <DetailValue label="Membership Fee" value={money(cycle.membership_fee_amount)} />
        <DetailValue label="Declaration Window" value={`${cycle.declaration_start_day} to ${cycle.declaration_end_day}`} />
        <DetailValue label="Payout Window" value={`${cycle.payout_start_day} to ${cycle.payout_end_day}`} />
      </div>
    </section>
  );
}

function MonthsTab({ months }) {
  return (
    <section className="panel cycle-tab-panel rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="panel-head mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-charcoal">Cycle Months</h2>
      </div>
      <DataTable
        columns={["Month", "Period", "Declaration Window", "Payout Window", "Status"]}
        rows={(months || []).map((month) => [
          `Month ${month.month_number}`,
          `${normalizeDate(month.start_date)} to ${normalizeDate(month.end_date)}`,
          `${normalizeDate(month.declaration_start_at)} to ${normalizeDate(month.declaration_end_at)}`,
          `${normalizeDate(month.payout_start_at)} to ${normalizeDate(month.payout_end_at)}`,
          <Badge text={String(month.status || "OPEN").replaceAll("_", " ")} tone={month.status === "LOCKED" ? "gray" : "green"} />,
        ])}
        empty="No months have been generated yet."
      />
    </section>
  );
}

function MembersTab({ members, onEnroll }) {
  return (
    <section className="panel cycle-tab-panel rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="panel-head mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-charcoal">Enrolled Members</h2>
        <Button type="button" variant="secondary" size="sm" icon={UserPlus} onClick={onEnroll}>Enroll Members</Button>
      </div>
      <DataTable
        columns={["Member", "Code", "Status", "Joined"]}
        rows={(members || []).map((member) => [
          `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.full_name || "Member",
          member.member_code || "-",
          <Badge text={member.status || "ACTIVE"} tone={member.status === "ACTIVE" ? "green" : "gray"} />,
          normalizeDate(member.joined_at || member.created_at),
        ])}
        empty="No members have been enrolled in this cycle."
      />
    </section>
  );
}

function PenaltiesTab({ penaltyTypes }) {
  return (
    <section className="panel cycle-tab-panel rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="panel-head mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-charcoal">Penalty Types</h2>
      </div>
      <DataTable
        columns={["Code", "Name", "Amount", "Convertible", "Status"]}
        rows={(penaltyTypes || []).map((penalty) => [
          penalty.code,
          penalty.name,
          money(penalty.amount),
          penalty.is_convertible_to_loan ? "Yes" : "No",
          <Badge text={penalty.is_active === false ? "Inactive" : "Active"} tone={penalty.is_active === false ? "gray" : "green"} />,
        ])}
        empty="No penalty types are configured for this cycle yet."
      />
    </section>
  );
}

function AuditTab({ auditRows }) {
  return (
    <section className="panel cycle-tab-panel rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="panel-head mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-charcoal">Cycle Audit</h2>
      </div>
      <DataTable
        columns={["Action", "Entity", "Reason", "Posted At"]}
        rows={(auditRows || []).map((row) => [
          row.action || row.event_type || "Audit event",
          row.entity_table || "cycles",
          row.reason || row.metadata?.reason || "-",
          normalizeDate(row.created_at),
        ])}
        empty="No cycle audit events found."
      />
    </section>
  );
}

export function CycleScreensPage({
  cycleApi = api,
  initialCycles = undefined,
  initialDetail = null,
  initialPenaltyTypes = [],
  initialAuditRows = [],
}) {
  const [cycles, setCycles] = useState(initialCycles || []);
  const [selected, setSelected] = useState(initialDetail);
  const [penaltyTypes, setPenaltyTypes] = useState(initialPenaltyTypes);
  const [auditRows, setAuditRows] = useState(initialAuditRows);
  const [activeTab, setActiveTab] = useState("rules");
  const [loading, setLoading] = useState(initialCycles === undefined);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [formMode, setFormMode] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [availableMembers, setAvailableMembers] = useState([]);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [enrollErrors, setEnrollErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCycle = selected?.data || selected;
  const months = selected?.months || [];
  const members = selected?.members || [];

  async function loadCycles() {
    setLoading(true);
    setError("");
    try {
      const response = await cycleApi("/cycles");
      setCycles(response.data || []);
    } catch (err) {
      setError(err.message || "Cycles could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCycleDetail(cycleId) {
    setDetailLoading(true);
    setError("");
    try {
      const [detail, settings, audit] = await Promise.all([
        cycleApi(`/cycles/${cycleId}`),
        cycleApi(`/settings/context?cycleId=${cycleId}`).catch(() => ({ data: { penaltyTypes: [] } })),
        cycleApi("/audit?entityTable=cycles&limit=10").catch(() => ({ data: [] })),
      ]);
      setSelected(detail);
      setPenaltyTypes(settings.data?.penaltyTypes || settings.penaltyTypes || []);
      setAuditRows(audit.data || []);
      setActiveTab("rules");
    } catch (err) {
      setError(err.message || "Cycle detail could not load.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (initialCycles === undefined) loadCycles();
  }, []);

  function openCreate() {
    setForm({ ...DEFAULT_FORM });
    setErrors({});
    setFormMode("create");
  }

  function openEdit() {
    setForm(formFromCycle(selectedCycle));
    setErrors({});
    setFormMode("edit");
  }

  async function submitCycle(event) {
    event.preventDefault();
    setBusy("save");
    setMessage("");
    setError("");
    try {
      const response = await saveCycleForm({
        form,
        selectedCycle: formMode === "edit" ? selectedCycle : null,
        cycleApi,
      });
      const saved = response.data || response;
      setFormMode("");
      await loadCycles();
      if (saved?.id) await loadCycleDetail(saved.id);
      else if (selectedCycle?.id) await loadCycleDetail(selectedCycle.id);
      setMessage(formMode === "edit" ? "Cycle rules saved." : "Cycle draft created.");
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Cycle could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function handleGenerateMonths() {
    if (!selectedCycle?.id) return;
    setBusy("months");
    setMessage("");
    setError("");
    try {
      await generateCycleMonths({ cycleId: selectedCycle.id, cycleApi });
      await loadCycleDetail(selectedCycle.id);
      setActiveTab("months");
      setMessage("Cycle months generated.");
    } catch (err) {
      setError(err.message || "Months could not be generated.");
    } finally {
      setBusy("");
    }
  }

  async function setCycleStatus(status) {
    if (!selectedCycle?.id) return;
    setBusy(status);
    setMessage("");
    setError("");
    try {
      await cycleApi(`/cycles/${selectedCycle.id}/status`, {
        method: "PATCH",
        body: { status, reason: `${status.toLowerCase()} from cycle screen` },
      });
      await loadCycles();
      await loadCycleDetail(selectedCycle.id);
      setMessage(`Cycle marked as ${status.toLowerCase()}.`);
    } catch (err) {
      setError(err.message || "Cycle status could not be changed.");
    } finally {
      setBusy("");
    }
  }

  async function activateCycle() {
    if (!selectedCycle?.id) return;
    setBusy("activate");
    setMessage("");
    setError("");
    try {
      await cycleApi(`/cycles/${selectedCycle.id}/activate`, { method: "POST" });
      await loadCycles();
      await loadCycleDetail(selectedCycle.id);
      setMessage("Cycle activated.");
    } catch (err) {
      setError(err.message || "Cycle could not be activated.");
    } finally {
      setBusy("");
    }
  }

  async function openEnrollMembers() {
    if (!selectedCycle?.id) return;
    setEnrollOpen(true);
    setEnrollErrors({});
    setSelectedMemberId("");
    setBusy("load-members");
    setError("");
    try {
      const response = await cycleApi("/members?status=ACTIVE&limit=100");
      setAvailableMembers(response.data || []);
    } catch (err) {
      setError(err.message || "Members could not be loaded.");
    } finally {
      setBusy("");
    }
  }

  async function submitEnrollment(event) {
    event.preventDefault();
    if (!selectedCycle?.id) return;
    setBusy("enroll");
    setEnrollErrors({});
    setMessage("");
    setError("");
    try {
      await enrollCycleMember({ cycleId: selectedCycle.id, memberId: selectedMemberId, cycleApi });
      setEnrollOpen(false);
      await loadCycleDetail(selectedCycle.id);
      setActiveTab("members");
      setMessage("Member enrolled into cycle.");
    } catch (err) {
      if (err.validationErrors) setEnrollErrors(err.validationErrors);
      else setError(err.message || "Member could not be enrolled.");
    } finally {
      setBusy("");
    }
  }

  const metrics = useMemo(() => [
    { title: "Cycles", value: cycles.length, note: "Configured cycles", tone: "blue", icon: FolderPlus },
    { title: "Selected Members", value: members.length, note: selectedCycle ? selectedCycle.name : "Choose a cycle", tone: "green", icon: UserPlus },
    { title: "Generated Months", value: months.length, note: "Available periods", tone: "teal", icon: CalendarDays },
    { title: "Penalty Types", value: penaltyTypes.length, note: "Cycle settings", tone: "amber", icon: Lock },
  ], [cycles.length, members.length, months.length, penaltyTypes.length, selectedCycle]);

  return (
    <Page
      title="Cycles"
      className="cycles-page"
      actions={(
        <>
          <Button type="button" icon={Plus} onClick={openCreate}>Create Cycle</Button>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={loadCycles} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={CalendarDays} onClick={handleGenerateMonths} disabled={!selectedCycle} loading={busy === "months"}>Generate Months</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Saved">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Cycle action failed">{error}</Alert> : null}

      <div className="metrics cycle-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <ButtonlessMetric key={metric.title} {...metric} />)}
      </div>

      <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
        <div className="panel-head mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-charcoal">Cycle List</h2>
        </div>
        <div className="cycle-list-mobile-actions mobile-only grid gap-2" aria-label="Cycle list quick actions">
          <Button type="button" icon={Plus} onClick={openCreate}>Create</Button>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={loadCycles} loading={loading}>Refresh</Button>
          <Button type="button" variant="secondary" icon={CalendarDays} onClick={handleGenerateMonths} disabled={!selectedCycle} loading={busy === "months"}>Months</Button>
        </div>
        {loading ? <Skeleton lines={5} /> : (
          <DataTable
            columns={["Cycle", "Dates", "Status", "Savings Cap", "Minimum Borrowing", "Members", "Action"]}
            rows={cycles.map((cycle) => [
              cycle.name,
              `${normalizeDate(cycle.start_date)} to ${normalizeDate(cycle.end_date)}`,
              <Badge text={cycle.status} tone={statusTone(cycle.status)} />,
              money(cycle.savings_cap),
              money(cycle.minimum_borrowing_amount),
              cycle.member_count ?? "-",
              <Button type="button" variant="secondary" size="sm" onClick={() => loadCycleDetail(cycle.id)}>View Details</Button>,
            ])}
            empty="No cycles have been created yet."
          />
        )}
      </section>

      {detailLoading ? <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={8} /></section> : selectedCycle ? (
        <section className="cycle-detail grid gap-4">
          <div className="cycle-detail-head flex items-start justify-between gap-4 rounded-app border border-mist bg-cream p-4 shadow-soft">
            <div>
              <span className="text-xs font-black uppercase text-charcoal/70">Selected Cycle</span>
              <h2 className="my-1 text-xl font-extrabold text-charcoal">{selectedCycle.name}</h2>
              <p className="m-0 text-sm font-semibold text-charcoal/75">{normalizeDate(selectedCycle.start_date)} to {normalizeDate(selectedCycle.end_date)}</p>
            </div>
            <Badge text={selectedCycle.status} tone={statusTone(selectedCycle.status)} />
          </div>

          <div className="button-row cycle-actions flex flex-wrap items-center gap-2.5 rounded-app border border-mist bg-cream p-3 shadow-soft">
            <Button type="button" icon={CheckCircle2} onClick={activateCycle} disabled={selectedCycle.status === "ACTIVE"} loading={busy === "activate"}>Activate Cycle</Button>
            <Button type="button" className="cycle-detail-generate-action" variant="secondary" icon={CalendarDays} onClick={handleGenerateMonths} loading={busy === "months"}>Generate Months</Button>
            <Button type="button" variant="secondary" icon={UserPlus} onClick={openEnrollMembers} loading={busy === "load-members"}>Enroll Members</Button>
            <Button type="button" variant="secondary" icon={Edit3} onClick={openEdit}>Edit Rules</Button>
            <Button type="button" variant="secondary" icon={Lock} onClick={() => setCycleStatus("CLOSED")} disabled={selectedCycle.status === "CLOSED"} loading={busy === "CLOSED"}>Close Cycle</Button>
            <Button type="button" variant="secondary" icon={Archive} onClick={() => setCycleStatus("ARCHIVED")} disabled={selectedCycle.status === "ARCHIVED"} loading={busy === "ARCHIVED"}>Archive</Button>
          </div>

          <Tabs
            label="Cycle detail tabs"
            active={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: "rules", label: "Rules" },
              { id: "months", label: "Months" },
              { id: "members", label: "Members" },
              { id: "penalties", label: "Penalty Types" },
              { id: "audit", label: "Audit" },
            ]}
          />

          {activeTab === "rules" ? <RulesTab cycle={selectedCycle} onEdit={openEdit} /> : null}
          {activeTab === "months" ? <MonthsTab months={months} onGenerate={handleGenerateMonths} loading={busy === "months"} /> : null}
          {activeTab === "members" ? <MembersTab members={members} onEnroll={openEnrollMembers} /> : null}
          {activeTab === "penalties" ? <PenaltiesTab penaltyTypes={penaltyTypes} /> : null}
          {activeTab === "audit" ? <AuditTab auditRows={auditRows} /> : null}
        </section>
      ) : (
        <EmptyState
          title="Select a cycle"
          message="Choose a cycle from the list to view rules, generated months, enrolled members, penalties, and audit history."
          action={<Button type="button" onClick={openCreate}>Create Cycle</Button>}
        />
      )}

      <Modal
        open={Boolean(formMode)}
        title={formMode === "edit" ? "Edit Cycle Rules" : "Create Cycle"}
        size="lg"
        onClose={() => setFormMode("")}
        footer={(
          <div className="button-row flex flex-wrap items-center gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setFormMode("")}>Cancel</Button>
            <Button type="button" variant="secondary" onClick={submitCycle} loading={busy === "save"}>Save Draft</Button>
            <Button type="button" onClick={submitCycle} loading={busy === "save"}>Save Cycle</Button>
          </div>
        )}
      >
        <form id="cycle-form" onSubmit={submitCycle}>
          <CycleForm form={form} setForm={setForm} errors={errors} editing={formMode === "edit"} selectedCycle={selectedCycle} />
        </form>
      </Modal>

      <Modal
        open={enrollOpen}
        title="Enroll Member"
        onClose={() => setEnrollOpen(false)}
        footer={(
          <div className="button-row flex flex-wrap items-center gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submitEnrollment} loading={busy === "enroll"}>Enroll Members</Button>
          </div>
        )}
      >
        <form onSubmit={submitEnrollment}>
          <Select
            label="Member"
            value={selectedMemberId}
            onChange={setSelectedMemberId}
            error={enrollErrors.memberId}
            placeholder={busy === "load-members" ? "Loading members..." : "Choose an active member"}
            required
            options={availableMembers.map((member) => ({
              value: member.id,
              label: `${member.first_name || ""} ${member.last_name || ""}`.trim() || member.member_code || member.email,
            }))}
          />
        </form>
      </Modal>
    </Page>
  );
}

function ButtonlessMetric({ title, value, note, tone, icon: Icon }) {
  return (
    <section className={`metric ${tone} rounded-app border border-mist border-l-[5px] bg-cream p-4 shadow-soft`}>
      <Icon size={20} aria-hidden="true" />
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
