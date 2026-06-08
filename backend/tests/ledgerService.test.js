import { describe, expect, it } from "vitest";
import { postLedger, reverseLedgerTransaction } from "../src/services/ledgerService.js";

class FakeClient {
  constructor({ original = null, entries = [], existingReversal = null } = {}) {
    this.original = original;
    this.entries = entries;
    this.existingReversal = existingReversal;
    this.insertedTransaction = null;
    this.insertedEntries = [];
  }

  async query(sql, params = []) {
    if (sql.includes("SELECT * FROM ledger_transactions WHERE id = $1")) {
      return { rows: this.original ? [this.original] : [] };
    }
    if (sql.includes("SELECT id FROM ledger_transactions WHERE reversed_transaction_id = $1")) {
      return { rows: this.existingReversal ? [this.existingReversal] : [] };
    }
    if (sql.includes("SELECT * FROM ledger_entries WHERE ledger_transaction_id = $1")) {
      return { rows: this.entries };
    }
    if (sql.includes("INSERT INTO ledger_transactions")) {
      const isReversalInsert = sql.includes("reversed_transaction_id");
      this.insertedTransaction = isReversalInsert
        ? {
            id: "reversal-tx",
            cycle_id: params[0],
            cycle_month_id: params[1],
            cycle_member_id: params[2],
            transaction_type: "REVERSAL",
            amount: params[3],
            description: params[4],
            source_table: params[5],
            source_id: params[6],
            reversed_transaction_id: params[7],
            reversal_reason: params[8],
            posted_by: params[9],
            is_reversal: true,
          }
        : {
            id: "new-tx",
            cycle_id: params[0],
            cycle_month_id: params[1],
            cycle_member_id: params[2],
            transaction_type: params[3],
            amount: params[4],
            description: params[5],
            source_table: params[6],
            source_id: params[7],
            posted_by: params[8],
          };
      return { rows: [this.insertedTransaction] };
    }
    if (sql.includes("INSERT INTO ledger_entries")) {
      this.insertedEntries.push({
        ledger_transaction_id: params[0],
        cycle_id: params[1],
        cycle_member_id: params[2],
        account_type: params[3],
        debit: params[4],
        credit: params[5],
        memo: params[6],
      });
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL in fake client: ${sql}`);
  }
}

describe("ledger service", () => {
  it("posts only balanced ledger entries", async () => {
    const client = new FakeClient();

    await expect(postLedger(client, {
      cycleId: "cycle-1",
      transactionType: "SAVINGS_DEPOSIT",
      amount: 100,
      entries: [
        { accountType: "CASH_POOL", debit: 100 },
        { accountType: "SAVINGS_PRINCIPAL", credit: 90 },
      ],
    })).rejects.toMatchObject({ status: 400 });

    expect(client.insertedTransaction).toBeNull();
    expect(client.insertedEntries).toEqual([]);
  });

  it("rejects postings whose transaction amount differs from the balanced entry total", async () => {
    const client = new FakeClient();

    await expect(postLedger(client, {
      cycleId: "cycle-1",
      transactionType: "SAVINGS_DEPOSIT",
      amount: 90,
      entries: [
        { accountType: "CASH_POOL", debit: 100 },
        { accountType: "SAVINGS_PRINCIPAL", credit: 100 },
      ],
    })).rejects.toMatchObject({
      status: 400,
      message: "Ledger transaction amount must match the balanced debit and credit total",
    });

    expect(client.insertedTransaction).toBeNull();
  });

  it("rejects invalid entry shapes before inserting anything", async () => {
    const invalidCases = [
      {
        entries: [{ accountType: "CASH_POOL", debit: 100 }],
        message: "Ledger posting requires at least two entries",
      },
      {
        entries: [
          { accountType: "CASH_POOL", debit: -100 },
          { accountType: "SAVINGS_PRINCIPAL", credit: -100 },
        ],
        message: "Ledger entry debit and credit amounts must be non-negative",
      },
      {
        entries: [
          { accountType: "CASH_POOL", debit: 100, credit: 1 },
          { accountType: "SAVINGS_PRINCIPAL", credit: 101 },
        ],
        message: "Ledger entry cannot contain both debit and credit amounts",
      },
      {
        entries: [
          { accountType: "CASH_POOL", debit: 100 },
          { accountType: "SAVINGS_PRINCIPAL" },
        ],
        message: "Ledger entry must contain a debit or credit amount",
      },
      {
        entries: [
          { debit: 100 },
          { accountType: "SAVINGS_PRINCIPAL", credit: 100 },
        ],
        message: "Ledger entry account type is required",
      },
    ];

    for (const invalidCase of invalidCases) {
      const client = new FakeClient();
      await expect(postLedger(client, {
        cycleId: "cycle-1",
        transactionType: "SAVINGS_DEPOSIT",
        amount: 100,
        entries: invalidCase.entries,
      })).rejects.toMatchObject({ status: 400, message: invalidCase.message });
      expect(client.insertedTransaction).toBeNull();
      expect(client.insertedEntries).toEqual([]);
    }
  });

  it("requires a source table when a source id is provided", async () => {
    const client = new FakeClient();

    await expect(postLedger(client, {
      cycleId: "cycle-1",
      transactionType: "SAVINGS_DEPOSIT",
      amount: 100,
      sourceId: "source-1",
      entries: [
        { accountType: "CASH_POOL", debit: 100 },
        { accountType: "SAVINGS_PRINCIPAL", credit: 100 },
      ],
    })).rejects.toMatchObject({
      status: 400,
      message: "Ledger source table is required when source ID is provided",
    });
  });

  it("posts a valid transaction and its ledger entries", async () => {
    const client = new FakeClient();

    const result = await postLedger(client, {
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      cycleMemberId: "cycle-member-1",
      transactionType: "SAVINGS_DEPOSIT",
      amount: 100,
      description: "Savings deposit",
      sourceTable: "declarations",
      sourceId: "declaration-1",
      postedBy: "admin-1",
      entries: [
        { accountType: "CASH_POOL", debit: 100, memo: "Cash received" },
        { accountType: "SAVINGS_PRINCIPAL", credit: 100 },
      ],
    });

    expect(result).toMatchObject({
      id: "new-tx",
      transaction_type: "SAVINGS_DEPOSIT",
      amount: 100,
      source_table: "declarations",
      source_id: "declaration-1",
    });
    expect(client.insertedEntries).toEqual([
      expect.objectContaining({ account_type: "CASH_POOL", debit: 100, credit: 0, memo: "Cash received" }),
      expect.objectContaining({ account_type: "SAVINGS_PRINCIPAL", debit: 0, credit: 100 }),
    ]);
  });

  it("creates a reversal by swapping original debits and credits", async () => {
    const original = {
      id: "original-tx",
      cycle_id: "cycle-1",
      cycle_month_id: "month-1",
      cycle_member_id: "cycle-member-1",
      transaction_type: "SAVINGS_DEPOSIT",
      amount: 250,
      source_table: "savings",
      source_id: "source-1",
      is_reversal: false,
    };
    const client = new FakeClient({
      original,
      entries: [
        { id: "entry-1", cycle_id: "cycle-1", cycle_member_id: "cycle-member-1", account_type: "CASH_POOL", debit: 250, credit: 0 },
        { id: "entry-2", cycle_id: "cycle-1", cycle_member_id: "cycle-member-1", account_type: "SAVINGS_PRINCIPAL", debit: 0, credit: 250 },
      ],
    });

    const result = await reverseLedgerTransaction(client, {
      ledgerTransactionId: original.id,
      reason: "duplicate posting",
      postedBy: "admin-1",
    });

    expect(result.original).toBe(original);
    expect(result.reversal).toMatchObject({
      transaction_type: "REVERSAL",
      amount: 250,
      reversed_transaction_id: "original-tx",
      reversal_reason: "duplicate posting",
      posted_by: "admin-1",
      is_reversal: true,
    });
    expect(client.insertedEntries).toEqual([
      expect.objectContaining({ account_type: "CASH_POOL", debit: 0, credit: 250 }),
      expect.objectContaining({ account_type: "SAVINGS_PRINCIPAL", debit: 250, credit: 0 }),
    ]);
  });

  it("prevents reversing a transaction more than once", async () => {
    const client = new FakeClient({
      original: { id: "original-tx", is_reversal: false },
      existingReversal: { id: "already-reversed" },
    });

    await expect(reverseLedgerTransaction(client, {
      ledgerTransactionId: "original-tx",
      reason: "duplicate posting",
      postedBy: "admin-1",
    })).rejects.toMatchObject({ status: 409 });

    expect(client.insertedTransaction).toBeNull();
  });

  it("requires a reversal reason", async () => {
    const client = new FakeClient({
      original: { id: "original-tx", is_reversal: false },
    });

    await expect(reverseLedgerTransaction(client, {
      ledgerTransactionId: "original-tx",
      reason: "",
      postedBy: "admin-1",
    })).rejects.toMatchObject({
      status: 400,
      message: "Reversal reason is required",
    });

    expect(client.insertedTransaction).toBeNull();
  });

  it("prevents reversing reversal transactions", async () => {
    const client = new FakeClient({
      original: { id: "reversal-tx", is_reversal: true },
    });

    await expect(reverseLedgerTransaction(client, {
      ledgerTransactionId: "reversal-tx",
      reason: "wrong reversal",
      postedBy: "admin-1",
    })).rejects.toMatchObject({
      status: 400,
      message: "A reversal transaction cannot be reversed from this workflow",
    });
  });

  it("rejects reversing transactions that have no ledger entries", async () => {
    const client = new FakeClient({
      original: { id: "original-tx", is_reversal: false },
      entries: [],
    });

    await expect(reverseLedgerTransaction(client, {
      ledgerTransactionId: "original-tx",
      reason: "missing entries",
      postedBy: "admin-1",
    })).rejects.toMatchObject({
      status: 400,
      message: "Cannot reverse a transaction without ledger entries",
    });
  });
});
