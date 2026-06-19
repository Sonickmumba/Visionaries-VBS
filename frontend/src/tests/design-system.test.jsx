import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Badge,
  Button,
  Alert,
  ConfirmDialog,
  CurrencyInput,
  DataTable,
  IconButton,
  Modal,
  Pagination,
  Skeleton,
  Tabs,
} from "../components/ui/index.jsx";

describe("design system components", () => {
  it("renders accessible buttons and loading states", () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);

    expect(html).toContain("aria-busy=\"true\"");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Save");
  });

  it("renders icon buttons with labels", () => {
    const html = renderToStaticMarkup(<IconButton label="Close panel" />);

    expect(html).toContain("aria-label=\"Close panel\"");
    expect(html).toContain("title=\"Close panel\"");
  });

  it("renders described fields and Kwacha currency inputs", () => {
    const field = renderToStaticMarkup(<CurrencyInput label="Savings" value="15000" error="Too much" />);
    const input = renderToStaticMarkup(<CurrencyInput label="Savings" value="15000" hint="Principal only" />);

    expect(field).toContain(">K<");
    expect(field).toContain("value=\"15000\"");
    expect(field).toContain("aria-label=\"Savings\"");
    expect(field).toContain("aria-invalid=\"true\"");
    expect(field).toContain("aria-describedby=");
    expect(input).toContain("Principal only");
  });

  it("renders responsive table labels and empty state", () => {
    const filled = renderToStaticMarkup(<DataTable columns={["Member", "Amount"]} rows={[["Mary", "K15,000"]]} />);
    const empty = renderToStaticMarkup(<DataTable columns={["Member"]} rows={[]} empty="No members" />);

    expect(filled).toContain("data-label=\"Member\"");
    expect(filled).toContain("Mary");
    expect(empty).toContain("No members");
  });

  it("renders tabs, badges, pagination, modal, and confirm dialog semantics", () => {
    const tabs = renderToStaticMarkup(<Tabs tabs={["Overview", "Loans"]} active="Loans" />);
    const badge = renderToStaticMarkup(<Badge tone="green" text="APPROVED" />);
    const pager = renderToStaticMarkup(<Pagination page={1} totalPages={3} />);
    const modal = renderToStaticMarkup(<Modal open title="Details"><p>Body</p></Modal>);
    const confirm = renderToStaticMarkup(<ConfirmDialog open reason="" title="Reverse entry" />);

    expect(tabs).toContain("role=\"tablist\"");
    expect(tabs).toContain("aria-selected=\"true\"");
    expect(tabs).toContain("tabindex=\"0\"");
    expect(badge).toContain("APPROVED");
    expect(badge).toContain("aria-label=\"APPROVED\"");
    expect(pager).toContain("Page 1 of 3");
    expect(modal).toContain("role=\"dialog\"");
    expect(modal).toContain("aria-modal=\"true\"");
    expect(modal).toContain("Close dialog");
    expect(confirm).toContain("Enter the audit reason");
  });

  it("renders live alerts and loading status semantics", () => {
    const danger = renderToStaticMarkup(<Alert tone="danger" title="Failed">Try again</Alert>);
    const skeleton = renderToStaticMarkup(<Skeleton lines={2} />);
    const confirm = renderToStaticMarkup(<ConfirmDialog open reason="Because" title="Confirm reversal" />);
    const table = renderToStaticMarkup(<DataTable caption="Members" columns={["Name"]} rows={[]} />);

    expect(danger).toContain("role=\"alert\"");
    expect(danger).toContain("aria-live=\"assertive\"");
    expect(skeleton).toContain("role=\"status\"");
    expect(confirm).toContain("aria-labelledby=");
    expect(table).toContain("aria-label=\"Members\"");
    expect(table).toContain("<caption>Members</caption>");
  });
});
