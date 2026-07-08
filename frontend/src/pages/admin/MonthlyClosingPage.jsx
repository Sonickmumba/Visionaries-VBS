import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Lock,
  PiggyBank,
  RefreshCw,
  Scale,
} from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Select,
  Skeleton,
  Stepper,
  Tabs,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/monthly-closing.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

export const CLOSING_ALLOCATION_METHODS = [
  { value: "ONLY_NON_BORROWERS_EQUAL", label: "Only non-borrowers equal" },
  { value: "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL", label: "Shortfall proportional" },
  { value: "ALL_MEMBERS_EQUAL", label: "All members equal" },
];

export const CLOSING_STEPS = [
  "Validate Inputs",
  "Assess Declarations",
  "Post Penalties",
  "Calculate Interest",
  "Allocate Common Interest",
  "Create Snapshots",
  "Approve and Lock",
];

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

function statusLabel(value) {
  return String(value || "-").replaceAll("_", " ");
}

function statusTone(status) {
  if (["APPROVED", "LOCKED", "AT_OR_ABOVE_MINIMUM"].includes(status)) return "green";
  if (["MISSED", "NEVER_BORROWED"].includes(status)) return "red";
  if (["OPEN", "DECLARATION_PERIOD", "PAYOUT_PERIOD", "BORROWED_BELOW_MINIMUM"].includes(status)) return "amber";
  return "gray";
}

export function closingPreviewQuery({ cycleId, cycleMonthId }) {
  const params = new URLSearchParams();
  if (cycleId) params.set("cycleId", cycleId);
  if (cycleMonthId) params.set("cycleMonthId", cycleMonthId);
  const query = params.toString();
  return `/monthly-closing/preview${query ? `?${query}` : ""}`;
}

export function validateClosingRun({ preview, allocationMethod }) {
  const errors = {};
  if (!preview?.cycle?.id) errors.cycleId = "Choose a cycle.";
  if (!preview?.cycleMonth?.id) errors.cycleMonthId = "Choose a month.";
  if (!allocationMethod) errors.allocationMethod = "Choose a common-interest allocation method.";
  if (preview?.cycleMonth?.status === "LOCKED") errors.locked = "This month is already locked.";
  return errors;
}

export function closingRunPayload({ preview, allocationMethod, lockMonth }) {
  return {
    cycleId: preview.cycle.id,
    cycleMonthId: preview.cycleMonth.id,
    lock: Boolean(lockMonth),
    allocationMethod,
  };
}

export async function runMonthlyClosing({ preview, allocationMethod, lockMonth, closingApi = api }) {
  const errors = validateClosingRun({ preview, allocationMethod });
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }

  return closingApi("/monthly-closing/run", {
    method: "POST",
    body: closingRunPayload({ preview, allocationMethod, lockMonth }),
  });
}

export function closingExceptions(members = []) {
  return members.filter((member) => (
    member.declarationStatus === "MISSED"
    || member.borrowingStatus === "NEVER_BORROWED"
    || member.borrowingStatus === "BORROWED_BELOW_MINIMUM"
    || Number(member.penaltyAmount || 0) > 0
  ));
}

export function closingStepIndex(preview, result) {
  if (result?.run?.status === "APPROVED") return CLOSING_STEPS.length;
  if (!preview?.cycleMonth) return 0;
  return 1;
}

function DetailValue({ label, value }) {
  return (
    <div className="grid gap-1 rounded-app border border-mist bg-cream p-3">
      <strong className="text-xs font-black uppercase text-charcoal/70">{label}</strong>
      <span className="break-words text-sm font-extrabold text-charcoal">{value}</span>
    </div>
  );
}

