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
  Pagination,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
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
  return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
}

function DetailValue({ label, value }) {
  return <div><strong>{label}</strong><span>{value}</span></div>;
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
    <section className="panel ledger-detail">
      <div className="panel-head">
        <h2>Transaction Detail</h2>
        <Badge text={titleCase(selected.transaction_type)} tone={ledgerTone(selected)} />
      </div>
      <div className="detail-grid ledger-detail-grid">
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
      )}
      <div className="detail-grid ledger-balance-grid">
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
      <div className="button-row">
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
      actions={(
        <>
          <Button type="button" icon={RefreshCw} onClick={() => loadLedger(filters, 1)} loading={loading}>Filter</Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>Clear Filters</Button>
          <Button type="button" variant="secondary" icon={Download} onClick={downloadCsv}>Export CSV</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Ledger action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Ledger action failed">{error}</Alert> : null}

      <section className="panel ledger-filters">
        <div className="form-grid three">
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

      <div className="metrics ledger-audit-metrics">
        <Card title="Transactions" value={metrics.count} note={`${metrics.total} matching records`} icon={BookOpen} />
        <Card title="Total Amount" value={money(metrics.amount)} note="Current page gross value" tone="blue" icon={BadgeDollarSign} />
        <Card title="Reversals" value={metrics.reversals} note="Corrections in current page" tone="amber" icon={Activity} />
      </div>

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

      <section className="panel">
        <div className="panel-head">
          <h2>Transactions</h2>
          <Badge text={`Page ${pagination.page || 1}`} tone="blue" />
        </div>
        {loading ? <Skeleton lines={8} /> : transactions.length ? (
          <>
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
