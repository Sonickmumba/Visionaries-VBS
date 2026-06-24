import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, DataTable, IconButton, Modal } from "../components/ui/index.jsx";
import { AppLayout, Page, adminNav, memberNav, routeLabel } from "../layouts/AppLayouts.jsx";

describe("QA-004 frontend regression suite", () => {
  it("keeps every primary admin and member route represented in navigation and app routing", () => {
    const appSource = fs.readFileSync(path.join(process.cwd(), "src/PortalApp.jsx"), "utf8");
    const mainSource = fs.readFileSync(path.join(process.cwd(), "src/main.jsx"), "utf8");
    const adminRoutes = [
      "dashboard",
      "cycles",
      "members",
      "declarations",
      "savings",
      "loans",
      "common-interest",
      "penalties",
      "closing",
      "ledger",
      "reports",
      "shareout",
      "audit",
      "notifications",
      "settings",
    ];
    const memberRoutes = [
      "member-dashboard",
      "my-declaration",
      "my-statement",
      "my-savings",
      "my-loans",
      "my-penalties",
      "my-reports",
      "my-shareout",
      "my-notifications",
    ];

    expect(adminNav.map(([id]) => id)).toEqual(adminRoutes);
    expect(memberNav.map(([id]) => id)).toEqual(memberRoutes);
    const labelsByRoute = new Map([...adminNav, ...memberNav].map(([id, label]) => [id, label]));
    for (const route of [...adminRoutes, ...memberRoutes]) {
      expect(appSource).toContain(`case "${route}"`);
      expect(routeLabel(route)).toBe(labelsByRoute.get(route));
    }
    expect(appSource).toContain("lazyNamed");
    expect(appSource).toContain("Suspense");
    expect(mainSource.length).toBeLessThan(500);
  });

  it("keeps app shells usable for desktop and mobile navigation", () => {
    const adminHtml = renderToStaticMarkup(
      <AppLayout user={{ role: "ADMIN", is_active: true }} page="reports" setPage={() => {}} onLogout={() => {}}>
        <Page title="Reports"><p>Reports body</p></Page>
      </AppLayout>
    );
    const memberHtml = renderToStaticMarkup(
      <AppLayout user={{ role: "MEMBER", is_active: true }} page="my-declaration" setPage={() => {}} onLogout={() => {}}>
        <Page title="My Declaration"><p>Declaration body</p></Page>
      </AppLayout>
    );

    expect(adminHtml).toContain("aria-label=\"Admin navigation\"");
    expect(adminHtml).toContain("aria-current=\"page\"");
    expect(adminHtml).toContain("Open navigation");
    expect(adminHtml).toContain("Skip to main content");
    expect(memberHtml).toContain("aria-label=\"Member navigation\"");
    expect(memberHtml).toContain("Member Portal");
    expect(memberHtml).toContain("my-declaration");
  });

  it("keeps responsive table, button, modal, and icon-button semantics intact", () => {
    const html = renderToStaticMarkup(
      <>
        <div className="button-row">
          <Button>Approve Inputs</Button>
          <IconButton label="View member details" />
        </div>
        <DataTable caption="Member balances" columns={["Member", "Savings Principal", "Loan Balance"]} rows={[["Mary Phiri", "K15,000", "K4,600"]]} />
        <Modal open title="Member details"><p>Traceable statement</p></Modal>
      </>
    );

    expect(html).toContain("Approve Inputs");
    expect(html).toContain("aria-label=\"View member details\"");
    expect(html).toContain("data-label=\"Savings Principal\"");
    expect(html).toContain("<caption>Member balances</caption>");
    expect(html).toContain("role=\"dialog\"");
    expect(html).toContain("aria-modal=\"true\"");
  });

  it("keeps mobile, focus, and overflow safeguards in CSS", () => {
    const cssFiles = [
      "src/styles/app.css",
      "src/styles/layouts.css",
      "src/styles/member-dashboard.css",
      "src/styles/member-declaration.css",
      "src/styles/member-statement.css",
      "src/styles/notifications.css",
    ].map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");

    for (const token of [
      "@media (max-width: 767px)",
      "@media (max-width: 900px)",
      "overflow-wrap: anywhere",
      "-webkit-overflow-scrolling: touch",
      "*:focus-visible",
      ".skip-link:focus",
      ".sidebar.open",
      ".mobile-only",
      ".table-wrap",
      "grid-template-columns",
    ]) {
      expect(cssFiles).toContain(token);
    }
  });

  it("uses HttpOnly cookie sessions instead of browser token storage", () => {
    const clientSource = fs.readFileSync(path.join(process.cwd(), "src/api/client.js"), "utf8");
    expect(clientSource).toContain("credentials: \"include\"");
    expect(clientSource).not.toContain("localStorage");
    expect(clientSource).not.toContain("Authorization");
    expect(clientSource).not.toContain("Bearer");
  });
});
