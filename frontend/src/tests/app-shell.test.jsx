import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SplashScreen } from "../App.jsx";

describe("app shell", () => {
  it("renders the branded splash screen while checking the session", () => {
    const html = renderToStaticMarkup(<SplashScreen />);

    expect(html).toContain("Visionaries Village Banking splash screen");
    expect(html).toContain("Visionaries Village Banking");
    expect(html).toContain("Save Together. Grow Together.");
    expect(html).toContain("Checking secure session");
    expect(html).toContain("splash-progress");
  });

  it("keeps splash styles mobile-first and motion-safe", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/app.css"), "utf8");

    expect(css).toContain(".splash-screen");
    expect(css).toContain("100svh");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@keyframes splash-progress");
  });
});
