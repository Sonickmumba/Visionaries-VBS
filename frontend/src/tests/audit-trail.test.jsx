import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  auditDetailPairs,
  AuditTrailPage,
  auditQuery,
  auditRowsForSection,
} from "../pages/admin/AuditTrailPage.jsx";

const auditLog = {
  id: "audit-1",
  created_at: "2026-01-31T10:00:00Z",
  actor_email: "admin@example.com",
  actor_role: "ADMIN",
  action: "REVERSE",
  entity_table: "ledger_transactions",
  entity_id: "tx-1",
  reason: "Correction approved",
  ip_address: "127.0.0.1",
  before_data: { amount: 100 },
  after_data: { amount: 0 },
};

const override = {
  id: "override-1",
  created_at: "2026-01-31",
  cycle_name: "2026 Main Cycle",
  target_table: "common_interest_allocations",
  target_id: "allocation-1",
  field_name: "final_charge",
  original_value: "3000",
  overridden_value: "2500",
  reason: "Committee approved",
};

const reversal = {
  id: "reversal-1",
  posted_at: "2026-01-31",
  first_name: "Mary",
  last_name: "Phiri",
  transaction_type: "SAVINGS_DEPOSIT_REVERSAL",
  amount: "15000",
  reversal_reason: "Duplicate posting",
};

const auditData = {
  data: [auditLog],
  overrides: [override],
  reversals: [reversal],
  totals: { logs: 1, overrides: 1, reversals: 1, logins: 0 },
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
};

describe("audit trail screens", () => {
  it("builds audit query strings for filters, section, pagination, and csv", () => {
    expect(auditQuery({
      filters: { action: "REVERSE", entityTable: "ledger_transactions", reason: "correction" },
      section: "reversals",
      page: 2,
      limit: 25,
      format: "csv",
    })).toBe("/audit?action=REVERSE&entityTable=ledger_transactions&reason=correction&section=reversals&page=2&limit=25&format=csv");
  });

  it("selects rows for the active audit section", () => {
    expect(auditRowsForSection(auditData, "logs")).toEqual([auditLog]);
    expect(auditRowsForSection(auditData, "overrides")).toEqual([override]);
    expect(auditRowsForSection(auditData, "reversals")).toEqual([reversal]);
  });

  it("omits large before/after objects from detail summary pairs", () => {
    const keys = auditDetailPairs(auditLog).map(([key]) => key);

    expect(keys).toContain("action");
    expect(keys).not.toContain("before_data");
    expect(keys).not.toContain("after_data");
  });

  it("renders audit filters, metrics, tabs, detail, and log rows", () => {
    const html = renderToStaticMarkup(
      <AuditTrailPage initialData={auditData} />
    );

    expect(html).toContain("Audit Trail");
    expect(html).toContain("Administrative Events");
    expect(html).toContain("Actor email");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Audit Logs");
    expect(html).toContain("Overrides");
    expect(html).toContain("Reversals");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("Correction approved");
    expect(html).toContain("View Audit Detail");
  });

  it("opens audit detail in a modal instead of an inline audit panel", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/admin/AuditTrailPage.jsx"), "utf8");

    expect(source).toContain('title="Audit Details"');
    expect(source).toContain("audit-detail-modal");
    expect(source).toContain("open={Boolean(selected)}");
  });

  it("keeps the audit mobile responsive contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/ledger-audit.css"), "utf8");

    expect(css).toContain(".ledger-audit-hero");
    expect(css).toContain(".ledger-audit-mobile-cards");
    expect(css).toContain(".ledger-audit-card");
    expect(css).toContain(".audit-detail-modal");
    expect(css).toContain("max-height: calc(100svh - 124px)");
    expect(css).toContain(".ledger-audit-desktop-table");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
