import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  exportLedgerCsv,
  LedgerPage,
  ledgerQuery,
  reverseLedgerTransaction,
  validateLedgerReversal,
} from "../pages/admin/LedgerPage.jsx";

const transaction = {
  id: "tx-1",
  transaction_date: "2026-01-31",
  posted_at: "2026-01-31T10:00:00Z",
  first_name: "Mary",
  last_name: "Phiri",
  member_code: "M001",
  transaction_type: "SAVINGS_DEPOSIT",
  amount: "15000",
  cycle_name: "2026 Main Cycle",
  month_number: 1,
  cycle_month_status: "OPEN",
  source_table: "declarations",
  source_id: "source-1",
  description: "Approved declaration savings deposit",
  is_reversal: false,
};

const entries = [
  { account_type: "SAVINGS", debit: "15000", credit: "0", memo: "Member savings" },
  { account_type: "CASH", debit: "0", credit: "15000", memo: "Cash received" },
];

describe("ledger screens", () => {
  it("builds ledger query strings with filters and pagination", () => {
    expect(ledgerQuery({
      filters: { transactionType: "SAVINGS_DEPOSIT", dateFrom: "2026-01-01", dateTo: "" },
      page: 2,
      limit: 50,
    })).toBe("/ledger?transactionType=SAVINGS_DEPOSIT&dateFrom=2026-01-01&page=2&limit=50");
  });

  it("validates reversal requirements", () => {
    expect(validateLedgerReversal({ transaction: null, reason: "" })).toMatchObject({
      transaction: "Choose a ledger transaction.",
      reason: "Enter a reversal reason.",
    });
    expect(validateLedgerReversal({ transaction: { ...transaction, is_reversal: true }, reason: "fix" })).toMatchObject({
      transaction: "Reversal records cannot be reversed again.",
    });
  });

  it("posts ledger reversals with a trimmed reason", async () => {
    const ledgerApi = vi.fn().mockResolvedValue({ data: { id: "rev-1" } });

    await reverseLedgerTransaction({ transaction, reason: " correction ", ledgerApi });

    expect(ledgerApi).toHaveBeenCalledWith("/ledger/tx-1/reverse", {
      method: "POST",
      body: { reason: "correction" },
    });
  });

  it("exports ledger CSV text from current rows", () => {
    const csv = exportLedgerCsv([transaction]);

    expect(csv).toContain("\"Date\",\"Member\",\"Code\",\"Type\",\"Amount\"");
    expect(csv).toContain("\"Mary Phiri\"");
    expect(csv).toContain("\"15000.00\"");
  });

  it("renders filters, metrics, detail entries, reversal controls, and transaction table", () => {
    const html = renderToStaticMarkup(
      <LedgerPage
        initialTransactions={[transaction]}
        initialPagination={{ page: 1, totalPages: 1, total: 1 }}
        initialDetail={{ data: transaction, entries, reversal: null }}
      />
    );

    expect(html).toContain("Ledger Explorer");
    expect(html).toContain("Transaction type");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Transaction Detail");
    expect(html).toContain("Reverse Transaction");
    expect(html).toContain("Approved declaration savings deposit");
    expect(html).toContain("K15,000");
    expect(html).toContain("View Transaction");
  });
});