function ClosingHero({ preview, totals, exceptions }) {
  return (
    <section className="closing-hero mb-4 grid gap-4 rounded-mobile bg-gradient-to-br from-forest via-emerald to-forest p-5 text-cream shadow-lift md:grid-cols-[minmax(0,1fr)_auto]" aria-label="Monthly closing overview">
      <div>
        <span className="text-xs font-black uppercase text-cream">Closing Preview</span>
        <h2 className="my-1 text-[25px] font-extrabold leading-tight text-cream">{preview?.cycle?.name || "Active Cycle"}</h2>
        <p className="m-0 text-sm font-extrabold text-cream/85">{preview?.cycleMonth ? `Month ${preview.cycleMonth.month_number} closing preview` : "Review declarations, interest, penalties, and carry-forward balances."}</p>
      </div>
      <div className="closing-hero-stat grid min-w-40 content-center gap-1 rounded-mobile border border-cream/20 bg-white/10 p-3 backdrop-blur">
        <span className="text-xs font-black uppercase text-cream">Exceptions</span>
        <strong className="break-words text-[24px] font-extrabold text-cream">{exceptions.length}</strong>
        <small className="text-xs font-extrabold text-cream/85">{totals.declared || 0} declared · {totals.missed || 0} missed</small>
      </div>
    </section>
  );
}

function OverviewStrip({ totals }) {
  return (
    <div className="closing-overview-strip mt-3.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
      <DetailValue label="Savings Deposits" value={money(totals.savingsDeposit)} />
      <DetailValue label="Savings Interest" value={money(totals.savingsInterest)} />
      <DetailValue label="Loan Interest" value={money(totals.loanInterest)} />
      <DetailValue label="Penalties" value={money(totals.penalties)} />
    </div>
  );
}

function MemberSnapshotCards({ members }) {
  if (!members.length) return null;
  return (
    <div className="closing-mobile-cards grid gap-3" aria-label="Mobile member closing snapshots">
      {members.map((member) => {
        const newLoan = Number(member.newLoanAmount || 0) + Number(member.topUpAmount || 0) + Number(member.convertedPenaltyLoanAmount || 0);
        const repayments = Number(member.principalRepaid || 0) + Number(member.interestRepaid || 0);
        return (
          <article key={member.cycle_member_id || member.member_code || memberName(member)} className="closing-card grid gap-3 rounded-mobile border border-mist bg-cream p-3 shadow-soft">
            <div className="closing-card-head grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
              <div className="closing-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(member)}</div>
              <div>
                <strong className="block break-words text-sm font-extrabold text-charcoal">{memberName(member)}</strong>
                <span className="block break-words text-xs font-extrabold text-charcoal/70">{member.member_code || "Member snapshot"}</span>
              </div>
              <Badge text={statusLabel(member.declarationStatus)} tone={statusTone(member.declarationStatus)} />
            </div>
            <div className="closing-card-values grid grid-cols-2 gap-2.5">
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Loan B/F</span><strong className="break-words text-base font-extrabold text-charcoal">{money(member.loanBroughtForward)}</strong></div>
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">New Loan</span><strong className="break-words text-base font-extrabold text-charcoal">{money(newLoan)}</strong></div>
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Loan Interest</span><strong className="break-words text-base font-extrabold text-charcoal">{money(member.loanInterest)}</strong></div>
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Repayments</span><strong className="break-words text-base font-extrabold text-charcoal">{money(repayments)}</strong></div>
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Loan C/F</span><strong className="break-words text-base font-extrabold text-charcoal">{money(member.loanCarriedForward)}</strong></div>
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Penalty</span><strong className="break-words text-base font-extrabold text-charcoal">{money(member.penaltyAmount)}</strong></div>
            </div>
            <Badge text={statusLabel(member.borrowingStatus)} tone={statusTone(member.borrowingStatus)} />
          </article>
        );
      })}
    </div>
  );
}

