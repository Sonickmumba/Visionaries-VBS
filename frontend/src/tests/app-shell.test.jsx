import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SplashScreen } from "../components/SplashScreen.jsx";

describe("app shell", () => {
  it("renders the branded splash screen while checking the session", () => {
    const html = renderToStaticMarkup(<SplashScreen />);

    expect(html).toContain("Visionaries Village Banking splash screen");
    expect(html).toContain("Visionaries Village Banking");
    expect(html).toContain("Save Together. Grow Together.");
    expect(html).toContain("Track Savings");
    expect(html).toContain("Manage Loans");
    expect(html).toContain("Share Interest");
    expect(html).toContain("Checking secure session");
    expect(html).toContain("splash-progress");
  });

  it("renders the guest welcome splash with a continue action", () => {
    const html = renderToStaticMarkup(<SplashScreen onContinue={() => {}} />);

    expect(html).toContain("Continue");
    expect(html).toContain("splash-continue");
    expect(html).not.toContain("splash-progress");
  });

  it("keeps splash styles mobile-first and motion-safe", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/app.css"), "utf8");

    expect(css).toContain(".splash-screen");
    expect(css).toContain(".brand-mark");
    expect(css).toContain(".splash-features");
    expect(css).toContain(".splash-continue");
    expect(css).toContain("100svh");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@keyframes splash-progress");
  });

  it("uses matching branded boot markup before React mounts", () => {
    const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");

    expect(html).toContain("boot-phone");
    expect(html).toContain("Save Together. Grow Together.");
    expect(html).not.toContain("Preparing the Visionaries financial operations workspace.");
  });
});
