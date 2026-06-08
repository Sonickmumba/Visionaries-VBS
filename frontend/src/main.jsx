import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Banknote,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  Lock,
  PiggyBank,
  Receipt,
  Scale,
  Users,
} from "lucide-react";
import { api, clearSession, getUser } from "./api/client.js";
import { Badge, Button, Card, DataTable, Field } from "./components/ui/index.jsx";
import { AppLayout, Page, ProtectedRoute, routeLabel } from "./layouts/AppLayouts.jsx";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage.jsx";
import { AuditTrailPage } from "./pages/admin/AuditTrailPage.jsx";
import { CommonInterestPage } from "./pages/admin/CommonInterestPage.jsx";
import { CycleScreensPage } from "./pages/admin/CycleScreensPage.jsx";
import { DeclarationScreensPage } from "./pages/admin/DeclarationScreensPage.jsx";
import { LedgerPage } from "./pages/admin/LedgerPage.jsx";
import { LoanScreensPage } from "./pages/admin/LoanScreensPage.jsx";
import { MemberManagementPage } from "./pages/admin/MemberManagementPage.jsx";
import { MonthlyClosingPage } from "./pages/admin/MonthlyClosingPage.jsx";
import { PenaltyScreensPage } from "./pages/admin/PenaltyScreensPage.jsx";
import { ReportsPage } from "./pages/admin/ReportsPage.jsx";
import { SavingsContributionPage } from "./pages/admin/SavingsContributionPage.jsx";
import { LoginPage } from "./pages/auth/LoginPage.jsx";
import { PasswordRecoveryPage } from "./pages/auth/PasswordRecoveryPage.jsx";
import { SignupPage } from "./pages/auth/SignupPage.jsx";
import "./styles/app.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? value.slice(0, 10) : "-";
const personName = (item) => [item?.first_name, item?.last_name].filter(Boolean).join(" ") || "Group";
const titleCase = (value) => String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

const ledgerTransactionTypes = [
  "SAVINGS_DEPOSIT",
  "SAVINGS_INTEREST",
  "SOCIAL_FUND_PAYMENT",
  "MEMBERSHIP_FEE_PAYMENT",
  "LOAN_DISBURSEMENT",
  "LOAN_TOP_UP",
  "PRINCIPAL_REPAYMENT",
  "LOAN_INTEREST_ASSESSMENT",
  "LOAN_INTEREST_REPAYMENT",
  "COMMON_INTEREST_ASSESSMENT",
  "COMMON_INTEREST_PAYMENT",
  "PENALTY_ASSESSMENT",
  "PENALTY_PAYMENT",
  "CONVERTED_PENALTY_LOAN",
  "ADMIN_ADJUSTMENT",
  "REVERSAL",
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadCsvFile(filename, headers, rows) {
  const lines = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","));
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function openPrintableReport({ title, subtitle, metrics = [], columns, rows, filename }) {
  const popup = window.open("", "_blank");
  if (!popup) return;
  const metricHtml = metrics.length ? `
    <section class="metrics">
      ${metrics.map((metric) => `<div><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>`).join("")}
    </section>
  ` : "";
  const rowsHtml = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length}">No records found.</td></tr>`;

  popup.document.write(`<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(filename || title)}</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; color: #172033; margin: 32px; }
          header { border-bottom: 2px solid #102a43; padding-bottom: 14px; margin-bottom: 20px; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          p { margin: 0; color: #65758b; }
          .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
          .metrics div { border: 1px solid #d8e1eb; padding: 10px; }
          .metrics span { display: block; color: #65758b; font-size: 11px; text-transform: uppercase; font-weight: 800; }
          .metrics strong { display: block; margin-top: 5px; font-size: 18px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #d8e1eb; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #eef4f8; color: #42526b; text-transform: uppercase; font-size: 10px; }
          .actions { margin-bottom: 16px; }
          button { background: #166534; color: white; border: 0; padding: 9px 13px; font-weight: 700; cursor: pointer; }
          @media print { .actions { display: none; } body { margin: 18mm; } }
        </style>
      </head>
      <body>
        <div class="actions"><button onclick="window.print()">Save as PDF</button></div>
        <header>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle || "")}</p>
        </header>
        ${metricHtml}
        <table>
          <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>setTimeout(() => window.print(), 250)</script>
      </body>
    </html>`);
  popup.document.close();
}

