import React from "react";
import fs from "node:fs";
import path from "node:path";
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
  MobileActionTile,
  MobileBottomNav,
  MobileHeader,
  MobileHeroCard,
  MobileListCard,
  MobileMetricCard,
  MobileScreenShell,
  MobileStepper,
  MobileStickyActionBar,
  MobileUploadCard,
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

  it("renders mobile shell, header, and active bottom navigation", () => {
    const nav = <MobileBottomNav active="home" items={[{ id: "home", label: "Home" }, { id: "my-notifications", label: "Alerts", badge: 4 }]} />;
    const html = renderToStaticMarkup(
      <MobileScreenShell bottomNav={nav}>
        <MobileHeader eyebrow="Good morning" title="Visionaries Village Banking" subtitle="Cycle 12" avatar={{ label: "Sonic Mumba", initials: "SM" }} />
      </MobileScreenShell>,
    );

    expect(html).toContain("mobile-shell has-bottom-nav");
    expect(html).toContain("Good morning");
    expect(html).toContain("Visionaries Village Banking");
    expect(html).toContain("aria-label=\"Primary mobile navigation\"");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain("Alerts");
    expect(html).toContain("4 unread notifications");
  });

  it("keeps mobile notification badges visible above nav icons", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/layouts.css"), "utf8");

    expect(css).toContain(".mobile-nav-icon-wrap");
    expect(css).toContain("overflow: visible");
    expect(css).toContain(".mobile-bottom-nav .mobile-nav-label");
    expect(css).not.toContain(".mobile-bottom-nav span {\n    max-width: 100%;\n    overflow: hidden;");
  });

  it("keeps shared mobile member layout rules in the design system", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/design-system.css"), "utf8");

    expect(css).toContain(".member-mobile-section");
    expect(css).toContain(".member-mobile-section-head");
    expect(css).toContain(".member-mobile-list");
    expect(css).toContain(".mobile-bottom-nav button:focus-visible");
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain(".mobile-shell.has-bottom-nav .mobile-sticky-actions");
    expect(css).toContain("bottom: 84px");
  });

  it("anchors mobile modals near the top with internal scrolling", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/design-system.css"), "utf8");

    expect(css).toContain(".ui-overlay");
    expect(css).toContain("align-items: start");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("max-height: calc(100svh - 20px)");
    expect(css).toContain(".ui-modal-body");
    expect(css).toContain("overflow: auto");
  });

  it("renders mobile finance cards and action tiles", () => {
    const hero = renderToStaticMarkup(<MobileHeroCard label="Total Accumulated Savings" value="K45,250" note="Up to Month 3" actionLabel="View" />);
    const metric = renderToStaticMarkup(<MobileMetricCard label="My Loan Balance" value="K10,000" note="After repayments" tone="blue" />);
    const action = renderToStaticMarkup(<MobileActionTile label="New Declaration" />);

    expect(hero).toContain("Total Accumulated Savings: K45,250. Up to Month 3");
    expect(hero).toContain("View");
    expect(metric).toContain("My Loan Balance: K10,000. After repayments");
    expect(metric).toContain("blue");
    expect(action).toContain("New Declaration");
    expect(action).toContain("mobile-action-tile");
  });

  it("renders mobile list rows, stepper, upload card, and sticky actions", () => {
    const list = renderToStaticMarkup(<MobileListCard title="Mary Phiri" subtitle="Savings declaration" value="K15,000" status={{ label: "Approved", tone: "green" }} />);
    const steps = renderToStaticMarkup(<MobileStepper active={1} steps={["Declare", "Review", "Approve"]} />);
    const upload = renderToStaticMarkup(<MobileUploadCard label="Savings proof" fileName="receipt.pdf" status="Uploaded" />);
    const actions = renderToStaticMarkup(<MobileStickyActionBar primaryLabel="Submit" secondaryLabel="Save draft" />);

    expect(list).toContain("Mary Phiri");
    expect(list).toContain("Approved");
    expect(steps).toContain("aria-label=\"Progress\"");
    expect(steps).toContain("class=\"active\"");
    expect(upload).toContain("Savings proof. Uploaded");
    expect(upload).toContain("receipt.pdf");
    expect(actions).toContain("mobile-sticky-actions");
    expect(actions).toContain("Submit");
    expect(actions).toContain("Save draft");
  });
});
