import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runIdempotent } from "../src/services/idempotencyService.js";
import { reverseLedgerTransaction } from "../src/services/ledgerService.js";
import { canPostToMonthStatus } from "../src/services/monthGuard.js";
import { getClosingLedgerSums } from "../src/services/monthlyClosingService.js";

describe("QA-004 backend regression suite", () => {
  it("keeps release regression commands wired through root, backend, and frontend packages", () => {
    const rootPackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "package.json"), "utf8"));
    const backendPackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    const frontendPackage = JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "frontend", "package.json"), "utf8"));

    expect(rootPackage.scripts["test:regression"]).toContain("backend");
    expect(rootPackage.scripts["test:regression"]).toContain("frontend");
    expect(backendPackage.scripts["test:regression"]).toContain("regression.test.js");
    expect(backendPackage.scripts["test:regression"]).toContain("adminWorkflow.qa.test.js");
    expect(backendPackage.scripts["test:regression"]).toContain("memberWorkflow.qa.test.js");
    expect(backendPackage.scripts["test:regression"]).toContain("financialAccuracy.qa.test.js");
    expect(frontendPackage.scripts["test:regression"]).toContain("regression.test.jsx");
  });

  it("protects locked months from ordinary financial posting paths", () => {
    expect(canPostToMonthStatus("OPEN")).toBe(true);
    expect(canPostToMonthStatus("DECLARATION_PERIOD")).toBe(true);
    expect(canPostToMonthStatus("PAYOUT_PERIOD")).toBe(true);
    expect(canPostToMonthStatus("LOCKED")).toBe(false);
  });

  it("keeps idempotent financial mutations replayable but body-sensitive", async () => {
    const stored = {
      response_status: 201,
      response_body: { data: { id: "loan-payment-1" } },
      request_hash: null,
    };
    const client = {
      calls: [],
      async query(sql, params = []) {
        this.calls.push({ sql, params });
        if (sql.includes("SELECT response_status")) return { rows: stored.request_hash ? [stored] : [] };
        if (sql.includes("INSERT INTO idempotency_keys")) {
          stored.request_hash = params[3];
          stored.response_status = params[4];
          stored.response_body = JSON.parse(params[5]);
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    };
    const req = {
      user: { id: "admin-1" },
      headers: { "idempotency-key": "pay-1" },
      body: { penaltyId: "penalty-1", amount: 100 },
    };

    const first = await runIdempotent(client, req, "POST /api/penalties/pay", async () => ({
      status: 201,
      body: { data: { id: "loan-payment-1" } },
    }));
    const replay = await runIdempotent(client, req, "POST /api/penalties/pay", async () => {
      throw new Error("work should not run on replay");
    });

    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({ replayed: true, status: 201, body: { data: { id: "loan-payment-1" } } });

    await expect(runIdempotent(client, {
      ...req,
      body: { penaltyId: "penalty-1", amount: 101 },
    }, "POST /api/penalties/pay", async () => ({}))).rejects.toMatchObject({
      status: 409,
      message: "Idempotency key has already been used with a different request body",
    });
  });

  it("keeps monthly closing ledger sums reversal-aware for all financial buckets", async () => {
    let sqlText = "";
    const sums = await getClosingLedgerSums(async (sql) => {
      sqlText = sql;
      return {
        rows: [{
          savings_deposit: "15000",
          savings_interest: "2250",
          new_loan: "5100",
          original_loan: "5000",
          top_up: "0",
          converted_penalty_loan: "100",
          principal_repaid: "1000",
          loan_interest_assessed: "750",
          interest_repaid: "150",
          common_interest_assessed: "3000",
          common_interest_paid: "75",
          penalties_assessed: "100",
          penalties_paid: "0",
          penalties_converted: "100",
        }],
      };
    }, {
      cycleId: "cycle-1",
      cycleMemberId: "cycle-member-1",
      cycleMonthId: "month-2",
      scope: "previous",
    });

    for (const type of [
      "SAVINGS_DEPOSIT",
      "SAVINGS_INTEREST",
      "LOAN_DISBURSEMENT",
      "LOAN_TOP_UP",
      "CONVERTED_PENALTY_LOAN",
      "PRINCIPAL_REPAYMENT",
      "LOAN_INTEREST_ASSESSMENT",
      "LOAN_INTEREST_REPAYMENT",
      "COMMON_INTEREST_ASSESSMENT",
      "COMMON_INTEREST_PAYMENT",
      "PENALTY_ASSESSMENT",
      "PENALTY_PAYMENT",
    ]) {
      expect(sqlText).toContain(type);
    }
    expect(sqlText).toContain("LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id");
    expect(sqlText).toContain("rev.id IS NULL");
    expect(sqlText).toContain("lt.is_reversal = FALSE");
    expect(sums).toMatchObject({
      savingsDeposit: 15000,
      savingsInterest: 2250,
      newLoan: 5100,
      convertedPenaltyLoan: 100,
      principalRepaid: 1000,
      penaltiesConverted: 100,
    });
  });

  it("keeps ledger reversals immutable and audit-reasoned", async () => {
    const original = {
      id: "ledger-1",
      cycle_id: "cycle-1",
      cycle_month_id: "month-1",
      cycle_member_id: "member-1",
      transaction_type: "PENALTY_ASSESSMENT",
      amount: 100,
      source_table: "penalties",
      source_id: "penalty-1",
      is_reversal: false,
    };
    const client = {
      insertedEntries: [],
      async query(sql, params = []) {
        if (sql.includes("SELECT * FROM ledger_transactions WHERE id = $1")) return { rows: [original] };
        if (sql.includes("SELECT id FROM ledger_transactions WHERE reversed_transaction_id = $1")) return { rows: [] };
        if (sql.includes("SELECT * FROM ledger_entries WHERE ledger_transaction_id = $1")) {
          return {
            rows: [
              { id: "entry-1", cycle_id: "cycle-1", cycle_member_id: "member-1", account_type: "PENALTY_RECEIVABLE", debit: 100, credit: 0 },
              { id: "entry-2", cycle_id: "cycle-1", cycle_member_id: "member-1", account_type: "PENALTY_INCOME", debit: 0, credit: 100 },
            ],
          };
        }
        if (sql.includes("INSERT INTO ledger_transactions")) {
          return {
            rows: [{
              id: "reversal-1",
              transaction_type: "REVERSAL",
              amount: params[3],
              reversed_transaction_id: params[7],
              reversal_reason: params[8],
              is_reversal: true,
            }],
          };
        }
        if (sql.includes("INSERT INTO ledger_entries")) {
          this.insertedEntries.push({ accountType: params[3], debit: params[4], credit: params[5] });
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    };

    await expect(reverseLedgerTransaction(client, {
      ledgerTransactionId: "ledger-1",
      reason: "",
    })).rejects.toMatchObject({ status: 400, message: "Reversal reason is required" });

    const result = await reverseLedgerTransaction(client, {
      ledgerTransactionId: "ledger-1",
      reason: "Approved correction",
      postedBy: "admin-1",
    });

    expect(result.reversal).toMatchObject({
      transaction_type: "REVERSAL",
      reversed_transaction_id: "ledger-1",
      reversal_reason: "Approved correction",
      is_reversal: true,
    });
    expect(client.insertedEntries).toEqual([
      { accountType: "PENALTY_RECEIVABLE", debit: 0, credit: 100 },
      { accountType: "PENALTY_INCOME", debit: 100, credit: 0 },
    ]);
  });
});
