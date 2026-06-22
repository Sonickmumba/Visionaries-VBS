import React, { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, ClipboardCheck, ClipboardList, FileText, Gauge, PiggyBank, Receipt, RefreshCw, RotateCcw, Scale, Send, UploadCloud } from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  CurrencyInput,
  DataTable,
  EmptyState,
  MobileBottomNav,
  MobileHeader,
  MobileMetricCard,
  MobileScreenShell,
  MobileStepper,
  MobileStickyActionBar,
  MobileUploadCard,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import { chooseActiveMembership } from "./MemberDashboardPage.jsx";
import "../../styles/member-declaration.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";
const titleCase = (value) => String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

export const MEMBER_DECLARATION_EMPTY_FORM = {
  savingsAmount: "",
  loanRequestAmount: "",
  loanTopUpAmount: "",
  principalRepaymentAmount: "",
  loanInterestRepaymentAmount: "",
  commonInterestPaymentAmount: "",
  otherObligationAmount: "",
  notes: "",
};

const amountFields = [
  ["savingsAmount", "Savings amount"],
  ["loanRequestAmount", "Loan request"],
  ["loanTopUpAmount", "Loan top-up"],
  ["principalRepaymentAmount", "Principal repayment"],
  ["loanInterestRepaymentAmount", "Loan interest repayment"],
  ["commonInterestPaymentAmount", "Common-interest payment"],
  ["otherObligationAmount", "Other obligation"],
];

const proofTypes = [
  ["savingsAmount", "SAVINGS_PAYMENT_PROOF", "Savings proof of payment"],
  ["principalRepaymentAmount", "PRINCIPAL_REPAYMENT_PROOF", "Principal repayment proof"],
  ["loanInterestRepaymentAmount", "LOAN_INTEREST_PAYMENT_PROOF", "Loan interest repayment proof"],
  ["commonInterestPaymentAmount", "COMMON_INTEREST_PAYMENT_PROOF", "Common-interest payment proof"],
];

const proofTypeLabels = Object.fromEntries(proofTypes.map(([, type, label]) => [type, label]));
const proofContentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const proofMaxBytes = 5 * 1024 * 1024;

function statusTone(status) {
  if (status === "APPROVED") return "green";
  if (status === "SUBMITTED" || status === "LATE" || status === "DRAFT") return "amber";
  if (status === "MISSED" || status === "CANCELLED") return "red";
  return "blue";
}

function pickDefaultMonth(months = []) {
  return months.find((month) => month.status === "DECLARATION_PERIOD")
    || months.find((month) => month.status === "OPEN")
    || months.find((month) => month.status === "PAYOUT_PERIOD")
    || months[0]
    || null;
}

