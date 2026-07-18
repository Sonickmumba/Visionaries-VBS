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
    expect(html).toContain("Stronger Together.");
    expect(html).toContain("Saving Today, Building Tomorrow.");
    expect(html).toContain("Secure. Reliable. Community Focused.");
    expect(html).toContain("Checking secure session");
    expect(html).toContain("splash-progress");
  });

  it("renders the guest welcome splash with a continue action", () => {
    const html = renderToStaticMarkup(<SplashScreen onContinue={() => {}} />);

    expect(html).toContain("Get Started");
    expect(html).toContain("bg-gradient-to-br");
    expect(html).not.toContain("splash-progress");
  });

  it("keeps splash styles mobile-first and motion-safe", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/SplashScreen.jsx"), "utf8");
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/app.css"), "utf8");

    expect(source).toContain("splashArtwork");
    expect(source).toContain("splashDesktopClass");
    expect(source).toContain("md:grid");
    expect(source).toContain("md:hidden");
    expect(source).toContain("min-h-[min(900px,calc(100svh-24px))]");
    expect(source).toContain("max-[430px]:min-h-[100svh]");
    expect(source).toContain("text-[clamp(44px,5.2vw,72px)]");
    expect(source).toContain("bg-gradient-to-br from-forest to-emerald");
    expect(css).toContain(".brand-mark");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@keyframes splash-progress");
  });

  it("uses matching branded boot markup before React mounts", () => {
    const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");

    expect(html).toContain("boot-phone");
    expect(html).toContain("Visionaries Village Banking");
    expect(html).not.toContain("Preparing the Visionaries financial operations workspace.");
  });
});
