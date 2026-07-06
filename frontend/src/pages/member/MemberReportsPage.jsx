import React, { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarDays, ClipboardList, Download, FileBarChart, FileText, Menu, PiggyBank, Printer, Scale, Search, ShieldAlert, WalletCards } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Badge, Button, MobileBottomNav, MobileListCard, MobileMetricCard, MobileScreenShell, Skeleton } from "../../components/ui/index.jsx";
import { ReportsPage } from "../admin/ReportsPage.jsx";
import { buildCsv, escapeHtml } from "../../utils/exportSafety.js";
import { chooseActiveMembership, memberDashboardTotals } from "./MemberDashboardPage.jsx";
import { memberMobileNavItems } from "./memberMobileNav.js";
import "../../styles/member-reports.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";
const titleCase = (value) => String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

const REPORTS = [
  { id: "statement", title: "Member Statement", icon: FileText, note: "Full transparent ledger" },
  { id: "savings", title: "Savings", icon: PiggyBank, note: "Principal, interest, contributions" },
  { id: "loans", title: "Loans", icon: Banknote, note: "Loan balance and repayments" },
  { id: "declarations", title: "Declarations", icon: ClipboardList, note: "Submitted monthly activity" },
  { id: "common-interest", title: "Common Interest", icon: Scale, note: "Assessments and payments" },
  { id: "penalties", title: "Penalties", icon: ShieldAlert, note: "Charges and conversions" },
  { id: "shareout", title: "Shareout", icon: WalletCards, note: "End-of-cycle position" },
];

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

export async function loadMemberReportCenterData({ memberApi = api } = {}) {
  const me = await memberApi("/auth/me");
  const activeMembership = chooseActiveMembership(me.cycleMemberships || []);
  if (!activeMembership) return { me, activeMembership: null, statement: null };
  const statement = await memberApi(`/reports/member-statement/${activeMembership.id}`);
  return { me, activeMembership, statement: statement.data };
}

function rowsForReport(report, statement) {
  const transactions = statement?.transactions || [];
  const filtered = transactions.filter((tx) => {
    const type = String(tx.transaction_type || "");
    if (report === "savings") return type.includes("SAVINGS") || type.includes("SOCIAL") || type.includes("MEMBERSHIP");
    if (report === "loans") return type.includes("LOAN") || type.includes("REPAYMENT");
    if (report === "common-interest") return type.includes("COMMON");
    if (report === "penalties") return type.includes("PENALTY");
    if (report === "declarations") return tx.source_table === "declarations";
    return true;
  });
  return filtered.slice(0, 6);
}

