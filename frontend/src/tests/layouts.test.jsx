import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppLayout, AuthLayout, Page, ProtectedRoute, adminNav, memberNav, routeLabel } from "../layouts/AppLayouts.jsx";

const admin = { id: "u1", role: "ADMIN", is_active: true };
const member = { id: "u2", role: "MEMBER", is_active: true };

describe("app layouts", () => {
  it("exposes admin and member navigation labels", () => {
    expect(adminNav.map((item) => item[0])).toContain("dashboard");
    expect(memberNav.map((item) => item[0])).toContain("my-statement");
    expect(routeLabel("common-interest")).toBe("Common Interest");
  });

  it("renders public auth layout", () => {
    const html = renderToStaticMarkup(<AuthLayout><section className="auth-card">Login</section></AuthLayout>);

    expect(html).toContain("Village Bank");
    expect(html).toContain("auth-card");
  });

  it("blocks protected content when there is no user", () => {
    const html = renderToStaticMarkup(<ProtectedRoute user={null} fallback={<div>Login required</div>}><div>Secret</div></ProtectedRoute>);

    expect(html).toContain("Login required");
    expect(html).not.toContain("Secret");
  });

  it("renders admin shell with breadcrumbs and cycle selectors", () => {
    const html = renderToStaticMarkup(
      <AppLayout user={admin} page="dashboard" setPage={() => {}} onLogout={() => {}}>
        <Page title="Dashboard">Content</Page>
      </AppLayout>
    );

    expect(html).toContain("Admin Portal");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Cycle");
    expect(html).toContain("Month");
    expect(html).toContain("aria-label=\"Admin navigation\"");
  });

  it("renders member shell with member navigation", () => {
    const html = renderToStaticMarkup(
      <AppLayout user={member} page="my-statement" setPage={() => {}} onLogout={() => {}}>
        <Page title="My Statement">Content</Page>
      </AppLayout>
    );

    expect(html).toContain("Member Portal");
    expect(html).toContain("My Statement");
    expect(html).toContain("aria-label=\"Member navigation\"");
  });
});
