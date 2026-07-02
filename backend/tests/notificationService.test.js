import { describe, expect, it, beforeEach } from "vitest";
import {
  archiveExpiredNotifications,
  clearNotificationsForTests,
  listNotifications,
  markNotificationsRead,
  publishPersistentNotification,
  publishActivityNotification,
  publishNotification,
  recentNotifications,
} from "../src/services/notificationService.js";

describe("notification service", () => {
  beforeEach(() => {
    clearNotificationsForTests();
  });

  it("publishes bounded real-time transparency events", () => {
    const event = publishNotification({
      type: "DECLARATION_SUBMITTED",
      title: "Declaration submitted",
      message: "A member submitted a declaration for group review.",
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      cycleMemberId: "cm-1",
      sourceTable: "declarations",
      sourceId: "dec-1",
      actionUrl: "reports:declarations",
      metadata: { savingsAmount: 15000 },
    });

    expect(event.id).toBe("1");
    expect(event.createdAt).toBeTruthy();
    expect(recentNotifications()).toEqual([event]);
    expect(event.metadata.savingsAmount).toBe(15000);
  });

  it("keeps newest notifications first and honors limit", () => {
    publishNotification({ type: "FIRST", title: "First" });
    publishNotification({ type: "SECOND", title: "Second" });

    expect(recentNotifications({ limit: 1 }).map((event) => event.type)).toEqual(["SECOND"]);
  });

  it("persists notification events before broadcasting them", async () => {
    const db = {
      query: async () => ({
        rows: [{
          id: "11111111-1111-4111-8111-111111111111",
          type: "COMMON_INTEREST_POSTED",
          title: "Common interest posted",
          message: "Common interest for Month 3 has been posted.",
          audience: "ALL",
          severity: "INFO",
          cycle_id: null,
          cycle_month_id: null,
          cycle_member_id: null,
          source_table: null,
          source_id: null,
          action_url: null,
          action_target: { adminPage: "common-interest" },
          metadata: { monthNumber: 3 },
          created_at: "2026-06-22T10:00:00.000Z",
        }],
      }),
    };

    const event = await publishPersistentNotification(db, {
      type: "COMMON_INTEREST_POSTED",
      title: "Common interest posted",
      message: "Common interest for Month 3 has been posted.",
      actionTarget: { adminPage: "common-interest" },
      metadata: { monthNumber: 3 },
    });

    expect(event.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(recentNotifications()[0]).toMatchObject({ id: event.id, type: "COMMON_INTEREST_POSTED" });
  });

  it("supports direct notification recipients", async () => {
    const calls = [];
    const db = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes("INSERT INTO notifications")) {
          return {
            rows: [{
              id: "11111111-1111-4111-8111-111111111111",
              type: "SYSTEM_EVENT",
              title: "Direct notice",
              message: "Private member notice.",
              audience: "ALL",
              severity: "INFO",
              recipient_mode: "USERS",
              metadata: {},
              created_at: "2026-06-22T10:00:00.000Z",
            }],
          };
        }
        return { rows: [], rowCount: 1 };
      },
    };

    const event = await publishPersistentNotification(db, {
      type: "SYSTEM_EVENT",
      title: "Direct notice",
      message: "Private member notice.",
      recipientUserIds: ["00000000-0000-0000-0000-000000000001"],
    });

    expect(event.recipientUserIds).toEqual(["00000000-0000-0000-0000-000000000001"]);
    expect(calls[0].params).toContain("USERS");
    expect(calls[1].sql).toContain("notification_recipients");
  });

  it("lists persisted notifications with unread state and writes read receipts", async () => {
    const calls = [];
    const db = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes("SELECT n.*, r.read_at")) {
          return {
            rows: [{
              id: "11111111-1111-4111-8111-111111111111",
              type: "DECLARATION_SUBMITTED",
              title: "Mary submitted a declaration",
              message: "Mary declared K15,000 savings for Month 2.",
              audience: "ALL",
              severity: "INFO",
              metadata: { savingsAmount: 15000 },
              created_at: "2026-06-22T10:00:00.000Z",
              read_at: null,
            }],
          };
        }
        if (sql.includes("COUNT(*)::int AS unread_count")) {
          return { rows: [{ unread_count: 3 }] };
        }
        return { rows: [], rowCount: 1 };
      },
    };

    const listed = await listNotifications(db, {
      user: { id: "00000000-0000-0000-0000-000000000001", role: "MEMBER" },
      limit: 10,
    });
    const marked = await markNotificationsRead(db, {
      userId: "00000000-0000-0000-0000-000000000001",
      notificationIds: ["11111111-1111-4111-8111-111111111111"],
    });

    expect(listed.unreadCount).toBe(3);
    expect(listed.data[0]).toMatchObject({ id: "11111111-1111-4111-8111-111111111111", readAt: null });
    expect(marked.read).toBe(1);
    expect(calls.at(-1).sql).toContain("notification_read_receipts");
  });

  it("archives expired notifications by retention policy", async () => {
    const db = {
      query: async (sql, params) => {
        expect(sql).toContain("archived_at = now()");
        expect(sql).toContain("expires_at IS NOT NULL");
        expect(params).toEqual([30, "Test retention"]);
        return { rows: [], rowCount: 4 };
      },
    };

    await expect(archiveExpiredNotifications(db, { retentionDays: 30, reason: "Test retention" })).resolves.toEqual({ archived: 4 });
  });

  it("enriches declaration notifications with member, amount, month, and routing target", async () => {
    const db = {
      query: async () => ({
        rows: [{ first_name: "Mary", last_name: "Phiri", member_code: "M001", month_number: 2 }],
      }),
    };

    await publishActivityNotification(db, {
      type: "DECLARATION_SUBMITTED",
      cycleId: "cycle-1",
      cycleMonthId: "month-2",
      cycleMemberId: "cm-1",
      sourceTable: "declarations",
      sourceId: "dec-1",
      metadata: { savingsAmount: 15000 },
    });

    const [event] = recentNotifications();
    expect(event.title).toBe("Mary Phiri submitted a declaration");
    expect(event.message).toBe("Mary Phiri declared K15,000 savings for Month 2.");
    expect(event.actionTarget).toEqual({ adminPage: "declarations", memberPage: "my-reports", report: "declarations" });
    expect(event.metadata).toMatchObject({ memberName: "Mary Phiri", monthNumber: 2 });
  });

  it("enriches approved declarations when routes pass the query function directly", async () => {
    const dbQuery = async () => ({
      rows: [{ first_name: "Mary", last_name: "Phiri", member_code: "M001", month_number: 2 }],
    });

    await publishActivityNotification(dbQuery, {
      type: "DECLARATION_APPROVED",
      cycleId: "cycle-1",
      cycleMonthId: "month-2",
      cycleMemberId: "cm-1",
      sourceTable: "declarations",
      sourceId: "dec-1",
      metadata: { savingsAmount: 30000, loanRequestAmount: 10000 },
    });

    const [event] = recentNotifications();
    expect(event.title).toBe("Mary Phiri declaration approved");
    expect(event.message).toBe("Mary Phiri's declaration for Month 2 was approved: declared K30,000 savings and requested a K10,000 loan.");
    expect(event.metadata).toMatchObject({ memberName: "Mary Phiri", monthNumber: 2 });
  });
});