function reportTotal(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function exportCsv(report, rows) {
  const csv = buildCsv([
    ["Date", "Type", "Amount", "Description", "Source"],
    ...rows.map((row) => [dateOnly(row.posted_at || row.transaction_date), titleCase(row.transaction_type), Number(row.amount || 0).toFixed(2), row.description || "", row.source_table || ""]),
  ]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `member-${report}-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadPdf({ report, rows, totals }) {
  const printable = window.open("", "_blank", "width=900,height=720");
  if (!printable) return;
  printable.document.write(`
    <html>
      <head>
        <title>${escapeHtml(report.title)}</title>
        <style>
          body{font-family:Inter,Arial,sans-serif;margin:28px;color:#1F2933}
          h1{margin:0 0 6px;color:#0D3B2E} p{margin:0 0 18px;color:#1F2933}
          .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
          .box{border:1px solid #E6E8EB;border-radius:8px;padding:10px}.box span{display:block;color:#1F2933;font-size:12px}.box strong{font-size:18px}
          table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #E6E8EB;padding:8px;text-align:left} th{background:#F7F4EE}
        </style>
      </head>
      <body>
        <h1>${escapeHtml(report.title)}</h1>
        <p>Visionaries Village Banking member transparency report</p>
        <section class="summary">
          <div class="box"><span>Accumulated Savings</span><strong>${escapeHtml(money(totals.accumulatedSavings))}</strong></div>
          <div class="box"><span>Loan Balance</span><strong>${escapeHtml(money(totals.outstandingLoan))}</strong></div>
          <div class="box"><span>Common Interest Due</span><strong>${escapeHtml(money(totals.commonInterestDue))}</strong></div>
        </section>
        <table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Description</th></tr></thead><tbody>
          ${rows.map((row) => `<tr><td>${escapeHtml(dateOnly(row.posted_at || row.transaction_date))}</td><td>${escapeHtml(titleCase(row.transaction_type))}</td><td>${escapeHtml(money(row.amount))}</td><td>${escapeHtml(row.description || "")}</td></tr>`).join("")}
        </tbody></table>
        <script>window.print()</script>
      </body>
    </html>
  `);
  printable.document.close();
}

export function MemberReportsPage({ setPage, reportsApi, initialData, initialCycles, initialCycleDetail, requestedReport }) {
  const [mobileData, setMobileData] = useState(null);
  const [mobileError, setMobileError] = useState("");
  const [mobileLoading, setMobileLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(requestedReport || "statement");

  async function loadMobileReports() {
    setMobileLoading(true);
    setMobileError("");
    try {
      setMobileData(await loadMemberReportCenterData({ memberApi: reportsApi || api }));
    } catch (err) {
      setMobileError(err.message || "Member reports could not load.");
    } finally {
      setMobileLoading(false);
    }
  }

  useEffect(() => {
    loadMobileReports();
  }, []);

  const totals = useMemo(() => memberDashboardTotals(mobileData), [mobileData]);
  const report = REPORTS.find((item) => item.id === selectedReport) || REPORTS[0];
  const rows = rowsForReport(report.id, mobileData?.statement);
  const selectedTotal = reportTotal(rows);
  const bottomNav = <MobileBottomNav active="my-reports" items={memberMobileNavItems} onChange={setPage} />;

  return (
    <>
      <div className="member-reports-mobile">
        <MobileScreenShell bottomNav={bottomNav}>
          <header className="member-reports-topbar">
            <button type="button" onClick={() => setPage?.("member-more")} aria-label="Open menu"><Menu size={18} aria-hidden="true" /></button>
            <h1>Reports</h1>
            <button type="button" onClick={loadMobileReports} aria-label="Refresh reports"><Search size={18} aria-hidden="true" /></button>
          </header>

          {mobileError ? <Alert tone="danger" title="Reports failed">{mobileError}</Alert> : null}
          {mobileLoading ? <section className="panel"><Skeleton lines={8} /></section> : (
            <>
              <section className="member-reports-summary-panel" aria-label="Group transparency summary">
                <h2>Group Transparency Summary</h2>
                <div className="member-reports-summary">
                <MobileMetricCard label="Total Savings" value={money(totals.groupPool.totalAccumulatedSavings || totals.accumulatedSavings)} note="Transparent view" icon={PiggyBank} />
                <MobileMetricCard label="Loans Issued" value={money(totals.groupPool.loansIssued || totals.borrowed)} note="Latest calculated" icon={Banknote} tone="blue" />
                <MobileMetricCard label="CI Pool" value={money(totals.groupPool.commonInterestPool)} note={totals.groupPoolScope} icon={Scale} tone="amber" />
                <MobileMetricCard label="Penalties Due" value={money(totals.penaltyDue)} note="Your outstanding" icon={ShieldAlert} tone={totals.penaltyDue > 0 ? "red" : "green"} />
                </div>
              </section>

              <section className="member-report-center" aria-label="Report Center">
                <div className="member-report-section-head">
                  <h2>Report Center</h2>
                  <Badge text="Swipe" tone="blue" />
                </div>
                <div className="member-report-carousel">
                  {REPORTS.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === report.id;
                    return (
                      <article key={item.id} className={`member-report-card ${active ? "active" : ""}`}>
                        <span><Icon size={18} aria-hidden="true" /></span>
                        <h3>{item.title}</h3>
                        <p>{item.note}</p>
                        <Button type="button" size="sm" onClick={() => setSelectedReport(item.id)}>Open</Button>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="member-report-preview" aria-label={`${report.title} preview`}>
                <div className="member-report-section-head">
                  <div>
                    <h2>{report.title}</h2>
                    <p>{memberName(mobileData?.statement?.member || mobileData?.me?.member)} · Full cycle</p>
                  </div>
                  <Badge text={`${rows.length} rows`} tone="blue" />
                </div>
                <div className="member-report-period">
                  <CalendarDays size={14} aria-hidden="true" />
                  <span>{mobileData?.statement?.cycle?.name || mobileData?.activeMembership?.cycle_name || "Current cycle"}</span>
                </div>
                <div className="member-report-visual" aria-label={`${report.title} visual summary`}>
                  <div>
                    <span>Selected Total</span>
                    <strong>{money(selectedTotal)}</strong>
                    <small>{report.note}</small>
                  </div>
                  <div className="member-report-chart" aria-hidden="true">
                    <span style={{ height: `${Math.max(22, Math.min(88, rows.length * 13))}%` }} />
                    <span style={{ height: `${Math.max(28, Math.min(92, Number(totals.accumulatedSavings || 0) / 500))}%` }} />
                    <span style={{ height: `${Math.max(18, Math.min(84, Number(totals.outstandingLoan || 0) / 350))}%` }} />
                    <span style={{ height: `${Math.max(24, Math.min(90, Number(totals.groupPool.commonInterestPool || 0) / 120))}%` }} />
                  </div>
                </div>
                <div className="member-report-preview-list">
                  {rows.slice(0, 3).length ? rows.slice(0, 3).map((row) => (
                    <MobileListCard
                      key={row.id || `${row.transaction_type}-${row.posted_at}`}
                      title={titleCase(row.transaction_type)}
                      subtitle={row.description || row.source_table || "Ledger record"}
                      meta={dateOnly(row.posted_at || row.transaction_date)}
                      value={money(row.amount)}
                      icon={report.icon}
                    />
                  )) : <p className="muted">No rows found for this report yet.</p>}
                </div>
                <div className="member-report-export-actions">
                  <Button type="button" icon={Printer} onClick={() => downloadPdf({ report, rows, totals })} disabled={!rows.length}>Download PDF</Button>
                  <Button type="button" variant="secondary" icon={Download} onClick={() => exportCsv(report.id, rows)} disabled={!rows.length}>Export CSV</Button>
                </div>
              </section>
            </>
          )}
        </MobileScreenShell>
      </div>

      <div className="member-reports-desktop">
        <ReportsPage
          reportsApi={reportsApi}
          initialData={initialData}
          initialCycles={initialCycles}
          initialCycleDetail={initialCycleDetail}
          requestedReport={requestedReport}
          title="Member Reports"
          heroEyebrow="Transparency Reports"
          readOnlyNote="Read-only group reports for statements, declarations, pool, savings, loans, common interest, penalties, and cycle closing."
        />
      </div>
    </>
  );
}
