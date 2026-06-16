import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Lock, RefreshCw, Save, Settings, UserPlus, Users } from "lucide-react";
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
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/settings.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const percentValue = (value) => String(Number(value || 0) * 100);
const decimalRate = (value) => Number(value || 0) / 100;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

function titleCase(value) {
  return String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function settingObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replaceAll(" ", "_");
}

export function validateInviteUser(form) {
  const errors = {};
  if (!String(form.email || "").includes("@")) errors.email = "Enter a valid email.";
  if (String(form.password || "").length < 10) errors.password = "Temporary password must be at least 10 characters.";
  if (!["ADMIN", "MEMBER", "AUDITOR"].includes(form.role)) errors.role = "Choose a valid role.";
  return errors;
}

export function inviteUserPayload(form) {
  return {
    email: String(form.email || "").trim().toLowerCase(),
    password: form.password,
    role: form.role,
  };
}

export async function inviteSettingsUser({ form, settingsApi = api }) {
  const errors = validateInviteUser(form);
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return settingsApi("/settings/users", { method: "POST", body: inviteUserPayload(form) });
}

export function userUpdatePayload(changes, reason = "Administrative user setting update") {
  return { ...changes, reason };
}

export function validatePenaltyType(form, selectedCycleId) {
  const errors = {};
  if (!selectedCycleId) errors.cycleId = "Select a cycle.";
  if (!String(form.code || "").trim()) errors.code = "Penalty code is required.";
  if (!String(form.name || "").trim()) errors.name = "Penalty name is required.";
  if (Number(form.amount || 0) < 0) errors.amount = "Amount cannot be negative.";
  return errors;
}

export function penaltyTypePayload(form, selectedCycleId) {
  return {
    cycleId: selectedCycleId,
    code: normalizeCode(form.code),
    name: String(form.name || "").trim(),
    description: form.description || null,
    amount: Number(form.amount || 0),
    isConvertibleToLoan: Boolean(form.isConvertibleToLoan),
    isActive: Boolean(form.isActive),
  };
}

export async function savePenaltyType({ form, selectedCycleId, settingsApi = api }) {
  const errors = validatePenaltyType(form, selectedCycleId);
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return settingsApi("/settings/penalty-types", { method: "POST", body: penaltyTypePayload(form, selectedCycleId) });
}

export function cycleDefaultsPayload(form) {
  return {
    savingsCap: Number(form.savingsCap || 0),
    minimumBorrowingAmount: Number(form.minimumBorrowingAmount || 0),
    savingsInterestRate: decimalRate(form.savingsInterestRate),
    loanInterestRate: decimalRate(form.loanInterestRate),
    commonInterestRate: decimalRate(form.commonInterestRate),
    socialFundAmount: Number(form.socialFundAmount || 0),
    membershipFeeAmount: Number(form.membershipFeeAmount || 0),
    declarationStartDay: Number(form.declarationStartDay || 1),
    declarationEndDay: Number(form.declarationEndDay || 1),
    payoutStartDay: Number(form.payoutStartDay || 1),
    payoutEndDay: Number(form.payoutEndDay || 1),
    reason: String(form.reason || "").trim(),
  };
}

export function roundingPayload(form) {
  return {
    roundingScale: Number(form.roundingScale || 0),
    roundingMode: form.roundingMode,
    reason: String(form.reason || "").trim(),
  };
}

export function notificationPayload(form) {
  return {
    emailEnabled: Boolean(form.emailEnabled),
    smsEnabled: Boolean(form.smsEnabled),
    declarationReminderDays: String(form.declarationReminderDays || "").split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item)),
    payoutReminderDays: String(form.payoutReminderDays || "").split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item)),
    reason: String(form.reason || "").trim(),
  };
}

function cycleToDefaultsForm(cycle) {
  return {
    savingsCap: cycle?.savings_cap || "",
    minimumBorrowingAmount: cycle?.minimum_borrowing_amount || "",
    savingsInterestRate: percentValue(cycle?.savings_interest_rate),
    loanInterestRate: percentValue(cycle?.loan_interest_rate),
    commonInterestRate: percentValue(cycle?.common_interest_rate),
    socialFundAmount: cycle?.social_fund_amount || "",
    membershipFeeAmount: cycle?.membership_fee_amount || "",
    declarationStartDay: cycle?.declaration_start_day || "",
    declarationEndDay: cycle?.declaration_end_day || "",
    payoutStartDay: cycle?.payout_start_day || "",
    payoutEndDay: cycle?.payout_end_day || "",
    reason: "",
  };
}

