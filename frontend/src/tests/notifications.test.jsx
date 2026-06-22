import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  NotificationCard,
  NotificationsPage,
  loadNotifications,
  notificationsViewModel,
} from "../pages/NotificationsPage.jsx";

const events = [
  {
    id: "1",
    type: "DECLARATION_SUBMITTED",
    title: "Declaration submitted",
    message: "A member submitted a declaration for group review.",
    severity: "INFO",
    createdAt: "2026-06-22T10:00:00Z",
    actionUrl: "reports:declarations",
    actionTarget: { adminPage: "declarations", memberPage: "my-reports", report: "declarations" },
    metadata: { savingsAmount: "15000", monthNumber: 2 },
  },
  {
    id: "2",
    type: "LOAN_DISBURSED",
    title: "Loan disbursed",
    message: "An approved loan was disbursed and posted to the ledger.",
    severity: "INFO",
    createdAt: "2026-06-22T10:05:00Z",
    metadata: { amount: "5000" },
  },
  {
    id: "3",
    type: "PENALTY_ASSESSED",
    title: "Penalty assessed",
    message: "An administrator assessed a member penalty.",
    severity: "WARNING",
    createdAt: "2026-06-22T10:10:00Z",
    metadata: { amount: "100" },
  },
];

describe("notifications", () => {
  it("summarizes notification categories", () => {
    expect(notificationsViewModel(events)).toMatchObject({
      total: 3,
      declarationCount: 1,
      loanCount: 1,
      financialCount: 1,
    });
  });

  it("loads recent notifications from the API", async () => {
    const notificationsApi = async (path) => {
      expect(path).toBe("/notifications?limit=75");
      return { data: events };
    };

    await expect(loadNotifications({ notificationsApi })).resolves.toEqual(events);
  });

  it("renders the real-time transparency feed", () => {
    const html = renderToStaticMarkup(<NotificationsPage initialEvents={events} setPage={() => {}} />);

    expect(html).toContain("Notifications");
    expect(html).toContain("Group Transparency Feed");
    expect(html).toContain("Declaration submitted");
    expect(html).toContain("Loan disbursed");
    expect(html).toContain("Penalty assessed");
    expect(html).toContain("K15,000");
    expect(html).toContain("Month 2");
    expect(html).toContain("Open Reports");
  });

  it("renders a notification card with report action", () => {
    const html = renderToStaticMarkup(<NotificationCard event={events[0]} onOpenTarget={() => {}} />);

    expect(html).toContain("Declaration Submitted");
    expect(html).toContain("View");
    expect(html).toContain("K15,000");
  });

  it("keeps real-time stream wiring and responsive styles", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/NotificationsPage.jsx"), "utf8");
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/notifications.css"), "utf8");

    expect(source).toContain("new EventSource");
    expect(source).toContain("/notifications/stream");
    expect(source).toContain("withCredentials: true");
    expect(source).toContain("actionTarget");
    expect(source).toContain("target.adminPage");
    expect(source).toContain("target.memberPage");
    expect(css).toContain(".notifications-hero");
    expect(css).toContain(".notification-card");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
