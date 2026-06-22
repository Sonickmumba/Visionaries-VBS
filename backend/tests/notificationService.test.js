import { describe, expect, it, beforeEach } from "vitest";
import {
  clearNotificationsForTests,
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
});
