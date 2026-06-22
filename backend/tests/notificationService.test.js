import { describe, expect, it, beforeEach } from "vitest";
import {
  clearNotificationsForTests,
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