function Panel({ title, children }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

function ActionList({ items }) {
  return <div className="action-list">{items.map((item) => <button key={item}>{item}<span>Open</span></button>)}</div>;
}

function CyclesPage() {
  const [cycles, setCycles] = useState([]);
  useEffect(() => { api("/cycles").then((r) => setCycles(r.data)); }, []);
  return (
    <Page title="Cycles" actions={<><Button>New Cycle</Button><Button variant="secondary">Generate Months</Button></>}>
      <DataTable columns={["Cycle", "Dates", "Status", "Savings Cap", "Minimum Borrowing", "Action"]} rows={cycles.map((c) => [
        c.name, `${c.start_date?.slice(0, 10)} to ${c.end_date?.slice(0, 10)}`, <Badge text={c.status} />, money(c.savings_cap), money(c.minimum_borrowing_amount), <Button variant="secondary">View</Button>
      ])} />
    </Page>
  );
}

function MembersPage() {
  const [members, setMembers] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    memberCode: "",
    nationalId: "",
    address: "",
    temporaryPassword: "password123",
    enrollActiveCycle: true,
  });

  async function loadMembers() {
    const r = await api("/members");
    setMembers(r.data);
  }

  useEffect(() => {
    loadMembers().catch(() => setMembers([]));
    api("/cycles").then((r) => setCycles(r.data)).catch(() => setCycles([]));
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createMember(event, keepOpen = false) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await api("/members", {
        method: "POST",
        body: {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || null,
          email: form.email || null,
          memberCode: form.memberCode || null,
          nationalId: form.nationalId || null,
          address: form.address || null,
          temporaryPassword: form.temporaryPassword || "password123",
        },
      });
      const activeCycle = cycles.find((cycle) => cycle.status === "ACTIVE") || cycles[0];
      if (form.enrollActiveCycle && activeCycle) {
        await api("/members/enroll", {
          method: "POST",
          body: { cycleId: activeCycle.id, memberId: created.data.id },
        });
      }
      await loadMembers();
      setForm({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        memberCode: "",
        nationalId: "",
        address: "",
        temporaryPassword: "password123",
        enrollActiveCycle: true,
      });
      setShowForm(keepOpen);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleMember(member) {
    setError("");
    try {
      await api(`/members/${member.id}/${member.is_active ? "deactivate" : "activate"}`, { method: "POST" });
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  }

  if (selected) return <MemberDetail memberId={selected} onBack={() => setSelected(null)} />;
  return (
    <Page title="Members" actions={<><Button onClick={() => setShowForm((value) => !value)}>{showForm ? "Close Form" : "New Member"}</Button><Button variant="secondary">Enroll Member</Button></>}>
      {showForm && (
        <Panel title="Create Member">
          <form onSubmit={(event) => createMember(event)}>
            <div className="form-grid three">
              <Field label="First name" value={form.firstName} onChange={(v) => updateForm("firstName", v)} />
              <Field label="Last name" value={form.lastName} onChange={(v) => updateForm("lastName", v)} />
              <Field label="Phone" value={form.phone} onChange={(v) => updateForm("phone", v)} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => updateForm("email", v)} />
              <Field label="Member code" value={form.memberCode} onChange={(v) => updateForm("memberCode", v)} />
              <Field label="National ID" value={form.nationalId} onChange={(v) => updateForm("nationalId", v)} />
              <Field label="Temporary password" value={form.temporaryPassword} onChange={(v) => updateForm("temporaryPassword", v)} />
              <Field label="Address" value={form.address} onChange={(v) => updateForm("address", v)} />
              <label className="check-field">
                <input type="checkbox" checked={form.enrollActiveCycle} onChange={(event) => updateForm("enrollActiveCycle", event.target.checked)} />
                Enroll into active cycle
              </label>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="button-row">
              <Button disabled={saving}>{saving ? "Saving..." : "Save Member"}</Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={(event) => createMember(event, true)}>Save + Add Another</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Panel>
      )}
      <DataTable columns={["Member", "Code", "Phone", "Savings Principal", "Borrowed", "Declaration", "Approved", "Action"]} rows={members.map((m) => [
        `${m.first_name} ${m.last_name}`,
        m.member_code || "-",
        m.phone || "-",
        money(m.savings_principal),
        money(m.cumulative_borrowed),
        <Badge text={m.current_declaration_status || "NONE"} />,
        m.approved_declarations || 0,
        <div className="button-row compact"><Button variant="secondary" onClick={() => setSelected(m.id)}>View Details</Button><Button variant="secondary" onClick={() => toggleMember(m)}>{m.is_active ? "Deactivate" : "Activate"}</Button></div>
      ])} />
    </Page>
  );
}

function MemberDetail({ memberId, onBack }) {
  const [member, setMember] = useState(null);
  const [tab, setTab] = useState("Overview");
  useEffect(() => { api(`/members/${memberId}`).then((r) => setMember(r)); }, [memberId]);
  const tx = member?.transactions || [];
  const declarations = member?.declarations || [];
  const declarationStats = member?.declarationStats || {};
  return (
    <Page title={member?.data ? `${member.data.first_name} ${member.data.last_name}` : "Member Detail"} actions={<><Button variant="secondary" onClick={onBack}>Back</Button><Button>Post Savings</Button><Button variant="danger">Convert Penalty</Button></>}>
      <div className="tabs">{["Overview", "Savings", "Loans", "Declarations", "Penalties", "Statement", "Audit"].map((t) => <button className={tab === t ? "active" : ""} onClick={() => setTab(t)} key={t}>{t}</button>)}</div>
      <div className="metrics">
        <Card title="Savings" value={money(tx.filter((t) => t.transaction_type === "SAVINGS_DEPOSIT").reduce((s, t) => s + Number(t.amount), 0))} note="Principal deposits" />
        <Card title="Loan Balance" value={money(tx.filter((t) => t.transaction_type?.includes("LOAN")).reduce((s, t) => s + Number(t.amount), 0))} tone="blue" />
        <Card title="Approved Declarations" value={declarationStats.approved || 0} note={`${declarationStats.awaitingReview || 0} awaiting review`} tone="green" icon={ClipboardList} />
        <Card title="Penalties" value={money(tx.filter((t) => t.transaction_type === "PENALTY_ASSESSMENT").reduce((s, t) => s + Number(t.amount), 0))} tone="amber" />
      </div>
      {tab === "Declarations" ? (
        <DataTable columns={["Cycle", "Month", "Submitted", "Savings", "Loan", "Status"]} rows={declarations.map((d) => [
          d.cycle_name,
          d.month_number ? `Month ${d.month_number}` : "-",
          dateOnly(d.submitted_at),
          money(d.savings_amount),
          money(Number(d.loan_request_amount || 0) + Number(d.loan_top_up_amount || 0)),
          <Badge text={d.status} />,
        ])} empty="No declarations found." />
      ) : (
        <DataTable columns={["Date", "Type", "Amount", "Description", "Action"]} rows={tx.map((t) => [
          t.posted_at?.slice(0, 10), t.transaction_type, money(t.amount), t.description || "-", <Button variant="secondary">View Ledger</Button>
        ])} />
      )}
    </Page>
  );
}

function AdminDeclarationsPage() {
  const [cycles, setCycles] = useState([]);
  const [cycleDetail, setCycleDetail] = useState({ months: [], members: [] });
  const [cycleId, setCycleId] = useState("");
  const [cycleMonthId, setCycleMonthId] = useState("");
  const [queue, setQueue] = useState({ declarations: [], missed: [], cycleMonth: null });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [formMode, setFormMode] = useState(null);
  const [form, setForm] = useState({
    cycleMemberId: "",
    savingsAmount: "",
    loanRequestAmount: "",
    loanTopUpAmount: "",
    principalRepaymentAmount: "",
    loanInterestRepaymentAmount: "",
    commonInterestPaymentAmount: "",
    otherObligationAmount: "",
    notes: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/cycles").then((r) => {
      setCycles(r.data);
      const active = r.data.find((cycle) => cycle.status === "ACTIVE") || r.data[0];
      if (active) setCycleId(active.id);
    }).catch((err) => setError(err.message));
  }, []);

  const selectedCycle = cycles.find((cycle) => cycle.id === cycleId);

  useEffect(() => {
    if (!cycleId) return;
    api(`/cycles/${cycleId}`).then((r) => {
      setCycleDetail({ months: r.months || [], members: r.members || [] });
      const month = r.months.find((m) => m.status === "DECLARATION_PERIOD")
        || r.months.find((m) => m.status === "OPEN")
        || r.months[0];
      if (month) setCycleMonthId(month.id);
    }).catch((err) => setError(err.message));
  }, [cycleId]);

  async function loadQueue(monthId = cycleMonthId) {
    if (!monthId) return;
    setLoading(true);
    setError("");
    try {
      const r = await api(`/declarations/queue?cycleMonthId=${monthId}`);
      setQueue(r.data);
      setDetail((current) => {
        if (!current) return current;
        return r.data.declarations.find((item) => item.id === current.id) || current;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue().catch(() => {});
  }, [cycleMonthId]);

  async function openDeclaration(id) {
    setSelected(id);
    setFormMode(null);
    setMessage("");
    setError("");
    try {
      const r = await api(`/declarations/${id}`);
      setDetail(r.data);
    } catch (err) {
      setError(err.message);
    }
  }

  function emptyDeclarationForm(memberId = "") {
    return {
      cycleMemberId: memberId,
      savingsAmount: "",
      loanRequestAmount: "",
      loanTopUpAmount: "",
      principalRepaymentAmount: "",
      loanInterestRepaymentAmount: "",
      commonInterestPaymentAmount: "",
      otherObligationAmount: "",
      notes: "",
    };
  }

  function startNewDeclaration() {
    setDetail(null);
    setSelected(null);
    setMessage("");
    setError("");
    const firstMember = cycleDetail.members?.find((member) => member.status === "ACTIVE") || cycleDetail.members?.[0];
    setForm(emptyDeclarationForm(firstMember?.id || ""));
    setFormMode("new");
  }

  function startEditDeclaration() {
    if (!detail) return;
    setMessage("");
    setError("");
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
    setFormMode("edit");
  }

  function updateDeclarationForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function declarationNumber(field) {
    return Number(form[field] || 0);
  }

  async function submitAdminDeclaration(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      if (!cycleId || !cycleMonthId) throw new Error("Select a cycle and month first.");
      if (formMode === "new" && !form.cycleMemberId) throw new Error("Select a member for the declaration.");
      const body = {
        cycleId,
        cycleMonthId,
        cycleMemberId: form.cycleMemberId,
        savingsAmount: declarationNumber("savingsAmount"),
        loanRequestAmount: declarationNumber("loanRequestAmount"),
        loanTopUpAmount: declarationNumber("loanTopUpAmount"),
        principalRepaymentAmount: declarationNumber("principalRepaymentAmount"),
        loanInterestRepaymentAmount: declarationNumber("loanInterestRepaymentAmount"),
        commonInterestPaymentAmount: declarationNumber("commonInterestPaymentAmount"),
        otherObligationAmount: declarationNumber("otherObligationAmount"),
        notes: form.notes || null,
      };

      if (formMode === "edit" && detail) {
        await api(`/declarations/${detail.id}`, { method: "PATCH", body });
        setMessage("Declaration updated. Review and approve inputs again if needed.");
        await openDeclaration(detail.id);
      } else {
        const created = await api("/declarations", { method: "POST", body });
        setMessage("Declaration submitted.");
        await openDeclaration(created.data.id);
      }
      setFormMode(null);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createLoanRequest() {
    if (!detail) return;
    setMessage("");
    setError("");
    try {
      await api(`/declarations/${detail.id}/create-loan-request`, { method: "POST" });
      setMessage("Loan request created from declaration.");
      await openDeclaration(detail.id);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  async function approveInputs() {
    if (!detail) return;
    setMessage("");
    setError("");
    try {
      await api(`/declarations/${detail.id}/approve-inputs`, {
        method: "POST",
        body: { reason: "Reviewed and approved declaration inputs" },
      });
      setMessage("Declaration inputs approved.");
      await openDeclaration(detail.id);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelDeclaration() {
    if (!detail) return;
    if (!window.confirm("Cancel this declaration? This will keep the audit history but remove it from normal processing.")) return;
    const reason = window.prompt("Reason for cancellation", "Cancelled after admin review");
    if (reason === null) return;
    setMessage("");
    setError("");
    try {
      await api(`/declarations/${detail.id}/cancel`, {
        method: "POST",
        body: { reason: reason || "Cancelled after admin review" },
      });
      setMessage("Declaration cancelled.");
      await openDeclaration(detail.id);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  async function assessMissedPenalty(member) {
    setMessage("");
    setError("");
    try {
      if (!queue.cycleMonth) throw new Error("No cycle month selected.");
      if (!member.failure_penalty_type_id) throw new Error("Failure-to-declare penalty type is not configured for this cycle.");
      await api("/declarations/missed", {
        method: "POST",
        body: {
          cycleId: member.cycle_id,
          cycleMonthId: queue.cycleMonth.id,
          cycleMemberId: member.cycle_member_id,
          penaltyTypeId: member.failure_penalty_type_id,
          amount: Number(member.failure_penalty_amount || 0),
          notes: "Marked missed and assessed from declaration queue",
        },
      });
      setMessage(`${member.first_name} ${member.last_name} marked missed and penalty assessed.`);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalDeclaredSavings = queue.declarations.reduce((sum, item) => sum + Number(item.savings_amount || 0), 0);
  const totalLoanIntent = queue.declarations.reduce((sum, item) => sum + Number(item.loan_request_amount || 0) + Number(item.loan_top_up_amount || 0), 0);
  const detailIsClosed = detail && ["CANCELLED", "MISSED"].includes(detail.status);

  return (
    <Page title="Declarations" actions={<><Button onClick={() => loadQueue()}>{loading ? "Loading..." : "Refresh Queue"}</Button><Button variant="secondary" onClick={startNewDeclaration}>New Declaration</Button></>}>
      <Panel title="Queue Filters">
        <div className="form-grid three">
          <label className="field">
            <span>Cycle</span>
            <select value={cycleId} onChange={(event) => setCycleId(event.target.value)}>
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Month</span>
            <select value={cycleMonthId} onChange={(event) => setCycleMonthId(event.target.value)}>
              {cycleDetail.months.map((month) => (
                <option key={month.id} value={month.id}>Month {month.month_number} · {month.status.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <div className="queue-note">
            {queue.cycleMonth ? `${queue.cycleMonth.cycle_name} · Month ${queue.cycleMonth.month_number}` : "Select an active cycle month"}
          </div>
        </div>
      </Panel>

      <div className="metrics">
        <Card title="Submitted" value={queue.declarations.length} note="Declarations received" icon={ClipboardList} />
        <Card title="Missed" value={queue.missed.length} note="Members not declared" tone="amber" icon={AlertTriangle} />
        <Card title="Declared Savings" value={money(totalDeclaredSavings)} note="This month" tone="green" icon={PiggyBank} />
        <Card title="Loan Intent" value={money(totalLoanIntent)} note="Requests + top-ups" tone="blue" icon={Banknote} />
      </div>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      {formMode && (
        <Panel title={formMode === "edit" ? "Edit Declaration" : "New Declaration"}>
          <form id="admin-declaration-form" onSubmit={submitAdminDeclaration}>
            <div className="form-grid three">
              <label className="field">
                <span>Member</span>
                <select value={form.cycleMemberId} disabled={formMode === "edit"} onChange={(event) => updateDeclarationForm("cycleMemberId", event.target.value)}>
                  <option value="">Select member</option>
                  {cycleDetail.members.map((member) => (
                    <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>
                  ))}
                </select>
              </label>
              <Field label="Savings amount" type="number" value={form.savingsAmount} onChange={(value) => updateDeclarationForm("savingsAmount", value)} placeholder="K0" />
              <Field label="Loan request" type="number" value={form.loanRequestAmount} onChange={(value) => updateDeclarationForm("loanRequestAmount", value)} placeholder="K0" />
              <Field label="Loan top-up" type="number" value={form.loanTopUpAmount} onChange={(value) => updateDeclarationForm("loanTopUpAmount", value)} placeholder="K0" />
              <Field label="Principal repayment" type="number" value={form.principalRepaymentAmount} onChange={(value) => updateDeclarationForm("principalRepaymentAmount", value)} placeholder="K0" />
              <Field label="Interest repayment" type="number" value={form.loanInterestRepaymentAmount} onChange={(value) => updateDeclarationForm("loanInterestRepaymentAmount", value)} placeholder="K0" />
              <Field label="Common interest" type="number" value={form.commonInterestPaymentAmount} onChange={(value) => updateDeclarationForm("commonInterestPaymentAmount", value)} placeholder="K0" />
              <Field label="Other obligation" type="number" value={form.otherObligationAmount} onChange={(value) => updateDeclarationForm("otherObligationAmount", value)} placeholder="K0" />
              <Field label="Notes" value={form.notes} onChange={(value) => updateDeclarationForm("notes", value)} placeholder="Optional" />
            </div>
            <div className="button-row">
              <Button type="submit">{formMode === "edit" ? "Save Declaration" : "Submit Declaration"}</Button>
              <Button type="button" variant="secondary" onClick={() => setFormMode(null)}>Back</Button>
            </div>
          </form>
        </Panel>
      )}

      {detail && (
        <Panel title={`Declaration Detail: ${detail.first_name} ${detail.last_name}`}>
          <div className="detail-grid">
            <div><strong>Status</strong><span>{detail.status}</span></div>
            <div><strong>Submitted</strong><span>{detail.submitted_at?.slice(0, 19).replace("T", " ")}</span></div>
            <div><strong>Savings</strong><span>{money(detail.savings_amount)}</span></div>
            <div><strong>Loan Request</strong><span>{money(detail.loan_request_amount)}</span></div>
            <div><strong>Top-up</strong><span>{money(detail.loan_top_up_amount)}</span></div>
            <div><strong>Principal Repay</strong><span>{money(detail.principal_repayment_amount)}</span></div>
            <div><strong>Interest Repay</strong><span>{money(detail.loan_interest_repayment_amount)}</span></div>
            <div><strong>Common Interest</strong><span>{money(detail.common_interest_payment_amount)}</span></div>
          </div>
          <div className="button-row">
            <Button variant="secondary" onClick={startEditDeclaration} disabled={detail.status === "CANCELLED" || detail.status === "MISSED"}>Edit Declaration</Button>
            <Button onClick={createLoanRequest} disabled={detailIsClosed || detail.has_loan_request || (!Number(detail.loan_request_amount) && !Number(detail.loan_top_up_amount))}>
              {detail.has_loan_request ? "Loan Request Exists" : "Create Loan Request"}
            </Button>
            <Button variant="secondary" onClick={approveInputs} disabled={detail.status === "APPROVED" || detail.status === "CANCELLED" || detail.status === "MISSED"}>
              {detail.status === "APPROVED" ? "Inputs Approved" : "Approve Inputs"}
            </Button>
            <Button variant="danger" onClick={cancelDeclaration} disabled={detailIsClosed}>Cancel Declaration</Button>
            <Button variant="secondary" onClick={() => { setDetail(null); setSelected(null); }}>Close Detail</Button>
          </div>
        </Panel>
      )}

      <Panel title="Submitted Declarations">
        <DataTable columns={["Member", "Submitted", "Savings", "Loan", "Repayments", "Status", "Action"]} rows={queue.declarations.map((d) => [
          `${d.first_name} ${d.last_name}`,
          d.submitted_at?.slice(0, 10),
          money(d.savings_amount),
          money(Number(d.loan_request_amount) + Number(d.loan_top_up_amount)),
          money(Number(d.principal_repayment_amount) + Number(d.loan_interest_repayment_amount)),
          <Badge text={d.status} />,
          <Button variant={selected === d.id ? "primary" : "secondary"} onClick={() => openDeclaration(d.id)}>View Details</Button>,
        ])} />
      </Panel>

      <Panel title="Missed Declarations">
        <DataTable columns={["Member", "Code", "Status", "Action"]} rows={queue.missed.map((m) => [
          `${m.first_name} ${m.last_name}`,
          m.member_code || "-",
          <Badge text={m.has_failure_penalty ? "PENALTY ASSESSED" : "MISSED"} />,
          <Button variant={m.has_failure_penalty ? "secondary" : "danger"} disabled={m.has_failure_penalty} onClick={() => assessMissedPenalty(m)}>
            {m.has_failure_penalty ? "Penalty Assessed" : `Assess ${money(m.failure_penalty_amount)}`}
          </Button>,
        ])} empty="No missed declarations for this month." />
      </Panel>
    </Page>
  );
}

function AdminLoansPage() {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const r = await api("/loans/requests");
      setRequests(r.data);
      if (selected) {
        const refreshed = r.data.find((request) => request.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests().catch(() => {});
  }, []);

  function chooseRequest(request) {
    setSelected(request);
    setApprovedAmount(String(request.approved_amount || request.requested_amount || ""));
    setRejectionReason("");
    setMessage("");
    setError("");
  }

  async function approveRequest() {
    if (!selected) return;
    setMessage("");
    setError("");
    try {
      await api(`/loans/requests/${selected.id}/approve`, {
        method: "POST",
        body: { approvedAmount: Number(approvedAmount) },
      });
      setMessage("Loan request approved.");
      await loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  async function rejectRequest() {
    if (!selected) return;
    setMessage("");
    setError("");
    try {
      await api(`/loans/requests/${selected.id}/reject`, {
        method: "POST",
        body: { reason: rejectionReason || "Rejected by admin review" },
      });
      setMessage("Loan request rejected.");
      await loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  async function disburseRequest() {
    if (!selected) return;
    setMessage("");
    setError("");
    try {
      await api("/loans/disbursements", {
        method: "POST",
        body: {
          loanRequestId: selected.id,
          cycleId: selected.cycle_id,
          cycleMonthId: selected.cycle_month_id,
          cycleMemberId: selected.cycle_member_id,
          originType: selected.origin_type,
          amount: Number(selected.approved_amount),
          notes: "Disbursed from loan approval queue",
        },
      });
      setMessage("Loan disbursed and posted to ledger.");
      await loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  const pending = requests.filter((request) => request.status === "PENDING").length;
  const approved = requests.filter((request) => request.status === "APPROVED").length;
  const disbursed = requests.filter((request) => request.is_disbursed).length;
  const requestedTotal = requests.reduce((sum, request) => sum + Number(request.requested_amount || 0), 0);

  return (
    <Page title="Loans" actions={<><Button onClick={loadRequests}>{loading ? "Loading..." : "Refresh Queue"}</Button><Button variant="secondary">New Loan Request</Button><Button variant="secondary">Record Repayment</Button></>}>
      <div className="metrics">
        <Card title="Pending" value={pending} note="Needs review" tone="amber" icon={ClipboardList} />
        <Card title="Approved" value={approved} note="Ready for payout" tone="blue" icon={CheckCircle2} />
        <Card title="Disbursed" value={disbursed} note="Posted to ledger" icon={Banknote} />
        <Card title="Requested Total" value={money(requestedTotal)} note="All requests" tone="teal" icon={BadgeDollarSign} />
      </div>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      {selected && (
        <Panel title={`Loan Request Detail: ${selected.first_name} ${selected.last_name}`}>
          <div className="detail-grid">
            <div><strong>Type</strong><span>{selected.origin_type}</span></div>
            <div><strong>Status</strong><span>{selected.is_disbursed ? "DISBURSED" : selected.status}</span></div>
            <div><strong>Requested</strong><span>{money(selected.requested_amount)}</span></div>
            <div><strong>Cumulative Borrowed</strong><span>{money(selected.cumulative_borrowed)}</span></div>
            <div><strong>Approved Amount</strong><span>{money(selected.approved_amount)}</span></div>
            <div><strong>Requested Date</strong><span>{selected.requested_at?.slice(0, 10)}</span></div>
          </div>
          <div className="form-grid three">
            <Field label="Approved amount" type="number" value={approvedAmount} onChange={setApprovedAmount} />
            <Field label="Rejection reason" value={rejectionReason} onChange={setRejectionReason} placeholder="Required when rejecting" />
          </div>
          <div className="button-row">
            <Button onClick={approveRequest} disabled={selected.status === "REJECTED" || selected.is_disbursed}>Approve</Button>
            <Button variant="danger" onClick={rejectRequest} disabled={selected.status !== "PENDING" || selected.is_disbursed}>Reject</Button>
            <Button onClick={disburseRequest} disabled={selected.status !== "APPROVED" || selected.is_disbursed}>Disburse Loan</Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close Detail</Button>
          </div>
        </Panel>
      )}

      <Panel title="Loan Approval Queue">
        <DataTable columns={["Member", "Type", "Requested", "Approved", "Borrowed", "Status", "Action"]} rows={requests.map((request) => [
          `${request.first_name} ${request.last_name}`,
          request.origin_type,
          money(request.requested_amount),
          money(request.approved_amount),
          money(request.cumulative_borrowed),
          <Badge text={request.is_disbursed ? "DISBURSED" : request.status} />,
          <Button variant={selected?.id === request.id ? "primary" : "secondary"} onClick={() => chooseRequest(request)}>Review</Button>,
        ])} />
      </Panel>
    </Page>
  );
}

function AdminSavingsPage() {
  const [context, setContext] = useState({ cycle: null, cycleMonth: null, members: [] });
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [savingsAmount, setSavingsAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadContext() {
    setLoading(true);
    setError("");
    try {
      const r = await api("/savings/posting-context");
      setContext(r.data);
      if (!selectedMemberId && r.data.members?.[0]) {
        setSelectedMemberId(r.data.members[0].cycle_member_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContext().catch(() => {});
  }, []);

  const selectedMember = context.members.find((member) => member.cycle_member_id === selectedMemberId);
  const amountNumber = Number(savingsAmount || 0);
  const remaining = Number(selectedMember?.savings_cap_remaining || 0);
  const exceedsCap = amountNumber > remaining;

  async function postSavings(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      if (!context.cycle || !context.cycleMonth || !selectedMember) throw new Error("Savings posting context is not ready.");
      await api("/savings/deposits", {
        method: "POST",
        body: {
          cycleId: context.cycle.id,
          cycleMonthId: context.cycleMonth.id,
          cycleMemberId: selectedMember.cycle_member_id,
          amount: amountNumber,
          notes: "Posted from admin savings screen",
        },
      });
      setMessage("Savings deposit posted.");
      setSavingsAmount("");
      await loadContext();
    } catch (err) {
      setError(err.message);
    }
  }

  async function postContribution(type) {
    setMessage("");
    setError("");
    try {
      if (!context.cycle || !context.cycleMonth || !selectedMember) throw new Error("Contribution posting context is not ready.");
      const amount = type === "SOCIAL_FUND" ? Number(context.cycle.social_fund_amount) : Number(context.cycle.membership_fee_amount);
      await api("/savings/contributions", {
        method: "POST",
        body: {
          cycleId: context.cycle.id,
          cycleMonthId: context.cycleMonth.id,
          cycleMemberId: selectedMember.cycle_member_id,
          contributionType: type,
          amount,
          notes: "Posted from admin savings screen",
        },
      });
      setMessage(`${type === "SOCIAL_FUND" ? "Social fund" : "Membership fee"} posted.`);
      await loadContext();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalPrincipal = context.members.reduce((sum, member) => sum + Number(member.savings_principal || 0), 0);
  const socialPaid = context.members.filter((member) => member.social_fund_paid).length;
  const membershipPaid = context.members.filter((member) => member.membership_fee_paid).length;

  return (
    <Page title="Savings" actions={<><Button onClick={loadContext}>{loading ? "Loading..." : "Refresh"}</Button><Button variant="secondary">View Ledger</Button></>}>
      <div className="metrics">
        <Card title="Savings Principal" value={money(totalPrincipal)} note="Cycle deposits" icon={PiggyBank} />
        <Card title="Savings Cap" value={money(context.cycle?.savings_cap)} note="Per member" tone="blue" icon={Scale} />
        <Card title="Social Fund Paid" value={`${socialPaid}/${context.members.length}`} note={money(context.cycle?.social_fund_amount)} tone="teal" icon={Receipt} />
        <Card title="Membership Paid" value={`${membershipPaid}/${context.members.length}`} note={money(context.cycle?.membership_fee_amount)} tone="amber" icon={Users} />
      </div>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <Panel title="Post Savings and Contributions">
        <form onSubmit={postSavings}>
          <div className="form-grid three">
            <label className="field">
              <span>Member</span>
              <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)}>
                {context.members.map((member) => (
                  <option key={member.cycle_member_id} value={member.cycle_member_id}>
                    {member.first_name} {member.last_name} · {member.member_code || "No code"}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Savings deposit" type="number" value={savingsAmount} onChange={setSavingsAmount} placeholder="K0" />
            <div className={`queue-note ${exceedsCap ? "warn" : ""}`}>
              Remaining cap: {money(remaining)}
            </div>
          </div>
          {exceedsCap && <div className="error">Savings cap exceeded. Reduce the deposit before posting.</div>}
          <div className="button-row">
            <Button disabled={!selectedMember || !amountNumber || exceedsCap}>Post Savings</Button>
            <Button type="button" variant="secondary" disabled={!selectedMember || selectedMember.social_fund_paid} onClick={() => postContribution("SOCIAL_FUND")}>
              {selectedMember?.social_fund_paid ? "Social Fund Paid" : "Post Social Fund"}
            </Button>
            <Button type="button" variant="secondary" disabled={!selectedMember || selectedMember.membership_fee_paid} onClick={() => postContribution("MEMBERSHIP_FEE")}>
              {selectedMember?.membership_fee_paid ? "Membership Paid" : "Post Membership Fee"}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="Member Savings Status">
        <DataTable columns={["Member", "Principal", "Cap Remaining", "Social Fund", "Membership", "Action"]} rows={context.members.map((member) => [
          `${member.first_name} ${member.last_name}`,
          money(member.savings_principal),
          money(member.savings_cap_remaining),
          <Badge text={member.social_fund_paid ? "PAID" : "UNPAID"} />,
          <Badge text={member.membership_fee_paid ? "PAID" : "UNPAID"} />,
          <Button variant="secondary" onClick={() => setSelectedMemberId(member.cycle_member_id)}>Select</Button>,
        ])} />
      </Panel>
    </Page>
  );
}

function AdminPenaltiesPage() {
  const [penalties, setPenalties] = useState([]);
  const [selected, setSelected] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [conversionReason, setConversionReason] = useState("Unpaid penalty converted by admin review");
  const [waiveReason, setWaiveReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPenalties() {
    setLoading(true);
    setError("");
    try {
      const r = await api("/penalties");
      setPenalties(r.data);
      if (selected) {
        const refreshed = r.data.find((penalty) => penalty.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPenalties().catch(() => {});
  }, []);

  function choosePenalty(penalty) {
    setSelected(penalty);
    const outstanding = Number(penalty.amount_assessed || 0) - Number(penalty.amount_paid || 0);
    setPaymentAmount(outstanding > 0 ? String(outstanding) : "");
    setConversionReason("Unpaid penalty converted by admin review");
    setWaiveReason("");
    setMessage("");
    setError("");
  }

  function outstanding(penalty = selected) {
    return Math.max(0, Number(penalty?.amount_assessed || 0) - Number(penalty?.amount_paid || 0));
  }

  function canAct(penalty = selected) {
    return penalty && !["PAID", "CONVERTED_TO_LOAN", "WAIVED", "REVERSED"].includes(penalty.status);
  }

  async function markPaid() {
    if (!selected) return;
    setMessage("");
    setError("");
    try {
      await api(`/penalties/${selected.id}/pay`, {
        method: "POST",
        body: { amount: Number(paymentAmount) },
      });
      setMessage("Penalty payment posted.");
      await loadPenalties();
    } catch (err) {
      setError(err.message);
    }
  }

  async function convertToLoan() {
    if (!selected) return;
    setMessage("");
    setError("");
    try {
      await api(`/penalties/${selected.id}/convert-to-loan`, {
        method: "POST",
        body: { reason: conversionReason },
      });
      setMessage("Penalty converted to loan.");
      await loadPenalties();
    } catch (err) {
      setError(err.message);
    }
  }

  async function waivePenalty() {
    if (!selected) return;
    setMessage("");
    setError("");
    try {
      await api(`/penalties/${selected.id}/waive`, {
        method: "POST",
        body: { reason: waiveReason || "Waived by admin review" },
      });
      setMessage("Penalty waived.");
      await loadPenalties();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalAssessed = penalties.reduce((sum, penalty) => sum + Number(penalty.amount_assessed || 0), 0);
  const totalPaid = penalties.reduce((sum, penalty) => sum + Number(penalty.amount_paid || 0), 0);
  const totalOutstanding = penalties.reduce((sum, penalty) => sum + outstanding(penalty), 0);
  const convertedCount = penalties.filter((penalty) => penalty.status === "CONVERTED_TO_LOAN").length;

  return (
    <Page title="Penalties" actions={<><Button onClick={loadPenalties}>{loading ? "Loading..." : "Refresh"}</Button><Button variant="secondary">Assess Penalty</Button></>}>
      <div className="metrics">
        <Card title="Assessed" value={money(totalAssessed)} note={`${penalties.length} penalties`} tone="amber" icon={AlertTriangle} />
        <Card title="Paid" value={money(totalPaid)} note="Collected penalties" icon={Receipt} />
        <Card title="Outstanding" value={money(totalOutstanding)} note="Needs action" tone="red" icon={BadgeDollarSign} />
        <Card title="Converted" value={convertedCount} note="Penalty loans" tone="blue" icon={Banknote} />
      </div>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      {selected && (
        <Panel title={`Penalty Detail: ${selected.first_name} ${selected.last_name}`}>
          <div className="detail-grid">
            <div><strong>Type</strong><span>{selected.penalty_name}</span></div>
            <div><strong>Status</strong><span>{selected.status}</span></div>
            <div><strong>Assessed</strong><span>{money(selected.amount_assessed)}</span></div>
            <div><strong>Paid</strong><span>{money(selected.amount_paid)}</span></div>
            <div><strong>Outstanding</strong><span>{money(outstanding())}</span></div>
            <div><strong>Assessed Date</strong><span>{selected.assessed_at?.slice(0, 10)}</span></div>
          </div>
          <div className="form-grid three">
            <Field label="Payment amount" type="number" value={paymentAmount} onChange={setPaymentAmount} />
            <Field label="Conversion reason" value={conversionReason} onChange={setConversionReason} />
            <Field label="Waive reason" value={waiveReason} onChange={setWaiveReason} />
          </div>
          <div className="button-row">
            <Button onClick={markPaid} disabled={!canAct() || !Number(paymentAmount)}>Mark Paid</Button>
            <Button variant="danger" onClick={convertToLoan} disabled={!canAct() || outstanding() <= 0}>Convert to Loan</Button>
            <Button variant="secondary" onClick={waivePenalty} disabled={!canAct()}>Waive</Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close Detail</Button>
          </div>
        </Panel>
      )}

      <Panel title="Penalty Register">
        <DataTable columns={["Member", "Type", "Assessed", "Paid", "Outstanding", "Status", "Action"]} rows={penalties.map((penalty) => [
          `${penalty.first_name} ${penalty.last_name}`,
          penalty.penalty_name,
          money(penalty.amount_assessed),
          money(penalty.amount_paid),
          money(outstanding(penalty)),
          <Badge text={penalty.status} />,
          <Button variant={selected?.id === penalty.id ? "primary" : "secondary"} onClick={() => choosePenalty(penalty)}>View Details</Button>,
        ])} />
      </Panel>
    </Page>
  );
}

function AdminMonthlyClosingPage() {
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockMonth, setLockMonth] = useState(false);

  async function loadPreview() {
    setLoading(true);
    setError("");
    try {
      const r = await api("/monthly-closing/preview");
      setPreview(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview().catch(() => {});
  }, []);

  async function runClosing() {
    setMessage("");
    setError("");
    try {
      if (!preview?.cycle || !preview?.cycleMonth) throw new Error("Monthly closing preview is not ready.");
      const r = await api("/monthly-closing/run", {
        method: "POST",
        body: {
          cycleId: preview.cycle.id,
          cycleMonthId: preview.cycleMonth.id,
          lock: lockMonth,
        },
      });
      setMessage(`Monthly closing completed. ${lockMonth ? "Month locked." : "Month left unlocked for review."}`);
      setPreview((current) => current ? { ...current, result: r.data } : current);
      await loadPreview();
    } catch (err) {
      setError(err.message);
    }
  }

  const totals = preview?.totals || {};
  const steps = [
    "Validate Inputs",
    "Check Declarations",
    "Assess Penalties",
    "Savings Interest",
    "Loan Interest",
    "Review Snapshots",
    "Lock Month",
  ];

  return (
    <Page title="Monthly Closing" actions={<><Button onClick={loadPreview}>{loading ? "Loading..." : "Refresh Preview"}</Button><Button variant="danger" onClick={runClosing}>Run Closing</Button></>}>
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <Panel title="Closing Context">
        <div className="detail-grid">
          <div><strong>Cycle</strong><span>{preview?.cycle?.name || "No active cycle"}</span></div>
          <div><strong>Month</strong><span>{preview?.cycleMonth ? `Month ${preview.cycleMonth.month_number}` : "-"}</span></div>
          <div><strong>Status</strong><span>{preview?.cycleMonth?.status || "-"}</span></div>
          <div><strong>Lock on Run</strong><span>{lockMonth ? "Yes" : "No"}</span></div>
        </div>
        <label className="check-field">
          <input type="checkbox" checked={lockMonth} onChange={(event) => setLockMonth(event.target.checked)} />
          Lock month immediately after successful closing
        </label>
      </Panel>

      <Panel title="Closing Steps">
        <div className="wizard-steps">
          {steps.map((step, index) => (
            <div className="wizard-step" key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </Panel>

      <div className="metrics">
        <Card title="Declared" value={totals.declared || 0} note="Members declared" icon={ClipboardList} />
        <Card title="Missed" value={totals.missed || 0} note="Penalty candidates" tone="amber" icon={AlertTriangle} />
        <Card title="Savings Interest" value={money(totals.savingsInterest)} note="Preview amount" icon={PiggyBank} />
        <Card title="Loan Interest" value={money(totals.loanInterest)} note="Preview amount" tone="blue" icon={Banknote} />
      </div>

      <Panel title="Exceptions">
        <DataTable columns={["Member", "Issue", "Expected Action"]} rows={(preview?.members || [])
          .filter((member) => member.declarationStatus === "MISSED" || member.borrowingStatus !== "AT_OR_ABOVE_MINIMUM")
          .map((member) => [
            `${member.first_name} ${member.last_name}`,
            member.declarationStatus === "MISSED" ? "Missed declaration" : member.borrowingStatus,
            member.declarationStatus === "MISSED" ? `Penalty ${money(member.penaltyAmount)}` : `Shortfall ${money(member.borrowingShortfall)}`,
          ])} empty="No exceptions for this preview." />
      </Panel>

      <Panel title="Member Preview">
        <DataTable columns={["Member", "Declaration", "Savings Deposit", "Savings Interest", "Loan Interest", "Borrowing Status", "Penalty"]} rows={(preview?.members || []).map((member) => [
          `${member.first_name} ${member.last_name}`,
          <Badge text={member.declarationStatus} />,
          money(member.savingsDeposit),
          money(member.savingsInterest),
          money(member.loanInterest),
          <Badge text={member.borrowingStatus} />,
          money(member.penaltyAmount),
        ])} />
      </Panel>
    </Page>
  );
}

function AdminCommonInterestPage() {
  const [method, setMethod] = useState("NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL");
  const [preview, setPreview] = useState(null);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPreview(nextMethod = method) {
    setLoading(true);
    setError("");
    try {
      const r = await api(`/common-interest/preview?allocationMethod=${nextMethod}`);
      setPreview(r.data);
      setSelectedAllocation(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview().catch(() => {});
  }, []);

  async function postAllocation() {
    setMessage("");
    setError("");
    try {
      if (!preview?.cycle || !preview?.cycleMonth) throw new Error("Common-interest preview is not ready.");
      await api("/common-interest/calculate", {
        method: "POST",
        body: {
          cycleId: preview.cycle.id,
          cycleMonthId: preview.cycleMonth.id,
          allocationMethod: method,
        },
      });
      setMessage("Common-interest allocation posted to ledger.");
      await loadPreview();
    } catch (err) {
      setError(err.message);
    }
  }

  function changeMethod(value) {
    setMethod(value);
    loadPreview(value).catch(() => {});
  }

  return (
    <Page title="Common Interest" actions={<><Button onClick={() => loadPreview()}>{loading ? "Loading..." : "Calculate Preview"}</Button><Button variant="danger" onClick={postAllocation}>Post Allocation</Button></>}>
      <Panel title="Allocation Settings">
        <div className="form-grid three">
          <label className="field">
            <span>Allocation Method</span>
            <select value={method} onChange={(event) => changeMethod(event.target.value)}>
              <option value="ONLY_NON_BORROWERS_EQUAL">Only non-borrowers equal</option>
              <option value="NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL">Shortfall proportional</option>
              <option value="ALL_MEMBERS_EQUAL">All members equal</option>
            </select>
          </label>
          <div className="queue-note">{preview?.cycle?.name || "No active cycle"}</div>
          <div className="queue-note">{preview?.cycleMonth ? `Month ${preview.cycleMonth.month_number} · ${preview.cycleMonth.status}` : "No cycle month"}</div>
        </div>
      </Panel>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="metrics">
        <Card title="Pool Contributions" value={money(preview?.totalPoolContributions)} note="Savings + fees + inflows" icon={Coins} />
        <Card title="Loans Issued" value={money(preview?.totalLoansIssued)} note="Current month payouts" tone="blue" icon={Banknote} />
        <Card title="Unborrowed Money" value={money(preview?.unborrowedMoney)} note="Contribution less loans" tone="amber" icon={Scale} />
        <Card title="CI Pool" value={money(preview?.commonInterestPool)} note={`${Number(preview?.commonInterestRate || 0) * 100}% charge`} tone="teal" icon={BadgeDollarSign} />
      </div>

      {preview?.existingRun && (
        <div className="success">An allocation has already been posted for this month. Recalculation requires a reversal or authorized override first.</div>
      )}

      {selectedAllocation && (
        <Panel title={`Allocation Detail: ${selectedAllocation.first_name} ${selectedAllocation.last_name}`}>
          <div className="detail-grid">
            <div><strong>Status</strong><span>{selectedAllocation.status}</span></div>
            <div><strong>Borrowed</strong><span>{money(selectedAllocation.cumulativeBorrowed)}</span></div>
            <div><strong>Shortfall</strong><span>{money(selectedAllocation.shortfall)}</span></div>
            <div><strong>Weight</strong><span>{Number(selectedAllocation.weight || 0).toFixed(4)}</span></div>
            <div><strong>Assigned Base</strong><span>{money(selectedAllocation.assignedBase)}</span></div>
            <div><strong>Charge</strong><span>{money(selectedAllocation.charge)}</span></div>
          </div>
          <div className="button-row">
            <Button variant="secondary">Override Charge</Button>
            <Button variant="secondary" onClick={() => setSelectedAllocation(null)}>Close Detail</Button>
          </div>
        </Panel>
      )}

      <Panel title="Allocation Preview">
        <DataTable columns={["Member", "Borrowed", "Status", "Shortfall", "Weight", "Assigned Base", "Charge", "Action"]} rows={(preview?.allocations || []).map((allocation) => [
          `${allocation.first_name} ${allocation.last_name}`,
          money(allocation.cumulativeBorrowed),
          <Badge text={allocation.status} />,
          money(allocation.shortfall),
          Number(allocation.weight || 0).toFixed(4),
          money(allocation.assignedBase),
          money(allocation.charge),
          <Button variant="secondary" onClick={() => setSelectedAllocation(allocation)}>View Details</Button>,
        ])} empty="No eligible allocations for the selected method." />
      </Panel>

      <Panel title="Borrowing Compliance">
        <DataTable columns={["Member", "Borrowed", "Status", "Shortfall"]} rows={(preview?.members || []).map((member) => [
          `${member.first_name} ${member.last_name}`,
          money(member.cumulativeBorrowed),
          <Badge text={member.status} />,
          money(member.shortfall),
        ])} />
      </Panel>
    </Page>
  );
}

function AdminLedgerPage() {
  const [filters, setFilters] = useState({
    transactionType: "",
    dateFrom: "",
    dateTo: "",
  });
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState([]);
  const [linkedReversal, setLinkedReversal] = useState(null);
  const [reversalReason, setReversalReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState("");

  async function loadLedger(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const queryString = params.toString();
      const r = await api(`/ledger${queryString ? `?${queryString}` : ""}`);
      setTransactions(r.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openTransaction(id) {
    setDetailLoading(true);
    setError("");
    try {
      const r = await api(`/ledger/${id}`);
      setSelected(r.data);
      setEntries(r.entries || []);
      setLinkedReversal(r.reversal || null);
      setReversalReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function reverseSelectedTransaction() {
    setMessage("");
    setError("");
    setReversing(true);
    try {
      if (!selected) throw new Error("No transaction selected.");
      await api(`/ledger/${selected.id}/reverse`, {
        method: "POST",
        body: { reason: reversalReason },
      });
      setMessage("Ledger transaction reversed successfully.");
      await openTransaction(selected.id);
      await loadLedger();
    } catch (err) {
      setError(err.message);
    } finally {
      setReversing(false);
    }
  }

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    const next = { transactionType: "", dateFrom: "", dateTo: "" };
    setFilters(next);
    loadLedger(next).catch(() => {});
  }

  function exportCsv() {
    const header = ["Date", "Member", "Code", "Type", "Amount", "Cycle", "Month", "Source", "Description"];
    const lines = transactions.map((tx) => [
      dateOnly(tx.transaction_date),
      personName(tx),
      tx.member_code || "",
      tx.transaction_type,
      Number(tx.amount || 0).toFixed(2),
      tx.cycle_name || "",
      tx.month_number ? `Month ${tx.month_number}` : "",
      [tx.source_table, tx.source_id].filter(Boolean).join(":"),
      tx.description || "",
    ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "village-bank-ledger.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    loadLedger().catch(() => {});
  }, []);

  const totalDebits = entries.reduce((sum, entry) => sum + Number(entry.debit || 0), 0);
  const totalCredits = entries.reduce((sum, entry) => sum + Number(entry.credit || 0), 0);

  return (
    <Page title="Ledger Explorer" actions={<><Button onClick={() => loadLedger()}>{loading ? "Loading..." : "Filter"}</Button><Button variant="secondary" onClick={clearFilters}>Clear Filters</Button><Button variant="secondary" onClick={exportCsv}>Export CSV</Button></>}>
      <Panel title="Filters">
        <div className="form-grid three">
          <label className="field">
            <span>Transaction Type</span>
            <select value={filters.transactionType} onChange={(event) => updateFilter("transactionType", event.target.value)}>
              <option value="">All transaction types</option>
              {ledgerTransactionTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
          </label>
          <Field label="Date from" type="date" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
          <Field label="Date to" type="date" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
        </div>
      </Panel>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <div className="metrics">
        <Card title="Transactions" value={transactions.length} note="Current result set" icon={BookOpen} />
        <Card title="Total Amount" value={money(transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0))} note="Gross transaction values" tone="blue" icon={BadgeDollarSign} />
        <Card title="Reversals" value={transactions.filter((tx) => tx.is_reversal).length} note="Audit corrections" tone="amber" icon={Activity} />
        <Card title="Limit" value="250" note="Most recent records" tone="teal" icon={FileBarChart} />
      </div>

      {selected && (
        <Panel title="Transaction Detail">
          <div className="detail-grid">
            <div><strong>Member</strong><span>{personName(selected)} {selected.member_code ? `(${selected.member_code})` : ""}</span></div>
            <div><strong>Type</strong><span>{titleCase(selected.transaction_type)}</span></div>
            <div><strong>Amount</strong><span>{money(selected.amount)}</span></div>
            <div><strong>Date</strong><span>{dateOnly(selected.transaction_date)}</span></div>
            <div><strong>Cycle</strong><span>{selected.cycle_name || "-"}</span></div>
            <div><strong>Month</strong><span>{selected.month_number ? `Month ${selected.month_number}` : "-"}</span></div>
            <div><strong>Source</strong><span>{[selected.source_table, selected.source_id].filter(Boolean).join(" · ") || "-"}</span></div>
            <div><strong>Posted</strong><span>{selected.posted_at ? new Date(selected.posted_at).toLocaleString() : "-"}</span></div>
          </div>
          {selected.description && <div className="queue-note">{selected.description}</div>}
          <DataTable columns={["Account", "Debit", "Credit", "Memo"]} rows={entries.map((entry) => [
            titleCase(entry.account_type),
            money(entry.debit),
            money(entry.credit),
            entry.memo || "-",
          ])} empty={detailLoading ? "Loading entries..." : "No entries found for this transaction."} />
          <div className="detail-grid">
            <div><strong>Total Debits</strong><span>{money(totalDebits)}</span></div>
            <div><strong>Total Credits</strong><span>{money(totalCredits)}</span></div>
            <div><strong>Balanced</strong><span>{Math.round(totalDebits * 100) === Math.round(totalCredits * 100) ? "Yes" : "No"}</span></div>
            <div><strong>Reversal</strong><span>{selected.is_reversal ? "Yes" : "No"}</span></div>
            <div><strong>Reversed By</strong><span>{linkedReversal ? `${dateOnly(linkedReversal.posted_at)} · ${linkedReversal.reversal_reason}` : "Not reversed"}</span></div>
          </div>
          {!selected.is_reversal && !linkedReversal && (
            <div className="form-grid two">
              <Field label="Reversal reason" value={reversalReason} onChange={setReversalReason} placeholder="Explain why this transaction is being reversed" />
              <div className="queue-note warn">A reversal creates a new opposite ledger transaction and keeps the original audit trail.</div>
            </div>
          )}
          <div className="button-row">
            <Button variant="danger" disabled={selected.is_reversal || linkedReversal || reversalReason.trim().length < 3 || reversing} onClick={reverseSelectedTransaction}>{reversing ? "Reversing..." : linkedReversal ? "Already Reversed" : selected.is_reversal ? "Reversal Record" : "Reverse Transaction"}</Button>
            <Button variant="secondary" onClick={() => { setSelected(null); setEntries([]); setLinkedReversal(null); setReversalReason(""); }}>Close Detail</Button>
          </div>
        </Panel>
      )}

      <Panel title="Transactions">
        <DataTable columns={["Date", "Member", "Type", "Amount", "Cycle Month", "Source", "Action"]} rows={transactions.map((tx) => [
          dateOnly(tx.transaction_date),
          <><strong>{personName(tx)}</strong><br /><span className="muted">{tx.member_code || "Group transaction"}</span></>,
          <Badge text={titleCase(tx.transaction_type)} />,
          money(tx.amount),
          tx.month_number ? `Month ${tx.month_number} · ${titleCase(tx.cycle_month_status)}` : "-",
          [tx.source_table, tx.source_id?.slice(0, 8)].filter(Boolean).join(" · ") || "-",
          <Button variant="secondary" onClick={() => openTransaction(tx.id)}>{detailLoading && selected?.id === tx.id ? "Opening..." : "View Transaction"}</Button>,
        ])} empty={loading ? "Loading ledger transactions..." : "No ledger transactions found."} />
      </Panel>
    </Page>
  );
}

const reportDefinitions = {
  "cycle-summary": {
    label: "Cycle Summary",
    columns: ["Month", "Status", "Savings", "Loans", "Common Interest", "Penalties"],
  },
  "member-statements": {
    label: "Member Statements",
    columns: ["Member", "Savings", "Savings Interest", "Borrowed", "Loan Interest", "Common Interest", "Penalties", "Action"],
  },
  "monthly-pool": {
    label: "Monthly Pool",
    columns: ["Month", "Status", "Contributions", "Loans Issued", "Unborrowed", "CI Pool", "Penalties"],
  },
  savings: {
    label: "Savings",
    columns: ["Member", "Principal", "Interest", "Cap Remaining", "Action"],
  },
  loans: {
    label: "Loans",
    columns: ["Member", "Borrowed", "Principal Repaid", "Interest", "Interest Repaid", "Shortfall", "Action"],
  },
  "common-interest": {
    label: "Common Interest",
    columns: ["Month", "Member", "Compliance", "Borrowed", "Shortfall", "Assigned Base", "Charge"],
  },
  declarations: {
    label: "Declarations",
    columns: ["Member", "Status", "Within Window", "Submitted", "Savings", "Loan Request", "Repayments"],
  },
  penalties: {
    label: "Penalties",
    columns: ["Month", "Member", "Type", "Assessed", "Paid", "Outstanding", "Status"],
  },
};

function AdminReportsPage() {
  const [report, setReport] = useState("cycle-summary");
  const [data, setData] = useState(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReport(nextReport = report, nextMember = selectedMember) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ report: nextReport });
      if (nextReport === "member-statements" && nextMember) params.set("cycleMemberId", nextMember);
      const r = await api(`/reports/center?${params.toString()}`);
      setData(r.data);
      setSelectedRow(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport().catch(() => {});
  }, []);

  function changeReport(nextReport) {
    setReport(nextReport);
    if (nextReport !== "member-statements") setSelectedMember("");
    loadReport(nextReport, nextReport === "member-statements" ? selectedMember : "").catch(() => {});
  }

  function changeMember(value) {
    setSelectedMember(value);
    loadReport("member-statements", value).catch(() => {});
  }

  function rowsForExport() {
    return rawReportRows(data?.rows || [], report);
  }

  function exportCsv() {
    const headers = reportDefinitions[report].columns.filter((column) => column !== "Action");
    downloadCsvFile(`village-bank-${report}.csv`, headers, rowsForExport());
  }

  function downloadPdf() {
    const headers = reportDefinitions[report].columns.filter((column) => column !== "Action");
    openPrintableReport({
      title: reportDefinitions[report].label,
      subtitle: `${data?.cycle?.name || "Village Bank"}${data?.cycleMonth ? ` · Month ${data.cycleMonth.month_number}` : ""}`,
      filename: `village-bank-${report}`,
      metrics: [
        { label: "Rows", value: rows.length },
        { label: "Savings", value: money(totals.savings_principal || sumRows(rows, ["principal_deposited", "savings_principal", "total_savings_deposits"])) },
        { label: "Loans", value: money(totals.loans_issued || sumRows(rows, ["cumulative_borrowed", "total_loans_issued"])) },
        { label: "Charges", value: money(Number(totals.common_interest || 0) + Number(totals.penalties || 0) || sumRows(rows, ["common_interest_pool", "calculated_charge", "final_charge", "amount_assessed"])) },
      ],
      columns: headers,
      rows: rowsForExport(),
    });
  }

  const rows = data?.rows || [];
  const totals = data?.totals || {};
  const reportRows = buildReportRows(rows, report, setSelectedRow);

  return (
    <Page title="Reports Center" actions={<><Button onClick={() => loadReport()}>{loading ? "Running..." : "Run Report"}</Button><Button variant="secondary" onClick={downloadPdf}>Download PDF</Button><Button variant="secondary" onClick={exportCsv}>Export CSV</Button></>}>
      <div className="tabs">
        {Object.entries(reportDefinitions).map(([id, definition]) => (
          <button key={id} className={report === id ? "active" : ""} onClick={() => changeReport(id)}>{definition.label}</button>
        ))}
      </div>

      <Panel title="Report Filters">
        <div className="form-grid three">
          <div className="queue-note">{data?.cycle?.name || "No active cycle"}</div>
          <div className="queue-note">{data?.cycleMonth ? `Month ${data.cycleMonth.month_number} · ${titleCase(data.cycleMonth.status)}` : "All months"}</div>
          <label className="field">
            <span>Member</span>
            <select value={selectedMember} disabled={report !== "member-statements"} onChange={(event) => changeMember(event.target.value)}>
              <option value="">All members</option>
              {(data?.members || []).map((member) => (
                <option key={member.cycle_member_id} value={member.cycle_member_id}>{member.first_name} {member.last_name}</option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      {error && <div className="error">{error}</div>}

      <div className="metrics">
        <Card title="Report Rows" value={rows.length} note={reportDefinitions[report].label} icon={FileBarChart} />
        <Card title="Savings" value={money(totals.savings_principal || sumRows(rows, ["principal_deposited", "savings_principal", "total_savings_deposits"]))} note="Principal or monthly total" icon={PiggyBank} />
        <Card title="Loans" value={money(totals.loans_issued || sumRows(rows, ["cumulative_borrowed", "total_loans_issued"]))} note="Issued or borrowed" tone="blue" icon={Banknote} />
        <Card title="Charges" value={money(Number(totals.common_interest || 0) + Number(totals.penalties || 0) || sumRows(rows, ["common_interest_pool", "calculated_charge", "final_charge", "amount_assessed"]))} note="Common interest + penalties" tone="amber" icon={Scale} />
      </div>

      {selectedRow && (
        <Panel title="Report Detail">
          <div className="detail-grid">
            {Object.entries(selectedRow).filter(([key]) => !["id", "cycle_id", "cycle_month_id", "cycle_member_id", "member_id"].includes(key)).slice(0, 12).map(([key, value]) => (
              <div key={key}><strong>{titleCase(key)}</strong><span>{formatReportValue(key, value)}</span></div>
            ))}
          </div>
          <div className="button-row">
            {selectedRow.cycle_member_id && <Button variant="secondary">Open Member</Button>}
            <Button variant="secondary">Open Ledger</Button>
            <Button variant="secondary" onClick={() => setSelectedRow(null)}>Close Detail</Button>
          </div>
        </Panel>
      )}

      <Panel title={reportDefinitions[report].label}>
        <DataTable columns={reportDefinitions[report].columns} rows={reportRows} empty={loading ? "Running report..." : "No report rows found."} />
      </Panel>
    </Page>
  );
}

const auditActions = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "POST", "REVERSE", "OVERRIDE", "LOCK", "REOPEN", "LOGIN"];

function AdminAuditPage() {
  const [tab, setTab] = useState("logs");
  const [filters, setFilters] = useState({ action: "", entityTable: "", dateFrom: "", dateTo: "" });
  const [auditData, setAuditData] = useState({ data: [], overrides: [], reversals: [], totals: {} });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAudit(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const r = await api(`/audit${params.toString() ? `?${params.toString()}` : ""}`);
      setAuditData(r);
      setSelected(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudit().catch(() => {});
  }, []);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    const next = { action: "", entityTable: "", dateFrom: "", dateTo: "" };
    setFilters(next);
    loadAudit(next).catch(() => {});
  }

  function exportCsv() {
    const currentRows = tab === "overrides" ? auditData.overrides : tab === "reversals" ? auditData.reversals : auditData.data;
    const keys = Object.keys(currentRows[0] || {});
    const lines = currentRows.map((row) => keys.map((key) => `"${String(formatAuditValue(row[key])).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[keys.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `village-bank-audit-${tab}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const rows = tab === "overrides" ? auditData.overrides || [] : tab === "reversals" ? auditData.reversals || [] : auditData.data || [];

  return (
    <Page title="Audit Trail" actions={<><Button onClick={() => loadAudit()}>{loading ? "Filtering..." : "Filter"}</Button><Button variant="secondary" onClick={clearFilters}>Clear Filters</Button><Button variant="secondary" onClick={exportCsv}>Export CSV</Button></>}>
      <Panel title="Audit Filters">
        <div className="form-grid four">
          <label className="field">
            <span>Action</span>
            <select value={filters.action} onChange={(event) => updateFilter("action", event.target.value)}>
              <option value="">All actions</option>
              {auditActions.map((action) => <option key={action} value={action}>{titleCase(action)}</option>)}
            </select>
          </label>
          <Field label="Entity table" value={filters.entityTable} onChange={(value) => updateFilter("entityTable", value)} placeholder="cycles, penalties..." />
          <Field label="Date from" type="date" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
          <Field label="Date to" type="date" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
        </div>
      </Panel>

      {error && <div className="error">{error}</div>}

      <div className="metrics">
        <Card title="Audit Logs" value={auditData.totals?.logs || 0} note="Filtered events" icon={Activity} />
        <Card title="Overrides" value={auditData.totals?.overrides || 0} note="Manual value changes" tone="amber" icon={Settings} />
        <Card title="Reversals" value={auditData.totals?.reversals || 0} note="Ledger corrections" tone="red" icon={BookOpen} />
        <Card title="Logins" value={auditData.totals?.logins || 0} note="Access events in filter" tone="blue" icon={Lock} />
      </div>

      <div className="tabs">
        <button className={tab === "logs" ? "active" : ""} onClick={() => { setTab("logs"); setSelected(null); }}>Audit Logs</button>
        <button className={tab === "overrides" ? "active" : ""} onClick={() => { setTab("overrides"); setSelected(null); }}>Overrides</button>
        <button className={tab === "reversals" ? "active" : ""} onClick={() => { setTab("reversals"); setSelected(null); }}>Reversals</button>
      </div>

      {selected && (
        <Panel title="Audit Detail">
          <div className="detail-grid">
            {auditDetailPairs(selected).map(([key, value]) => (
              <div key={key}><strong>{titleCase(key)}</strong><span>{formatAuditValue(value)}</span></div>
            ))}
          </div>
          {(selected.before_data || selected.after_data) && (
            <div className="grid two">
              <Panel title="Before">
                <pre className="json-view">{JSON.stringify(selected.before_data || {}, null, 2)}</pre>
              </Panel>
              <Panel title="After">
                <pre className="json-view">{JSON.stringify(selected.after_data || {}, null, 2)}</pre>
              </Panel>
            </div>
          )}
          <div className="button-row">
            <Button variant="secondary">Open Related Record</Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close Detail</Button>
          </div>
        </Panel>
      )}

      <Panel title={tab === "overrides" ? "Overrides" : tab === "reversals" ? "Reversal Transactions" : "Audit Logs"}>
        <DataTable columns={auditColumns(tab)} rows={auditRows(tab, rows, setSelected)} empty={loading ? "Loading audit records..." : "No audit records found."} />
      </Panel>
    </Page>
  );
}

function auditColumns(tab) {
  if (tab === "overrides") return ["Date", "Cycle", "Target", "Field", "Original", "Override", "Reason", "Detail"];
  if (tab === "reversals") return ["Date", "Member", "Type", "Amount", "Reason", "Detail"];
  return ["Date", "Actor", "Action", "Entity", "Reason", "IP", "Detail"];
}

function auditRows(tab, rows, setSelected) {
  if (tab === "overrides") {
    return rows.map((row) => [
      dateOnly(row.created_at),
      row.cycle_name || "-",
      `${row.target_table}:${String(row.target_id || "").slice(0, 8)}`,
      titleCase(row.field_name),
      money(row.original_value),
      money(row.overridden_value),
      row.reason || "-",
      <Button variant="secondary" onClick={() => setSelected(row)}>View Audit Detail</Button>,
    ]);
  }
  if (tab === "reversals") {
    return rows.map((row) => [
      dateOnly(row.posted_at),
      personName(row),
      titleCase(row.transaction_type),
      money(row.amount),
      row.reversal_reason || "-",
      <Button variant="secondary" onClick={() => setSelected(row)}>View Audit Detail</Button>,
    ]);
  }
  return rows.map((row) => [
    row.created_at ? new Date(row.created_at).toLocaleString() : "-",
    row.actor_email || "System",
    <Badge text={titleCase(row.action)} />,
    `${row.entity_table}${row.entity_id ? `:${String(row.entity_id).slice(0, 8)}` : ""}`,
    row.reason || "-",
    row.ip_address || "-",
    <Button variant="secondary" onClick={() => setSelected(row)}>View Audit Detail</Button>,
  ]);
}

function auditDetailPairs(row) {
  return Object.entries(row)
    .filter(([key]) => !["before_data", "after_data"].includes(key))
    .slice(0, 16);
}

function formatAuditValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function AdminSettingsPage() {
  const [context, setContext] = useState(null);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [userForm, setUserForm] = useState({ email: "", password: "", role: "MEMBER" });
  const [penaltyForm, setPenaltyForm] = useState({
    code: "",
    name: "",
    description: "",
    amount: "",
    isConvertibleToLoan: true,
    isActive: true,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadSettings(cycleId = selectedCycleId) {
    setLoading(true);
    setError("");
    try {
      const r = await api(`/settings/context${cycleId ? `?cycleId=${cycleId}` : ""}`);
      setContext(r.data);
      setSelectedCycleId(r.data.selectedCycleId || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings().catch(() => {});
  }, []);

  function updateUserForm(field, value) {
    setUserForm((current) => ({ ...current, [field]: value }));
  }

  function updatePenaltyForm(field, value) {
    setPenaltyForm((current) => ({ ...current, [field]: value }));
  }

  async function inviteUser(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api("/settings/users", { method: "POST", body: userForm });
      setMessage("User invited successfully.");
      setUserForm({ email: "", password: "", role: "MEMBER" });
      await loadSettings();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateUser(user, changes) {
    setMessage("");
    setError("");
    try {
      await api(`/settings/users/${user.id}`, {
        method: "PATCH",
        body: { ...changes, reason: changes.reason || "Administrative user setting update" },
      });
      setMessage("User settings updated.");
      await loadSettings();
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePenaltyType(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      if (!selectedCycleId) throw new Error("Select a cycle before adding a penalty type.");
      await api("/settings/penalty-types", {
        method: "POST",
        body: {
          cycleId: selectedCycleId,
          code: penaltyForm.code,
          name: penaltyForm.name,
          description: penaltyForm.description || null,
          amount: Number(penaltyForm.amount || 0),
          isConvertibleToLoan: penaltyForm.isConvertibleToLoan,
          isActive: penaltyForm.isActive,
        },
      });
      setMessage("Penalty type saved.");
      setPenaltyForm({ code: "", name: "", description: "", amount: "", isConvertibleToLoan: true, isActive: true });
      await loadSettings(selectedCycleId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function togglePenaltyType(penaltyType, changes) {
    setMessage("");
    setError("");
    try {
      await api(`/settings/penalty-types/${penaltyType.id}`, {
        method: "PATCH",
        body: { ...changes, reason: "Administrative penalty configuration update" },
      });
      setMessage("Penalty type updated.");
      await loadSettings(selectedCycleId);
    } catch (err) {
      setError(err.message);
    }
  }

  function changeCycle(value) {
    setSelectedCycleId(value);
    loadSettings(value).catch(() => {});
  }

  return (
    <Page title="Settings" actions={<><Button onClick={() => loadSettings()}>{loading ? "Loading..." : "Refresh"}</Button><Button form="invite-user-form">Invite User</Button><Button form="penalty-type-form" variant="secondary">Add Penalty Type</Button></>}>
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="metrics">
        <Card title="Users" value={context?.users?.length || 0} note="System accounts" icon={Users} />
        <Card title="Active Users" value={(context?.users || []).filter((user) => user.is_active).length} note="Can sign in" tone="blue" icon={Lock} />
        <Card title="Cycles" value={context?.cycles?.length || 0} note="Configured cycles" tone="teal" icon={CalendarDays} />
        <Card title="Penalty Types" value={context?.penaltyTypes?.length || 0} note="Selected cycle" tone="amber" icon={AlertTriangle} />
      </div>

      <div className="grid two">
        <Panel title="Invite User">
          <form id="invite-user-form" onSubmit={inviteUser}>
            <div className="form-grid two">
              <Field label="Email" type="email" value={userForm.email} onChange={(value) => updateUserForm("email", value)} />
              <Field label="Temporary password" type="password" value={userForm.password} onChange={(value) => updateUserForm("password", value)} />
              <label className="field">
                <span>Role</span>
                <select value={userForm.role} onChange={(event) => updateUserForm("role", event.target.value)}>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="AUDITOR">Auditor</option>
                </select>
              </label>
            </div>
          </form>
        </Panel>

        <Panel title="Cycle Configuration">
          <div className="form-grid two">
            <label className="field">
              <span>Cycle</span>
              <select value={selectedCycleId} onChange={(event) => changeCycle(event.target.value)}>
                {(context?.cycles || []).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}
              </select>
            </label>
            <div className="queue-note">{context?.activeCycle ? `Active: ${context.activeCycle.name}` : "No active cycle"}</div>
          </div>
        </Panel>
      </div>

      <Panel title="Users">
        <DataTable columns={["Email", "Role", "Status", "Created", "Actions"]} rows={(context?.users || []).map((user) => [
          user.email,
          <label className="field inline-field">
            <select value={user.role} onChange={(event) => updateUser(user, { role: event.target.value })}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
              <option value="AUDITOR">Auditor</option>
            </select>
          </label>,
          <Badge text={user.is_active ? "Active" : "Disabled"} />,
          dateOnly(user.created_at),
          <div className="button-row compact">
            <Button variant="secondary" onClick={() => updateUser(user, { isActive: !user.is_active })}>{user.is_active ? "Disable User" : "Enable User"}</Button>
          </div>,
        ])} empty="No users found." />
      </Panel>

      <div className="grid two">
        <Panel title="Add Penalty Type">
          <form id="penalty-type-form" onSubmit={savePenaltyType}>
            <div className="form-grid two">
              <Field label="Code" value={penaltyForm.code} onChange={(value) => updatePenaltyForm("code", value)} placeholder="LATE_PAYMENT" />
              <Field label="Name" value={penaltyForm.name} onChange={(value) => updatePenaltyForm("name", value)} placeholder="Late payment" />
              <Field label="Amount" type="number" value={penaltyForm.amount} onChange={(value) => updatePenaltyForm("amount", value)} placeholder="K0" />
              <Field label="Description" value={penaltyForm.description} onChange={(value) => updatePenaltyForm("description", value)} placeholder="Optional" />
              <label className="check-field">
                <input type="checkbox" checked={penaltyForm.isConvertibleToLoan} onChange={(event) => updatePenaltyForm("isConvertibleToLoan", event.target.checked)} />
                Convertible to loan
              </label>
              <label className="check-field">
                <input type="checkbox" checked={penaltyForm.isActive} onChange={(event) => updatePenaltyForm("isActive", event.target.checked)} />
                Active
              </label>
            </div>
          </form>
        </Panel>

        <Panel title="Cycle Rules Snapshot">
          <div className="detail-grid">
            <div><strong>Selected Cycle</strong><span>{(context?.cycles || []).find((cycle) => cycle.id === selectedCycleId)?.name || "-"}</span></div>
            <div><strong>Status</strong><span>{titleCase((context?.cycles || []).find((cycle) => cycle.id === selectedCycleId)?.status)}</span></div>
            <div><strong>Savings Cap</strong><span>{money((context?.cycles || []).find((cycle) => cycle.id === selectedCycleId)?.savings_cap)}</span></div>
            <div><strong>Minimum Borrowing</strong><span>{money((context?.cycles || []).find((cycle) => cycle.id === selectedCycleId)?.minimum_borrowing_amount)}</span></div>
          </div>
        </Panel>
      </div>

      <Panel title="Penalty Types">
        <DataTable columns={["Code", "Name", "Amount", "Convertible", "Status", "Actions"]} rows={(context?.penaltyTypes || []).map((penaltyType) => [
          penaltyType.code,
          penaltyType.name,
          money(penaltyType.amount),
          penaltyType.is_convertible_to_loan ? "Yes" : "No",
          <Badge text={penaltyType.is_active ? "Active" : "Disabled"} />,
          <div className="button-row compact">
            <Button variant="secondary" onClick={() => togglePenaltyType(penaltyType, { isActive: !penaltyType.is_active })}>{penaltyType.is_active ? "Disable" : "Enable"}</Button>
            <Button variant="secondary" onClick={() => togglePenaltyType(penaltyType, { isConvertibleToLoan: !penaltyType.is_convertible_to_loan })}>{penaltyType.is_convertible_to_loan ? "Block Conversion" : "Allow Conversion"}</Button>
          </div>,
        ])} empty="No penalty types configured for this cycle." />
      </Panel>
    </Page>
  );
}

function sumRows(rows, keys) {
  return rows.reduce((sum, row) => sum + keys.reduce((inner, key) => inner + Number(row[key] || 0), 0), 0);
}

function reportMember(row) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Group";
}

function formatReportValue(key, value) {
  if (value === null || value === undefined || value === "") return "-";
  if (key.includes("amount") || key.includes("total") || key.includes("interest") || key.includes("saving") || key.includes("loan") || key.includes("penalt") || key.includes("charge") || key.includes("borrow") || key.includes("paid") || key.includes("base") || key.includes("shortfall") || key.includes("principal")) return money(value);
  if (key.includes("date") || key.includes("_at")) return String(value).slice(0, 10);
  return titleCase(value);
}

function buildReportRows(rows, report, setSelectedRow) {
  if (report === "member-statements") {
    return rows.map((row) => [
      <><strong>{reportMember(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      money(row.savings_principal),
      money(row.savings_interest),
      money(row.borrowed),
      money(row.loan_interest_assessed),
      money(row.common_interest),
      money(Number(row.penalties || 0) - Number(row.penalties_paid || 0)),
      <Button variant="secondary" onClick={() => setSelectedRow(row)}>View Details</Button>,
    ]);
  }
  if (report === "monthly-pool") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      <Badge text={titleCase(row.status)} />,
      money(row.total_pool_contributions),
      money(row.total_loans_issued),
      money(row.unborrowed_money),
      money(row.common_interest_pool),
      money(row.total_penalties_assessed),
    ]);
  }
  if (report === "savings") {
    return rows.map((row) => [
      <><strong>{reportMember(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      money(row.principal_deposited),
      money(row.interest_earned),
      money(row.cap_remaining),
      <Button variant="secondary" onClick={() => setSelectedRow(row)}>View Details</Button>,
    ]);
  }
  if (report === "loans") {
    return rows.map((row) => [
      <><strong>{reportMember(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      money(row.cumulative_borrowed),
      money(row.principal_repaid),
      money(row.interest_assessed),
      money(row.interest_repaid),
      money(row.borrowing_shortfall),
      <Button variant="secondary" onClick={() => setSelectedRow(row)}>View Details</Button>,
    ]);
  }
  if (report === "common-interest") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      <><strong>{reportMember(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      <Badge text={titleCase(row.compliance_status)} />,
      money(row.cumulative_borrowed_amount),
      money(row.borrowing_shortfall),
      money(row.assigned_base),
      money(row.final_charge),
    ]);
  }
  if (report === "declarations") {
    return rows.map((row) => [
      <><strong>{reportMember(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      <Badge text={row.status ? titleCase(row.status) : "Missed"} />,
      row.is_within_window === null || row.is_within_window === undefined ? "-" : row.is_within_window ? "Yes" : "No",
      row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "-",
      money(row.savings_amount),
      money(row.loan_request_amount),
      money(Number(row.principal_repayment_amount || 0) + Number(row.loan_interest_repayment_amount || 0)),
    ]);
  }
  if (report === "penalties") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      <><strong>{reportMember(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      row.penalty_type,
      money(row.amount_assessed),
      money(row.amount_paid),
      money(row.outstanding_amount),
      <Badge text={titleCase(row.status)} />,
    ]);
  }
  return rows.map((row) => [
    `Month ${row.month_number}`,
    <Badge text={titleCase(row.status)} />,
    money(row.total_savings_deposits),
    money(row.total_loans_issued),
    money(row.common_interest_pool),
    money(row.total_penalties_assessed),
  ]);
}

function rawReportRows(rows, report) {
  if (report === "member-statements") {
    return rows.map((row) => [
      `${reportMember(row)} ${row.member_code || ""}`.trim(),
      money(row.savings_principal),
      money(row.savings_interest),
      money(row.borrowed),
      money(row.loan_interest_assessed),
      money(row.common_interest),
      money(Number(row.penalties || 0) - Number(row.penalties_paid || 0)),
    ]);
  }
  if (report === "monthly-pool") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      titleCase(row.status),
      money(row.total_pool_contributions),
      money(row.total_loans_issued),
      money(row.unborrowed_money),
      money(row.common_interest_pool),
      money(row.total_penalties_assessed),
    ]);
  }
  if (report === "savings") {
    return rows.map((row) => [
      `${reportMember(row)} ${row.member_code || ""}`.trim(),
      money(row.principal_deposited),
      money(row.interest_earned),
      money(row.cap_remaining),
    ]);
  }
  if (report === "loans") {
    return rows.map((row) => [
      `${reportMember(row)} ${row.member_code || ""}`.trim(),
      money(row.cumulative_borrowed),
      money(row.principal_repaid),
      money(row.interest_assessed),
      money(row.interest_repaid),
      money(row.borrowing_shortfall),
    ]);
  }
  if (report === "common-interest") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      `${reportMember(row)} ${row.member_code || ""}`.trim(),
      titleCase(row.compliance_status),
      money(row.cumulative_borrowed_amount),
      money(row.borrowing_shortfall),
      money(row.assigned_base),
      money(row.final_charge),
    ]);
  }
  if (report === "declarations") {
    return rows.map((row) => [
      `${reportMember(row)} ${row.member_code || ""}`.trim(),
      row.status ? titleCase(row.status) : "Missed",
      row.is_within_window === null || row.is_within_window === undefined ? "-" : row.is_within_window ? "Yes" : "No",
      row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "-",
      money(row.savings_amount),
      money(row.loan_request_amount),
      money(Number(row.principal_repayment_amount || 0) + Number(row.loan_interest_repayment_amount || 0)),
    ]);
  }
  if (report === "penalties") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      `${reportMember(row)} ${row.member_code || ""}`.trim(),
      row.penalty_type,
      money(row.amount_assessed),
      money(row.amount_paid),
      money(row.outstanding_amount),
      titleCase(row.status),
    ]);
  }
  return rows.map((row) => [
    `Month ${row.month_number}`,
    titleCase(row.status),
    money(row.total_savings_deposits),
    money(row.total_loans_issued),
    money(row.common_interest_pool),
    money(row.total_penalties_assessed),
  ]);
}

function GenericAdminPage({ title, type }) {
  const content = {
    declarations: ["New Declaration", "Submit Declaration", "Save Draft", "Edit Declaration", "Cancel Declaration", "Approve Inputs", "Create Loan Request", "Assess Penalty"],
    savings: ["Post Savings", "Post Social Fund", "Post Membership Fee", "Reverse Posting", "View Ledger"],
    loans: ["Approve", "Reject", "Adjust Amount", "Disburse Loan", "Record Repayment", "View Loan", "Reverse Transaction"],
    "common-interest": ["Calculate Preview", "Approve Allocation", "Override Charge", "Save Override", "View Ledger", "Export"],
    penalties: ["Assess Penalty", "Mark Paid", "Convert to Loan", "Waive", "Reverse", "View Converted Loan"],
    closing: ["Start Closing", "Continue", "Back", "Recalculate", "View Exceptions", "Approve Step", "Lock Month", "Export Closing Report"],
    ledger: ["Filter", "Clear Filters", "View Transaction", "Reverse Transaction", "Export CSV"],
    reports: ["Run Report", "Download PDF", "Export CSV", "Open Member", "Open Ledger"],
    audit: ["Filter", "View Audit Detail", "Export CSV"],
    settings: ["Invite User", "Save User", "Disable User", "Add Penalty Type", "Save Settings"],
  }[type] || [];
  return (
    <Page title={title} actions={content.slice(0, 3).map((b) => <Button key={b} variant={b.includes("Reverse") || b.includes("Lock") ? "danger" : "primary"}>{b}</Button>)}>
      <Panel title={`${title} Workspace`}>
        <p className="muted">This screen is wired into the app navigation and ready for API-specific forms. All expected workflow buttons are visible below.</p>
        <div className="button-cloud">{content.map((b) => <Button key={b} variant={b.includes("Cancel") || b.includes("Reverse") || b.includes("Waive") ? "danger" : "secondary"}>{b}</Button>)}</div>
      </Panel>
      <DataTable columns={["Record", "Member", "Amount", "Status", "Action"]} rows={[
        ["March item", "Mary Phiri", "K1,000", <Badge text="Pending" />, <Button variant="secondary">View Details</Button>],
        ["Cycle item", "Agnes Banda", "K5,000", <Badge text="Approved" />, <Button variant="secondary">Open</Button>],
      ]} />
    </Page>
  );
}

async function loadMemberPortalData() {
  const me = await api("/auth/me");
  const activeMembership = me.cycleMemberships?.find((membership) => membership.cycle_status === "ACTIVE") || me.cycleMemberships?.[0] || null;
  if (!activeMembership) return { me, activeMembership: null, statement: null, savings: [], loans: [], penalties: [] };
  const [statement, savings, loans, penalties] = await Promise.all([
    api(`/reports/member-statement/${activeMembership.id}`),
    api(`/savings/member/${activeMembership.id}`),
    api(`/loans/member/${activeMembership.id}`),
    api(`/penalties/member/${activeMembership.id}`),
  ]);
  return {
    me,
    activeMembership,
    statement: statement.data,
    savings: savings.data || [],
    loans: loans.data || [],
    penalties: penalties.data || [],
  };
}

function memberTotals(portal) {
  const totals = portal?.statement?.totals || {};
  const borrowed = Number(totals.borrowed || 0);
  const principalRepaid = Number(totals.principal_repaid || 0);
  const loanInterest = Number(totals.loan_interest_assessed || 0);
  const loanInterestRepaid = Number(totals.loan_interest_repaid || 0);
  const penalties = Number(totals.penalties || 0);
  const penaltiesPaid = Number(totals.penalties_paid || 0);
  return {
    savingsPrincipal: Number(totals.savings_principal || 0),
    savingsInterest: Number(totals.savings_interest || 0),
    accumulatedSavings: Number(totals.savings_principal || 0) + Number(totals.savings_interest || 0),
    outstandingLoan: borrowed + loanInterest - principalRepaid - loanInterestRepaid,
    commonInterestDue: Number(totals.common_interest || 0) - Number(totals.common_interest_paid || 0),
    penaltyDue: penalties - penaltiesPaid,
    borrowed,
    borrowingShortfall: Math.max(0, Number(portal?.activeMembership?.minimum_borrowing_amount || 0) - borrowed),
  };
}

function useMemberPortal() {
  const [portal, setPortal] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setPortal(await loadMemberPortalData());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  return { portal, totals: memberTotals(portal), error, loading, reload: load };
}

function MemberDashboard({ setPage }) {
  const { portal, totals, error, loading, reload } = useMemberPortal();
  return (
    <Page title="My Dashboard" actions={<><Button onClick={() => setPage("my-declaration")}>Submit Declaration</Button><Button variant="secondary" onClick={() => setPage("my-statement")}>View Statement</Button><Button variant="secondary" onClick={reload}>{loading ? "Loading..." : "Refresh"}</Button></>}>
      {error && <div className="error">{error}</div>}
      <div className="metrics">
        <Card title="My Savings" value={money(totals.accumulatedSavings)} note={`${money(totals.savingsPrincipal)} principal`} icon={PiggyBank} />
        <Card title="My Loan" value={money(totals.outstandingLoan)} note={`${money(totals.borrowingShortfall)} shortfall`} tone="blue" icon={Banknote} />
        <Card title="Common Interest Due" value={money(totals.commonInterestDue)} note="Assessed less paid" tone="amber" icon={Scale} />
        <Card title="Penalty Due" value={money(totals.penaltyDue)} note="Outstanding penalties" tone="red" icon={AlertTriangle} />
      </div>
      <Panel title="Cycle Position">
        <div className="detail-grid">
          <div><strong>Member</strong><span>{portal?.me?.member ? `${portal.me.member.first_name} ${portal.me.member.last_name}` : "-"}</span></div>
          <div><strong>Cycle</strong><span>{portal?.activeMembership?.cycle_name || "No active cycle"}</span></div>
          <div><strong>Savings Cap</strong><span>{money(portal?.activeMembership?.savings_cap)}</span></div>
          <div><strong>Minimum Borrowing</strong><span>{money(portal?.activeMembership?.minimum_borrowing_amount)}</span></div>
        </div>
      </Panel>
      <Panel title="Recent Transactions">
        <DataTable columns={["Date", "Type", "Amount", "Description"]} rows={(portal?.statement?.transactions || []).slice(0, 6).map((tx) => [
          dateOnly(tx.transaction_date),
          <Badge text={titleCase(tx.transaction_type)} />,
          money(tx.amount),
          tx.description || "-",
        ])} empty={loading ? "Loading transactions..." : "No transactions found."} />
      </Panel>
    </Page>
  );
}

function MemberStatementPage() {
  const { portal, totals, error, loading, reload } = useMemberPortal();
  function downloadStatement() {
    openPrintableReport({
      title: "Member Statement",
      subtitle: `${portal?.me?.member ? `${portal.me.member.first_name} ${portal.me.member.last_name}` : "Member"} · ${portal?.activeMembership?.cycle_name || "Cycle"}`,
      filename: "member-statement",
      metrics: [
        { label: "Accumulated Savings", value: money(totals.accumulatedSavings) },
        { label: "Outstanding Loan", value: money(totals.outstandingLoan) },
        { label: "Common Interest Due", value: money(totals.commonInterestDue) },
        { label: "Penalty Due", value: money(totals.penaltyDue) },
      ],
      columns: ["Date", "Type", "Amount", "Description", "Source"],
      rows: (portal?.statement?.transactions || []).map((tx) => [
        dateOnly(tx.transaction_date),
        titleCase(tx.transaction_type),
        money(tx.amount),
        tx.description || "-",
        tx.source_table || "-",
      ]),
    });
  }
  return (
    <Page title="My Statement" actions={<><Button onClick={reload}>{loading ? "Loading..." : "Refresh"}</Button><Button variant="secondary" onClick={downloadStatement}>Download Statement</Button></>}>
      {error && <div className="error">{error}</div>}
      <div className="metrics">
        <Card title="Accumulated Savings" value={money(totals.accumulatedSavings)} note="Principal + interest" icon={PiggyBank} />
        <Card title="Outstanding Loan" value={money(totals.outstandingLoan)} note="Loan balance estimate" tone="blue" icon={Banknote} />
        <Card title="Common Interest Due" value={money(totals.commonInterestDue)} note="Outstanding common interest" tone="amber" icon={Scale} />
        <Card title="Penalty Due" value={money(totals.penaltyDue)} note="Outstanding penalties" tone="red" icon={AlertTriangle} />
      </div>
      <Panel title="Statement Summary">
        <div className="detail-grid">
          <div><strong>Savings Principal</strong><span>{money(totals.savingsPrincipal)}</span></div>
          <div><strong>Savings Interest</strong><span>{money(totals.savingsInterest)}</span></div>
          <div><strong>Cumulative Borrowed</strong><span>{money(totals.borrowed)}</span></div>
          <div><strong>Borrowing Shortfall</strong><span>{money(totals.borrowingShortfall)}</span></div>
        </div>
      </Panel>
      <Panel title="All Transactions">
        <DataTable columns={["Date", "Type", "Amount", "Description", "Source"]} rows={(portal?.statement?.transactions || []).map((tx) => [
          dateOnly(tx.transaction_date),
          <Badge text={titleCase(tx.transaction_type)} />,
          money(tx.amount),
          tx.description || "-",
          tx.source_table || "-",
        ])} empty={loading ? "Loading statement..." : "No statement transactions found."} />
      </Panel>
    </Page>
  );
}

function MemberSavingsPage() {
  const { portal, totals, error, loading, reload } = useMemberPortal();
  const cap = Number(portal?.activeMembership?.savings_cap || 0);
  function downloadSavingsReport() {
    openPrintableReport({
      title: "Savings Report",
      subtitle: `${portal?.me?.member ? `${portal.me.member.first_name} ${portal.me.member.last_name}` : "Member"} · ${portal?.activeMembership?.cycle_name || "Cycle"}`,
      filename: "member-savings-report",
      metrics: [
        { label: "Principal Saved", value: money(totals.savingsPrincipal) },
        { label: "Savings Interest", value: money(totals.savingsInterest) },
        { label: "Accumulated Savings", value: money(totals.accumulatedSavings) },
        { label: "Cap Remaining", value: money(Math.max(0, cap - totals.savingsPrincipal)) },
      ],
      columns: ["Date", "Type", "Amount", "Description"],
      rows: (portal?.savings || []).map((tx) => [dateOnly(tx.transaction_date), titleCase(tx.transaction_type), money(tx.amount), tx.description || "-"]),
    });
  }
  return (
    <Page title="My Savings" actions={<><Button onClick={reload}>{loading ? "Loading..." : "Refresh"}</Button><Button variant="secondary" onClick={downloadSavingsReport}>Download Savings Report</Button></>}>
      {error && <div className="error">{error}</div>}
      <div className="metrics">
        <Card title="Principal Saved" value={money(totals.savingsPrincipal)} note={`${money(Math.max(0, cap - totals.savingsPrincipal))} cap remaining`} icon={PiggyBank} />
        <Card title="Savings Interest" value={money(totals.savingsInterest)} note="Posted during closing" tone="teal" icon={BadgeDollarSign} />
        <Card title="Accumulated Savings" value={money(totals.accumulatedSavings)} note="Running value" tone="blue" icon={Coins} />
        <Card title="Savings Cap" value={money(cap)} note="Principal cap only" tone="amber" icon={Lock} />
      </div>
      <Panel title="Savings Transactions">
        <DataTable columns={["Date", "Type", "Amount", "Description"]} rows={(portal?.savings || []).map((tx) => [
          dateOnly(tx.transaction_date),
          <Badge text={titleCase(tx.transaction_type)} />,
          money(tx.amount),
          tx.description || "-",
        ])} empty={loading ? "Loading savings..." : "No savings transactions found."} />
      </Panel>
    </Page>
  );
}

function MemberLoansPage() {
  const { portal, totals, error, loading, reload } = useMemberPortal();
  function downloadLoanReport() {
    openPrintableReport({
      title: "Loan Report",
      subtitle: `${portal?.me?.member ? `${portal.me.member.first_name} ${portal.me.member.last_name}` : "Member"} · ${portal?.activeMembership?.cycle_name || "Cycle"}`,
      filename: "member-loan-report",
      metrics: [
        { label: "Cumulative Borrowed", value: money(totals.borrowed) },
        { label: "Outstanding Loan", value: money(totals.outstandingLoan) },
        { label: "Minimum Borrowing", value: money(portal?.activeMembership?.minimum_borrowing_amount) },
        { label: "Borrowing Shortfall", value: money(totals.borrowingShortfall) },
      ],
      columns: ["Date", "Type", "Amount", "Description"],
      rows: (portal?.loans || []).map((tx) => [dateOnly(tx.transaction_date), titleCase(tx.transaction_type), money(tx.amount), tx.description || "-"]),
    });
  }
  return (
    <Page title="My Loans" actions={<><Button onClick={reload}>{loading ? "Loading..." : "Refresh"}</Button><Button variant="secondary" onClick={downloadLoanReport}>Download Loan Report</Button></>}>
      {error && <div className="error">{error}</div>}
      <div className="metrics">
        <Card title="Cumulative Borrowed" value={money(totals.borrowed)} note={`${money(totals.borrowingShortfall)} to minimum`} icon={Banknote} />
        <Card title="Outstanding Loan" value={money(totals.outstandingLoan)} note="Principal + interest less payments" tone="blue" icon={BadgeDollarSign} />
        <Card title="Minimum Borrowing" value={money(portal?.activeMembership?.minimum_borrowing_amount)} note="Cycle requirement" tone="amber" icon={Scale} />
        <Card title="Compliance" value={totals.borrowingShortfall <= 0 ? "Met" : "Below"} note="Borrowing status" tone={totals.borrowingShortfall <= 0 ? "green" : "red"} icon={CheckCircle2} />
      </div>
      <Panel title="Loan Transactions">
        <DataTable columns={["Date", "Type", "Amount", "Description"]} rows={(portal?.loans || []).map((tx) => [
          dateOnly(tx.transaction_date),
          <Badge text={titleCase(tx.transaction_type)} />,
          money(tx.amount),
          tx.description || "-",
        ])} empty={loading ? "Loading loans..." : "No loan transactions found."} />
      </Panel>
    </Page>
  );
}

function MemberPenaltiesPage() {
  const { portal, totals, error, loading, reload } = useMemberPortal();
  function downloadPenaltyReport() {
    openPrintableReport({
      title: "Penalty Report",
      subtitle: `${portal?.me?.member ? `${portal.me.member.first_name} ${portal.me.member.last_name}` : "Member"} · ${portal?.activeMembership?.cycle_name || "Cycle"}`,
      filename: "member-penalty-report",
      metrics: [
        { label: "Assessed", value: money((portal?.penalties || []).reduce((sum, penalty) => sum + Number(penalty.amount_assessed || 0), 0)) },
        { label: "Paid", value: money((portal?.penalties || []).reduce((sum, penalty) => sum + Number(penalty.amount_paid || 0), 0)) },
        { label: "Outstanding", value: money(totals.penaltyDue) },
        { label: "Converted", value: (portal?.penalties || []).filter((penalty) => penalty.status === "CONVERTED_TO_LOAN").length },
      ],
      columns: ["Month", "Type", "Assessed", "Paid", "Outstanding", "Status"],
      rows: (portal?.penalties || []).map((penalty) => [
        penalty.month_number ? `Month ${penalty.month_number}` : "-",
        penalty.penalty_name,
        money(penalty.amount_assessed),
        money(penalty.amount_paid),
        money(penalty.outstanding_amount),
        titleCase(penalty.status),
      ]),
    });
  }
  return (
    <Page title="My Penalties" actions={<><Button onClick={reload}>{loading ? "Loading..." : "Refresh"}</Button><Button variant="secondary" onClick={downloadPenaltyReport}>Download Penalty Report</Button></>}>
      {error && <div className="error">{error}</div>}
      <div className="metrics">
        <Card title="Assessed" value={money((portal?.penalties || []).reduce((sum, penalty) => sum + Number(penalty.amount_assessed || 0), 0))} note="Total penalties" icon={AlertTriangle} />
        <Card title="Paid" value={money((portal?.penalties || []).reduce((sum, penalty) => sum + Number(penalty.amount_paid || 0), 0))} note="Payments posted" tone="teal" icon={CheckCircle2} />
        <Card title="Outstanding" value={money(totals.penaltyDue)} note="Still due" tone="red" icon={BadgeDollarSign} />
        <Card title="Converted" value={(portal?.penalties || []).filter((penalty) => penalty.status === "CONVERTED_TO_LOAN").length} note="Moved to loan balance" tone="blue" icon={Banknote} />
      </div>
      <Panel title="Penalty Records">
        <DataTable columns={["Month", "Type", "Assessed", "Paid", "Outstanding", "Status"]} rows={(portal?.penalties || []).map((penalty) => [
          penalty.month_number ? `Month ${penalty.month_number}` : "-",
          penalty.penalty_name,
          money(penalty.amount_assessed),
          money(penalty.amount_paid),
          money(penalty.outstanding_amount),
          <Badge text={titleCase(penalty.status)} />,
        ])} empty={loading ? "Loading penalties..." : "No penalties found."} />
      </Panel>
    </Page>
  );
}

function MemberFormPage({ title }) {
  const [context, setContext] = useState(null);
  const [cycleDetail, setCycleDetail] = useState(null);
  const [form, setForm] = useState({
    savingsAmount: "",
    loanRequestAmount: "",
    loanTopUpAmount: "",
    principalRepaymentAmount: "",
    loanInterestRepaymentAmount: "",
    commonInterestPaymentAmount: "",
    notes: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/auth/me")
      .then(async (data) => {
        const activeMembership = data.cycleMemberships?.find((membership) => membership.cycle_status === "ACTIVE") || data.cycleMemberships?.[0];
        setContext({ ...data, activeMembership });
        if (activeMembership) {
          const cycle = await api(`/cycles/${activeMembership.cycle_id}`);
          setCycleDetail(cycle);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const activeMonth = cycleDetail?.months?.find((month) => month.status === "DECLARATION_PERIOD")
    || cycleDetail?.months?.find((month) => month.status === "OPEN")
    || cycleDetail?.months?.[0];

  function updateDeclaration(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function amount(field) {
    return Number(form[field] || 0);
  }

  function declarationPayload(saveAsDraft = false) {
    if (!context?.activeMembership || !activeMonth) throw new Error("No active cycle month is available for declaration.");
    return {
      cycleId: context.activeMembership.cycle_id,
      cycleMonthId: activeMonth.id,
      cycleMemberId: context.activeMembership.id,
      savingsAmount: amount("savingsAmount"),
      loanRequestAmount: amount("loanRequestAmount"),
      loanTopUpAmount: amount("loanTopUpAmount"),
      principalRepaymentAmount: amount("principalRepaymentAmount"),
      loanInterestRepaymentAmount: amount("loanInterestRepaymentAmount"),
      commonInterestPaymentAmount: amount("commonInterestPaymentAmount"),
      otherObligationAmount: 0,
      notes: form.notes || null,
      saveAsDraft,
    };
  }

  async function saveDeclaration(saveAsDraft = false) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api("/declarations", {
        method: "POST",
        body: declarationPayload(saveAsDraft),
      });
      setMessage(saveAsDraft ? "Declaration draft saved." : "Declaration submitted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitDeclaration(event) {
    event.preventDefault();
    await saveDeclaration(false);
  }

  function clearForm() {
    setForm({
      savingsAmount: "",
      loanRequestAmount: "",
      loanTopUpAmount: "",
      principalRepaymentAmount: "",
      loanInterestRepaymentAmount: "",
      commonInterestPaymentAmount: "",
      notes: "",
    });
    setMessage("");
    setError("");
  }

  return (
    <Page title={title} actions={<><Button form="member-declaration-form" disabled={saving}>{saving ? "Saving..." : "Submit"}</Button><Button variant="secondary" disabled={saving} onClick={() => saveDeclaration(true)}>Save Draft</Button><Button variant="secondary" onClick={clearForm}>Cancel</Button></>}>
      <Panel title="Declaration Window">
        <p>
          {context?.activeMembership ? `Cycle: ${context.activeMembership.cycle_name}` : "Loading member cycle..."}
          {activeMonth ? ` · Month ${activeMonth.month_number} · ${activeMonth.status.replaceAll("_", " ")}` : ""}
        </p>
      </Panel>
      <form id="member-declaration-form" onSubmit={submitDeclaration}>
        <div className="form-grid three">
          <Field label="Savings amount" type="number" value={form.savingsAmount} onChange={(v) => updateDeclaration("savingsAmount", v)} placeholder="K0" />
          <Field label="Loan request" type="number" value={form.loanRequestAmount} onChange={(v) => updateDeclaration("loanRequestAmount", v)} placeholder="K0" />
          <Field label="Loan top-up" type="number" value={form.loanTopUpAmount} onChange={(v) => updateDeclaration("loanTopUpAmount", v)} placeholder="K0" />
          <Field label="Principal repayment" type="number" value={form.principalRepaymentAmount} onChange={(v) => updateDeclaration("principalRepaymentAmount", v)} placeholder="K0" />
          <Field label="Loan interest repayment" type="number" value={form.loanInterestRepaymentAmount} onChange={(v) => updateDeclaration("loanInterestRepaymentAmount", v)} placeholder="K0" />
          <Field label="Common-interest payment" type="number" value={form.commonInterestPaymentAmount} onChange={(v) => updateDeclaration("commonInterestPaymentAmount", v)} placeholder="K0" />
          <Field label="Notes" value={form.notes} onChange={(v) => updateDeclaration("notes", v)} placeholder="Optional" />
        </div>
        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}
      </form>
    </Page>
  );
}

function App() {
  const [user, setUser] = useState(getUser());
  const [page, setPage] = useState(user?.role === "MEMBER" ? "member-dashboard" : "dashboard");
  const [authMode, setAuthMode] = useState(() => new URLSearchParams(window.location.search).has("resetToken") ? "forgot" : "login");
  const pageTitle = useMemo(() => routeLabel(page), [page]);
  const resetToken = useMemo(() => new URLSearchParams(window.location.search).get("resetToken") || "", []);

  function logout() {
    clearSession();
    setUser(null);
    setAuthMode("login");
  }

  const auth = authMode === "login" ? (
    <LoginPage
      onLogin={(u, landingPage) => {
        setUser(u);
        setPage(landingPage);
      }}
      onNavigateSignup={() => setAuthMode("signup")}
      onNavigateForgot={() => setAuthMode("forgot")}
    />
  ) : authMode === "signup" ? (
    <SignupPage
      onSignup={(u, landingPage) => {
        setUser(u);
        setPage(landingPage);
      }}
      onBackToLogin={() => setAuthMode("login")}
    />
  ) : (
    <PasswordRecoveryPage
      initialToken={resetToken}
      onBackToLogin={() => setAuthMode("login")}
    />
  );

  let screen;
  if (page === "dashboard") screen = <AdminDashboardPage setPage={setPage} />;
  else if (page === "cycles") screen = <CycleScreensPage />;
  else if (page === "members") screen = <MemberManagementPage />;
  else if (page === "declarations") screen = <DeclarationScreensPage />;
  else if (page === "savings") screen = <SavingsContributionPage />;
  else if (page === "loans") screen = <LoanScreensPage />;
  else if (page === "common-interest") screen = <CommonInterestPage />;
  else if (page === "penalties") screen = <PenaltyScreensPage />;
  else if (page === "closing") screen = <MonthlyClosingPage />;
  else if (page === "ledger") screen = <LedgerPage />;
  else if (page === "reports") screen = <ReportsPage />;
  else if (page === "audit") screen = <AuditTrailPage />;
  else if (page === "settings") screen = <AdminSettingsPage />;
  else if (page === "member-dashboard") screen = <MemberDashboard setPage={setPage} />;
  else if (page === "my-declaration") screen = <MemberFormPage title="My Declaration" />;
  else if (page === "my-statement") screen = <MemberStatementPage />;
  else if (page === "my-savings") screen = <MemberSavingsPage />;
  else if (page === "my-loans") screen = <MemberLoansPage />;
  else if (page === "my-penalties") screen = <MemberPenaltiesPage />;
  else if (page.startsWith("my-")) screen = <GenericAdminPage title={pageTitle} type={page} />;
  else screen = <GenericAdminPage title={pageTitle} type={page} />;

  return (
    <ProtectedRoute user={user} fallback={auth}>
      <AppLayout user={user} page={page} setPage={setPage} onLogout={logout}>{screen}</AppLayout>
    </ProtectedRoute>
  );
}

createRoot(document.getElementById("root")).render(<App />);