function ExceptionCards({ exceptions }) {
  if (!exceptions.length) return null;
  return (
    <div className="closing-mobile-cards grid gap-3" aria-label="Mobile monthly closing exceptions">
      {exceptions.map((member) => {
        const missed = member.declarationStatus === "MISSED";
        return (
          <article key={member.cycle_member_id || member.member_code || memberName(member)} className="closing-card grid gap-3 rounded-mobile border border-mist bg-cream p-3 shadow-soft">
            <div className="closing-card-head grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
              <div className="closing-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(member)}</div>
              <div>
                <strong className="block break-words text-sm font-extrabold text-charcoal">{memberName(member)}</strong>
                <span className="block break-words text-xs font-extrabold text-charcoal/70">{missed ? "Missed declaration" : statusLabel(member.borrowingStatus)}</span>
              </div>
              <Badge text={missed ? "Penalty" : "Compliance"} tone={missed ? "red" : "amber"} />
            </div>
            <div className="closing-card-values grid grid-cols-2 gap-2.5">
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Action</span><strong className="break-words text-base font-extrabold text-charcoal">{missed ? "Assess penalty" : "Carry status"}</strong></div>
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Amount</span><strong className="break-words text-base font-extrabold text-charcoal">{missed ? money(member.penaltyAmount) : money(member.borrowingShortfall)}</strong></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RunResult({ result }) {
  if (!result) return null;
  const summary = result.summary || {};
  const run = result.run || {};
  const commonInterestRun = result.commonInterest?.run || {};

  return (
    <section className="panel closing-result mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
      <div className="closing-result-hero mb-3.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div>
          <span className="text-xs font-black uppercase text-emerald">Approved Run</span>
          <h2 className="my-0.5 text-xl font-extrabold text-charcoal">Monthly Closing Posted</h2>
          <p className="m-0 text-sm font-extrabold text-charcoal/75">{(result.snapshots || []).length} member snapshots created.</p>
        </div>
        <Badge text={run.status || "APPROVED"} tone="green" />
      </div>
      <div className="detail-grid closing-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailValue label="Run Number" value={run.run_number || "-"} />
        <DetailValue label="Approved" value={dateOnly(run.approved_at || run.completed_at)} />
        <DetailValue label="Snapshots" value={(result.snapshots || []).length} />
        <DetailValue label="Common Interest Pool" value={money(commonInterestRun.common_interest_pool || summary.common_interest_pool)} />
      </div>
      <div className="closing-overview-strip">
        <DetailValue label="Savings Interest" value={money(summary.total_savings_interest)} />
        <DetailValue label="Loan Interest" value={money(summary.total_loan_interest_assessed)} />
        <DetailValue label="Common Interest" value={money(summary.total_common_interest_charged)} />
        <DetailValue label="Penalties" value={money(summary.total_penalties_assessed)} />
        <DetailValue label="Outstanding Loans" value={money(summary.total_outstanding_loans)} />
      </div>
      <div className="closing-desktop-table">
        <DataTable
          columns={["Savings Interest", "Loan Interest", "Common Interest", "Penalties", "Outstanding Loans"]}
          rows={[[
            money(summary.total_savings_interest),
            money(summary.total_loan_interest_assessed),
            money(summary.total_common_interest_charged),
            money(summary.total_penalties_assessed),
            money(summary.total_outstanding_loans),
          ]]}
        />
      </div>
    </section>
  );
}

export function MonthlyClosingPage({
  closingApi = api,
  initialCycles = undefined,
  initialCycleDetail = null,
  initialPreview = null,
  initialResult = null,
}) {
  const [cycles, setCycles] = useState(initialCycles || []);
  const [cycleDetail, setCycleDetail] = useState(initialCycleDetail || { months: [] });
  const [cycleId, setCycleId] = useState(initialCycles?.[0]?.id || initialPreview?.cycle?.id || "");
  const [cycleMonthId, setCycleMonthId] = useState(initialCycleDetail?.months?.[0]?.id || initialPreview?.cycleMonth?.id || "");
  const [allocationMethod, setAllocationMethod] = useState("NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL");
  const [lockMonth, setLockMonth] = useState(false);
  const [preview, setPreview] = useState(initialPreview);
  const [result, setResult] = useState(initialResult);
  const [activeTab, setActiveTab] = useState("overview");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialPreview === null);
  const [busy, setBusy] = useState("");

  async function loadCycles() {
    try {
      const response = await closingApi("/cycles");
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
    try {
      const response = await closingApi(`/cycles/${id}`);
      const months = response.months || [];
      setCycleDetail({ months });
      const selected = months.find((month) => ["DECLARATION_PERIOD", "OPEN", "PAYOUT_PERIOD"].includes(month.status)) || months[0];
      if (selected && !cycleMonthId) setCycleMonthId(selected.id);
    } catch (err) {
      setError(err.message || "Cycle months could not load.");
    }
  }

  async function loadPreview({ clearResult = true } = {}) {
    setLoading(true);
    setErrors({});
    setError("");
    try {
      const response = await closingApi(closingPreviewQuery({ cycleId, cycleMonthId }));
      setPreview(response.data);
      if (clearResult) setResult(null);
    } catch (err) {
      setError(err.message || "Monthly closing preview could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function runClosing() {
    setBusy("run");
    setMessage("");
    setError("");
    setErrors({});
    try {
      const response = await runMonthlyClosing({ preview, allocationMethod, lockMonth, closingApi });
      setResult(response.data);
      setMessage(`Monthly closing approved. ${lockMonth ? "The month was locked." : "The month remains open for authorized review."}`);
      setActiveTab("result");
      await loadPreview({ clearResult: false });
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Monthly closing could not be completed.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (initialCycles === undefined) loadCycles();
  }, []);

  useEffect(() => {
    if (cycleId && initialCycleDetail === null) loadCycleDetail(cycleId);
  }, [cycleId]);

  useEffect(() => {
    if (initialPreview === null) loadPreview();
  }, [cycleMonthId]);

  const totals = preview?.totals || {};
  const members = preview?.members || [];
  const exceptions = useMemo(() => closingExceptions(members), [members]);
  const stepIndex = closingStepIndex(preview, result);

  return (
    <Page
      title="Monthly Closing"
      className="monthly-closing-page grid gap-0"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={loadPreview} loading={loading}>Refresh Preview</Button>
          <Button type="button" variant="danger" icon={FileCheck2} onClick={runClosing} loading={busy === "run"} disabled={preview?.cycleMonth?.status === "LOCKED"}>
            Run Closing
          </Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Monthly closing complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Monthly closing failed">{error}</Alert> : null}
      {errors.locked ? <Alert tone="warning" title="Month locked">{errors.locked}</Alert> : null}

      <ClosingHero preview={preview} totals={totals} exceptions={exceptions} />

      <div className="admin-mobile-action-row closing-mobile-actions-row mobile-only flex gap-2" aria-label="Monthly closing quick actions">
        <Button type="button" icon={RefreshCw} onClick={loadPreview} loading={loading}>Refresh</Button>
        <Button type="button" variant="danger" icon={FileCheck2} onClick={runClosing} loading={busy === "run"} disabled={preview?.cycleMonth?.status === "LOCKED"}>
          Run
        </Button>
      </div>

      <section className="panel closing-context mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
        <div className="form-grid three grid gap-3 md:grid-cols-3">
          <Select
            label="Cycle"
            value={cycleId}
            onChange={(value) => { setCycleId(value); setCycleMonthId(""); }}
            placeholder="Choose cycle"
            error={errors.cycleId}
            options={cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.name} - ${cycle.status}` }))}
          />
          <Select
            label="Month"
            value={cycleMonthId}
            onChange={setCycleMonthId}
            placeholder="Choose month"
            error={errors.cycleMonthId}
            options={(cycleDetail.months || []).map((month) => ({ value: month.id, label: `Month ${month.month_number} - ${statusLabel(month.status)}` }))}
          />
          <Select
            label="Common-interest method"
            value={allocationMethod}
            onChange={setAllocationMethod}
            error={errors.allocationMethod}
            options={CLOSING_ALLOCATION_METHODS}
          />
        </div>
        <label className="closing-lock-toggle mt-3.5 inline-flex items-center gap-2.5 text-sm font-extrabold text-charcoal">
          <input type="checkbox" checked={lockMonth} onChange={(event) => setLockMonth(event.target.checked)} />
          <span><Lock size={15} aria-hidden="true" /> Lock month after approval</span>
        </label>
      </section>

      <section className="panel closing-steps-panel mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
        <div className="panel-head mb-3 flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-extrabold text-charcoal">Closing Workflow</h2>
          <Badge text={preview?.cycleMonth ? statusLabel(preview.cycleMonth.status) : "No month"} tone={statusTone(preview?.cycleMonth?.status)} />
        </div>
        <Stepper steps={CLOSING_STEPS} active={stepIndex} />
      </section>

      {loading ? <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={9} /></section> : !preview ? (
        <EmptyState title="No monthly closing preview" message="Choose a cycle month and refresh the preview before running closing." />
      ) : (
        <>
          <div className="metrics closing-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card title="Declared" value={totals.declared || 0} note="Members declared" icon={ClipboardList} />
            <Card title="Missed" value={totals.missed || 0} note="Penalty candidates" tone={Number(totals.missed || 0) ? "red" : "green"} icon={AlertTriangle} />
            <Card title="Savings Interest" value={money(totals.savingsInterest)} note="To post this month" tone="teal" icon={PiggyBank} />
            <Card title="Loan Interest" value={money(totals.loanInterest)} note="Loan interest assessment" tone="blue" icon={Banknote} />
            <Card title="Penalties" value={money(totals.penalties)} note="Failure-to-declare preview" tone="amber" icon={Scale} />
          </div>

          <Tabs
            active={activeTab}
            onChange={setActiveTab}
            label="Monthly closing tabs"
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "members", label: "Member Snapshots" },
              { id: "exceptions", label: "Exceptions" },
              { id: "result", label: "Run Result" },
            ]}
          />

          {activeTab === "overview" ? (
            <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-extrabold text-charcoal">Closing Context</h2>
                <Badge text={preview.cycle?.name || "Cycle"} tone="blue" />
              </div>
              <div className="detail-grid closing-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailValue label="Cycle" value={preview.cycle?.name || "-"} />
                <DetailValue label="Month" value={preview.cycleMonth ? `Month ${preview.cycleMonth.month_number}` : "-"} />
                <DetailValue label="Month Status" value={statusLabel(preview.cycleMonth?.status)} />
                <DetailValue label="Allocation Method" value={CLOSING_ALLOCATION_METHODS.find((item) => item.value === allocationMethod)?.label || "-"} />
              </div>
              <OverviewStrip totals={totals} />
              <div className="closing-desktop-table">
                <DataTable
                  columns={["Declared", "Missed", "Savings Deposits", "Savings Interest", "Loan Interest", "Penalties"]}
                  rows={[[
                    totals.declared || 0,
                    totals.missed || 0,
                    money(totals.savingsDeposit),
                    money(totals.savingsInterest),
                    money(totals.loanInterest),
                    money(totals.penalties),
                  ]]}
                />
              </div>
            </section>
          ) : null}

          {activeTab === "members" ? (
            <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-extrabold text-charcoal">Member Snapshots</h2>
                <Badge text={`${members.length} members`} tone="blue" />
              </div>
              <MemberSnapshotCards members={members} />
              <div className="closing-desktop-table">
                <DataTable
                  columns={["Member", "Declaration", "Loan B/F", "New Loan", "Loan Interest", "Repayments", "Loan C/F", "Borrowing Status", "Penalty"]}
                  rows={members.map((member) => [
                    memberName(member),
                    <Badge text={statusLabel(member.declarationStatus)} tone={statusTone(member.declarationStatus)} />,
                    money(member.loanBroughtForward),
                    money(Number(member.newLoanAmount || 0) + Number(member.topUpAmount || 0) + Number(member.convertedPenaltyLoanAmount || 0)),
                    money(member.loanInterest),
                    money(Number(member.principalRepaid || 0) + Number(member.interestRepaid || 0)),
                    money(member.loanCarriedForward),
                    <Badge text={statusLabel(member.borrowingStatus)} tone={statusTone(member.borrowingStatus)} />,
                    money(member.penaltyAmount),
                  ])}
                  empty="No active members found for this cycle month."
                />
              </div>
            </section>
          ) : null}

          {activeTab === "exceptions" ? (
            <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
              <div className="panel-head mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-extrabold text-charcoal">Exceptions</h2>
                <Badge text={`${exceptions.length} items`} tone={exceptions.length ? "amber" : "green"} />
              </div>
              <ExceptionCards exceptions={exceptions} />
              <div className="closing-desktop-table">
                <DataTable
                  columns={["Member", "Issue", "Expected Closing Action", "Amount"]}
                  rows={exceptions.map((member) => {
                    const missed = member.declarationStatus === "MISSED";
                    return [
                      memberName(member),
                      missed ? "Missed declaration" : statusLabel(member.borrowingStatus),
                      missed ? "Assess failure-to-declare penalty" : "Carry borrowing compliance status forward",
                      missed ? money(member.penaltyAmount) : money(member.borrowingShortfall),
                    ];
                  })}
                  empty="No declaration or borrowing exceptions found."
                />
              </div>
            </section>
          ) : null}

          {activeTab === "result" ? (
            result ? <RunResult result={result} /> : (
              <EmptyState title="No approved run yet" message="Run monthly closing after reviewing the preview, exceptions, and member snapshots." />
            )
          ) : null}
        </>
      )}
    </Page>
  );
}
