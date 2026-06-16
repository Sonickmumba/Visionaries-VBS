import { PassThrough, Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
  clientQuery: vi.fn(),
}));

vi.mock("../src/db/pool.js", () => ({
  query: mocks.query,
  withTransaction: mocks.withTransaction,
  pool: {},
}));

vi.mock("../src/middleware/auth.js", () => ({
  requireAuth(req, _res, next) {
    req.user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@example.com",
      role: req.headers["x-test-role"] || "ADMIN",
      is_active: true,
    };
    next();
  },
  requireRole(...roles) {
    return (req, _res, next) => {
      if (!roles.includes(req.user.role)) {
        const error = new Error("Forbidden");
        error.status = 403;
        return next(error);
      }
      return next();
    };
  },
}));

const { app } = await import("../src/app.js");

function inject({ method = "GET", url, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = new Readable({
      read() {
        this.push(payload);
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = {
      host: "localhost",
      ...(body ? { "content-type": "application/json", "content-length": String(payload.length) } : {}),
      ...headers,
    };
    req.socket = new PassThrough();
    req.socket.remoteAddress = "127.0.0.1";
    req.connection = req.socket;

    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[String(name).toLowerCase()] = value;
      },
      getHeader(name) {
        return this.headers[String(name).toLowerCase()];
      },
      removeHeader(name) {
        delete this.headers[String(name).toLowerCase()];
      },
      write(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        return true;
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed = text;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = text;
        }
        resolve({ status: this.statusCode, body: parsed, text, headers: this.headers });
      },
      on(event, handler) {
        if (event === "error") this._errorHandler = handler;
      },
      once(event, handler) {
        this.on(event, handler);
      },
      emit(event, error) {
        if (event === "error") {
          if (this._errorHandler) this._errorHandler(error);
          reject(error);
        }
      },
    };

    app.handle(req, res, reject);
  });
}

