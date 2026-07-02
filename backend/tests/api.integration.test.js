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
      id: "00000000-0000-0000-0000-000000000001",
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
const { clearNotificationsForTests } = await import("../src/services/notificationService.js");

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

describe("API integration smoke tests", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.clientQuery.mockReset();
    mocks.withTransaction.mockReset();
    mocks.withTransaction.mockImplementation(async (work) => work({
      query: mocks.clientQuery,
    }));
    clearNotificationsForTests();
  });

  it("serves health checks without authentication", async () => {
    const response = await inject({ url: "/health" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.requestId).toBeTruthy();
  });

  it("blocks non-admin settings access", async () => {
    const response = await inject({
      url: "/api/settings/context",
      headers: { "x-test-role": "MEMBER" },
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Forbidden");
  });

  it("returns settings context for admins", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "u1", email: "admin@example.com", role: "ADMIN", is_active: true }] })
      .mockResolvedValueOnce({ rows: [{ id: "c1", name: "Main Cycle", status: "ACTIVE" }] })
      .mockResolvedValueOnce({ rows: [{ id: "c1", name: "Main Cycle", status: "ACTIVE", rounding_scale: 2, rounding_mode: "HALF_UP" }] })
      .mockResolvedValueOnce({ rows: [{ id: "p1", code: "FAILURE_TO_DECLARE", amount: 100 }] })
      .mockResolvedValueOnce({ rows: [{ key: "notification_preferences", value: { emailEnabled: false } }] });

    const response = await inject({ url: "/api/settings/context" });

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.activeCycle.name).toBe("Main Cycle");
    expect(response.body.data.penaltyTypes[0].code).toBe("FAILURE_TO_DECLARE");
    expect(response.body.data.appSettings.notification_preferences.emailEnabled).toBe(false);
    expect(response.body.data.roundingModes).toContain("HALF_UP");
  });

  it("returns recent notifications for authenticated users", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: "11111111-1111-4111-8111-111111111111",
        type: "DECLARATION_SUBMITTED",
        title: "Declaration submitted",
        message: "A member submitted a declaration for group review.",
        audience: "ALL",
        severity: "INFO",
        action_url: "reports:declarations",
        action_target: { adminPage: "declarations", memberPage: "my-reports", report: "declarations" },
        metadata: { savingsAmount: 15000 },
        created_at: "2026-06-22T10:00:00.000Z",
        read_at: null,
      }],
    });

    const response = await inject({
      url: "/api/notifications?limit=10",
      headers: { "x-test-role": "MEMBER" },
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.unreadCount).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      type: "DECLARATION_SUBMITTED",
      title: "Declaration submitted",
      actionUrl: "reports:declarations",
    });
  });

  it("marks notifications as read for the authenticated user", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ unread_count: 0 }] });

    const response = await inject({
      method: "POST",
      url: "/api/notifications/read",
      headers: { "x-test-role": "MEMBER" },
      body: { notificationIds: ["11111111-1111-4111-8111-111111111111"] },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ read: 1, unreadCount: 0 });
    expect(mocks.query.mock.calls[0][0]).toContain("notification_read_receipts");
  });

  it("archives expired notifications for administrators", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [], rowCount: 2 });

    const response = await inject({
      method: "POST",
      url: "/api/notifications/archive-expired",
      body: { reason: "Monthly retention run" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ archived: 2 });
    expect(mocks.query.mock.calls[0][0]).toContain("archived_at = now()");
  });

  it("invites users through settings with an audit trail", async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "11111111-1111-4111-8111-111111111111",
          email: "new.member@example.com",
          role: "MEMBER",
          is_active: false,
          email_verified_at: null,
          email_verification_sent_at: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/settings/users",
      body: {
        email: "new.member@example.com",
        role: "MEMBER",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe("new.member@example.com");
    expect(mocks.clientQuery.mock.calls[1][0]).toContain("INSERT INTO users");
    expect(mocks.clientQuery.mock.calls[2][0]).toContain("INSERT INTO auth_email_tokens");
    expect(mocks.clientQuery.mock.calls[4][0]).toContain("INSERT INTO audit_logs");
  });

  it("prevents disabling the last active administrator", async () => {
    const admin = {
      id: "00000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      role: "ADMIN",
      is_active: true,
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [{ id: admin.id }] });

    const response = await inject({
      method: "PATCH",
      url: `/api/settings/users/${admin.id}`,
      body: { isActive: false, reason: "Testing admin guard" },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("You cannot deactivate your own administrator account");
  });

  it("prevents duplicate penalty type codes per cycle", async () => {
    mocks.clientQuery.mockResolvedValueOnce({ rows: [{ id: "existing-type" }] });

    const response = await inject({
      method: "POST",
      url: "/api/settings/penalty-types",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        code: "failure to declare",
        name: "Failure to Declare",
        amount: 100,
        isConvertibleToLoan: true,
        isActive: true,
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Penalty type code already exists for this cycle");
  });

  it("updates draft rounding policy with an audit trail", async () => {
    const before = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "DRAFT",
      rounding_scale: 2,
      rounding_mode: "HALF_UP",
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [before] })
      .mockResolvedValueOnce({ rows: [{ ...before, rounding_scale: 3, rounding_mode: "DOWN" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "PATCH",
      url: `/api/settings/cycles/${before.id}/rounding-policy`,
      body: {
        roundingScale: 3,
        roundingMode: "down",
        reason: "Committee approved rounding precision",
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.rounding_mode).toBe("DOWN");
    expect(mocks.clientQuery.mock.calls[2][0]).toContain("INSERT INTO audit_logs");
  });

  it("validates override reasons through the API", async () => {
    const response = await inject({
      method: "POST",
      url: "/api/overrides",
      body: {
        targetTable: "common_interest_allocations",
        targetId: "11111111-1111-4111-8111-111111111111",
        fieldName: "final_charge",
        overriddenValue: 25,
        reason: "",
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });

  it("blocks members from audit trail access", async () => {
    const response = await inject({
      url: "/api/audit",
      headers: { "x-test-role": "MEMBER" },
    });

    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("lists filtered audit logs with pagination metadata", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          id: "audit-1",
          action: "OVERRIDE",
          entity_table: "common_interest_allocations",
          reason: "Committee approved",
          actor_email: "admin@example.com",
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "override-1", reason: "Committee approved" }] })
      .mockResolvedValueOnce({ rows: [{ id: "reversal-1", reversal_reason: "Correction" }] });

    const response = await inject({
      url: "/api/audit?action=OVERRIDE&entityTable=common_interest_allocations&reason=committee&page=2&limit=10",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.overrides).toHaveLength(1);
    expect(response.body.reversals).toHaveLength(1);
    expect(response.body.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(mocks.query.mock.calls[0][0]).toContain("COUNT(*)::int AS count");
    expect(mocks.query.mock.calls[1][0]).toContain("LIMIT $4 OFFSET $5");
    expect(mocks.query.mock.calls[1][1]).toEqual(["OVERRIDE", "common_interest_allocations", "%committee%", 10, 10]);
    expect(mocks.query.mock.calls[2][0]).toContain("o.target_table = $1");
  });

  it("exports audit logs as CSV", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: "audit-1", action: "POST", entity_table: "ledger_transactions" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({ url: "/api/audit?format=csv" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("id,action,entity_table");
    expect(response.text).toContain("\"POST\"");
  });

  it("supports member list status filters and pagination metadata", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: "member-1", first_name: "Mary", is_active: true, active_cycle_member_id: "cm-1", active_cycle_member_status: "ACTIVE" }] });

    const response = await inject({ url: "/api/members?status=active&page=2&limit=5" });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ active_cycle_member_id: "cm-1", active_cycle_member_status: "ACTIVE" });
    expect(response.body.pagination).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
    expect(mocks.query.mock.calls[0][1]).toEqual(["%%", true]);
    expect(mocks.query.mock.calls[1][0]).toContain("acm.status = 'ACTIVE'");
    expect(mocks.query.mock.calls[1][0]).not.toContain("ac.status = 'ACTIVE'");
  });

  it("blocks members from opening another member profile", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ id: "member-1", user_id: "someone-else", first_name: "Mary" }],
    });

    const response = await inject({
      url: "/api/members/11111111-1111-4111-8111-111111111111",
      headers: { "x-test-role": "MEMBER" },
    });

    expect(response.status).toBe(403);
  });

  it("enrolls a member through the members endpoint with audit logging", async () => {
    const cycleMember = {
      id: "33333333-3333-4333-8333-333333333333",
      cycle_id: "11111111-1111-4111-8111-111111111111",
      member_id: "22222222-2222-4222-8222-222222222222",
      status: "ACTIVE",
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ id: cycleMember.cycle_id }] })
      .mockResolvedValueOnce({ rows: [{ id: cycleMember.member_id }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [cycleMember] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/members/enroll",
      body: { cycleId: cycleMember.cycle_id, memberId: cycleMember.member_id },
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject(cycleMember);
    expect(mocks.clientQuery.mock.calls[3][0]).toContain("ON CONFLICT");
    expect(mocks.clientQuery.mock.calls[4][0]).toContain("INSERT INTO audit_logs");
  });

  it("enrolls a member through the canonical cycle endpoint", async () => {
    const cycleMember = {
      id: "33333333-3333-4333-8333-333333333333",
      cycle_id: "11111111-1111-4111-8111-111111111111",
      member_id: "22222222-2222-4222-8222-222222222222",
      status: "ACTIVE",
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ id: cycleMember.cycle_id }] })
      .mockResolvedValueOnce({ rows: [{ id: cycleMember.member_id }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [cycleMember] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: `/api/cycles/${cycleMember.cycle_id}/members`,
      body: { memberId: cycleMember.member_id },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("ACTIVE");
    expect(mocks.withTransaction).toHaveBeenCalledOnce();
  });

  it("updates cycle participation status", async () => {
    const before = {
      id: "33333333-3333-4333-8333-333333333333",
      cycle_id: "11111111-1111-4111-8111-111111111111",
      member_id: "22222222-2222-4222-8222-222222222222",
      status: "ACTIVE",
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [before] })
      .mockResolvedValueOnce({ rows: [{ ...before, status: "INACTIVE", left_at: "2026-06-07" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "PATCH",
      url: `/api/cycles/${before.cycle_id}/members/${before.id}`,
      body: { status: "INACTIVE", reason: "Member paused participation" },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("INACTIVE");
  });

  it("returns cycle months through the canonical endpoint", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "month-1", month_number: 1 }] });

    const response = await inject({ url: "/api/cycles/11111111-1111-4111-8111-111111111111/months" });

    expect(response.status).toBe(200);
    expect(response.body.data[0].month_number).toBe(1);
  });

  it("requires an audit reason for active cycle critical rule changes", async () => {
    mocks.clientQuery.mockResolvedValueOnce({
      rows: [{
        id: "11111111-1111-4111-8111-111111111111",
        status: "ACTIVE",
        savings_cap: 30000,
        minimum_borrowing_amount: 20000,
        savings_interest_rate: 0.15,
        loan_interest_rate: 0.15,
        common_interest_rate: 0.15,
        social_fund_amount: 240,
        membership_fee_amount: 80,
        declaration_start_day: 28,
        declaration_end_day: 3,
        payout_start_day: 4,
        payout_end_day: 5,
        start_date: "2026-01-01",
        end_date: "2026-12-31",
      }],
    });

    const response = await inject({
      method: "PATCH",
      url: "/api/cycles/11111111-1111-4111-8111-111111111111",
      body: { savingsCap: 35000 },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Changing critical rules on a non-draft cycle requires an audit reason");
  });

  it("blocks cycle activation until months are generated", async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ id: "11111111-1111-4111-8111-111111111111", status: "DRAFT" }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const response = await inject({
      method: "POST",
      url: "/api/cycles/11111111-1111-4111-8111-111111111111/activate",
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Generate cycle months before activating the cycle");
  });

  it("returns an empty declaration queue when cycle and month do not match", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      url: "/api/declarations/queue?cycleMonthId=11111111-1111-4111-8111-111111111111&cycleId=22222222-2222-4222-8222-222222222222",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ cycleMonth: null, declarations: [], missed: [] });
  });

  it("returns 404 for missing declaration detail", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      url: "/api/declarations/11111111-1111-4111-8111-111111111111",
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Declaration not found");
  });

  it("blocks resubmitting an approved declaration", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "month-1", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "member-1", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "month-1", status: "OPEN" }] })
      .mockResolvedValueOnce({
        rows: [{
          id: "month-1",
          declaration_window_start: "2020-01-01",
          declaration_window_end: "2030-01-03",
        }],
      });
    mocks.clientQuery.mockResolvedValueOnce({ rows: [{ id: "decl-1", status: "APPROVED" }] });

    const response = await inject({
      method: "POST",
      url: "/api/declarations",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        cycleMemberId: "33333333-3333-4333-8333-333333333333",
        savingsAmount: 100,
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("This declaration is closed and cannot be replaced by a new submission");
  });

  it("returns savings activity with cap progress totals", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          cycle_member_id: "33333333-3333-4333-8333-333333333333",
          cycle_id: "11111111-1111-4111-8111-111111111111",
          savings_cap: 30000,
          first_name: "Mary",
          last_name: "Phiri",
          member_code: "M001",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "ledger-1",
          transaction_type: "SAVINGS_DEPOSIT",
          amount: "1000",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          savings_principal: "1000",
          savings_interest: "150",
          social_fund_paid: "240",
          membership_fee_paid: "80",
        }],
      });

    const response = await inject({
      url: "/api/savings/member/33333333-3333-4333-8333-333333333333",
    });

    expect(response.status).toBe(200);
    expect(response.body.data[0].transaction_type).toBe("SAVINGS_DEPOSIT");
    expect(response.body.member.first_name).toBe("Mary");
    expect(response.body.totals.savings_principal).toBe("1000");
    expect(response.body.totals.savings_cap).toBe(30000);
    expect(response.body.totals.savings_cap_remaining).toBe(29000);
  });

  it("excludes reversed social fund and membership payments from savings posting context", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          id: "11111111-1111-4111-8111-111111111111",
          savings_cap: 30000,
          social_fund_amount: 240,
          membership_fee_amount: 80,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "22222222-2222-4222-8222-222222222222", month_number: 1, status: "OPEN" }],
      })
      .mockResolvedValueOnce({
        rows: [{
          cycle_member_id: "33333333-3333-4333-8333-333333333333",
          first_name: "Karen",
          last_name: "Chileshe",
          social_fund_paid: false,
          membership_fee_paid: false,
        }],
      });

    const response = await inject({ url: "/api/savings/posting-context" });

    expect(response.status).toBe(200);
    expect(response.body.data.members[0]).toMatchObject({
      first_name: "Karen",
      social_fund_paid: false,
      membership_fee_paid: false,
    });
    expect(mocks.query.mock.calls[2][0]).toContain("contribution_rev.reversed_transaction_id = contribution_lt.id");
    expect(mocks.query.mock.calls[2][0]).toContain("contribution_rev.id IS NULL");
    expect(mocks.query.mock.calls[2][0]).toContain("contribution_lt.is_reversal = FALSE");
  });

  it("posts one-time contributions through the canonical contributions API", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "33333333-3333-4333-8333-333333333333", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "OPEN" }] });
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "44444444-4444-4444-8444-444444444444",
          transaction_type: "SOCIAL_FUND_PAYMENT",
          amount: 240,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "55555555-5555-4555-8555-555555555555",
          contribution_type: "SOCIAL_FUND",
          amount: 240,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/contributions",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        cycleMemberId: "33333333-3333-4333-8333-333333333333",
        contributionType: "SOCIAL_FUND",
        amount: 240,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.contribution_type).toBe("SOCIAL_FUND");
    expect(mocks.clientQuery.mock.calls[1][0]).toContain("INSERT INTO ledger_transactions");
    expect(mocks.clientQuery.mock.calls[4][0]).toContain("INSERT INTO contribution_payments");
  });

  it("prevents duplicate one-time contributions", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "33333333-3333-4333-8333-333333333333", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "OPEN" }] });
    mocks.clientQuery.mockResolvedValueOnce({ rows: [{ id: "existing-contribution" }] });

    const response = await inject({
      method: "POST",
      url: "/api/contributions",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        cycleMemberId: "33333333-3333-4333-8333-333333333333",
        contributionType: "MEMBERSHIP_FEE",
        amount: 80,
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("This one-time contribution has already been recorded for the member in this cycle");
  });

  it("blocks contribution postings into locked months", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "33333333-3333-4333-8333-333333333333", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "LOCKED" }] });

    const response = await inject({
      method: "POST",
      url: "/api/contributions",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        cycleMemberId: "33333333-3333-4333-8333-333333333333",
        contributionType: "SOCIAL_FUND",
        amount: 240,
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("This month is locked. Use a reversal or authorized override workflow.");
    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });

  it("lists contribution activity through the canonical contributions API", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{
        id: "55555555-5555-4555-8555-555555555555",
        contribution_type: "MEMBERSHIP_FEE",
        amount: "80",
        transaction_type: "MEMBERSHIP_FEE_PAYMENT",
      }],
    });

    const response = await inject({
      url: "/api/contributions/member/33333333-3333-4333-8333-333333333333",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].transaction_type).toBe("MEMBERSHIP_FEE_PAYMENT");
  });

  it("blocks members from approving loan requests", async () => {
    const response = await inject({
      method: "POST",
      url: "/api/loans/requests/11111111-1111-4111-8111-111111111111/approve",
      headers: { "x-test-role": "MEMBER" },
      body: { approvedAmount: 1000 },
    });

    expect(response.status).toBe(403);
  });

  it("approves loan requests with an audit trail", async () => {
    const before = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "PENDING",
      requested_amount: "1000",
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [before] })
      .mockResolvedValueOnce({ rows: [{ ...before, status: "APPROVED", approved_amount: "1000" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/loans/requests/11111111-1111-4111-8111-111111111111/approve",
      body: { approvedAmount: 1000 },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("APPROVED");
    expect(mocks.clientQuery.mock.calls[2][0]).toContain("INSERT INTO audit_logs");
  });

  it("enforces the payout window for loan disbursements", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "33333333-3333-4333-8333-333333333333", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "OPEN" }] });
    mocks.clientQuery.mockResolvedValueOnce({
      rows: [{
        id: "22222222-2222-4222-8222-222222222222",
        status: "OPEN",
        payout_window_start: "2020-01-04",
        payout_window_end: "2020-01-05",
      }],
    });

    const response = await inject({
      method: "POST",
      url: "/api/loans/disbursements",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        cycleMemberId: "33333333-3333-4333-8333-333333333333",
        originType: "ORIGINAL_LOAN",
        amount: 1000,
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Loan disbursements are only allowed during the payout window");
    expect(mocks.clientQuery).toHaveBeenCalledOnce();
  });

  it("disburses approved loans and preserves origin through ledger and disbursement rows", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "33333333-3333-4333-8333-333333333333", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "PAYOUT_PERIOD" }] });
    mocks.clientQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "44444444-4444-4444-8444-444444444444",
          status: "APPROVED",
          cycle_id: "11111111-1111-4111-8111-111111111111",
          cycle_month_id: "22222222-2222-4222-8222-222222222222",
          cycle_member_id: "33333333-3333-4333-8333-333333333333",
          origin_type: "TOP_UP",
          approved_amount: "1000",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "55555555-5555-4555-8555-555555555555", transaction_type: "LOAN_TOP_UP" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "66666666-6666-4666-8666-666666666666",
          origin_type: "TOP_UP",
          amount: "1000",
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/loans/disbursements",
      body: {
        loanRequestId: "44444444-4444-4444-8444-444444444444",
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        cycleMemberId: "33333333-3333-4333-8333-333333333333",
        originType: "TOP_UP",
        amount: 1000,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.origin_type).toBe("TOP_UP");
    expect(mocks.clientQuery.mock.calls[2][0]).toContain("INSERT INTO ledger_transactions");
    expect(mocks.clientQuery.mock.calls[5][0]).toContain("INSERT INTO loan_disbursements");
  });

  it("records principal and interest repayments separately", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "33333333-3333-4333-8333-333333333333", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "OPEN" }] });
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ id: "principal-ledger" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "interest-ledger" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "77777777-7777-4777-8777-777777777777",
          principal_amount: "400",
          interest_amount: "60",
          principal_ledger_transaction_id: "principal-ledger",
          interest_ledger_transaction_id: "interest-ledger",
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/loans/repayments",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        cycleMemberId: "33333333-3333-4333-8333-333333333333",
        principalAmount: 400,
        interestAmount: 60,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.principal_ledger_transaction_id).toBe("principal-ledger");
    expect(response.body.data.interest_ledger_transaction_id).toBe("interest-ledger");
    expect(mocks.clientQuery.mock.calls[0][1][3]).toBe("PRINCIPAL_REPAYMENT");
    expect(mocks.clientQuery.mock.calls[3][1][3]).toBe("LOAN_INTEREST_REPAYMENT");
  });

  it("returns loan member activity with cumulative borrowed and outstanding summary", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "ledger-1", transaction_type: "LOAN_DISBURSEMENT", amount: "1000" }] })
      .mockResolvedValueOnce({
        rows: [{
          cumulative_borrowed: "1200",
          original_loans: "1000",
          top_ups: "200",
          converted_penalty_loans: "0",
          interest_assessed: "150",
          principal_repaid: "300",
          interest_repaid: "50",
          outstanding_balance: "1000",
        }],
      });

    const response = await inject({
      url: "/api/loans/member/33333333-3333-4333-8333-333333333333",
    });

    expect(response.status).toBe(200);
    expect(response.body.data[0].transaction_type).toBe("LOAN_DISBURSEMENT");
    expect(response.body.summary.cumulative_borrowed).toBe("1200");
    expect(response.body.summary.outstanding_balance).toBe("1000");
  });

  it("assesses configurable penalties using the penalty type amount and posts ledger/audit records", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "33333333-3333-4333-8333-333333333333", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "OPEN" }] });
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ id: "44444444-4444-4444-8444-444444444444", amount: "100", code: "FAILURE_TO_DECLARE" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "assessment-ledger", transaction_type: "PENALTY_ASSESSMENT" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "55555555-5555-4555-8555-555555555555",
          amount_assessed: "100",
          status: "ASSESSED",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/penalties",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        cycleMemberId: "33333333-3333-4333-8333-333333333333",
        penaltyTypeId: "44444444-4444-4444-8444-444444444444",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.amount_assessed).toBe("100");
    expect(mocks.clientQuery.mock.calls[2][0]).toContain("INSERT INTO ledger_transactions");
    expect(mocks.clientQuery.mock.calls[7][0]).toContain("INSERT INTO audit_logs");
  });

  it("updates penalty payment status and audits the payment", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ status: "OPEN" }] });
    const before = {
      id: "55555555-5555-4555-8555-555555555555",
      cycle_id: "11111111-1111-4111-8111-111111111111",
      cycle_month_id: "22222222-2222-4222-8222-222222222222",
      cycle_member_id: "33333333-3333-4333-8333-333333333333",
      amount_assessed: "100",
      amount_paid: "0",
      status: "ASSESSED",
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [before] })
      .mockResolvedValueOnce({ rows: [{ id: "payment-ledger", transaction_type: "PENALTY_PAYMENT" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...before, amount_paid: "40", status: "PARTIALLY_PAID" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/penalties/55555555-5555-4555-8555-555555555555/pay",
      body: { amount: 40 },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("PARTIALLY_PAID");
    expect(response.body.data.amount_paid).toBe("40");
  });

  it("paginates penalty lists with cycle, month, and status filters", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          id: "55555555-5555-4555-8555-555555555555",
          status: "ASSESSED",
          penalty_name: "Failure to Declare",
          first_name: "Mary",
          last_name: "Phiri",
        }],
      });

    const response = await inject({
      url: "/api/penalties?cycleId=11111111-1111-4111-8111-111111111111&cycleMonthId=22222222-2222-4222-8222-222222222222&status=ASSESSED&page=2&limit=5",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
    expect(mocks.query.mock.calls[0][0]).toContain("COUNT(*)::int AS total");
    expect(mocks.query.mock.calls[1][0]).toContain("LIMIT $4 OFFSET $5");
    expect(mocks.query.mock.calls[1][1]).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "ASSESSED",
      5,
      5,
    ]);
  });

  it("replays idempotent penalty payments without reposting ledger entries", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ status: "OPEN" }] });
    mocks.clientQuery.mockResolvedValueOnce({
      rows: [{
        response_status: 200,
        response_body: {
          data: {
            id: "55555555-5555-4555-8555-555555555555",
            status: "PARTIALLY_PAID",
            amount_paid: "40",
          },
        },
        request_hash: "f78a55155e8c087f90016b4b8d51cb68fec992a9587a2a25b8f8307c9b01dd6f",
      }],
    });

    const response = await inject({
      method: "POST",
      url: "/api/penalties/55555555-5555-4555-8555-555555555555/pay",
      headers: { "idempotency-key": "penalty-payment-1" },
      body: { amount: 40 },
    });

    expect(response.status).toBe(200);
    expect(response.headers["idempotency-replayed"]).toBe("true");
    expect(response.body.data.status).toBe("PARTIALLY_PAID");
    expect(mocks.clientQuery).toHaveBeenCalledTimes(1);
  });

  it("converts unpaid penalties to auditable loan principal", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ status: "OPEN" }] });
    const before = {
      id: "55555555-5555-4555-8555-555555555555",
      cycle_id: "11111111-1111-4111-8111-111111111111",
      cycle_month_id: "22222222-2222-4222-8222-222222222222",
      cycle_member_id: "33333333-3333-4333-8333-333333333333",
      amount_assessed: "100",
      amount_paid: "25",
      status: "PARTIALLY_PAID",
      is_convertible_to_loan: true,
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [before] })
      .mockResolvedValueOnce({ rows: [{ id: "converted-ledger", transaction_type: "CONVERTED_PENALTY_LOAN" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "loan-disbursement", source_penalty_id: before.id, origin_type: "CONVERTED_PENALTY", amount: "75" }] })
      .mockResolvedValueOnce({ rows: [{ ...before, status: "CONVERTED_TO_LOAN", converted_loan_disbursement_id: "loan-disbursement" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/penalties/55555555-5555-4555-8555-555555555555/convert-to-loan",
      body: { reason: "Member requested conversion" },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("CONVERTED_TO_LOAN");
    expect(response.body.data.converted_loan_disbursement_id).toBe("loan-disbursement");
    expect(mocks.clientQuery.mock.calls[4][0]).toContain("INSERT INTO loan_disbursements");
  });

  it("requires a reason when waiving penalties", async () => {
    const response = await inject({
      method: "POST",
      url: "/api/penalties/55555555-5555-4555-8555-555555555555/waive",
      body: { reason: "" },
    });

    expect(response.status).toBe(400);
  });

  it("waives outstanding penalties with a ledger adjustment and audit trail", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ status: "OPEN" }] });
    const before = {
      id: "55555555-5555-4555-8555-555555555555",
      cycle_id: "11111111-1111-4111-8111-111111111111",
      cycle_month_id: "22222222-2222-4222-8222-222222222222",
      cycle_member_id: "33333333-3333-4333-8333-333333333333",
      amount_assessed: "100",
      amount_paid: "30",
      status: "PARTIALLY_PAID",
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [before] })
      .mockResolvedValueOnce({ rows: [{ id: "waiver-ledger", transaction_type: "ADMIN_ADJUSTMENT" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...before, status: "WAIVED", notes: "Committee approved" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/penalties/55555555-5555-4555-8555-555555555555/waive",
      body: { reason: "Committee approved" },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("WAIVED");
    expect(mocks.clientQuery.mock.calls[1][1][3]).toBe("ADMIN_ADJUSTMENT");
  });

  it("blocks duplicate common-interest calculation while active assessments exist", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", cycle_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "OPEN" }] });
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ id: "44444444-4444-4444-8444-444444444444" }] })
      .mockResolvedValueOnce({ rows: [{ id: "55555555-5555-4555-8555-555555555555" }] });

    const response = await inject({
      method: "POST",
      url: "/api/common-interest/calculate",
      body: {
        cycleId: "11111111-1111-4111-8111-111111111111",
        cycleMonthId: "22222222-2222-4222-8222-222222222222",
        allocationMethod: "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL",
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Common-interest assessments already exist for this month. Reverse or override them before recalculating.");
    expect(mocks.clientQuery).toHaveBeenCalledTimes(2);
    expect(mocks.clientQuery.mock.calls[1][0]).toContain("JOIN ledger_transactions");
  });

  it("runs monthly closing end-to-end with penalties, interest, common interest, summaries, and optional locking", async () => {
    const cycleId = "11111111-1111-4111-8111-111111111111";
    const cycleMonthId = "22222222-2222-4222-8222-222222222222";
    const cycleMemberId = "33333333-3333-4333-8333-333333333333";
    const userId = "00000000-0000-0000-0000-000000000001";
    const cycle = {
      id: cycleId,
      savings_interest_rate: "0.15",
      loan_interest_rate: "0.15",
      common_interest_rate: "0.15",
      minimum_borrowing_amount: "20000",
      rounding_scale: 2,
      rounding_mode: "HALF_UP",
    };
    const previousSums = {
      savings_deposit: "1000",
      savings_interest: "150",
      new_loan: "2000",
      original_loan: "2000",
      top_up: "0",
      converted_penalty_loan: "0",
      principal_repaid: "0",
      loan_interest_assessed: "0",
      interest_repaid: "0",
      common_interest_assessed: "0",
      common_interest_paid: "0",
      penalties_assessed: "0",
      penalties_paid: "0",
      penalties_converted: "0",
    };
    const currentSums = {
      savings_deposit: "1000",
      savings_interest: "0",
      new_loan: "0",
      original_loan: "0",
      top_up: "0",
      converted_penalty_loan: "0",
      principal_repaid: "0",
      loan_interest_assessed: "0",
      interest_repaid: "0",
      common_interest_assessed: "375",
      common_interest_paid: "0",
      penalties_assessed: "100",
      penalties_paid: "0",
      penalties_converted: "0",
    };

    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: cycleMonthId, cycle_id: cycleId }] })
      .mockResolvedValueOnce({ rows: [{ id: cycleMonthId, status: "OPEN" }] });
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [cycle] })
      .mockResolvedValueOnce({ rows: [{ next: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: "closing-run", cycle_id: cycleId, cycle_month_id: cycleMonthId, run_number: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ cycle_member_id: cycleMemberId }] })
      .mockResolvedValueOnce({ rows: [{ id: "penalty-type", amount: "100" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "penalty-ledger", transaction_type: "PENALTY_ASSESSMENT", amount: "100" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "penalty-row" }] })
      .mockResolvedValueOnce({ rows: [previousSums] })
      .mockResolvedValueOnce({ rows: [currentSums] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "savings-interest-ledger", transaction_type: "SAVINGS_INTEREST", amount: "322.5" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "loan-interest-ledger", transaction_type: "LOAN_INTEREST_ASSESSMENT", amount: "300" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [cycle] })
      .mockResolvedValueOnce({ rows: [{ id: cycleMonthId, cycle_id: cycleId }] })
      .mockResolvedValueOnce({ rows: [{ contributions: "3000", loans: "500" }] })
      .mockResolvedValueOnce({
        rows: [{
          cycle_member_id: cycleMemberId,
          first_name: "Mary",
          last_name: "Phiri",
          member_code: "M001",
          borrowed: "0",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "common-interest-run",
          total_pool_contributions: "3000",
          unborrowed_money: "2500",
          common_interest_pool: "375",
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "common-interest-ledger", transaction_type: "COMMON_INTEREST_ASSESSMENT", amount: "375" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "common-interest-allocation", final_charge: "375" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [previousSums] })
      .mockResolvedValueOnce({ rows: [currentSums] })
      .mockResolvedValueOnce({
        rows: [{
          id: "snapshot-1",
          declaration_status: "MISSED",
          savings_interest: "322.5",
          loan_interest_assessed: "300",
          common_interest_charge: "375",
          penalties_assessed: "100",
        }],
      })
      .mockResolvedValueOnce({ rows: [{ social_fund: "240", membership_fees: "80" }] })
      .mockResolvedValueOnce({
        rows: [{
          id: "summary-1",
          total_savings_deposits: "1000",
          total_savings_interest: "322.5",
          total_loan_interest_assessed: "300",
          total_common_interest_charged: "375",
          total_penalties_assessed: "100",
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "closing-run", status: "APPROVED" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/monthly-closing/run",
      body: {
        cycleId,
        cycleMonthId,
        lock: true,
        allocationMethod: "ONLY_NON_BORROWERS_EQUAL",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.run.status).toBe("APPROVED");
    expect(response.body.data.summary.total_common_interest_charged).toBe("375");
    expect(response.body.data.snapshots).toHaveLength(1);
    expect(response.body.data.commonInterest.allocations).toHaveLength(1);
    expect(mocks.clientQuery.mock.calls.some((call) => call[0].includes("INSERT INTO penalties"))).toBe(true);
    expect(mocks.clientQuery.mock.calls.some((call) => call[1]?.[3] === "SAVINGS_INTEREST")).toBe(true);
    expect(mocks.clientQuery.mock.calls.some((call) => call[1]?.[3] === "LOAN_INTEREST_ASSESSMENT")).toBe(true);
    expect(mocks.clientQuery.mock.calls.some((call) => call[0].includes("INSERT INTO member_monthly_snapshots"))).toBe(true);
    expect(mocks.clientQuery.mock.calls.some((call) => call[0].includes("INSERT INTO cycle_month_summaries"))).toBe(true);
    expect(mocks.clientQuery.mock.calls.some((call) => call[0].includes("UPDATE cycle_months SET status = 'LOCKED'"))).toBe(true);
    expect(mocks.clientQuery.mock.calls.some((call) => call[0].includes("INSERT INTO audit_logs") && call[1]?.[1] === "APPROVE")).toBe(true);
    expect(mocks.clientQuery.mock.calls.find((call) => call[1]?.[3] === "SAVINGS_INTEREST")[1][4]).toBe(322.5);
    expect(mocks.clientQuery.mock.calls.find((call) => call[1]?.[3] === "LOAN_INTEREST_ASSESSMENT")[1][4]).toBe(300);
    expect(mocks.clientQuery.mock.calls.find((call) => call[0].includes("INSERT INTO common_interest_allocations"))[1][10]).toBe(375);
  });

  it("blocks members from opening another member report", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      url: "/api/reports/member-statement?cycleMemberId=33333333-3333-4333-8333-333333333333",
      headers: { "x-test-role": "MEMBER" },
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("You can only access your own cycle records");
  });

  it("allows members to open the read-only reports center for all cycle members", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "11111111-1111-4111-8111-111111111111", name: "Main Cycle", minimum_borrowing_amount: 20000 }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", month_number: 1, status: "OPEN" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", month_number: 1, status: "OPEN" }] })
      .mockResolvedValueOnce({
        rows: [
          { cycle_member_id: "33333333-3333-4333-8333-333333333333", first_name: "Mary", last_name: "Phiri" },
          { cycle_member_id: "44444444-4444-4444-8444-444444444444", first_name: "John", last_name: "Banda" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { cycle_member_id: "33333333-3333-4333-8333-333333333333", first_name: "Mary", last_name: "Phiri", savings_principal: "1000" },
          { cycle_member_id: "44444444-4444-4444-8444-444444444444", first_name: "John", last_name: "Banda", savings_principal: "2000" },
        ],
      });

    const response = await inject({
      url: "/api/reports/center?report=member-statements",
      headers: { "x-test-role": "MEMBER" },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.rows).toHaveLength(2);
    expect(response.body.data.rows.map((row) => row.first_name)).toEqual(["Mary", "John"]);
    expect(mocks.query.mock.calls[3][0]).not.toContain("m.user_id");
    expect(mocks.query.mock.calls[4][0]).not.toContain("m.user_id");
  });

  it("allows members to view group converted-penalty reports without admin actions", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "11111111-1111-4111-8111-111111111111", name: "Main Cycle" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222", month_number: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          id: "penalty-1",
          first_name: "Mary",
          last_name: "Phiri",
          amount_assessed: "100",
          converted_loan_amount: "100",
        }],
      });

    const response = await inject({
      url: "/api/reports/converted-penalties",
      headers: { "x-test-role": "MEMBER" },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.rows).toHaveLength(1);
    expect(mocks.query.mock.calls[2][0]).not.toContain("m.user_id");
  });

  it("returns member statements with month filters and reversal-aware ledger totals", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{
          cycle_member_id: "33333333-3333-4333-8333-333333333333",
          first_name: "Mary",
          last_name: "Phiri",
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "ledger-1", transaction_type: "SAVINGS_DEPOSIT", amount: "1000" }] })
      .mockResolvedValueOnce({ rows: [{ id: "snapshot-1", savings_deposit: "1000" }] })
      .mockResolvedValueOnce({
        rows: [{
          savings_principal: "1000",
          savings_interest: "150",
          borrowed: "0",
        }],
      });

    const response = await inject({
      url: "/api/reports/member-statement?cycleMemberId=33333333-3333-4333-8333-333333333333&cycleMonthId=22222222-2222-4222-8222-222222222222",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.transactions).toHaveLength(1);
    expect(response.body.data.snapshots).toHaveLength(1);
    expect(mocks.query.mock.calls[1][0]).toContain("LEFT JOIN ledger_transactions rev");
    expect(mocks.query.mock.calls[1][0]).toContain("lt.cycle_month_id = $2");
    expect(mocks.query.mock.calls[3][0]).toContain("rev.id IS NULL");
    expect(mocks.query.mock.calls[3][1]).toEqual([
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("exports savings reports as CSV", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "11111111-1111-4111-8111-111111111111", savings_cap: 30000 }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222" }] })
      .mockResolvedValueOnce({
        rows: [{
          cycle_member_id: "33333333-3333-4333-8333-333333333333",
          member_code: "M001",
          first_name: "Mary",
          last_name: "Phiri",
          principal_deposited: "1000",
          interest_earned: "150",
          cap_remaining: "29000",
        }],
      });

    const response = await inject({ url: "/api/reports/savings?format=csv" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text).toContain("cycle_member_id,member_code,first_name,last_name");
    expect(response.text).toContain("\"Mary\"");
    expect(mocks.query.mock.calls[2][0]).toContain("LEFT JOIN ledger_transactions rev");
  });

  it("treats missing declaration rows as missed in compliance reports", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [{ id: "22222222-2222-4222-8222-222222222222" }] })
      .mockResolvedValueOnce({
        rows: [{
          cycle_member_id: "33333333-3333-4333-8333-333333333333",
          first_name: "Mary",
          last_name: "Phiri",
          status: "MISSED",
        }],
      });

    const response = await inject({ url: "/api/reports/declarations?status=MISSED" });

    expect(response.status).toBe(200);
    expect(response.body.data.totals.missed).toBe(1);
    expect(mocks.query.mock.calls[2][0]).toContain("COALESCE(d.status, 'MISSED') AS status");
    expect(mocks.query.mock.calls[2][0]).toContain("OR d.id IS NULL");
  });

  it("reverses unpaid assessed penalties through immutable ledger reversal", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ status: "OPEN" }] });
    const before = {
      id: "55555555-5555-4555-8555-555555555555",
      status: "ASSESSED",
      amount_paid: "0",
      assessment_ledger_transaction_id: "assessment-ledger",
      converted_loan_disbursement_id: null,
    };
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [before] })
      .mockResolvedValueOnce({
        rows: [{
          id: "assessment-ledger",
          cycle_id: "11111111-1111-4111-8111-111111111111",
          cycle_month_id: "22222222-2222-4222-8222-222222222222",
          cycle_member_id: "33333333-3333-4333-8333-333333333333",
          amount: "100",
          transaction_type: "PENALTY_ASSESSMENT",
          source_table: "penalties",
          source_id: before.id,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "entry-1",
          cycle_id: "11111111-1111-4111-8111-111111111111",
          cycle_member_id: "33333333-3333-4333-8333-333333333333",
          account_type: "PENALTY",
          debit: "100",
          credit: "0",
        }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "reversal-ledger" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...before, status: "REVERSED", notes: "Duplicate assessment" }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await inject({
      method: "POST",
      url: "/api/penalties/55555555-5555-4555-8555-555555555555/reverse",
      body: { reason: "Duplicate assessment" },
    });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("REVERSED");
    expect(mocks.clientQuery.mock.calls[4][0]).toContain("INSERT INTO ledger_transactions");
  });
});
