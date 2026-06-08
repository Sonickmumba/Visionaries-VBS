import React, { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Banknote, Calculator, Coins, RefreshCw, Scale } from "lucide-react";
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
  Tabs,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/common-interest.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const percent = (value) => `${(Number(value || 0) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

export const ALLOCATION_METHODS = [
  { value: "ONLY_NON_BORROWERS_EQUAL", label: "Only non-borrowers equal" },
  { value: "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL", label: "Shortfall proportional" },
  { value: "ALL_MEMBERS_EQUAL", label: "All members equal" },
];

function memberName(item) {
  return `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "Member";
}

function statusTone(status) {
  if (status === "AT_OR_ABOVE_MINIMUM") return "green";
  if (status === "BORROWED_BELOW_MINIMUM") return "amber";
  if (status === "NEVER_BORROWED") return "red";
  return "gray";
}

export function previewQuery({ cycleId, cycleMonthId, allocationMethod }) {
  const params = new URLSearchParams();
  if (cycleId) params.set("cycleId", cycleId);
  if (cycleMonthId) params.set("cycleMonthId", cycleMonthId);
  if (allocationMethod) params.set("allocationMethod", allocationMethod);
  return `/common-interest/preview?${params.toString()}`;
}

export function validateCommonInterestPost({ preview, allocationMethod }) {
  const errors = {};
  if (!preview?.cycle?.id) errors.cycleId = "Choose a cycle.";
  if (!preview?.cycleMonth?.id) errors.cycleMonthId = "Choose a month.";
  if (!allocationMethod) errors.allocationMethod = "Choose an allocation method.";
  if (preview?.existingRun) errors.existingRun = "An allocation has already been posted for this month.";
  return errors;
}

export function commonInterestPostPayload({ preview, allocationMethod }) {
  return {
    cycleId: preview.cycle.id,
    cycleMonthId: preview.cycleMonth.id,
    allocationMethod,
  };
}

export async function postCommonInterestAllocation({ preview, allocationMethod, commonInterestApi = api }) {
  const errors = validateCommonInterestPost({ preview, allocationMethod });
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return commonInterestApi("/common-interest/calculate", {
    method: "POST",
    body: commonInterestPostPayload({ preview, allocationMethod }),
  });
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

function AllocationDetail({ allocation, onClose }) {
  if (!allocation) return null;
  return (
    <section className="panel common-interest-detail">
      <div className="panel-head">
        <h2>Allocation Detail: {memberName(allocation)}</h2>
        <Badge text={allocation.status || allocation.compliance_status} tone={statusTone(allocation.status || allocation.compliance_status)} />
      </div>
      <div className="detail-grid common-interest-detail-grid">
        <DetailValue label="Borrowed" value={money(allocation.cumulativeBorrowed ?? allocation.cumulative_borrowed_amount)} />
        <DetailValue label="Shortfall" value={money(allocation.shortfall ?? allocation.borrowing_shortfall)} />
        <DetailValue label="Weight" value={Number((allocation.weight ?? allocation.allocation_weight) || 0).toFixed(4)} />
        <DetailValue label="Assigned Base" value={money(allocation.assignedBase ?? allocation.assigned_base)} />
        <DetailValue label="Calculated Charge" value={money(allocation.charge ?? allocation.calculated_charge)} />
        <DetailValue label="Final Charge" value={money(allocation.final_charge ?? allocation.charge)} />
      </div>
      <div className="button-row">
        <Button type="button" variant="secondary" onClick={onClose}>Close Detail</Button>
      </div>
    </section>
  );
}

function RunDetail({ run }) {
  if (!run?.data) return null;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Posted Run</h2>
        <Badge text={run.data.allocation_method?.replaceAll("_", " ")} tone="green" />
      </div>
      <div className="detail-grid common-interest-detail-grid">
        <DetailValue label="Posted" value={dateOnly(run.data.created_at)} />
        <DetailValue label="Pool Contributions" value={money(run.data.total_pool_contributions)} />
        <DetailValue label="Loans Issued" value={money(run.data.total_loans_issued)} />
        <DetailValue label="Unborrowed Money" value={money(run.data.unborrowed_money)} />
        <DetailValue label="Common Interest Pool" value={money(run.data.common_interest_pool)} />
      </div>
      <DataTable
        columns={["Member", "Status", "Borrowed", "Shortfall", "Assigned Base", "Charge"]}
        rows={(run.allocations || []).map((item) => [
          memberName(item),
          <Badge text={item.compliance_status} tone={statusTone(item.compliance_status)} />,
          money(item.cumulative_borrowed_amount),
          money(item.borrowing_shortfall),
          money(item.assigned_base),
          money(item.final_charge),
        ])}
        empty="No posted allocations found for this run."
      />
    </section>
  );
}

