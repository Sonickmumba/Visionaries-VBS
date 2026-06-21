import React, { useEffect, useMemo, useState } from "react";
import { Banknote, Download, FileBarChart, PiggyBank, Printer, RefreshCw, Scale } from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Modal,
  Select,
  Skeleton,
  Tabs,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/reports.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

function titleCase(value) {
  return String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function memberName(row) {
  return `${row?.first_name || ""} ${row?.last_name || ""}`.trim() || "Group";
}

function initials(row) {
  return memberName(row)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "R";
}

export const REPORT_DEFINITIONS = {
  "cycle-summary": {
    label: "Cycle Summary",
    mode: "center",
    columns: ["Month", "Status", "Savings", "Loans", "Common Interest", "Penalties"],
  },
  "member-statements": {
    label: "Member Statements",
    mode: "center",
    columns: ["Member", "Savings", "Savings Interest", "Borrowed", "Loan Interest", "Common Interest", "Penalties", "Action"],
    supportsMember: true,
  },
  "monthly-pool": {
    label: "Monthly Pool",
    mode: "center",
    columns: ["Month", "Status", "Contributions", "Loans Issued", "Unborrowed", "CI Pool", "Penalties"],
  },
  savings: {
    label: "Savings",
    mode: "center",
    columns: ["Member", "Principal", "Interest", "Cap Remaining", "Action"],
  },
  loans: {
    label: "Loans",
    mode: "center",
    columns: ["Member", "Borrowed", "Principal Repaid", "Interest", "Interest Repaid", "Shortfall", "Action"],
  },
  "common-interest": {
    label: "Common Interest",
    mode: "center",
    columns: ["Month", "Member", "Compliance", "Borrowed", "Shortfall", "Assigned Base", "Charge"],
    supportsMonth: true,
  },
  declarations: {
    label: "Declarations",
    mode: "center",
    columns: ["Member", "Status", "Within Window", "Submitted", "Savings", "Loan Request", "Repayments"],
    supportsMonth: true,
  },
  penalties: {
    label: "Penalties",
    mode: "center",
    columns: ["Month", "Member", "Type", "Assessed", "Paid", "Outstanding", "Status"],
    supportsMonth: true,
  },
  "converted-penalties": {
    label: "Converted Penalties",
    mode: "endpoint",
    endpoint: "/reports/converted-penalties",
    columns: ["Month", "Member", "Type", "Assessed", "Loan Amount", "Ledger", "Status"],
    supportsMonth: true,
  },
  "cycle-closing": {
    label: "Cycle Closing",
    mode: "endpoint",
    endpoint: "/reports/cycle-closing",
    columns: ["Month", "Month Status", "Closing", "Savings", "Savings Interest", "Loans", "Common Interest", "Penalties"],
    supportsMonth: true,
  },
};

export function reportsQuery({ report, cycleId = "", cycleMonthId = "", cycleMemberId = "", format = "" }) {
  const definition = REPORT_DEFINITIONS[report] || REPORT_DEFINITIONS["cycle-summary"];
  const params = new URLSearchParams();
  if (definition.mode === "center") params.set("report", report);
  if (cycleId) params.set("cycleId", cycleId);
  if (cycleMonthId && definition.supportsMonth) params.set("cycleMonthId", cycleMonthId);
  if (cycleMemberId && definition.supportsMember) params.set("cycleMemberId", cycleMemberId);
  if (format) params.set("format", format);
  const path = definition.mode === "center" ? "/reports/center" : definition.endpoint;
  return `${path}?${params.toString()}`;
}

export function reportTotals({ rows = [], totals = {} }) {
  const sum = (keys) => rows.reduce((total, row) => total + keys.reduce((inner, key) => inner + Number(row[key] || 0), 0), 0);
  return {
    savings: Number(totals.savings_principal || totals.principalDeposited || totals.savings || 0) || sum(["principal_deposited", "savings_principal", "total_savings_deposits"]),
    loans: Number(totals.loans_issued || totals.cumulativeBorrowed || totals.loansIssued || 0) || sum(["cumulative_borrowed", "total_loans_issued"]),
    charges: Number(totals.common_interest || 0) + Number(totals.penalties || 0)
      || Number(totals.commonInterest || 0) + Number(totals.assessed || 0)
      || sum(["common_interest_pool", "calculated_charge", "final_charge", "amount_assessed", "total_common_interest_charged", "total_penalties_assessed"]),
  };
}

export function formatReportValue(key, value) {
  if (value === null || value === undefined || value === "") return "-";
  if (/amount|total|interest|saving|loan|penalt|charge|borrow|paid|base|shortfall|principal|contribution|unborrowed/i.test(key)) return money(value);
  if (/date|_at/i.test(key)) return dateOnly(value);
  return titleCase(value);
}

export function buildReportRows(rows, report, onSelect) {
  if (report === "member-statements") {
    return rows.map((row) => [
      <><strong>{memberName(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      money(row.savings_principal),
      money(row.savings_interest),
      money(row.borrowed),
      money(row.loan_interest_assessed),
      money(row.common_interest),
      money(Number(row.penalties || 0) - Number(row.penalties_paid || 0)),
      <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(row)}>View Details</Button>,
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
      <><strong>{memberName(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      money(row.principal_deposited),
      money(row.interest_earned),
      money(row.cap_remaining),
      <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(row)}>View Details</Button>,
    ]);
  }
  if (report === "loans") {
    return rows.map((row) => [
      <><strong>{memberName(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      money(row.cumulative_borrowed),
      money(row.principal_repaid),
      money(row.interest_assessed),
      money(row.interest_repaid),
      money(row.borrowing_shortfall),
      <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(row)}>View Details</Button>,
    ]);
  }
  if (report === "common-interest") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      <><strong>{memberName(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      <Badge text={titleCase(row.compliance_status)} />,
      money(row.cumulative_borrowed_amount),
      money(row.borrowing_shortfall),
      money(row.assigned_base),
      money(row.final_charge),
    ]);
  }
  if (report === "declarations") {
    return rows.map((row) => [
      <><strong>{memberName(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
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
      <><strong>{memberName(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      row.penalty_type,
      money(row.amount_assessed),
      money(row.amount_paid),
      money(row.outstanding_amount),
      <Badge text={titleCase(row.status)} />,
    ]);
  }
  if (report === "converted-penalties") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      <><strong>{memberName(row)}</strong><br /><span className="muted">{row.member_code}</span></>,
      row.penalty_type,
      money(row.amount_assessed),
      money(row.converted_loan_amount),
      row.converted_loan_ledger_transaction_id ? String(row.converted_loan_ledger_transaction_id).slice(0, 8) : "-",
      <Badge text={titleCase(row.status)} />,
    ]);
  }
  if (report === "cycle-closing") {
    return rows.map((row) => [
      `Month ${row.month_number}`,
      <Badge text={titleCase(row.month_status)} />,
      <Badge text={titleCase(row.closing_status || "Not run")} />,
      money(row.total_savings_deposits),
      money(row.total_savings_interest),
      money(row.total_loans_issued),
      money(row.total_common_interest_charged),
      money(row.total_penalties_assessed),
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

export function rawReportRows(rows, report) {
  return buildReportRows(rows, report, () => {}).map((row) => row.filter((_, index) => REPORT_DEFINITIONS[report].columns[index] !== "Action").map((cell) => {
    if (typeof cell === "string" || typeof cell === "number") return cell;
    if (React.isValidElement(cell)) return "";
    return String(cell ?? "");
  }));
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function openPrintableReport({ title, subtitle, metrics, columns, rows }) {
  const printable = window.open("", "_blank", "width=1100,height=800");
  if (!printable) return;
  printable.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body{font-family:Inter,Arial,sans-serif;margin:32px;color:#172033}
          h1{margin:0 0 4px} p{margin:0 0 22px;color:#52637a}
          .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
          .metric{border:1px solid #d8e1eb;border-radius:8px;padding:10px}
          .metric span{display:block;color:#52637a;font-size:12px}.metric strong{font-size:18px}
          table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #d8e1eb;padding:8px;text-align:left} th{background:#eef4f8}
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <section class="metrics">${metrics.map((metric) => `<div class="metric"><span>${metric.label}</span><strong>${metric.value}</strong></div>`).join("")}</section>
        <table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <script>window.print()</script>
      </body>
    </html>
  `);
  printable.document.close();
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
}

function ReportsHero({ definition, data, totals, rows }) {
  return (
    <section className="reports-hero">
      <div>
        <span>Reports Center</span>
        <h2>{definition.label}</h2>
        <p>{data?.cycle?.name || "Visionaries Village Banking"}{data?.cycleMonth ? ` · Month ${data.cycleMonth.month_number}` : " · cycle-wide view"}</p>
      </div>
      <div className="reports-hero-stat">
        <span>Rows</span>
        <strong>{rows.length}</strong>
        <small>{money(totals.savings)} savings</small>
      </div>
    </section>
  );
}

function ReportCards({ rows, report, definition, onSelect }) {
  if (!rows.length) return null;
  const columns = definition.columns.filter((column) => column !== "Action");
  return (
    <div className="reports-mobile-cards" aria-label="Mobile report rows">
      {rows.map((row, index) => {
        const title = row.first_name || row.last_name ? memberName(row) : row.month_number ? `Month ${row.month_number}` : definition.label;
        const subtitle = row.member_code || row.status || row.month_status || row.penalty_type || row.compliance_status || dataLabel(row);
        const values = columns.slice(1, 5).map((column) => {
          const key = columnKeyForReport(column, report);
          return { column, value: formatReportValue(key, row[key]) };
        });
        return (
          <article key={row.id || row.cycle_member_id || row.cycle_month_id || `${report}-${index}`} className="reports-card">
            <div className="reports-card-head">
              <div className="reports-avatar">{initials(row)}</div>
              <div>
                <strong>{title}</strong>
                <span>{titleCase(subtitle)}</span>
              </div>
              <Badge text={definition.label} tone="blue" />
            </div>
            <div className="reports-card-values">
              {values.map(({ column, value }) => (
                <div key={column}><span>{column}</span><strong>{value}</strong></div>
              ))}
            </div>
            {definition.columns.includes("Action") ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(row)}>View Details</Button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function ReportDetail({ selectedRow, definition, onClose }) {
  if (!selectedRow) return null;
  return (
    <section className="reports-detail">
      <div className="reports-detail-hero">
        <div className="reports-avatar">{initials(selectedRow)}</div>
        <div>
          <span>Report Detail</span>
          <h2>{memberName(selectedRow)}</h2>
          <p>{definition.label}</p>
        </div>
        <Badge text={definition.label} tone="blue" />
      </div>
      <div className="detail-grid reports-detail-grid">
        {Object.entries(selectedRow)
          .filter(([key]) => !["id", "cycle_id", "cycle_month_id", "cycle_member_id", "member_id"].includes(key))
          .slice(0, 16)
          .map(([key, value]) => <DetailValue key={key} label={titleCase(key)} value={formatReportValue(key, value)} />)}
      </div>
      <div className="button-row">
        <Button type="button" variant="secondary" onClick={onClose}>Close Detail</Button>
      </div>
    </section>
  );
}

function dataLabel(row) {
  return row.closing_status || row.transaction_type || row.penalty_type || "Report row";
}

function columnKeyForReport(column, report) {
  const keyMap = {
    "cycle-summary": {
      Month: "month_number",
      Status: "status",
      Savings: "total_savings_deposits",
      Loans: "total_loans_issued",
      "Common Interest": "common_interest_pool",
      Penalties: "total_penalties_assessed",
    },
    "member-statements": {
      Member: "member_code",
      Savings: "savings_principal",
      "Savings Interest": "savings_interest",
      Borrowed: "borrowed",
      "Loan Interest": "loan_interest_assessed",
      "Common Interest": "common_interest",
      Penalties: "penalties",
    },
    "monthly-pool": {
      Month: "month_number",
      Status: "status",
      Contributions: "total_pool_contributions",
      "Loans Issued": "total_loans_issued",
      Unborrowed: "unborrowed_money",
      "CI Pool": "common_interest_pool",
      Penalties: "total_penalties_assessed",
    },
    savings: {
      Member: "member_code",
      Principal: "principal_deposited",
      Interest: "interest_earned",
      "Cap Remaining": "cap_remaining",
    },
    loans: {
      Member: "member_code",
      Borrowed: "cumulative_borrowed",
      "Principal Repaid": "principal_repaid",
      Interest: "interest_assessed",
      "Interest Repaid": "interest_repaid",
      Shortfall: "borrowing_shortfall",
    },
    "common-interest": {
      Month: "month_number",
      Member: "member_code",
      Compliance: "compliance_status",
      Borrowed: "cumulative_borrowed_amount",
      Shortfall: "borrowing_shortfall",
      "Assigned Base": "assigned_base",
      Charge: "final_charge",
    },
    declarations: {
      Member: "member_code",
      Status: "status",
      "Within Window": "is_within_window",
      Submitted: "submitted_at",
      Savings: "savings_amount",
      "Loan Request": "loan_request_amount",
      Repayments: "principal_repayment_amount",
    },
    penalties: {
      Month: "month_number",
      Member: "member_code",
      Type: "penalty_type",
      Assessed: "amount_assessed",
      Paid: "amount_paid",
      Outstanding: "outstanding_amount",
      Status: "status",
    },
    "converted-penalties": {
      Month: "month_number",
      Member: "member_code",
      Type: "penalty_type",
      Assessed: "amount_assessed",
      "Loan Amount": "converted_loan_amount",
      Ledger: "converted_loan_ledger_transaction_id",
      Status: "status",
    },
    "cycle-closing": {
      Month: "month_number",
      "Month Status": "month_status",
      Closing: "closing_status",
      Savings: "total_savings_deposits",
      "Savings Interest": "total_savings_interest",
      Loans: "total_loans_issued",
      "Common Interest": "total_common_interest_charged",
      Penalties: "total_penalties_assessed",
    },
  };
  return keyMap[report]?.[column] || column.toLowerCase().replaceAll(" ", "_");
}

export function ReportsPage({
  reportsApi = api,
  initialData = null,
  initialCycles = undefined,
  initialCycleDetail = null,
}) {
  const [report, setReport] = useState(initialData?.report || "cycle-summary");
  const [cycles, setCycles] = useState(initialCycles || []);
  const [cycleDetail, setCycleDetail] = useState(initialCycleDetail || { months: [] });
  const [cycleId, setCycleId] = useState(initialData?.cycle?.id || initialCycles?.[0]?.id || "");
  const [cycleMonthId, setCycleMonthId] = useState(initialData?.cycleMonth?.id || "");
  const [selectedMember, setSelectedMember] = useState("");
  const [data, setData] = useState(initialData);
  const [selectedRow, setSelectedRow] = useState(null);
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState("");

  async function loadCycles() {
    try {
      const response = await reportsApi("/cycles");
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
      const response = await reportsApi(`/cycles/${id}`);
      setCycleDetail({ months: response.months || [] });
    } catch (err) {
      setError(err.message || "Cycle months could not load.");
    }
  }

  async function loadReport(nextReport = report) {
    setLoading(true);
    setError("");
    try {
      const response = await reportsApi(reportsQuery({
        report: nextReport,
        cycleId,
        cycleMonthId,
        cycleMemberId: selectedMember,
      }));
      const payload = response.data || {};
      setData(payload);
      if (payload.cycle?.id && !cycleId) setCycleId(payload.cycle.id);
      setSelectedRow(null);
    } catch (err) {
      setError(err.message || "Report could not run.");
    } finally {
      setLoading(false);
    }
  }

  function changeReport(value) {
    setReport(value);
    if (!REPORT_DEFINITIONS[value].supportsMember) setSelectedMember("");
    setSelectedRow(null);
    loadReport(value).catch(() => {});
  }

  function exportCsv() {
    const definition = REPORT_DEFINITIONS[report];
    const headers = definition.columns.filter((column) => column !== "Action");
    downloadCsv(`village-bank-${report}.csv`, headers, rawReportRows(data?.rows || [], report));
  }

  function downloadPdf() {
    const definition = REPORT_DEFINITIONS[report];
    const rows = data?.rows || [];
    const totals = reportTotals({ rows, totals: data?.totals || {} });
    openPrintableReport({
      title: definition.label,
      subtitle: `${data?.cycle?.name || "Visionaries Village Banking"}${data?.cycleMonth ? ` - Month ${data.cycleMonth.month_number}` : ""}`,
      metrics: [
        { label: "Rows", value: rows.length },
        { label: "Savings", value: money(totals.savings) },
        { label: "Loans", value: money(totals.loans) },
        { label: "Charges", value: money(totals.charges) },
      ],
      columns: definition.columns.filter((column) => column !== "Action"),
      rows: rawReportRows(rows, report),
    });
  }

  useEffect(() => {
    if (initialCycles === undefined) loadCycles();
  }, []);

  useEffect(() => {
    if (cycleId && initialCycleDetail === null) loadCycleDetail(cycleId);
  }, [cycleId]);

  useEffect(() => {
    if (initialData === null) loadReport();
  }, [cycleId, cycleMonthId, selectedMember]);

  const rows = data?.rows || [];
  const members = data?.members || [];
  const definition = REPORT_DEFINITIONS[report];
  const totals = reportTotals({ rows, totals: data?.totals || {} });
  const reportRows = buildReportRows(rows, report, setSelectedRow);

  return (
    <Page
      title="Reports Center"
      className="reports-page"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={() => loadReport()} loading={loading}>Run Report</Button>
          <Button type="button" variant="secondary" icon={Printer} onClick={downloadPdf}>Download PDF</Button>
          <Button type="button" variant="secondary" icon={Download} onClick={exportCsv}>Export CSV</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Report failed">{error}</Alert> : null}

      <ReportsHero definition={definition} data={data} totals={totals} rows={rows} />

      <div className="admin-mobile-action-row reports-mobile-actions-row mobile-only" aria-label="Reports quick actions">
        <Button type="button" icon={RefreshCw} onClick={() => loadReport()} loading={loading}>Run</Button>
        <Button type="button" variant="secondary" icon={Printer} onClick={downloadPdf}>PDF</Button>
        <Button type="button" variant="secondary" icon={Download} onClick={exportCsv}>CSV</Button>
      </div>

      <Tabs
        active={report}
        onChange={changeReport}
        label="Report tabs"
        tabs={Object.entries(REPORT_DEFINITIONS).map(([id, item]) => ({ id, label: item.label }))}
      />

      <section className="panel reports-filters">
        <div className="form-grid three">
          <Select
            label="Cycle"
            value={cycleId}
            onChange={(value) => { setCycleId(value); setCycleMonthId(""); }}
            placeholder="Active cycle"
            options={cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.name} - ${cycle.status}` }))}
          />
          <Select
            label="Month"
            value={cycleMonthId}
            onChange={setCycleMonthId}
            placeholder={definition.supportsMonth ? "Report context month" : "All months"}
            disabled={!definition.supportsMonth}
            options={(cycleDetail.months || []).map((month) => ({ value: month.id, label: `Month ${month.month_number} - ${titleCase(month.status)}` }))}
          />
          <Select
            label="Member"
            value={selectedMember}
            onChange={setSelectedMember}
            placeholder={definition.supportsMember ? "All members" : "Not required"}
            disabled={!definition.supportsMember}
            options={members.map((member) => ({ value: member.cycle_member_id, label: `${member.first_name} ${member.last_name}` }))}
          />
        </div>
      </section>

      <div className="metrics reports-metrics">
        <Card title="Report Rows" value={rows.length} note={definition.label} icon={FileBarChart} />
        <Card title="Savings" value={money(totals.savings)} note="Principal or monthly total" icon={PiggyBank} />
        <Card title="Loans" value={money(totals.loans)} note="Issued or borrowed" tone="blue" icon={Banknote} />
        <Card title="Charges" value={money(totals.charges)} note="Common interest + penalties" tone="amber" icon={Scale} />
      </div>

      <Modal
        open={Boolean(selectedRow)}
        title="Report Details"
        size="lg"
        onClose={() => setSelectedRow(null)}
      >
        {selectedRow ? (
          <div className="reports-detail-modal">
            <ReportDetail selectedRow={selectedRow} definition={definition} onClose={() => setSelectedRow(null)} />
          </div>
        ) : null}
      </Modal>

      <section className="panel">
        <div className="panel-head">
          <h2>{definition.label}</h2>
          <Badge text={data?.cycle?.name || "Cycle context"} tone="blue" />
        </div>
        {loading ? <Skeleton lines={8} /> : rows.length ? (
          <>
            <ReportCards rows={rows} report={report} definition={definition} onSelect={setSelectedRow} />
            <div className="reports-desktop-table">
              <DataTable columns={definition.columns} rows={reportRows} empty="No report rows found." />
            </div>
          </>
        ) : (
          <EmptyState title="No report rows" message="Run another report, change filters, or post financial transactions first." />
        )}
      </section>
    </Page>
  );
}
