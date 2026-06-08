import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Badge,
  Button,
  ConfirmDialog,
  CurrencyInput,
  DataTable,
  IconButton,
  Modal,
  Pagination,
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

  it("renders Kwacha currency inputs", () => {
    const html = renderToStaticMarkup(<CurrencyInput label="Savings" value="15000" />);

    expect(html).toContain(">K<");
    expect(html).toContain("value=\"15000\"");
    expect(html).toContain("aria-label=\"Savings\"");
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
    expect(badge).toContain("APPROVED");
    expect(pager).toContain("Page 1 of 3");
    expect(modal).toContain("role=\"dialog\"");
    expect(confirm).toContain("Enter the audit reason");
  });
});