export function CommonInterestPage({
  commonInterestApi = api,
  initialCycles = undefined,
  initialCycleDetail = null,
  initialPreview = null,
  initialRun = null,
}) {
  const [cycles, setCycles] = useState(initialCycles || []);
  const [cycleDetail, setCycleDetail] = useState(initialCycleDetail || { months: [] });
  const [cycleId, setCycleId] = useState(initialCycles?.[0]?.id || initialPreview?.cycle?.id || "");
  const [cycleMonthId, setCycleMonthId] = useState(initialCycleDetail?.months?.[0]?.id || initialPreview?.cycleMonth?.id || "");
  const [allocationMethod, setAllocationMethod] = useState("NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL");
  const [preview, setPreview] = useState(initialPreview);
  const [run, setRun] = useState(initialRun);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [activeTab, setActiveTab] = useState("preview");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialPreview === null);
  const [busy, setBusy] = useState("");

  async function loadCycles() {
    try {
      const response = await commonInterestApi("/cycles");
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
      const response = await commonInterestApi(`/cycles/${id}`);
      setCycleDetail({ months: response.months || [] });
      const month = (response.months || []).find((item) => item.status === "DECLARATION_PERIOD")
        || (response.months || []).find((item) => item.status === "OPEN")
        || response.months?.[0];
      if (month && !cycleMonthId) setCycleMonthId(month.id);
    } catch (err) {
      setError(err.message || "Cycle months could not load.");
    }
  }

  async function loadPreview(nextMethod = allocationMethod) {
    setLoading(true);
    setErrors({});
    setError("");
    try {
      const response = await commonInterestApi(previewQuery({ cycleId, cycleMonthId, allocationMethod: nextMethod }));
      setPreview(response.data);
      setSelectedAllocation(null);
      if (response.data?.cycleMonth?.id) await loadRun(response.data.cycleMonth.id);
    } catch (err) {
      setError(err.message || "Common-interest preview could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRun(monthId = cycleMonthId) {
    if (!monthId) return;
    try {
      const response = await commonInterestApi(`/common-interest/runs/${monthId}`);
      setRun(response);
    } catch {
      setRun(null);
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

  function changeMethod(value) {
    setAllocationMethod(value);
    loadPreview(value);
  }

  async function postAllocation() {
    setBusy("post");
    setErrors({});
    setMessage("");
    setError("");
    try {
      const response = await postCommonInterestAllocation({ preview, allocationMethod, commonInterestApi });
      setMessage("Common-interest allocation posted to ledger.");
      setRun({ data: response.data?.run || null, allocations: response.data?.allocations || [] });
      await loadPreview();
      setActiveTab("run");
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Common-interest allocation could not be posted.");
    } finally {
      setBusy("");
    }
  }

  const totals = useMemo(() => ({
    pool: preview?.totalPoolContributions || 0,
    loans: preview?.totalLoansIssued || 0,
    unborrowed: preview?.unborrowedMoney || 0,
    poolCharge: preview?.commonInterestPool || 0,
  }), [preview]);

  return (
    <Page
      title="Common Interest"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={() => loadPreview()} loading={loading}>Calculate Preview</Button>
          <Button type="button" variant="danger" icon={Calculator} onClick={postAllocation} loading={busy === "post"} disabled={Boolean(preview?.existingRun)}>Post Allocation</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Common-interest action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Common-interest action failed">{error}</Alert> : null}
      {errors.existingRun ? <Alert tone="warning" title="Already posted">{errors.existingRun}</Alert> : null}

      <section className="panel common-interest-filters">
        <div className="form-grid three">
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
            options={(cycleDetail.months || []).map((month) => ({ value: month.id, label: `Month ${month.month_number} - ${String(month.status || "OPEN").replaceAll("_", " ")}` }))}
          />
          <Select
            label="Allocation Method"
            value={allocationMethod}
            onChange={changeMethod}
            error={errors.allocationMethod}
            options={ALLOCATION_METHODS}
          />
        </div>
      </section>

      <div className="metrics common-interest-metrics">
        <Card title="Pool Contributions" value={money(totals.pool)} note="Savings + fees + inflows" icon={Coins} />
        <Card title="Loans Issued" value={money(totals.loans)} note="Current month payouts" tone="blue" icon={Banknote} />
        <Card title="Unborrowed Money" value={money(totals.unborrowed)} note="Contribution less loans" tone="amber" icon={Scale} />
        <Card title="CI Pool" value={money(totals.poolCharge)} note={`${percent(preview?.commonInterestRate)} charge`} tone="teal" icon={BadgeDollarSign} />
      </div>

      {preview?.existingRun ? (
        <Alert tone="warning" title="Posted allocation exists">
          This month already has common-interest assessments. Recalculation requires reversal or an authorized override workflow.
        </Alert>
      ) : null}

      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !preview ? (
        <EmptyState title="No common-interest preview" message="Choose an active cycle month and calculate a preview." />
      ) : (
        <>
          <Tabs
            active={activeTab}
            onChange={setActiveTab}
            label="Common-interest tabs"
            tabs={[
              { id: "preview", label: "Allocation Preview" },
              { id: "compliance", label: "Borrowing Compliance" },
              { id: "run", label: "Posted Run" },
            ]}
          />

          <AllocationDetail allocation={selectedAllocation} onClose={() => setSelectedAllocation(null)} />

          {activeTab === "preview" ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Allocation Preview</h2>
                <Badge text={ALLOCATION_METHODS.find((item) => item.value === allocationMethod)?.label} tone="blue" />
              </div>
              <DataTable
                columns={["Member", "Borrowed", "Status", "Shortfall", "Weight", "Assigned Base", "Charge", "Action"]}
                rows={(preview.allocations || []).map((allocation) => [
                  memberName(allocation),
                  money(allocation.cumulativeBorrowed),
                  <Badge text={allocation.status} tone={statusTone(allocation.status)} />,
                  money(allocation.shortfall),
                  Number(allocation.weight || 0).toFixed(4),
                  money(allocation.assignedBase),
                  money(allocation.charge),
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedAllocation(allocation)}>View Details</Button>,
                ])}
                empty="No eligible allocations for the selected method."
              />
            </section>
          ) : null}

          {activeTab === "compliance" ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Borrowing Compliance</h2>
              </div>
              <DataTable
                columns={["Member", "Code", "Borrowed", "Status", "Shortfall"]}
                rows={(preview.members || []).map((member) => [
                  memberName(member),
                  member.member_code || "-",
                  money(member.cumulativeBorrowed),
                  <Badge text={member.status} tone={statusTone(member.status)} />,
                  money(member.shortfall),
                ])}
                empty="No active members found for this cycle."
              />
            </section>
          ) : null}

          {activeTab === "run" ? (
            run?.data ? <RunDetail run={run} /> : (
              <EmptyState title="No posted run" message="Post the reviewed allocation to create common-interest assessment ledger transactions." />
            )
          ) : null}
        </>
      )}
    </Page>
  );
}
