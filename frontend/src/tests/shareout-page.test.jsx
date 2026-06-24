import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareoutPage } from "../pages/admin/ShareoutPage.jsx";
import { MemberShareoutPage } from "../pages/member/MemberShareoutPage.jsx";

describe("shareout screens", () => {
  it("renders admin shareout controls and surplus language", () => {
    const html = renderToStaticMarkup(
      <ShareoutPage
        apiClient={async () => ({ data: null })}
      />
    );

    expect(html).toContain("Cycle Shareout");
    expect(html).toContain("Generate Preview");
    expect(html).toContain("Surplus Fund");
    expect(html).toContain("Member Shareout");
    expect(html).toContain("Post Shareout");
    expect(html).toContain("15%");
  });

  it("renders member shareout as read-only with mobile navigation", () => {
    const html = renderToStaticMarkup(<MemberShareoutPage setPage={() => {}} />);

    expect(html).toContain("My Shareout");
    expect(html).toContain("My End-of-Cycle Shareout");
    expect(html).toContain("Status");
    expect(html).toContain("my-shareout");
    expect(html).not.toContain("Post Shareout and Close Cycle");
  });

  it("keeps shareout implementation separate from savings and loan engines", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/admin/ShareoutPage.jsx"), "utf8");

    expect(source).toContain("/shareout/preview");
    expect(source).toContain("/shareout/post");
    expect(source).toContain("/shareout/surplus");
    expect(source).not.toContain("/monthly-closing/run");
    expect(source).not.toContain("/loans/disbursements");
    expect(source).not.toContain("/savings/deposits");
  });
});
