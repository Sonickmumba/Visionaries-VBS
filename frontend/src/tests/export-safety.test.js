import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvCell, escapeHtml } from "../utils/exportSafety.js";

describe("export safety", () => {
  it("escapes HTML for printable reports", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("quotes CSV and neutralizes spreadsheet formulas", () => {
    expect(escapeCsvCell('Mary "M"')).toBe('"Mary ""M"""');
    expect(escapeCsvCell("=IMPORTXML(\"https://evil.test\")")).toBe('"\'=IMPORTXML(""https://evil.test"")"');
    expect(buildCsv([["Name", "Amount"], ["+SUM(1,2)", 150]])).toBe('"Name","Amount"\n"\'+SUM(1,2)","150"');
  });
});
