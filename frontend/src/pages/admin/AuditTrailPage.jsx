import React, { useEffect, useMemo, useState } from "react";
import { Activity, Download, Lock, RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Tabs,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/ledger-audit.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "POST", "REVERSE", "OVERRIDE", "LOCK", "REOPEN", "LOGIN"];

function titleCase(value) {
  return String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function memberName(item) {
  return `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "Group";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function actionTone(action) {
  if (["APPROVE", "CREATE", "LOGIN"].includes(action)) return "green";
  if (["REVERSE", "DELETE", "REJECT"].includes(action)) return "red";
  if (["OVERRIDE", "LOCK", "REOPEN"].includes(action)) return "amber";
  return "blue";
}

export function auditQuery({ filters = {}, section = "logs", page = 1, limit = 50, format = "" }) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set("section", section);
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (format) params.set("format", format);
  return `/audit?${params.toString()}`;
}

export function auditRowsForSection(auditData, section) {
  if (section === "overrides") return auditData.overrides || [];
  if (section === "reversals") return auditData.reversals || [];
  return auditData.data || [];
}

export function auditDetailPairs(row) {
  return Object.entries(row || {})
    .filter(([key]) => !["before_data", "after_data"].includes(key))
    .slice(0, 18);
}

function DetailValue({ label, value }) {
  return (
    <div className="grid gap-1 rounded-app border border-mist bg-cream p-3">
      <strong className="text-xs font-black uppercase text-charcoal/70">{label}</strong>
      <span className="break-words text-sm font-extrabold text-charcoal">{value}</span>
    </div>
  );
}

function AuditHero({ metrics, section }) {
  return (
    <section className="ledger-audit-hero mb-4 grid gap-4 rounded-mobile bg-gradient-to-br from-forest via-emerald to-forest p-5 text-cream shadow-lift md:grid-cols-[minmax(0,1fr)_auto]" aria-label="Audit governance overview">
      <div>
        <span className="text-xs font-black uppercase text-cream">Governance Log</span>
        <h2 className="my-1 text-[25px] font-extrabold leading-tight text-cream">{section === "overrides" ? "Override Review" : section === "reversals" ? "Reversal Review" : "Administrative Events"}</h2>
        <p className="m-0 text-sm font-extrabold text-cream/85">Trace who acted, what changed, when it happened, and why it was approved.</p>
      </div>
      <div className="ledger-audit-hero-stat grid min-w-40 content-center gap-1 rounded-mobile border border-cream/20 bg-white/10 p-3 backdrop-blur">
        <span className="text-xs font-black uppercase text-cream">Audit Logs</span>
        <strong className="break-words text-[22px] font-extrabold text-cream">{metrics.logs}</strong>
        <small className="text-xs font-extrabold text-cream/85">{metrics.overrides} overrides · {metrics.reversals} reversals</small>
      </div>
    </section>
  );
}

function AuditCards({ section, rows, onSelect }) {
  if (!rows.length) return null;
  return (
    <div className="ledger-audit-mobile-cards grid gap-3" aria-label="Mobile audit cards">
      {rows.map((row) => {
        const action = row.action || row.transaction_type || row.field_name || row.target_table;
        const title = section === "overrides"
          ? titleCase(row.field_name)
          : section === "reversals"
            ? memberName(row)
            : row.actor_email || "System";
        const subtitle = section === "overrides"
          ? `${row.target_table || "-"}:${String(row.target_id || "").slice(0, 8)}`
          : section === "reversals"
            ? titleCase(row.transaction_type)
            : `${row.entity_table || "-"}${row.entity_id ? `:${String(row.entity_id).slice(0, 8)}` : ""}`;
        return (
          <article key={row.id || `${title}-${row.created_at || row.posted_at}`} className="ledger-audit-card grid gap-3 rounded-mobile border border-mist bg-cream p-3 shadow-soft">
            <div className="ledger-audit-card-head grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
              <div className="ledger-audit-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{String(title || "A").slice(0, 2).toUpperCase()}</div>
              <div>
                <strong className="block break-words text-sm font-extrabold text-charcoal">{title}</strong>
                <span className="block break-words text-xs font-extrabold text-charcoal/70">{subtitle}</span>
              </div>
              <Badge text={titleCase(action)} tone={actionTone(row.action || row.transaction_type)} />
            </div>
            <div className="ledger-audit-card-values grid grid-cols-2 gap-2.5">
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Date</span><strong className="break-words text-base font-extrabold text-charcoal">{dateOnly(row.created_at || row.posted_at)}</strong></div>
              <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Reason</span><strong className="break-words text-base font-extrabold text-charcoal">{row.reason || row.reversal_reason || "-"}</strong></div>
              {section === "overrides" ? (
                <>
                  <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Original</span><strong className="break-words text-base font-extrabold text-charcoal">{formatValue(row.original_value)}</strong></div>
                  <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Override</span><strong className="break-words text-base font-extrabold text-charcoal">{formatValue(row.overridden_value)}</strong></div>
                </>
              ) : section === "reversals" ? (
                <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Amount</span><strong className="break-words text-base font-extrabold text-charcoal">{money(row.amount)}</strong></div>
              ) : (
                <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">IP</span><strong className="break-words text-base font-extrabold text-charcoal">{row.ip_address || "-"}</strong></div>
              )}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(row)}>View Audit Detail</Button>
          </article>
        );
      })}
    </div>
  );
}

function AuditDetail({ row, onClose }) {
  if (!row) return null;
  return (
    <section className="audit-detail grid gap-3.5">
      <div className="ledger-audit-detail-hero mb-0 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="ledger-audit-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{String(row.actor_email || row.target_table || row.transaction_type || "A").slice(0, 2).toUpperCase()}</div>
        <div>
          <span className="text-xs font-black uppercase text-emerald">Audit Detail</span>
          <h2 className="my-0.5 text-xl font-extrabold text-charcoal">{row.actor_email || titleCase(row.target_table || row.transaction_type)}</h2>
          <p className="m-0 break-words text-sm font-extrabold text-charcoal/75">{row.reason || row.reversal_reason || "Traceable administrative activity"}</p>
        </div>
        <Badge text={titleCase(row.action || row.transaction_type || row.target_table)} tone={actionTone(row.action)} />
      </div>
      <div className="detail-grid audit-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {auditDetailPairs(row).map(([key, value]) => (
          <DetailValue key={key} label={titleCase(key)} value={formatValue(value)} />
        ))}
      </div>
      {(row.before_data || row.after_data) ? (
        <div className="audit-json-grid mt-3.5 grid gap-3.5 md:grid-cols-2">
          <section className="panel nested-panel m-0 rounded-app border border-mist bg-cream p-4 shadow-soft">
            <h3 className="m-0 mb-2.5 text-sm font-extrabold text-charcoal">Before</h3>
            <pre className="json-view">{formatValue(row.before_data || {})}</pre>
          </section>
          <section className="panel nested-panel m-0 rounded-app border border-mist bg-cream p-4 shadow-soft">
            <h3 className="m-0 mb-2.5 text-sm font-extrabold text-charcoal">After</h3>
            <pre className="json-view">{formatValue(row.after_data || {})}</pre>
          </section>
        </div>
      ) : null}
      <div className="button-row flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="secondary" onClick={onClose}>Close Detail</Button>
      </div>
    </section>
  );
}

function AuditTable({ section, rows, loading, onSelect }) {
  if (loading) return <Skeleton lines={8} />;
  if (!rows.length) return <EmptyState title="No audit records" message="Adjust filters or wait for administrative activity to create audit records." />;

  if (section === "overrides") {
    return (
      <DataTable
        columns={["Date", "Cycle", "Target", "Field", "Original", "Override", "Reason", "Detail"]}
        rows={rows.map((row) => [
          dateOnly(row.created_at),
          row.cycle_name || "-",
          `${row.target_table || "-"}:${String(row.target_id || "").slice(0, 8)}`,
          titleCase(row.field_name),
          formatValue(row.original_value),
          formatValue(row.overridden_value),
          row.reason || "-",
          <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(row)}>View Audit Detail</Button>,
        ])}
      />
    );
  }

  if (section === "reversals") {
    return (
      <DataTable
        columns={["Date", "Member", "Type", "Amount", "Reason", "Detail"]}
        rows={rows.map((row) => [
          dateOnly(row.posted_at),
          memberName(row),
          titleCase(row.transaction_type),
          money(row.amount),
          row.reversal_reason || "-",
          <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(row)}>View Audit Detail</Button>,
        ])}
      />
    );
  }

  return (
    <DataTable
      columns={["Date", "Actor", "Action", "Entity", "Reason", "IP", "Detail"]}
      rows={rows.map((row) => [
        row.created_at ? new Date(row.created_at).toLocaleString() : "-",
        row.actor_email || "System",
        <Badge text={titleCase(row.action)} tone={actionTone(row.action)} />,
        `${row.entity_table || "-"}${row.entity_id ? `:${String(row.entity_id).slice(0, 8)}` : ""}`,
        row.reason || "-",
        row.ip_address || "-",
        <Button type="button" variant="secondary" size="sm" onClick={() => onSelect(row)}>View Audit Detail</Button>,
      ])}
    />
  );
}

export function AuditTrailPage({
  auditApi = api,
  initialData = undefined,
}) {
  const [section, setSection] = useState("logs");
  const [filters, setFilters] = useState({ action: "", entityTable: "", actorEmail: "", reason: "", dateFrom: "", dateTo: "" });
  const [auditData, setAuditData] = useState(initialData || { data: [], overrides: [], reversals: [], totals: {}, pagination: { page: 1, totalPages: 1 } });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(initialData === undefined);
  const [error, setError] = useState("");

  async function loadAudit(nextFilters = filters, page = auditData.pagination?.page || 1, nextSection = section) {
    setLoading(true);
    setError("");
    try {
      const response = await auditApi(auditQuery({ filters: nextFilters, section: nextSection, page }));
      setAuditData(response);
      setSelected(null);
    } catch (err) {
      setError(err.message || "Audit records could not load.");
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    const next = { action: "", entityTable: "", actorEmail: "", reason: "", dateFrom: "", dateTo: "" };
    setFilters(next);
    loadAudit(next, 1).catch(() => {});
  }

  function changeSection(value) {
    setSection(value);
    setSelected(null);
    loadAudit(filters, 1, value).catch(() => {});
  }

  function exportCsv() {
    window.location.href = auditQuery({ filters, section, page: auditData.pagination?.page || 1, limit: auditData.pagination?.limit || 50, format: "csv" }).replace("/audit", `${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/audit`);
  }

  useEffect(() => {
    if (initialData === undefined) loadAudit();
  }, []);

  const rows = auditRowsForSection(auditData, section);
  const totals = auditData.totals || {};
  const metrics = useMemo(() => ({
    logs: totals.logs ?? (auditData.data || []).length,
    overrides: totals.overrides ?? (auditData.overrides || []).length,
    reversals: totals.reversals ?? (auditData.reversals || []).length,
    logins: totals.logins ?? (auditData.data || []).filter((row) => row.action === "LOGIN").length,
  }), [auditData, totals]);

  return (
    <Page
      title="Audit Trail"
      className="ledger-audit-page grid gap-0"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={() => loadAudit(filters, 1)} loading={loading}>Apply Filters</Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>Clear Filters</Button>
          <Button type="button" variant="secondary" icon={Download} onClick={exportCsv}>Export CSV</Button>
        </>
      )}
    >
      {error ? <Alert tone="danger" title="Audit load failed">{error}</Alert> : null}

      <AuditHero metrics={metrics} section={section} />

      <div className="admin-mobile-action-row audit-mobile-actions-row mobile-only flex gap-2" aria-label="Audit quick actions">
        <Button type="button" icon={RefreshCw} onClick={() => loadAudit(filters, 1)} loading={loading}>Apply</Button>
        <Button type="button" variant="secondary" onClick={clearFilters}>Clear</Button>
        <Button type="button" variant="secondary" icon={Download} onClick={exportCsv}>Export</Button>
      </div>

      <section className="panel audit-filters mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
        <div className="form-grid three grid gap-3 md:grid-cols-3">
          <Select
            label="Action"
            value={filters.action}
            onChange={(value) => updateFilter("action", value)}
            placeholder="All actions"
            options={AUDIT_ACTIONS.map((action) => ({ value: action, label: titleCase(action) }))}
          />
          <Field label="Entity table" value={filters.entityTable} onChange={(value) => updateFilter("entityTable", value)} placeholder="cycles, penalties..." />
          <Field label="Actor email" value={filters.actorEmail} onChange={(value) => updateFilter("actorEmail", value)} placeholder="admin@example.com" />
          <Field label="Reason contains" value={filters.reason} onChange={(value) => updateFilter("reason", value)} placeholder="committee, correction..." />
          <Field label="Date from" type="date" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
          <Field label="Date to" type="date" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
        </div>
      </section>

      <div className="metrics ledger-audit-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Audit Logs" value={metrics.logs} note="Filtered events" icon={Activity} />
        <Card title="Overrides" value={metrics.overrides} note="Manual value changes" tone="amber" icon={SlidersHorizontal} />
        <Card title="Reversals" value={metrics.reversals} note="Ledger corrections" tone="red" icon={RotateCcw} />
        <Card title="Logins" value={metrics.logins} note="Access events" tone="blue" icon={Lock} />
      </div>

      <Tabs
        active={section}
        onChange={changeSection}
        label="Audit tabs"
        tabs={[
          { id: "logs", label: "Audit Logs" },
          { id: "overrides", label: "Overrides" },
          { id: "reversals", label: "Reversals" },
        ]}
      />

      <Modal
        open={Boolean(selected)}
        title="Audit Details"
        size="lg"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="audit-detail-modal pr-0.5">
            <AuditDetail row={selected} onClose={() => setSelected(null)} />
          </div>
        ) : null}
      </Modal>

      <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
        <div className="panel-head mb-3 flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-extrabold text-charcoal">{section === "overrides" ? "Overrides" : section === "reversals" ? "Reversal Transactions" : "Audit Logs"}</h2>
          <Badge text={`${rows.length} rows`} tone="blue" />
        </div>
        {loading ? <Skeleton lines={8} /> : rows.length ? (
          <>
            <AuditCards section={section} rows={rows} onSelect={setSelected} />
            <div className="ledger-audit-desktop-table">
              <AuditTable section={section} rows={rows} loading={false} onSelect={setSelected} />
            </div>
          </>
        ) : (
          <EmptyState title="No audit records" message="Adjust filters or wait for administrative activity to create audit records." />
        )}
        {section === "logs" && rows.length ? (
          <Pagination
            page={auditData.pagination?.page || 1}
            totalPages={auditData.pagination?.totalPages || 1}
            disabled={loading}
            onPageChange={(page) => loadAudit(filters, page)}
          />
        ) : null}
      </section>
    </Page>
  );
}
