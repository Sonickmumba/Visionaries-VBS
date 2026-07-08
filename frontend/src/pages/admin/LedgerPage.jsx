import React, { useEffect, useMemo, useState } from "react";
import { Activity, BadgeDollarSign, BookOpen, Download, RefreshCw, RotateCcw } from "lucide-react";
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
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import { buildCsv } from "../../utils/exportSafety.js";
import "../../styles/ledger-audit.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

export const LEDGER_TRANSACTION_TYPES = [
  "SAVINGS_DEPOSIT",
  "SAVINGS_INTEREST",
  "SOCIAL_FUND_PAYMENT",
  "MEMBERSHIP_FEE_PAYMENT",
  "LOAN_DISBURSEMENT",
  "LOAN_TOP_UP",
  "PRINCIPAL_REPAYMENT",
  "LOAN_INTEREST_PAYMENT",
  "LOAN_INTEREST_ASSESSMENT",
  "COMMON_INTEREST_ASSESSMENT",
  "COMMON_INTEREST_PAYMENT",
  "PENALTY_ASSESSMENT",
  "PENALTY_PAYMENT",
  "CONVERTED_PENALTY_LOAN",
  "ADMIN_ADJUSTMENT",
];

function titleCase(value) {
  return String(value || "-").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function memberName(item) {
  return `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "Group";
}

function initials(item) {
  return memberName(item)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";
}

function ledgerTone(transaction) {
  if (transaction?.is_reversal) return "red";
  if (String(transaction?.transaction_type || "").includes("INTEREST")) return "amber";
  if (String(transaction?.transaction_type || "").includes("LOAN")) return "blue";
  return "green";
}

export function ledgerQuery({ filters = {}, page = 1, limit = 50 }) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set("page", String(page));
  params.set("limit", String(limit));
  return `/ledger?${params.toString()}`;
}

export function validateLedgerReversal({ transaction, reason }) {
  const errors = {};
  if (!transaction?.id) errors.transaction = "Choose a ledger transaction.";
  if (transaction?.is_reversal) errors.transaction = "Reversal records cannot be reversed again.";
  if (!String(reason || "").trim() || String(reason || "").trim().length < 3) errors.reason = "Enter a reversal reason.";
  return errors;
}

export async function reverseLedgerTransaction({ transaction, reason, ledgerApi = api }) {
  const errors = validateLedgerReversal({ transaction, reason });
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return ledgerApi(`/ledger/${transaction.id}/reverse`, {
    method: "POST",
    body: { reason: String(reason).trim() },
  });
}

export function exportLedgerCsv(transactions = []) {
  const header = ["Date", "Member", "Code", "Type", "Amount", "Cycle", "Month", "Source", "Description"];
  const rows = transactions.map((tx) => [
    dateOnly(tx.transaction_date),
    memberName(tx),
    tx.member_code || "",
    tx.transaction_type || "",
    Number(tx.amount || 0).toFixed(2),
    tx.cycle_name || "",
    tx.month_number ? `Month ${tx.month_number}` : "",
    [tx.source_table, tx.source_id].filter(Boolean).join(":"),
    tx.description || "",
  ]);
  return buildCsv([header, ...rows]);
}

function DetailValue({ label, value }) {
  return (
    <div className="grid gap-1 rounded-app border border-mist bg-cream p-3">
      <strong className="text-xs font-black uppercase text-charcoal/70">{label}</strong>
      <span className="break-words text-sm font-extrabold text-charcoal">{value}</span>
    </div>
  );
}

function LedgerHero({ metrics }) {
  return (
    <section className="ledger-audit-hero mb-4 grid gap-4 rounded-mobile bg-gradient-to-br from-forest via-emerald to-forest p-5 text-cream shadow-lift md:grid-cols-[minmax(0,1fr)_auto]" aria-label="Ledger transaction trail overview">
      <div>
        <span className="text-xs font-black uppercase text-cream">Posting Review</span>
        <h2 className="my-1 text-[25px] font-extrabold leading-tight text-cream">Transaction Trail</h2>
        <p className="m-0 text-sm font-extrabold text-cream/85">Review postings, inspect entries, export rows, and reverse errors with reasons.</p>
      </div>
      <div className="ledger-audit-hero-stat grid min-w-40 content-center gap-1 rounded-mobile border border-cream/20 bg-white/10 p-3 backdrop-blur">
        <span className="text-xs font-black uppercase text-cream">Total Amount</span>
        <strong className="break-words text-[22px] font-extrabold text-cream">{money(metrics.amount)}</strong>
        <small className="text-xs font-extrabold text-cream/85">{metrics.count} visible transactions</small>
      </div>
    </section>
  );
}

function LedgerCards({ transactions, selected, onOpen }) {
  if (!transactions.length) return null;
  return (
    <div className="ledger-audit-mobile-cards grid gap-3" aria-label="Mobile ledger transaction cards">
      {transactions.map((tx) => (
        <article key={tx.id} className={`ledger-audit-card grid gap-3 rounded-mobile border border-mist bg-cream p-3 shadow-soft ${selected?.id === tx.id ? "selected border-emerald shadow-lift" : ""}`}>
          <div className="ledger-audit-card-head grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
            <div className="ledger-audit-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(tx)}</div>
            <div>
              <strong className="block break-words text-sm font-extrabold text-charcoal">{memberName(tx)}</strong>
              <span className="block break-words text-xs font-extrabold text-charcoal/70">{tx.member_code || "Group transaction"}</span>
            </div>
            <Badge text={titleCase(tx.transaction_type)} tone={ledgerTone(tx)} />
          </div>
          <div className="ledger-audit-card-values grid grid-cols-2 gap-2.5">
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Amount</span><strong className="break-words text-base font-extrabold text-charcoal">{money(tx.amount)}</strong></div>
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Date</span><strong className="break-words text-base font-extrabold text-charcoal">{dateOnly(tx.transaction_date)}</strong></div>
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Month</span><strong className="break-words text-base font-extrabold text-charcoal">{tx.month_number ? `Month ${tx.month_number}` : "-"}</strong></div>
            <div className="grid gap-1 rounded-app border border-mist bg-cream p-3"><span className="text-[11px] font-black uppercase text-charcoal/70">Source</span><strong className="break-words text-base font-extrabold text-charcoal">{[tx.source_table, tx.source_id?.slice?.(0, 8)].filter(Boolean).join(" - ") || "-"}</strong></div>
          </div>
          <Button type="button" variant={selected?.id === tx.id ? "primary" : "secondary"} size="sm" onClick={() => onOpen(tx.id)}>
            View Transaction
          </Button>
        </article>
      ))}
    </div>
  );
}

function LedgerDetail({
  selected,
  entries,
  reversal,
  detailLoading,
  reversalReason,
  onReasonChange,
  onReverse,
  onClose,
  reversing,
  errors,
}) {
  if (!selected) return null;
  const totalDebits = entries.reduce((sum, entry) => sum + Number(entry.debit || 0), 0);
  const totalCredits = entries.reduce((sum, entry) => sum + Number(entry.credit || 0), 0);
  const reversed = Boolean(reversal);
  const canReverse = !selected.is_reversal && !reversed;

  return (
    <section className="ledger-detail grid gap-3.5">
      <div className="ledger-audit-detail-hero mb-0 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="ledger-audit-avatar grid h-11 w-11 place-items-center rounded-mobile bg-cream text-sm font-black text-emerald" aria-hidden="true">{initials(selected)}</div>
        <div>
          <span className="text-xs font-black uppercase text-emerald">Transaction Detail</span>
          <h2 className="my-0.5 text-xl font-extrabold text-charcoal">{memberName(selected)}</h2>
          <p className="m-0 break-words text-sm font-extrabold text-charcoal/75">{selected.description || titleCase(selected.transaction_type)}</p>
        </div>
        <Badge text={titleCase(selected.transaction_type)} tone={ledgerTone(selected)} />
      </div>
      <div className="ledger-audit-detail-strip mb-0 grid gap-2.5 md:grid-cols-3">
        <DetailValue label="Amount" value={money(selected.amount)} />
        <DetailValue label="Transaction Date" value={dateOnly(selected.transaction_date)} />
        <DetailValue label="Reversal" value={selected.is_reversal ? "Reversal record" : reversed ? "Already reversed" : "Not reversed"} />
      </div>
      <div className="detail-grid ledger-detail-grid grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailValue label="Member" value={`${memberName(selected)} ${selected.member_code ? `(${selected.member_code})` : ""}`} />
        <DetailValue label="Amount" value={money(selected.amount)} />
        <DetailValue label="Transaction Date" value={dateOnly(selected.transaction_date)} />
        <DetailValue label="Posted" value={selected.posted_at ? new Date(selected.posted_at).toLocaleString() : "-"} />
        <DetailValue label="Cycle" value={selected.cycle_name || "-"} />
        <DetailValue label="Month" value={selected.month_number ? `Month ${selected.month_number}` : "-"} />
        <DetailValue label="Source" value={[selected.source_table, selected.source_id?.slice?.(0, 8)].filter(Boolean).join(" - ") || "-"} />
        <DetailValue label="Reversal" value={selected.is_reversal ? "Reversal record" : reversed ? "Already reversed" : "Not reversed"} />
      </div>
      {selected.description ? <p className="muted ledger-note">{selected.description}</p> : null}
      {detailLoading ? <Skeleton lines={5} /> : (
        <div className="ledger-detail-entries">
          <DataTable
            columns={["Account", "Debit", "Credit", "Memo"]}
            rows={entries.map((entry) => [
              titleCase(entry.account_type),
              money(entry.debit),
              money(entry.credit),
              entry.memo || "-",
            ])}
            empty="No ledger entries found for this transaction."
          />
        </div>
      )}
      <div className="detail-grid ledger-balance-grid mt-3.5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailValue label="Total Debits" value={money(totalDebits)} />
        <DetailValue label="Total Credits" value={money(totalCredits)} />
        <DetailValue label="Balanced" value={Math.round(totalDebits * 100) === Math.round(totalCredits * 100) ? "Yes" : "No"} />
        <DetailValue label="Linked Reversal" value={reversal ? `${dateOnly(reversal.posted_at)} - ${reversal.reversal_reason || "No reason"}` : "-"} />
      </div>
      {canReverse ? (
        <Textarea
          label="Reversal reason"
          value={reversalReason}
          onChange={onReasonChange}
          error={errors.reason}
          rows={3}
          placeholder="Explain why this transaction must be reversed"
        />
      ) : null}
      {errors.transaction ? <Alert tone="warning" title="Reversal unavailable">{errors.transaction}</Alert> : null}
      <div className="button-row flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="danger" icon={RotateCcw} onClick={onReverse} loading={reversing} disabled={!canReverse}>
          {reversed ? "Already Reversed" : selected.is_reversal ? "Reversal Record" : "Reverse Transaction"}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>Close Detail</Button>
      </div>
    </section>
  );
}

export function LedgerPage({
  ledgerApi = api,
  initialTransactions = undefined,
  initialPagination = null,
  initialDetail = null,
}) {
  const [filters, setFilters] = useState({ transactionType: "", dateFrom: "", dateTo: "" });
  const [transactions, setTransactions] = useState(initialTransactions || []);
  const [pagination, setPagination] = useState(initialPagination || { page: 1, totalPages: 1, total: initialTransactions?.length || 0 });
  const [selected, setSelected] = useState(initialDetail?.data || null);
  const [entries, setEntries] = useState(initialDetail?.entries || []);
  const [linkedReversal, setLinkedReversal] = useState(initialDetail?.reversal || null);
  const [reversalReason, setReversalReason] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialTransactions === undefined);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reversing, setReversing] = useState(false);

  async function loadLedger(nextFilters = filters, page = pagination.page || 1) {
    setLoading(true);
    setError("");
    try {
      const response = await ledgerApi(ledgerQuery({ filters: nextFilters, page }));
      setTransactions(response.data || []);
      setPagination(response.pagination || { page, totalPages: 1, total: response.data?.length || 0 });
    } catch (err) {
      setError(err.message || "Ledger could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function openTransaction(id) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await ledgerApi(`/ledger/${id}`);
      setSelected(response.data);
      setEntries(response.entries || []);
      setLinkedReversal(response.reversal || null);
      setReversalReason("");
      setErrors({});
    } catch (err) {
      setError(err.message || "Ledger transaction could not load.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function reverseSelected() {
    setReversing(true);
    setMessage("");
    setError("");
    setErrors({});
    try {
      await reverseLedgerTransaction({ transaction: selected, reason: reversalReason, ledgerApi });
      setMessage("Ledger transaction reversed. The original record remains auditable.");
      await openTransaction(selected.id);
      await loadLedger();
    } catch (err) {
      if (err.validationErrors) setErrors(err.validationErrors);
      else setError(err.message || "Ledger transaction could not be reversed.");
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
    loadLedger(next, 1).catch(() => {});
  }

  function downloadCsv() {
    const csv = exportLedgerCsv(transactions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "village-bank-ledger.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (initialTransactions === undefined) loadLedger();
  }, []);

  const metrics = useMemo(() => ({
    count: transactions.length,
    amount: transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    reversals: transactions.filter((tx) => tx.is_reversal || tx.reversed_transaction_id).length,
    total: pagination.total || transactions.length,
  }), [transactions, pagination.total]);

  return (
    <Page
      title="Ledger Explorer"
      className="ledger-audit-page grid gap-0"
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={() => loadLedger(filters, 1)} loading={loading}>Apply Filters</Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>Clear Filters</Button>
          <Button type="button" variant="secondary" icon={Download} onClick={downloadCsv}>Export CSV</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Ledger action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Ledger action failed">{error}</Alert> : null}

      <LedgerHero metrics={metrics} />

      <div className="admin-mobile-action-row ledger-mobile-actions-row mobile-only flex gap-2" aria-label="Ledger quick actions">
        <Button type="button" icon={RefreshCw} onClick={() => loadLedger(filters, 1)} loading={loading}>Apply</Button>
        <Button type="button" variant="secondary" onClick={clearFilters}>Clear</Button>
        <Button type="button" variant="secondary" icon={Download} onClick={downloadCsv}>Export</Button>
      </div>

      <section className="panel ledger-filters mb-5 rounded-app border border-mist bg-cream p-4 shadow-soft">
        <div className="form-grid three grid gap-3 md:grid-cols-3">
          <Select
            label="Transaction type"
            value={filters.transactionType}
            onChange={(value) => updateFilter("transactionType", value)}
            placeholder="All transaction types"
            options={LEDGER_TRANSACTION_TYPES.map((type) => ({ value: type, label: titleCase(type) }))}
          />
          <Field label="Date from" type="date" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
          <Field label="Date to" type="date" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
        </div>
      </section>

      <div className="metrics ledger-audit-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Transactions" value={metrics.count} note={`${metrics.total} matching records`} icon={BookOpen} />
        <Card title="Total Amount" value={money(metrics.amount)} note="Current page gross value" tone="blue" icon={BadgeDollarSign} />
        <Card title="Reversals" value={metrics.reversals} note="Corrections in current page" tone="amber" icon={Activity} />
      </div>

      <Modal
        open={Boolean(selected)}
        title="Transaction Details"
        size="lg"
        onClose={() => { setSelected(null); setEntries([]); setLinkedReversal(null); setReversalReason(""); setErrors({}); }}
      >
        {selected ? (
          <div className="ledger-detail-modal pr-0.5">
            <LedgerDetail
              selected={selected}
              entries={entries}
              reversal={linkedReversal}
              detailLoading={detailLoading}
              reversalReason={reversalReason}
              onReasonChange={setReversalReason}
              onReverse={reverseSelected}
              onClose={() => { setSelected(null); setEntries([]); setLinkedReversal(null); setReversalReason(""); setErrors({}); }}
              reversing={reversing}
              errors={errors}
            />
          </div>
        ) : null}
      </Modal>

      <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft">
        <div className="panel-head mb-3 flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-extrabold text-charcoal">Transactions</h2>
          <Badge text={`Page ${pagination.page || 1}`} tone="blue" />
        </div>
        {loading ? <Skeleton lines={8} /> : transactions.length ? (
          <>
            <LedgerCards transactions={transactions} selected={selected} onOpen={openTransaction} />
            <div className="ledger-audit-desktop-table">
              <DataTable
                columns={["Date", "Member", "Type", "Amount", "Cycle Month", "Source", "Action"]}
                rows={transactions.map((tx) => [
                  dateOnly(tx.transaction_date),
                  <><strong>{memberName(tx)}</strong><br /><span className="muted">{tx.member_code || "Group transaction"}</span></>,
                  <Badge text={titleCase(tx.transaction_type)} tone={ledgerTone(tx)} />,
                  money(tx.amount),
                  tx.month_number ? `Month ${tx.month_number} - ${titleCase(tx.cycle_month_status)}` : "-",
                  [tx.source_table, tx.source_id?.slice?.(0, 8)].filter(Boolean).join(" - ") || "-",
                  <Button type="button" variant="secondary" size="sm" onClick={() => openTransaction(tx.id)}>
                    View Transaction
                  </Button>,
                ])}
                empty="No ledger transactions found."
              />
            </div>
            <Pagination
              page={pagination.page || 1}
              totalPages={pagination.totalPages || 1}
              disabled={loading}
              onPageChange={(page) => loadLedger(filters, page)}
            />
          </>
        ) : (
          <EmptyState title="No ledger transactions" message="Post savings, loans, penalties, interest, or closing entries to build the ledger." />
        )}
      </section>
    </Page>
  );
}
