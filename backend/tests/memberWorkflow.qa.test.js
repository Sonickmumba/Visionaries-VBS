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
      id: "00000000-0000-4000-8000-000000000002",
      email: "mary@example.com",
      role: req.headers["x-test-role"] || "MEMBER",
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
      "x-test-role": "MEMBER",
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
  user: "00000000-0000-4000-8000-000000000002",
  cycle: "11111111-1111-4111-8111-111111111111",
  month: "22222222-2222-4222-8222-222222222222",
  member: "33333333-3333-4333-8333-333333333333",
  cycleMember: "44444444-4444-4444-8444-444444444444",
  otherCycleMember: "55555555-5555-4555-8555-555555555555",
  declaration: "66666666-6666-4666-8666-666666666666",
};

function okRows(rows = []) {
  return { rows };
}

describe("QA-002 end-to-end member workflow", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.clientQuery.mockReset();
    mocks.withTransaction.mockReset();
    mocks.withTransaction.mockImplementation(async (work) => work({ query: mocks.clientQuery }));
  });

  it("runs the member journey and keeps all data scoped to the logged-in member", async () => {
    const member = {
      id: ids.member,
      user_id: ids.user,
      first_name: "Mary",
      last_name: "Phiri",
      member_code: "M001",
    };
    const membership = {
      id: ids.cycleMember,
      cycle_id: ids.cycle,
      member_id: ids.member,
      status: "ACTIVE",
      cycle_name: "2026 Main Cycle",
      cycle_status: "ACTIVE",
      minimum_borrowing_amount: "20000",
      savings_cap: "30000",
      savings_interest_rate: "0.15",
      loan_interest_rate: "0.15",
      common_interest_rate: "0.15",
    };
    const month = {
      id: ids.month,
      cycle_id: ids.cycle,
      status: "DECLARATION_PERIOD",
      declaration_window_start: "2020-01-28",
      declaration_window_end: "2030-02-03",
      month_number: 1,
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

    mocks.query
      .mockResolvedValueOnce(okRows([member]))
      .mockResolvedValueOnce(okRows([membership]));
    const me = await inject({ url: "/api/auth/me" });
    expect(me.status).toBe(200);
    expect(me.body.member.id).toBe(ids.member);
    expect(me.body.cycleMemberships[0].id).toBe(ids.cycleMember);

    mocks.query
      .mockResolvedValueOnce(okRows([{ id: ids.month, cycle_id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember, cycle_id: ids.cycle }]))
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember }]))
      .mockResolvedValueOnce(okRows([{ id: ids.month, status: "DECLARATION_PERIOD" }]))
      .mockResolvedValueOnce(okRows([month]));
    mocks.clientQuery
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([declaration]))
      .mockResolvedValueOnce(okRows([]));
    const submitted = await inject({
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
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.cycle_member_id).toBe(ids.cycleMember);

    mocks.query
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember }]))
      .mockResolvedValueOnce(okRows([{
        cycle_member_id: ids.cycleMember,
        first_name: "Mary",
        last_name: "Phiri",
        cycle_name: "2026 Main Cycle",
      }]))
      .mockResolvedValueOnce(okRows([
        { id: "tx-savings", transaction_type: "SAVINGS_DEPOSIT", amount: "15000", source_table: "declarations", source_id: ids.declaration },
        { id: "tx-loan", transaction_type: "LOAN_DISBURSEMENT", amount: "5000" },
        { id: "tx-penalty", transaction_type: "PENALTY_ASSESSMENT", amount: "100" },
      ]))
      .mockResolvedValueOnce(okRows([{ id: "snapshot-1", cycle_member_id: ids.cycleMember, month_number: 1 }]))
      .mockResolvedValueOnce(okRows([{
        savings_principal: "15000",
        savings_interest: "2250",
        borrowed: "5000",
        principal_repaid: "1000",
        loan_interest_assessed: "750",
        loan_interest_repaid: "150",
        common_interest: "3000",
        common_interest_paid: "75",
        penalties: "100",
        penalties_paid: "0",
      }]));
    const statement = await inject({ url: `/api/reports/member-statement/${ids.cycleMember}` });
    expect(statement.status).toBe(200);
    expect(statement.body.data.transactions).toHaveLength(3);
    expect(statement.body.data.totals.savings_principal).toBe("15000");
    expect(statement.body.data.transactions.every((tx) => tx.source_table !== "other_members")).toBe(true);

    mocks.query
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember }]))
      .mockResolvedValueOnce(okRows([{
        cycle_member_id: ids.cycleMember,
        cycle_id: ids.cycle,
        savings_cap: "30000",
        first_name: "Mary",
        last_name: "Phiri",
      }]))
      .mockResolvedValueOnce(okRows([
        { id: "tx-savings", transaction_type: "SAVINGS_DEPOSIT", amount: "15000" },
        { id: "tx-interest", transaction_type: "SAVINGS_INTEREST", amount: "2250" },
      ]))
      .mockResolvedValueOnce(okRows([{
        savings_principal: "15000",
        savings_interest: "2250",
        social_fund_paid: "240",
        membership_fee_paid: "80",
      }]));
    const savings = await inject({ url: `/api/savings/member/${ids.cycleMember}` });
    expect(savings.status).toBe(200);
    expect(savings.body.totals.savings_cap_remaining).toBe(15000);

    mocks.query
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember }]))
      .mockResolvedValueOnce(okRows([{ id: "tx-loan", transaction_type: "LOAN_DISBURSEMENT", amount: "5000" }]))
      .mockResolvedValueOnce(okRows([{
        cumulative_borrowed: "5000",
        original_loans: "5000",
        top_ups: "0",
        converted_penalty_loans: "0",
        interest_assessed: "750",
        principal_repaid: "1000",
        interest_repaid: "150",
        outstanding_balance: "4600",
      }]));
    const loans = await inject({ url: `/api/loans/member/${ids.cycleMember}` });
    expect(loans.status).toBe(200);
    expect(loans.body.summary.outstanding_balance).toBe("4600");

    mocks.query
      .mockResolvedValueOnce(okRows([{ id: ids.cycleMember }]))
      .mockResolvedValueOnce(okRows([{ total: 1 }]))
      .mockResolvedValueOnce(okRows([{
        id: "penalty-1",
        penalty_name: "Failure to Declare",
        amount_assessed: "100",
        amount_paid: "0",
        outstanding_amount: "100",
        status: "ASSESSED",
      }]));
    const penalties = await inject({ url: `/api/penalties/member/${ids.cycleMember}` });
    expect(penalties.status).toBe(200);
    expect(penalties.body.data[0].outstanding_amount).toBe("100");

    mocks.query.mockResolvedValueOnce(okRows([]));
    const otherStatement = await inject({ url: `/api/reports/member-statement/${ids.otherCycleMember}` });
    expect(otherStatement.status).toBe(403);
    expect(otherStatement.body.error).toBe("You can only access your own cycle records");

    const adminDashboard = await inject({ url: "/api/reports/dashboard" });
    expect(adminDashboard.status).toBe(403);

    const approveLoan = await inject({
      method: "POST",
      url: "/api/loans/requests/77777777-7777-4777-8777-777777777777/approve",
      body: { approvedAmount: 5000 },
    });
    expect(approveLoan.status).toBe(403);
  });
});