const ids = {
  cycle: "11111111-1111-4111-8111-111111111111",
  month: "22222222-2222-4222-8222-222222222222",
  member: "33333333-3333-4333-8333-333333333333",
  user: "44444444-4444-4444-8444-444444444444",
  cycleMember: "55555555-5555-4555-8555-555555555555",
  declaration: "66666666-6666-4666-8666-666666666666",
  loanRequest: "77777777-7777-4777-8777-777777777777",
  loanDisbursement: "88888888-8888-4888-8888-888888888888",
  penaltyType: "99999999-9999-4999-8999-999999999999",
  penalty: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

function okRows(rows = []) {
  return { rows };
}

function sqlCallsContaining(text) {
  return [...mocks.clientQuery.mock.calls, ...mocks.query.mock.calls].filter((call) => String(call[0]).includes(text));
}

describe("QA-001 end-to-end admin workflow", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.clientQuery.mockReset();
    mocks.withTransaction.mockReset();
    mocks.withTransaction.mockImplementation(async (work) => work({ query: mocks.clientQuery }));
  });

  it("runs the admin path from cycle setup through traceable financial postings and reports", async () => {
    const cycle = {
      id: ids.cycle,
      name: "2026 Main Cycle",
      status: "DRAFT",
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      savings_cap: "30000",
      minimum_borrowing_amount: "20000",
      savings_interest_rate: "0.15",
      loan_interest_rate: "0.15",
      common_interest_rate: "0.15",
      social_fund_amount: "240",
      membership_fee_amount: "80",
      declaration_start_day: 28,
      declaration_end_day: 3,
      payout_start_day: 4,
      payout_end_day: 5,
    };
    const month = {
      id: ids.month,
      cycle_id: ids.cycle,
      status: "OPEN",
      month_number: 1,
      payout_window_start: "2020-01-04",
      payout_window_end: "2030-01-05",
      declaration_window_start: "2020-01-28",
      declaration_window_end: "2030-02-03",
    };
    const member = {
      id: ids.member,
      user_id: ids.user,
      first_name: "Mary",
      last_name: "Phiri",
      member_code: "M001",
    };
    const cycleMember = {
      id: ids.cycleMember,
      cycle_id: ids.cycle,
      member_id: ids.member,
      status: "ACTIVE",
    };
    const declaration = {
      id: ids.declaration,
      cycle_id: ids.cycle,
      cycle_month_id: ids.month,
      cycle_member_id: ids.cycleMember,
      status: "SUBMITTED",
      savings_amount: "15000",
      loan_request_amount: "5000",
      loan_top_up_amount: "0",
      principal_repayment_amount: "1000",
      loan_interest_repayment_amount: "150",
      common_interest_payment_amount: "75",
      other_obligation_amount: "0",
    };

    mocks.clientQuery
      .mockResolvedValueOnce(okRows([cycle]))
      .mockResolvedValueOnce(okRows([]));
    const createCycle = await inject({
      method: "POST",
      url: "/api/cycles",
      body: {
        name: cycle.name,
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        savingsCap: 30000,
        minimumBorrowingAmount: 20000,
        savingsInterestRate: 0.15,
        loanInterestRate: 0.15,
        commonInterestRate: 0.15,
        socialFundAmount: 240,
        membershipFeeAmount: 80,
        declarationStartDay: 28,
        declarationEndDay: 3,
        payoutStartDay: 4,
        payoutEndDay: 5,
      },
    });
    expect(createCycle.status).toBe(201);

    mocks.clientQuery
      .mockResolvedValueOnce(okRows([cycle]))
      .mockResolvedValueOnce(okRows([month]))
      .mockResolvedValueOnce(okRows([]));
    const generateMonths = await inject({ method: "POST", url: `/api/cycles/${ids.cycle}/months/generate` });
    expect(generateMonths.status).toBe(201);
    expect(generateMonths.body.data).toHaveLength(1);

    mocks.clientQuery
      .mockResolvedValueOnce(okRows([cycle]))
      .mockResolvedValueOnce(okRows([{ count: 1 }]))
      .mockResolvedValueOnce(okRows([{ ...cycle, status: "ACTIVE" }]))
      .mockResolvedValueOnce(okRows([]));
    const activateCycle = await inject({ method: "POST", url: `/api/cycles/${ids.cycle}/activate` });
    expect(activateCycle.status).toBe(200);
    expect(activateCycle.body.data.status).toBe("ACTIVE");

    mocks.clientQuery
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: ids.user }]))
      .mockResolvedValueOnce(okRows([member]));
    const createMember = await inject({
      method: "POST",
      url: "/api/members",
      body: {
        firstName: "Mary",
        lastName: "Phiri",
        email: "mary@example.com",
        memberCode: "M001",
        temporaryPassword: "Password123!",
      },
    });
    expect(createMember.status).toBe(201);

    mocks.clientQuery
      .mockResolvedValueOnce(okRows([{ id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.member }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([cycleMember]))
      .mockResolvedValueOnce(okRows([]));
    const enrollMember = await inject({
      method: "POST",
      url: `/api/cycles/${ids.cycle}/members`,
      body: { memberId: ids.member },
    });
    expect(enrollMember.status).toBe(201);
    expect(enrollMember.body.data.id).toBe(ids.cycleMember);

    mocks.query
      .mockResolvedValueOnce(okRows([{ id: ids.month, cycle_id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember, cycle_id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.month, status: "OPEN" }]))
      .mockResolvedValueOnce(okRows([month]));
    mocks.clientQuery
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([declaration]))
      .mockResolvedValueOnce(okRows([]));
    const submitDeclaration = await inject({
      method: "POST",
      url: "/api/declarations",
      body: {
        cycleId: ids.cycle,
        cycleMonthId: ids.month,
        cycleMemberId: ids.cycleMember,
        savingsAmount: 15000,
        loanRequestAmount: 5000,
        principalRepaymentAmount: 1000,
        loanInterestRepaymentAmount: 150,
        commonInterestPaymentAmount: 75,
      },
    });
    expect(submitDeclaration.status).toBe(201);
    expect(submitDeclaration.body.data.status).toBe("SUBMITTED");

    mocks.query.mockResolvedValueOnce(okRows([{ status: "OPEN" }]));
    mocks.clientQuery
      .mockResolvedValueOnce(okRows([declaration]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ savings_cap: "30000" }]))
      .mockResolvedValueOnce(okRows([{ total: "0" }]))
      .mockResolvedValueOnce(okRows([{ id: "ledger-savings", transaction_type: "SAVINGS_DEPOSIT", amount: "15000" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: "ledger-principal", transaction_type: "PRINCIPAL_REPAYMENT", amount: "1000" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: "ledger-interest", transaction_type: "LOAN_INTEREST_REPAYMENT", amount: "150" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: "repayment-1" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: "ledger-common-payment", transaction_type: "COMMON_INTEREST_PAYMENT", amount: "75" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: ids.loanRequest, status: "PENDING", requested_amount: "5000", origin_type: "ORIGINAL_LOAN" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ ...declaration, status: "APPROVED" }]))
      .mockResolvedValueOnce(okRows([]));
    const approveDeclaration = await inject({
      method: "POST",
      url: `/api/declarations/${ids.declaration}/approve-inputs`,
      body: { reason: "QA workflow declaration approval" },
    });
    expect(approveDeclaration.status).toBe(200);
    expect(approveDeclaration.body.data.status).toBe("APPROVED");

    mocks.clientQuery
      .mockResolvedValueOnce(okRows([{ id: ids.loanRequest, status: "PENDING", requested_amount: "5000" }]))
      .mockResolvedValueOnce(okRows([{ id: ids.loanRequest, status: "APPROVED", approved_amount: "5000" }]))
      .mockResolvedValueOnce(okRows([]));
    const approveLoan = await inject({
      method: "POST",
      url: `/api/loans/requests/${ids.loanRequest}/approve`,
      body: { approvedAmount: 5000 },
    });
    expect(approveLoan.status).toBe(200);
    expect(approveLoan.body.data.status).toBe("APPROVED");

    mocks.query
      .mockResolvedValueOnce(okRows([{ id: ids.month, cycle_id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember, cycle_id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.month, status: "OPEN" }]));
    mocks.clientQuery
      .mockResolvedValueOnce(okRows([{ id: ids.loanRequest, status: "APPROVED", cycle_id: ids.cycle, cycle_month_id: ids.month, cycle_member_id: ids.cycleMember, origin_type: "ORIGINAL_LOAN", approved_amount: "5000" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: "ledger-loan", transaction_type: "LOAN_DISBURSEMENT", amount: "5000" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: ids.loanDisbursement, loan_request_id: ids.loanRequest, origin_type: "ORIGINAL_LOAN", amount: "5000", ledger_transaction_id: "ledger-loan" }]))
      .mockResolvedValueOnce(okRows([]));
    const disburseLoan = await inject({
      method: "POST",
      url: "/api/loans/disbursements",
      body: {
        loanRequestId: ids.loanRequest,
        cycleId: ids.cycle,
        cycleMonthId: ids.month,
        cycleMemberId: ids.cycleMember,
        originType: "ORIGINAL_LOAN",
        amount: 5000,
      },
    });
    expect(disburseLoan.status).toBe(201);
    expect(disburseLoan.body.data.ledger_transaction_id).toBe("ledger-loan");

    mocks.query
      .mockResolvedValueOnce(okRows([{ id: ids.month, cycle_id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember, cycle_id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.month, status: "OPEN" }]));
    mocks.clientQuery
      .mockResolvedValueOnce(okRows([{ id: ids.penaltyType, amount: "100", code: "FAILURE_TO_DECLARE" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: "ledger-penalty", transaction_type: "PENALTY_ASSESSMENT", amount: "100" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([{ id: ids.penalty, amount_assessed: "100", status: "ASSESSED" }]))
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]));
    const assessPenalty = await inject({
      method: "POST",
      url: "/api/penalties",
      body: {
        cycleId: ids.cycle,
        cycleMonthId: ids.month,
        cycleMemberId: ids.cycleMember,
        penaltyTypeId: ids.penaltyType,
      },
    });
    expect(assessPenalty.status).toBe(201);
    expect(assessPenalty.body.data.status).toBe("ASSESSED");

    mocks.query
      .mockResolvedValueOnce(okRows([{ ...cycle, status: "ACTIVE" }]))
      .mockResolvedValueOnce(okRows([month]))
      .mockResolvedValueOnce(okRows([{ savings: "15000", loans: "5000", common_interest: "0", penalties: "100" }]))
      .mockResolvedValueOnce(okRows([{ count: 0 }]))
      .mockResolvedValueOnce(okRows([{ total: 1, approved: 1, awaiting_review: 0, missed: 0, cancelled: 0, current_month_approved: 1, current_month_missed: 0 }]));
    const dashboard = await inject({ url: "/api/reports/dashboard" });
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.totals.savings).toBe("15000");
    expect(dashboard.body.data.declarationStats.approved).toBe(1);

    mocks.query
      .mockResolvedValueOnce(okRows([{ cycle_member_id: ids.cycleMember, first_name: "Mary", last_name: "Phiri" }]))
      .mockResolvedValueOnce(okRows([
        { id: "ledger-savings", transaction_type: "SAVINGS_DEPOSIT", amount: "15000", source_table: "declarations", source_id: ids.declaration },
        { id: "ledger-loan", transaction_type: "LOAN_DISBURSEMENT", amount: "5000", source_table: null, source_id: null },
        { id: "ledger-penalty", transaction_type: "PENALTY_ASSESSMENT", amount: "100", source_table: "penalties", source_id: ids.penalty },
      ]))
      .mockResolvedValueOnce(okRows([{ id: "snapshot-1", cycle_member_id: ids.cycleMember }]))
      .mockResolvedValueOnce(okRows([{ savings_principal: "15000", borrowed: "5000", penalties: "100" }]));
    const statement = await inject({ url: `/api/reports/member-statement/${ids.cycleMember}` });
    expect(statement.status).toBe(200);
    expect(statement.body.data.transactions.map((tx) => tx.transaction_type)).toEqual([
      "SAVINGS_DEPOSIT",
      "LOAN_DISBURSEMENT",
      "PENALTY_ASSESSMENT",
    ]);

    const ledgerTransactionTypes = sqlCallsContaining("INSERT INTO ledger_transactions").map((call) => call[1]?.[3]).filter(Boolean);
    expect(ledgerTransactionTypes).toEqual(expect.arrayContaining([
      "SAVINGS_DEPOSIT",
      "PRINCIPAL_REPAYMENT",
      "LOAN_INTEREST_REPAYMENT",
      "COMMON_INTEREST_PAYMENT",
      "LOAN_DISBURSEMENT",
      "PENALTY_ASSESSMENT",
    ]));
    expect(sqlCallsContaining("INSERT INTO loan_requests")).toHaveLength(1);
    expect(sqlCallsContaining("INSERT INTO loan_disbursements")).toHaveLength(1);
    expect(sqlCallsContaining("INSERT INTO penalties")).toHaveLength(1);
    expect(sqlCallsContaining("INSERT INTO audit_logs").length).toBeGreaterThanOrEqual(8);
  });
});
