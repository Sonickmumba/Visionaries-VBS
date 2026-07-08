import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Tailwind foundation", () => {
  it("uses the approved Visionaries palette and keeps preflight disabled", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "tailwind.config.cjs"), "utf8");

    for (const color of ["#0D3B2E", "#127A5A", "#D9A227", "#F7F4EE", "#E6E8EB", "#1F2933", "#E25D5D"]) {
      expect(config).toContain(color);
    }

    expect(config).toContain("preflight: false");
    expect(config).toContain("content: [\"./index.html\", \"./src/**/*.{js,jsx}\"]");
  });

  it("loads Tailwind after existing app CSS for incremental migration", () => {
    const main = fs.readFileSync(path.join(process.cwd(), "src/main.jsx"), "utf8");
    const tailwindCss = fs.readFileSync(path.join(process.cwd(), "src/styles/tailwind.css"), "utf8");

    expect(main.indexOf("./styles/app.css")).toBeLessThan(main.indexOf("./styles/tailwind.css"));
    expect(tailwindCss).toContain("@tailwind base;");
    expect(tailwindCss).toContain("@tailwind components;");
    expect(tailwindCss).toContain("@tailwind utilities;");
    expect(tailwindCss).toContain(".tw-app-card");
    expect(tailwindCss).toContain(".tw-primary-action");
  });
});