function amountError(value, label) {
  if (String(value ?? "").trim() === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} must be a valid number.`;
  if (number < 0) return `${label} cannot be negative.`;
  return "";
}

function hasDeclarationActivity(form) {
  return amountFields.some(([key]) => Number(form[key] || 0) > 0) || Boolean(String(form.notes || "").trim());
}

function requiredProofTypes(form) {
  return proofTypes.filter(([field]) => Number(form[field] || 0) > 0).map(([, type]) => type);
}

function proofFileError(file) {
  if (!file) return "";
  if (!proofContentTypes.includes(file.type)) return "Use JPG, PNG, WEBP, or PDF.";
  if (file.size > proofMaxBytes) return "Proof must be 5 MB or less.";
  return "";
}

export function validateMemberDeclarationForm(form, { saveAsDraft = false, activeMembership = null, selectedMonth = null } = {}) {
  const errors = {};
  if (!activeMembership) errors.activeMembership = "You are not enrolled in an active cycle.";
  if (!selectedMonth) errors.selectedMonth = "Choose a cycle month.";
  amountFields.forEach(([key, label]) => {
    const error = amountError(form[key], label);
    if (error) errors[key] = error;
  });
  if (!saveAsDraft && !hasDeclarationActivity(form)) {
    errors.activity = "Enter at least one amount or a note before submitting. Use Save Draft for incomplete declarations.";
  }
  return errors;
}

export function memberDeclarationPayload({ form, activeMembership, selectedMonth, saveAsDraft = false }) {
  return {
    cycleId: activeMembership.cycle_id,
    cycleMonthId: selectedMonth.id,
    cycleMemberId: activeMembership.id,
    savingsAmount: Number(form.savingsAmount || 0),
    loanRequestAmount: Number(form.loanRequestAmount || 0),
    loanTopUpAmount: Number(form.loanTopUpAmount || 0),
    principalRepaymentAmount: Number(form.principalRepaymentAmount || 0),
    loanInterestRepaymentAmount: Number(form.loanInterestRepaymentAmount || 0),
    commonInterestPaymentAmount: Number(form.commonInterestPaymentAmount || 0),
    otherObligationAmount: Number(form.otherObligationAmount || 0),
    notes: form.notes || null,
    saveAsDraft,
  };
}

export async function submitMemberDeclaration({ form, activeMembership, selectedMonth, saveAsDraft = false, memberApi = api }) {
  const errors = validateMemberDeclarationForm(form, { saveAsDraft, activeMembership, selectedMonth });
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return memberApi("/declarations", {
    method: "POST",
    body: memberDeclarationPayload({ form, activeMembership, selectedMonth, saveAsDraft }),
  });
}

export async function uploadDeclarationProof({ declarationId, attachmentType, file, memberApi = api }) {
  const signatureResponse = await memberApi(`/declarations/${declarationId}/attachments/upload-signature`, {
    method: "POST",
    body: {
      attachmentType,
      filename: file.name,
      contentType: file.type,
      fileSizeBytes: file.size,
    },
  });
  const signature = signatureResponse.data;
  const formData = new FormData();
  Object.entries(signature.params).forEach(([key, value]) => formData.append(key, value));
  formData.append("file", file);

  const uploadResponse = await fetch(signature.uploadUrl, { method: "POST", body: formData });
  const uploaded = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) throw new Error(uploaded.error?.message || "Payment proof upload failed.");

  return memberApi(`/declarations/${declarationId}/attachments`, {
    method: "POST",
    body: {
      attachmentType,
      expectedPublicId: signature.publicId,
      originalFilename: file.name,
      contentType: file.type,
      fileSizeBytes: file.size,
      cloudinary: {
        assetId: uploaded.asset_id,
        publicId: uploaded.public_id,
        resourceType: uploaded.resource_type || signature.resourceType,
        deliveryType: uploaded.type || signature.deliveryType,
        format: uploaded.format || null,
        version: uploaded.version || null,
        bytes: uploaded.bytes || file.size,
        secureUrl: uploaded.secure_url || null,
      },
    },
  });
}

export async function loadMemberDeclarationData({ memberApi = api } = {}) {
  const me = await memberApi("/auth/me");
  const activeMembership = chooseActiveMembership(me.cycleMemberships || []);
  if (!activeMembership) {
    return { me, activeMembership: null, cycleDetail: null, months: [], declarations: [], selectedMonth: null };
  }
  const [cycleDetail, declarationsResponse] = await Promise.all([
    memberApi(`/cycles/${activeMembership.cycle_id}`),
    memberApi("/declarations"),
  ]);
  const months = cycleDetail.months || [];
  const declarations = declarationsResponse.data || [];
  return {
    me,
    activeMembership,
    cycleDetail,
    months,
    declarations,
    selectedMonth: pickDefaultMonth(months),
  };
}

function formFromDeclaration(declaration) {
  if (!declaration) return { ...MEMBER_DECLARATION_EMPTY_FORM };
  return {
    savingsAmount: String(Number(declaration.savings_amount || 0) || ""),
    loanRequestAmount: String(Number(declaration.loan_request_amount || 0) || ""),
    loanTopUpAmount: String(Number(declaration.loan_top_up_amount || 0) || ""),
    principalRepaymentAmount: String(Number(declaration.principal_repayment_amount || 0) || ""),
    loanInterestRepaymentAmount: String(Number(declaration.loan_interest_repayment_amount || 0) || ""),
    commonInterestPaymentAmount: String(Number(declaration.common_interest_payment_amount || 0) || ""),
    otherObligationAmount: String(Number(declaration.other_obligation_amount || 0) || ""),
    notes: declaration.notes || "",
  };
}

function FieldSummary({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

function MemberDeclarationMobileHero({
  selectedMonth,
  declarationStatus,
  enteredSavings,
  enteredLoans,
  enteredRepayments,
  form,
  load,
}) {
  return (
    <section className="member-declaration-hero" aria-label="Declaration status summary">
      <div className="member-declaration-hero-head">
        <div>
          <span>Declaration Status</span>
          <h2>{titleCase(declarationStatus)}</h2>
        </div>
        <Badge text={selectedMonth ? `Month ${selectedMonth.month_number}` : "No month"} tone={statusTone(declarationStatus)} />
      </div>
      <p>{selectedMonth ? `${dateOnly(selectedMonth.declaration_window_start)} to ${dateOnly(selectedMonth.declaration_window_end)}` : "Select a month"}</p>
      <div className="member-declaration-hero-values">
        <FieldSummary label="Savings" value={money(enteredSavings)} />
        <FieldSummary label="Loans" value={money(enteredLoans)} />
        <FieldSummary label="Repayments" value={money(enteredRepayments)} />
        <FieldSummary label="Common Interest" value={money(form.commonInterestPaymentAmount)} />
      </div>
      <Button type="button" size="sm" variant="secondary" icon={RefreshCw} onClick={load}>Refresh</Button>
    </section>
  );
}

function monthLabel(month) {
  return month ? `Month ${month.month_number} - ${titleCase(month.status)}` : "No month selected";
}

function ProofUploadField({ type, existing, proofFiles, setProofFiles, errors, setErrors, closedDeclaration }) {
  return (
    <label className={`proof-upload ${errors[type] ? "has-error" : ""}`}>
      <span><UploadCloud size={17} aria-hidden="true" /> {proofTypeLabels[type]}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={closedDeclaration}
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          setProofFiles((current) => ({ ...current, [type]: file }));
          if (errors[type]) setErrors((current) => ({ ...current, [type]: "" }));
        }}
      />
      <small>{proofFiles[type]?.name || existing?.original_filename || "JPG, PNG, WEBP, or PDF up to 5 MB"}</small>
      {existing ? <Badge text="Uploaded" tone="green" /> : null}
      {errors[type] ? <small className="field-error">{errors[type]}</small> : null}
    </label>
  );
}

function MobileProofUploadField({ type, existing, proofFiles, setProofFiles, errors, setErrors, closedDeclaration }) {
  const inputRef = useRef(null);
  const status = errors[type]
    || proofFiles[type]?.name
    || existing?.original_filename
    || "JPG, PNG, WEBP, or PDF up to 5 MB";

  return (
    <div className={errors[type] ? "mobile-proof has-error" : "mobile-proof"}>
      <MobileUploadCard
        label={proofTypeLabels[type]}
        fileName={proofFiles[type]?.name || existing?.original_filename}
        status={status}
        disabled={closedDeclaration}
        onChooseFile={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        className="mobile-proof-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={closedDeclaration}
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          setProofFiles((current) => ({ ...current, [type]: file }));
          if (errors[type]) setErrors((current) => ({ ...current, [type]: "" }));
        }}
      />
      {existing ? <Badge text="Uploaded" tone="green" /> : null}
      {errors[type] ? <small className="field-error">{errors[type]}</small> : null}
    </div>
  );
}

export function MemberDeclarationPage({
  setPage,
  memberApi = api,
  initialData = null,
}) {
  const [data, setData] = useState(initialData);
  const [selectedMonthId, setSelectedMonthId] = useState(initialData?.selectedMonth?.id || "");
  const [form, setForm] = useState(MEMBER_DECLARATION_EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(initialData === null);
  const [saving, setSaving] = useState("");
  const [proofFiles, setProofFiles] = useState({});
  const [proofAttachments, setProofAttachments] = useState([]);
  const [proofLoading, setProofLoading] = useState(false);

  const months = data?.months || [];
  const selectedMonth = useMemo(
    () => months.find((month) => month.id === selectedMonthId) || data?.selectedMonth || null,
    [months, selectedMonthId, data?.selectedMonth],
  );
  const declarations = data?.declarations || [];
  const currentDeclaration = declarations.find((declaration) => declaration.cycle_month_id === selectedMonth?.id) || null;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const next = await loadMemberDeclarationData({ memberApi });
      setData(next);
      setSelectedMonthId(next.selectedMonth?.id || "");
    } catch (err) {
      setError(err.message || "Could not load declaration data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData === null) load();
  }, []);

  useEffect(() => {
    setForm(formFromDeclaration(currentDeclaration));
    setProofFiles({});
    setErrors({});
    setMessage("");
  }, [currentDeclaration?.id, selectedMonth?.id]);

  useEffect(() => {
    let active = true;
    async function loadProofs() {
      if (!currentDeclaration?.id) {
        setProofAttachments([]);
        return;
      }
      setProofLoading(true);
      try {
        const response = await memberApi(`/declarations/${currentDeclaration.id}/attachments`);
        if (active) setProofAttachments(response.data || []);
      } catch {
        if (active) setProofAttachments([]);
      } finally {
        if (active) setProofLoading(false);
      }
    }
    loadProofs();
    return () => {
      active = false;
    };
  }, [currentDeclaration?.id, memberApi]);

  function updateForm(key) {
    return (value) => {
      setForm((current) => ({ ...current, [key]: value }));
      if (errors[key] || errors.activity) {
        setErrors((current) => ({ ...current, [key]: "", activity: "" }));
      }
    };
  }

  async function save(saveAsDraft) {
    setSaving(saveAsDraft ? "draft" : "submit");
    setError("");
    setMessage("");
    setErrors({});
    try {
      const proofErrors = {};
      Object.entries(proofFiles).forEach(([type, file]) => {
        const error = proofFileError(file);
        if (error) proofErrors[type] = error;
      });
      if (!saveAsDraft) {
        requiredProofTypes(form).forEach((type) => {
          const hasExisting = proofAttachments.some((attachment) => attachment.attachment_type === type);
          if (!proofFiles[type] && !hasExisting) proofErrors[type] = `${proofTypeLabels[type]} is required.`;
        });
      }
      if (Object.keys(proofErrors).length) {
        setErrors(proofErrors);
        return;
      }

      const response = await submitMemberDeclaration({
        form,
        activeMembership: data?.activeMembership,
        selectedMonth,
        saveAsDraft,
        memberApi,
      });
      const savedDeclaration = response.data || response;
      const filesToUpload = Object.entries(proofFiles).filter(([, file]) => file);
      for (const [attachmentType, file] of filesToUpload) {
        await uploadDeclarationProof({
          declarationId: savedDeclaration.id,
          attachmentType,
          file,
          memberApi,
        });
      }
      setProofFiles({});
      setMessage(saveAsDraft ? "Declaration draft saved." : "Declaration submitted for admin review.");
      await load();
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Declaration could not be saved.");
    } finally {
      setSaving("");
    }
  }

  function clearForm() {
    setForm({ ...MEMBER_DECLARATION_EMPTY_FORM });
    setProofFiles({});
    setErrors({});
    setError("");
    setMessage("");
  }

  const activeMembership = data?.activeMembership;
  const closedDeclaration = ["APPROVED", "CANCELLED", "MISSED"].includes(currentDeclaration?.status);
  const declarationStatus = currentDeclaration?.status || "NEW";
  const visibleProofTypes = requiredProofTypes(form);
  const enteredSavings = Number(form.savingsAmount || 0);
  const enteredLoans = Number(form.loanRequestAmount || 0) + Number(form.loanTopUpAmount || 0);
  const enteredRepayments = Number(form.principalRepaymentAmount || 0) + Number(form.loanInterestRepaymentAmount || 0);
  const bottomNav = (
    <MobileBottomNav
      active="my-declaration"
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
      className="member-declaration-page"
      title="My Declaration"
      actions={(
        <>
          <Button type="button" icon={Send} onClick={() => save(false)} disabled={loading || !activeMembership || closedDeclaration} loading={saving === "submit"}>Submit Declaration</Button>
          <Button type="button" variant="secondary" icon={FileText} onClick={() => save(true)} disabled={loading || !activeMembership || closedDeclaration} loading={saving === "draft"}>Save Draft</Button>
          <Button type="button" variant="secondary" icon={RotateCcw} onClick={clearForm} disabled={loading || closedDeclaration}>Clear</Button>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>Refresh</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Declaration failed">{error}</Alert> : null}
      {errors.activity ? <Alert tone="danger" title="Declaration needs activity">{errors.activity}</Alert> : null}
      {message ? <Alert tone="success" title="Declaration saved">{message}</Alert> : null}

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !activeMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into an active cycle before submitting declarations." />
      ) : (
        <>
          <div className="member-declaration-mobile">
            <MobileScreenShell bottomNav={bottomNav}>
              <MobileHeader
                eyebrow="Monthly Declaration"
                title={monthLabel(selectedMonth)}
                subtitle={activeMembership.cycle_name || "Active cycle"}
              />

              <MemberDeclarationMobileHero
                selectedMonth={selectedMonth}
                declarationStatus={declarationStatus}
                enteredSavings={enteredSavings}
                enteredLoans={enteredLoans}
                enteredRepayments={enteredRepayments}
                form={form}
                load={load}
              />

              <MobileStepper
                active={closedDeclaration ? 2 : currentDeclaration ? 1 : 0}
                steps={["Prepare", "Review", "Admin"]}
                label="Declaration progress"
              />

              <Alert tone="info" title="Loan requests are always open">
                Loan requests and top-ups may be submitted on any day in the selected month. Other payments still follow the declaration window.
              </Alert>

              {closedDeclaration ? <Alert tone="info" title="Declaration is closed">Approved, missed, or cancelled declarations cannot be replaced from the member portal.</Alert> : null}

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Month Context</h2>
                  <Badge text={titleCase(declarationStatus)} tone={statusTone(declarationStatus)} />
                </div>
                <div className="member-mobile-position">
                  <Select
                    label="Cycle month"
                    value={selectedMonthId}
                    onChange={setSelectedMonthId}
                    options={months.map((month) => ({ value: month.id, label: monthLabel(month) }))}
                    placeholder="Select month"
                    error={errors.selectedMonth}
                  />
                  <FieldSummary label="Savings Cap" value={money(activeMembership.savings_cap)} />
                  <FieldSummary label="Minimum Borrowing" value={money(activeMembership.minimum_borrowing_amount)} />
                </div>
              </section>

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>Amounts</h2>
                  <Badge text={currentDeclaration ? "Existing Record" : "New Record"} tone={currentDeclaration ? "amber" : "blue"} />
                </div>
                <div className="member-declaration-mobile-summary" aria-label="Declaration amount summary">
                  <MobileMetricCard label="Savings" value={money(enteredSavings)} note="Requires proof when submitted" icon={PiggyBank} />
                  <MobileMetricCard label="Loans" value={money(enteredLoans)} note="Request or top-up" icon={Banknote} tone="blue" />
                  <MobileMetricCard label="Repayments" value={money(enteredRepayments)} note="Principal plus interest" icon={Receipt} tone="amber" />
                  <MobileMetricCard label="Common Interest" value={money(form.commonInterestPaymentAmount)} note="Payment declaration" icon={Scale} tone="purple" />
                </div>
                <div className="member-declaration-mobile-form">
                  <CurrencyInput label="Savings amount" value={form.savingsAmount} onChange={updateForm("savingsAmount")} error={errors.savingsAmount} disabled={closedDeclaration} />
                  <CurrencyInput label="Loan request" value={form.loanRequestAmount} onChange={updateForm("loanRequestAmount")} error={errors.loanRequestAmount} disabled={closedDeclaration} />
                  <CurrencyInput label="Loan top-up" value={form.loanTopUpAmount} onChange={updateForm("loanTopUpAmount")} error={errors.loanTopUpAmount} disabled={closedDeclaration} />
                  <CurrencyInput label="Principal repayment" value={form.principalRepaymentAmount} onChange={updateForm("principalRepaymentAmount")} error={errors.principalRepaymentAmount} disabled={closedDeclaration} />
                  <CurrencyInput label="Loan interest repayment" value={form.loanInterestRepaymentAmount} onChange={updateForm("loanInterestRepaymentAmount")} error={errors.loanInterestRepaymentAmount} disabled={closedDeclaration} />
                  <CurrencyInput label="Common-interest payment" value={form.commonInterestPaymentAmount} onChange={updateForm("commonInterestPaymentAmount")} error={errors.commonInterestPaymentAmount} disabled={closedDeclaration} />
                  <CurrencyInput label="Other obligation" value={form.otherObligationAmount} onChange={updateForm("otherObligationAmount")} error={errors.otherObligationAmount} disabled={closedDeclaration} />
                  <Textarea label="Notes" value={form.notes} onChange={updateForm("notes")} rows={3} placeholder="Optional declaration note" disabled={closedDeclaration} />
                </div>
              </section>

              {visibleProofTypes.length ? (
                <section className="member-mobile-section">
                  <div className="member-mobile-section-head">
                    <h2>Proof of Payment</h2>
                    <Badge text={proofLoading ? "Loading proofs" : `${proofAttachments.length} uploaded`} tone="blue" />
                  </div>
                  <div className="member-mobile-list">
                    {visibleProofTypes.map((type) => (
                      <MobileProofUploadField
                        key={type}
                        type={type}
                        existing={proofAttachments.find((attachment) => attachment.attachment_type === type)}
                        proofFiles={proofFiles}
                        setProofFiles={setProofFiles}
                        errors={errors}
                        setErrors={setErrors}
                        closedDeclaration={closedDeclaration}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="member-mobile-section">
                <div className="member-mobile-section-head">
                  <h2>History</h2>
                  <Badge text={`${declarations.length} records`} tone="blue" />
                </div>
                <div className="member-mobile-list">
                  {declarations.slice(0, 5).length ? declarations.slice(0, 5).map((declaration) => (
                    <article key={declaration.id} className="member-mobile-history-card">
                      <div>
                        <strong>{declaration.month_number ? `Month ${declaration.month_number}` : dateOnly(declaration.submitted_at)}</strong>
                        <span>{dateOnly(declaration.submitted_at)}</span>
                      </div>
                      <div>
                        <strong>{money(Number(declaration.savings_amount || 0) + Number(declaration.loan_request_amount || 0) + Number(declaration.loan_top_up_amount || 0))}</strong>
                        <Badge text={titleCase(declaration.status)} tone={statusTone(declaration.status)} />
                      </div>
                    </article>
                  )) : <p className="muted">No declarations found.</p>}
                </div>
              </section>

              <MobileStickyActionBar
                primaryLabel="Submit Declaration"
                secondaryLabel="Save Draft"
                onPrimary={() => save(false)}
                onSecondary={() => save(true)}
                primaryDisabled={loading || !activeMembership || closedDeclaration}
                secondaryDisabled={loading || !activeMembership || closedDeclaration}
                loading={saving === "submit"}
              />
            </MobileScreenShell>
          </div>

          <div className="member-declaration-desktop">
          <section className="panel member-declaration-context">
            <div className="panel-head">
              <h2>Declaration Window</h2>
              <Badge text={titleCase(declarationStatus)} tone={statusTone(declarationStatus)} />
            </div>
            <div className="form-grid three">
              <Select
                label="Cycle month"
                value={selectedMonthId}
                onChange={setSelectedMonthId}
                options={months.map((month) => ({
                  value: month.id,
                  label: monthLabel(month),
                }))}
                placeholder="Select month"
                error={errors.selectedMonth}
              />
              <FieldSummary label="Cycle" value={activeMembership.cycle_name || "-"} />
              <FieldSummary label="Declaration Window" value={selectedMonth ? `${dateOnly(selectedMonth.declaration_window_start)} to ${dateOnly(selectedMonth.declaration_window_end)}` : "-"} />
              <FieldSummary label="Savings Cap" value={money(activeMembership.savings_cap)} />
              <FieldSummary label="Minimum Borrowing" value={money(activeMembership.minimum_borrowing_amount)} />
              <FieldSummary label="Existing Status" value={titleCase(declarationStatus)} />
            </div>
            <Alert tone="info" title="Loan requests are always open">
              Loan requests and top-ups may be submitted on any day in the selected month. Savings, repayments, loan-interest payments, common-interest payments, and other obligations still follow the declaration window.
            </Alert>
            {closedDeclaration ? <Alert tone="info" title="Declaration is closed">Approved, missed, or cancelled declarations cannot be replaced from the member portal.</Alert> : null}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Declaration Details</h2>
              <Badge text={currentDeclaration ? "Existing month record" : "New month record"} tone={currentDeclaration ? "amber" : "blue"} />
            </div>
            <div className="form-grid three">
              <CurrencyInput label="Savings amount" value={form.savingsAmount} onChange={updateForm("savingsAmount")} error={errors.savingsAmount} disabled={closedDeclaration} />
              <CurrencyInput label="Loan request" value={form.loanRequestAmount} onChange={updateForm("loanRequestAmount")} error={errors.loanRequestAmount} disabled={closedDeclaration} />
              <CurrencyInput label="Loan top-up" value={form.loanTopUpAmount} onChange={updateForm("loanTopUpAmount")} error={errors.loanTopUpAmount} disabled={closedDeclaration} />
              <CurrencyInput label="Principal repayment" value={form.principalRepaymentAmount} onChange={updateForm("principalRepaymentAmount")} error={errors.principalRepaymentAmount} disabled={closedDeclaration} />
              <CurrencyInput label="Loan interest repayment" value={form.loanInterestRepaymentAmount} onChange={updateForm("loanInterestRepaymentAmount")} error={errors.loanInterestRepaymentAmount} disabled={closedDeclaration} />
              <CurrencyInput label="Common-interest payment" value={form.commonInterestPaymentAmount} onChange={updateForm("commonInterestPaymentAmount")} error={errors.commonInterestPaymentAmount} disabled={closedDeclaration} />
              <CurrencyInput label="Other obligation" value={form.otherObligationAmount} onChange={updateForm("otherObligationAmount")} error={errors.otherObligationAmount} disabled={closedDeclaration} />
            </div>
            <Textarea label="Notes" value={form.notes} onChange={updateForm("notes")} rows={3} placeholder="Optional declaration note" disabled={closedDeclaration} />
          </section>

          {visibleProofTypes.length ? (
            <section className="panel payment-proof-panel">
              <div className="panel-head">
                <h2>Proof of Payment</h2>
                <Badge text={proofLoading ? "Loading proofs" : `${proofAttachments.length} uploaded`} tone="blue" />
              </div>
              <div className="proof-grid">
                {visibleProofTypes.map((type) => {
                  const existing = proofAttachments.find((attachment) => attachment.attachment_type === type);
                  return (
                    <ProofUploadField
                      key={type}
                      type={type}
                      existing={existing}
                      proofFiles={proofFiles}
                      setProofFiles={setProofFiles}
                      errors={errors}
                      setErrors={setErrors}
                      closedDeclaration={closedDeclaration}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <h2>My Declaration History</h2>
              <Badge text={`${declarations.length} records`} tone="blue" />
            </div>
            <DataTable
              columns={["Month", "Submitted", "Savings", "Loan Request", "Repayments", "Common Interest", "Status"]}
              rows={declarations.map((declaration) => [
                declaration.month_number ? `Month ${declaration.month_number}` : dateOnly(declaration.submitted_at),
                dateOnly(declaration.submitted_at),
                money(declaration.savings_amount),
                money(Number(declaration.loan_request_amount || 0) + Number(declaration.loan_top_up_amount || 0)),
                money(Number(declaration.principal_repayment_amount || 0) + Number(declaration.loan_interest_repayment_amount || 0)),
                money(declaration.common_interest_payment_amount),
                <Badge text={titleCase(declaration.status)} tone={statusTone(declaration.status)} />,
              ])}
              empty="No declarations found."
            />
          </section>

          <div className="button-row">
            <Button type="button" variant="secondary" icon={ClipboardCheck} onClick={() => setPage?.("member-dashboard")}>Back to Dashboard</Button>
          </div>
          </div>
        </>
      )}
    </Page>
  );
}
