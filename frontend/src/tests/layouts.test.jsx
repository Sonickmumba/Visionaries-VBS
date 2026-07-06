import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppLayout, AuthLayout, Page, ProtectedRoute, adminNav, memberNav, routeLabel } from "../layouts/AppLayouts.jsx";

const admin = { id: "u1", role: "ADMIN", is_active: true };
const member = { id: "u2", role: "MEMBER", is_active: true };

describe("app layouts", () => {
  it("exposes admin and member navigation labels", () => {
    expect(adminNav.map((item) => item[0])).toContain("dashboard");
    expect(memberNav.map((item) => item[0])).toContain("my-statement");
    expect(memberNav.map((item) => item[0])).toContain("my-reports");
    expect(memberNav.map((item) => item[0])).toContain("my-notifications");
    expect(adminNav.map((item) => item[0])).toContain("notifications");
    expect(routeLabel("common-interest")).toBe("Common Interest");
    expect(routeLabel("my-reports")).toBe("Reports");
    expect(routeLabel("my-notifications")).toBe("Notifications");
  });

  it("renders public auth layout", () => {
    const html = renderToStaticMarkup(<AuthLayout><section className="auth-card">Login</section></AuthLayout>);

    expect(html).toContain("Visionaries Village Banking");
    expect(html).toContain("brand-lockup");
    expect(html).toContain("auth-card");
  });

  it("blocks protected content when there is no user", () => {
    const html = renderToStaticMarkup(<ProtectedRoute user={null} fallback={<div>Login required</div>}><div>Secret</div></ProtectedRoute>);

    expect(html).toContain("Login required");
    expect(html).not.toContain("Secret");
  });

  it("renders admin shell with portal header and cycle selectors", () => {
    const html = renderToStaticMarkup(
      <AppLayout user={admin} page="dashboard" setPage={() => {}} onLogout={() => {}}>
        <Page title="Dashboard">Content</Page>
      </AppLayout>
    );

    expect(html).toContain("Admin Portal");
    expect(html).toContain("Visionaries Village Banking");
    expect(html).toContain("brand-mark");
    expect(html).toContain("Financial operations workspace");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Cycle");
    expect(html).toContain("Month");
    expect(html).toContain("Skip to main content");
    expect(html).toContain("id=\"main-content\"");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain("aria-label=\"Admin navigation\"");
    expect(html).toContain("sidebar-profile");
    expect(html).toContain("Admin quick navigation");
    expect(html).toContain("Close navigation");
    expect(html).toContain("Open notifications");
  });

  it("keeps notifications in the header instead of mobile bottom navigation", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/layouts/AppLayouts.jsx"), "utf8");
    const memberMobileNav = fs.readFileSync(path.join(process.cwd(), "src/pages/member/memberMobileNav.js"), "utf8");

    expect(source).toContain("Open notifications");
    expect(source).toContain("[\"dashboard\", \"members\", \"declarations\", \"loans\", \"reports\"]");
    expect(source).toContain("[\"member-dashboard\", \"my-declaration\", \"my-savings\", \"my-loans\", \"my-reports\"]");
    expect(source).not.toContain("[\"dashboard\", \"declarations\", \"loans\", \"notifications\", \"reports\"]");
    expect(memberMobileNav).not.toContain("my-notifications");
    expect(memberMobileNav).not.toContain("Alerts");
  });

  it("renders member shell with member navigation", () => {
    const html = renderToStaticMarkup(
      <AppLayout user={member} page="my-statement" setPage={() => {}} onLogout={() => {}}>
        <Page title="My Statement">Content</Page>
      </AppLayout>
    );

    expect(html).toContain("Member Portal");
    expect(html).toContain("Transparent member access");
    expect(html).toContain("My Statement");
    expect(html).toContain("aria-label=\"Member navigation\"");
    expect(html).not.toContain("Member quick navigation");
  });

  it("keeps responsive shell, action, and table safeguards in CSS", () => {
    const appCss = fs.readFileSync(path.join(process.cwd(), "src/styles/app.css"), "utf8");
    const layoutCss = fs.readFileSync(path.join(process.cwd(), "src/styles/layouts.css"), "utf8");

    expect(appCss).toContain("@media (max-width: 767px)");
    expect(appCss).toContain(".sidebar.open");
    expect(appCss).toContain("*:focus-visible");
    expect(appCss).toContain(".skip-link:focus");
    expect(appCss).toContain(".button-row .btn");
    expect(appCss).toContain("overflow-wrap: anywhere");
    expect(appCss).toContain("-webkit-overflow-scrolling: touch");
    expect(appCss).toContain(".btn:hover:not(:disabled)");
    expect(appCss).toContain(".icon-btn:hover:not(:disabled)");
    expect(appCss).toContain(".panel {\n  background: #F7F4EE;\n  border: 1px solid #E6E8EB;\n  border-radius: 8px;");
    expect(appCss).toContain(".metric {\n  background: #F7F4EE;\n  border: 1px solid #E6E8EB;\n  border-left: 5px solid #127A5A;\n  border-radius: 8px;");
    expect(appCss).toContain(".tabs button.active");
    expect(appCss).toContain("background: var(--portal-accent-soft");
    expect(layoutCss).toContain("@media (max-width: 900px)");
    expect(layoutCss).toContain(".top-selectors .field:nth-child(2)");
    expect(layoutCss).toContain(".top-title-block");
    expect(layoutCss).toContain(".top-member-summary");
    expect(layoutCss).toContain(".top-unread-badge");
    expect(layoutCss).toContain(".mobile-bottom-nav");
    expect(layoutCss).toContain("left: 50%");
    expect(layoutCss).toContain("transform: translateX(-50%)");
    expect(layoutCss).toContain("width: min(452px, calc(100vw - 20px))");
    expect(layoutCss).toContain(".sidebar-profile");
    expect(layoutCss).toContain("backdrop-filter");
    expect(appCss).toContain(".admin-shell");
    expect(appCss).toContain(".member-shell");
    expect(appCss).toContain("--portal-accent");
    expect(appCss).toContain("background: var(--portal-sidebar");
    expect(appCss).toContain("border-left: 4px solid var(--portal-page-line");
    expect(layoutCss).toContain(".member-shell .top-member-summary");
    expect(layoutCss).toContain("color: var(--portal-accent");
  });
});