function cycleToRoundingForm(cycle) {
  return {
    roundingScale: cycle?.rounding_scale ?? 2,
    roundingMode: cycle?.rounding_mode || "HALF_UP",
    reason: "",
  };
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

export function SettingsPage({
  settingsApi = api,
  initialContext = null,
}) {
  const [context, setContext] = useState(initialContext);
  const [selectedCycleId, setSelectedCycleId] = useState(initialContext?.selectedCycleId || "");
  const [activeTab, setActiveTab] = useState("users");
  const [userForm, setUserForm] = useState({ email: "", password: "", role: "MEMBER" });
  const [penaltyForm, setPenaltyForm] = useState({ code: "", name: "", description: "", amount: "", isConvertibleToLoan: true, isActive: true });
  const [userReason, setUserReason] = useState("Administrative user setting update");
  const [cycleForm, setCycleForm] = useState(cycleToDefaultsForm(null));
  const [roundingForm, setRoundingForm] = useState(cycleToRoundingForm(null));
  const [notificationForm, setNotificationForm] = useState({
    emailEnabled: true,
    smsEnabled: false,
    declarationReminderDays: "28,1,3",
    payoutReminderDays: "4,5",
    reason: "",
  });
  const [activeDefaultsForm, setActiveDefaultsForm] = useState({ autoSelectLatestActive: true, defaultCycleId: "", reason: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialContext === null);
  const [busy, setBusy] = useState("");

  const selectedCycle = useMemo(() => (context?.cycles || []).find((cycle) => cycle.id === selectedCycleId), [context, selectedCycleId]);

  function hydrateForms(nextContext, cycleId = nextContext?.selectedCycleId) {
    const cycle = (nextContext?.cycles || []).find((item) => item.id === cycleId);
    setCycleForm(cycleToDefaultsForm(cycle));
    setRoundingForm(cycleToRoundingForm(cycle));
    const notifications = settingObject(nextContext?.appSettings?.notification_preferences, {});
    setNotificationForm({
      emailEnabled: notifications.emailEnabled ?? true,
      smsEnabled: notifications.smsEnabled ?? false,
      declarationReminderDays: (notifications.declarationReminderDays || [28, 1, 3]).join(","),
      payoutReminderDays: (notifications.payoutReminderDays || [4, 5]).join(","),
      reason: "",
    });
    const defaults = settingObject(nextContext?.appSettings?.active_cycle_defaults, {});
    setActiveDefaultsForm({
      autoSelectLatestActive: defaults.autoSelectLatestActive ?? true,
      defaultCycleId: defaults.defaultCycleId || "",
      reason: "",
    });
  }

  async function loadSettings(cycleId = selectedCycleId) {
    setLoading(true);
    setError("");
    try {
      const response = await settingsApi(`/settings/context${cycleId ? `?cycleId=${cycleId}` : ""}`);
      const nextContext = response.data;
      setContext(nextContext);
      setSelectedCycleId(nextContext.selectedCycleId || "");
      hydrateForms(nextContext, nextContext.selectedCycleId || cycleId);
    } catch (err) {
      setError(err.message || "Settings could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialContext === null) loadSettings();
    else hydrateForms(initialContext, initialContext.selectedCycleId);
  }, []);

  async function inviteUser(event) {
    event.preventDefault();
    setBusy("invite");
    setErrors({});
    setMessage("");
    setError("");
    try {
      await inviteSettingsUser({ form: userForm, settingsApi });
      setMessage("User invited successfully.");
      setUserForm({ email: "", password: "", role: "MEMBER" });
      await loadSettings();
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "User could not be invited.");
    } finally {
      setBusy("");
    }
  }

  async function updateUser(user, changes) {
    setBusy(user.id);
    setMessage("");
    setError("");
    try {
      await settingsApi(`/settings/users/${user.id}`, { method: "PATCH", body: userUpdatePayload(changes, userReason) });
      setMessage("User settings updated.");
      await loadSettings();
    } catch (err) {
      setError(err.message || "User settings could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function submitPenaltyType(event) {
    event.preventDefault();
    setBusy("penalty");
    setErrors({});
    setMessage("");
    setError("");
    try {
      await savePenaltyType({ form: penaltyForm, selectedCycleId, settingsApi });
      setMessage("Penalty type saved.");
      setPenaltyForm({ code: "", name: "", description: "", amount: "", isConvertibleToLoan: true, isActive: true });
      await loadSettings(selectedCycleId);
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Penalty type could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function patchPenaltyType(penaltyType, changes) {
    setBusy(penaltyType.id);
    setMessage("");
    setError("");
    try {
      await settingsApi(`/settings/penalty-types/${penaltyType.id}`, { method: "PATCH", body: { ...changes, reason: "Administrative penalty configuration update" } });
      setMessage("Penalty type updated.");
      await loadSettings(selectedCycleId);
    } catch (err) {
      setError(err.message || "Penalty type could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function saveCycleDefaults(event) {
    event.preventDefault();
    setBusy("cycle");
    setMessage("");
    setError("");
    try {
      await settingsApi(`/settings/cycles/${selectedCycleId}/defaults`, { method: "PATCH", body: cycleDefaultsPayload(cycleForm) });
      setMessage("Cycle defaults updated.");
      await loadSettings(selectedCycleId);
    } catch (err) {
      setError(err.message || "Cycle defaults could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function saveRoundingPolicy(event) {
    event.preventDefault();
    setBusy("rounding");
    setMessage("");
    setError("");
    try {
      await settingsApi(`/settings/cycles/${selectedCycleId}/rounding-policy`, { method: "PATCH", body: roundingPayload(roundingForm) });
      setMessage("Rounding policy updated.");
      await loadSettings(selectedCycleId);
    } catch (err) {
      setError(err.message || "Rounding policy could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function saveNotifications(event) {
    event.preventDefault();
    setBusy("notifications");
    setMessage("");
    setError("");
    try {
      await settingsApi("/settings/notification-preferences", { method: "PATCH", body: notificationPayload(notificationForm) });
      setMessage("Notification preferences updated.");
      await loadSettings(selectedCycleId);
    } catch (err) {
      setError(err.message || "Notification preferences could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function saveActiveDefaults(event) {
    event.preventDefault();
    setBusy("active-defaults");
    setMessage("");
    setError("");
    try {
      await settingsApi("/settings/active-cycle-defaults", {
        method: "PATCH",
        body: {
          autoSelectLatestActive: Boolean(activeDefaultsForm.autoSelectLatestActive),
          defaultCycleId: activeDefaultsForm.defaultCycleId || null,
          reason: String(activeDefaultsForm.reason || "").trim(),
        },
      });
      setMessage("Active cycle defaults updated.");
      await loadSettings(selectedCycleId);
    } catch (err) {
      setError(err.message || "Active cycle defaults could not be updated.");
    } finally {
      setBusy("");
    }
  }

  function changeCycle(value) {
    setSelectedCycleId(value);
    loadSettings(value).catch(() => {});
  }

  const metrics = {
    users: context?.users?.length || 0,
    activeUsers: (context?.users || []).filter((user) => user.is_active).length,
    cycles: context?.cycles?.length || 0,
    penalties: context?.penaltyTypes?.length || 0,
  };

  return (
    <Page
      title="Settings"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={() => loadSettings()} loading={loading}>Refresh</Button>
          <Button type="submit" form="invite-user-form" icon={UserPlus} loading={busy === "invite"}>Invite User</Button>
          <Button type="submit" form="penalty-type-form" variant="secondary" icon={Save} loading={busy === "penalty"}>Add Penalty Type</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Settings updated">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Settings action failed">{error}</Alert> : null}

      <div className="metrics settings-metrics">
        <Card title="Users" value={metrics.users} note="System accounts" icon={Users} />
        <Card title="Active Users" value={metrics.activeUsers} note="Can sign in" tone="blue" icon={Lock} />
        <Card title="Cycles" value={metrics.cycles} note="Configured cycles" tone="teal" icon={CalendarDays} />
        <Card title="Penalty Types" value={metrics.penalties} note="Selected cycle" tone="amber" icon={AlertTriangle} />
      </div>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        label="Settings tabs"
        tabs={[
          { id: "users", label: "Users" },
          { id: "cycle", label: "Cycle Rules" },
          { id: "penalties", label: "Penalty Types" },
          { id: "app", label: "App Settings" },
        ]}
      />

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !context ? (
        <EmptyState title="No settings context" message="Refresh settings after the backend is available." />
      ) : (
        <>
          {activeTab === "users" ? (
            <>
              <section className="panel settings-form-panel">
                <div className="panel-head"><h2>Invite User</h2></div>
                <form id="invite-user-form" onSubmit={inviteUser} className="settings-form">
                  <div className="form-grid three">
                    <Field label="Email" type="email" value={userForm.email} onChange={(value) => setUserForm((current) => ({ ...current, email: value }))} error={errors.email} />
                    <Field label="Temporary password" type="password" value={userForm.password} onChange={(value) => setUserForm((current) => ({ ...current, password: value }))} error={errors.password} />
                    <Select label="Role" value={userForm.role} onChange={(value) => setUserForm((current) => ({ ...current, role: value }))} error={errors.role} options={["MEMBER", "ADMIN", "AUDITOR"].map((role) => ({ value: role, label: titleCase(role) }))} />
                  </div>
                </form>
              </section>

              <section className="panel">
                <div className="panel-head"><h2>Users</h2></div>
                <Textarea label="User change reason" value={userReason} onChange={setUserReason} rows={2} />
                <DataTable
                  columns={["Email", "Role", "Status", "Created", "Actions"]}
                  rows={(context.users || []).map((user) => [
                    user.email,
                    <Select
                      label="Role"
                      className="inline-field"
                      value={user.role}
                      onChange={(role) => updateUser(user, { role })}
                      options={["MEMBER", "ADMIN", "AUDITOR"].map((role) => ({ value: role, label: titleCase(role) }))}
                    />,
                    <Badge text={user.is_active ? "Active" : "Disabled"} tone={user.is_active ? "green" : "red"} />,
                    dateOnly(user.created_at),
                    <Button type="button" size="sm" variant="secondary" loading={busy === user.id} onClick={() => updateUser(user, { isActive: !user.is_active })}>{user.is_active ? "Disable User" : "Enable User"}</Button>,
                  ])}
                  empty="No users found."
                />
              </section>
            </>
          ) : null}

          {activeTab === "cycle" ? (
            <>
              <section className="panel settings-form-panel">
                <div className="panel-head">
                  <h2>Cycle Configuration</h2>
                  <Badge text={selectedCycle ? titleCase(selectedCycle.status) : "No cycle"} tone={selectedCycle?.status === "DRAFT" ? "amber" : "blue"} />
                </div>
                <Select
                  label="Cycle"
                  value={selectedCycleId}
                  onChange={changeCycle}
                  options={(context.cycles || []).map((cycle) => ({ value: cycle.id, label: `${cycle.name} - ${cycle.status}` }))}
                />
                <div className="detail-grid settings-detail-grid">
                  <DetailValue label="Savings Cap" value={money(selectedCycle?.savings_cap)} />
                  <DetailValue label="Minimum Borrowing" value={money(selectedCycle?.minimum_borrowing_amount)} />
                  <DetailValue label="Savings Interest" value={`${percentValue(selectedCycle?.savings_interest_rate)}%`} />
                  <DetailValue label="Loan Interest" value={`${percentValue(selectedCycle?.loan_interest_rate)}%`} />
                </div>
              </section>

              <form className="panel settings-form" onSubmit={saveCycleDefaults}>
                <div className="panel-head"><h2>Draft Cycle Defaults</h2><Button type="submit" icon={Save} loading={busy === "cycle"}>Save Defaults</Button></div>
                <div className="form-grid four">
                  <CurrencyInput label="Savings cap" value={cycleForm.savingsCap} onChange={(value) => setCycleForm((current) => ({ ...current, savingsCap: value }))} />
                  <CurrencyInput label="Minimum borrowing" value={cycleForm.minimumBorrowingAmount} onChange={(value) => setCycleForm((current) => ({ ...current, minimumBorrowingAmount: value }))} />
                  <Field label="Savings interest %" type="number" value={cycleForm.savingsInterestRate} onChange={(value) => setCycleForm((current) => ({ ...current, savingsInterestRate: value }))} />
                  <Field label="Loan interest %" type="number" value={cycleForm.loanInterestRate} onChange={(value) => setCycleForm((current) => ({ ...current, loanInterestRate: value }))} />
                  <Field label="Common interest %" type="number" value={cycleForm.commonInterestRate} onChange={(value) => setCycleForm((current) => ({ ...current, commonInterestRate: value }))} />
                  <CurrencyInput label="Social fund" value={cycleForm.socialFundAmount} onChange={(value) => setCycleForm((current) => ({ ...current, socialFundAmount: value }))} />
                  <CurrencyInput label="Membership fee" value={cycleForm.membershipFeeAmount} onChange={(value) => setCycleForm((current) => ({ ...current, membershipFeeAmount: value }))} />
                  <Field label="Declaration start day" type="number" value={cycleForm.declarationStartDay} onChange={(value) => setCycleForm((current) => ({ ...current, declarationStartDay: value }))} />
                  <Field label="Declaration end day" type="number" value={cycleForm.declarationEndDay} onChange={(value) => setCycleForm((current) => ({ ...current, declarationEndDay: value }))} />
                  <Field label="Payout start day" type="number" value={cycleForm.payoutStartDay} onChange={(value) => setCycleForm((current) => ({ ...current, payoutStartDay: value }))} />
                  <Field label="Payout end day" type="number" value={cycleForm.payoutEndDay} onChange={(value) => setCycleForm((current) => ({ ...current, payoutEndDay: value }))} />
                </div>
                <Textarea label="Reason" value={cycleForm.reason} onChange={(value) => setCycleForm((current) => ({ ...current, reason: value }))} rows={2} required />
              </form>

              <form className="panel settings-form" onSubmit={saveRoundingPolicy}>
                <div className="panel-head"><h2>Rounding Policy</h2><Button type="submit" variant="secondary" icon={Save} loading={busy === "rounding"}>Save Rounding</Button></div>
                <div className="form-grid three">
                  <Field label="Rounding scale" type="number" value={roundingForm.roundingScale} onChange={(value) => setRoundingForm((current) => ({ ...current, roundingScale: value }))} />
                  <Select label="Rounding mode" value={roundingForm.roundingMode} onChange={(value) => setRoundingForm((current) => ({ ...current, roundingMode: value }))} options={(context.roundingModes || []).map((mode) => ({ value: mode, label: titleCase(mode) }))} />
                  <Textarea label="Reason" value={roundingForm.reason} onChange={(value) => setRoundingForm((current) => ({ ...current, reason: value }))} rows={2} required />
                </div>
              </form>
            </>
          ) : null}

          {activeTab === "penalties" ? (
            <>
              <section className="panel settings-form-panel">
                <div className="panel-head"><h2>Add Penalty Type</h2></div>
                <form id="penalty-type-form" onSubmit={submitPenaltyType} className="settings-form">
                  <div className="form-grid three">
                    <Field label="Code" value={penaltyForm.code} onChange={(value) => setPenaltyForm((current) => ({ ...current, code: value }))} error={errors.code} placeholder="LATE_PAYMENT" />
                    <Field label="Name" value={penaltyForm.name} onChange={(value) => setPenaltyForm((current) => ({ ...current, name: value }))} error={errors.name} placeholder="Late payment" />
                    <CurrencyInput label="Amount" value={penaltyForm.amount} onChange={(value) => setPenaltyForm((current) => ({ ...current, amount: value }))} error={errors.amount} />
                    <Field label="Description" value={penaltyForm.description} onChange={(value) => setPenaltyForm((current) => ({ ...current, description: value }))} />
                    <label className="settings-check"><input type="checkbox" checked={penaltyForm.isConvertibleToLoan} onChange={(event) => setPenaltyForm((current) => ({ ...current, isConvertibleToLoan: event.target.checked }))} /> Convertible to loan</label>
                    <label className="settings-check"><input type="checkbox" checked={penaltyForm.isActive} onChange={(event) => setPenaltyForm((current) => ({ ...current, isActive: event.target.checked }))} /> Active</label>
                  </div>
                </form>
              </section>

              <section className="panel">
                <div className="panel-head"><h2>Penalty Types</h2><Badge text={selectedCycle?.name || "Selected cycle"} tone="blue" /></div>
                <DataTable
                  columns={["Code", "Name", "Amount", "Convertible", "Status", "Actions"]}
                  rows={(context.penaltyTypes || []).map((penaltyType) => [
                    penaltyType.code,
                    penaltyType.name,
                    money(penaltyType.amount),
                    penaltyType.is_convertible_to_loan ? "Yes" : "No",
                    <Badge text={penaltyType.is_active ? "Active" : "Disabled"} tone={penaltyType.is_active ? "green" : "red"} />,
                    <div className="button-row compact">
                      <Button type="button" size="sm" variant="secondary" loading={busy === penaltyType.id} onClick={() => patchPenaltyType(penaltyType, { isActive: !penaltyType.is_active })}>{penaltyType.is_active ? "Disable" : "Enable"}</Button>
                      <Button type="button" size="sm" variant="secondary" loading={busy === penaltyType.id} onClick={() => patchPenaltyType(penaltyType, { isConvertibleToLoan: !penaltyType.is_convertible_to_loan })}>{penaltyType.is_convertible_to_loan ? "Block Conversion" : "Allow Conversion"}</Button>
                    </div>,
                  ])}
                  empty="No penalty types configured for this cycle."
                />
              </section>
            </>
          ) : null}

          {activeTab === "app" ? (
            <div className="settings-app-grid">
              <form className="panel settings-form" onSubmit={saveNotifications}>
                <div className="panel-head"><h2>Notification Preferences</h2><Button type="submit" icon={Save} loading={busy === "notifications"}>Save</Button></div>
                <label className="settings-check"><input type="checkbox" checked={notificationForm.emailEnabled} onChange={(event) => setNotificationForm((current) => ({ ...current, emailEnabled: event.target.checked }))} /> Email enabled</label>
                <label className="settings-check"><input type="checkbox" checked={notificationForm.smsEnabled} onChange={(event) => setNotificationForm((current) => ({ ...current, smsEnabled: event.target.checked }))} /> SMS enabled</label>
                <Field label="Declaration reminder days" value={notificationForm.declarationReminderDays} onChange={(value) => setNotificationForm((current) => ({ ...current, declarationReminderDays: value }))} />
                <Field label="Payout reminder days" value={notificationForm.payoutReminderDays} onChange={(value) => setNotificationForm((current) => ({ ...current, payoutReminderDays: value }))} />
                <Textarea label="Reason" value={notificationForm.reason} onChange={(value) => setNotificationForm((current) => ({ ...current, reason: value }))} rows={2} required />
              </form>

              <form className="panel settings-form" onSubmit={saveActiveDefaults}>
                <div className="panel-head"><h2>Active Cycle Defaults</h2><Button type="submit" variant="secondary" icon={Save} loading={busy === "active-defaults"}>Save</Button></div>
                <label className="settings-check"><input type="checkbox" checked={activeDefaultsForm.autoSelectLatestActive} onChange={(event) => setActiveDefaultsForm((current) => ({ ...current, autoSelectLatestActive: event.target.checked }))} /> Auto-select latest active cycle</label>
                <Select label="Default cycle" value={activeDefaultsForm.defaultCycleId} onChange={(value) => setActiveDefaultsForm((current) => ({ ...current, defaultCycleId: value }))} placeholder="No fixed default" options={(context.cycles || []).map((cycle) => ({ value: cycle.id, label: `${cycle.name} - ${cycle.status}` }))} />
                <Textarea label="Reason" value={activeDefaultsForm.reason} onChange={(value) => setActiveDefaultsForm((current) => ({ ...current, reason: value }))} rows={2} required />
              </form>
            </div>
          ) : null}
        </>
      )}
    </Page>
  );
}
