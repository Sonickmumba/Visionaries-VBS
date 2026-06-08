const fs = require("fs");
const path = require("path");

const out = "outputs/village-banking-complete-mockup-design-pack.pdf";

const PAGE = { w: 842, h: 595, m: 34 };
const colors = {
  ink: "#172033",
  muted: "#65758b",
  line: "#d8e1eb",
  bg: "#f6f8fb",
  panel: "#ffffff",
  primary: "#166534",
  primary2: "#0f766e",
  accent: "#2563eb",
  warn: "#b45309",
  danger: "#b42318",
  successBg: "#dcfce7",
  infoBg: "#dbeafe",
  warnBg: "#fef3c7",
  dangerBg: "#fee2e2",
  dark: "#0f172a",
  sidebar: "#102a43",
  soft: "#eef4f8",
};

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

function esc(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

class Pdf {
  constructor() {
    this.pages = [];
    this.ops = [];
  }

  page(title, subtitle) {
    if (this.ops.length) this.pages.push(this.ops.join("\n"));
    this.ops = [];
    this.rect(0, 0, PAGE.w, PAGE.h, colors.bg);
    this.text(title, PAGE.m, 34, 20, "F1", colors.ink);
    if (subtitle) this.text(subtitle, PAGE.m, 58, 9, "F2", colors.muted);
  }

  finish() {
    if (this.ops.length) this.pages.push(this.ops.join("\n"));
  }

  raw(s) {
    this.ops.push(s);
  }

  color(hex, stroke = false) {
    const [r, g, b] = hexToRgb(hex);
    this.raw(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${stroke ? "RG" : "rg"}`);
  }

  rect(x, yTop, w, h, fill = null, stroke = null, lw = 1) {
    const y = PAGE.h - yTop - h;
    this.raw("q");
    if (fill) this.color(fill);
    if (stroke) {
      this.color(stroke, true);
      this.raw(`${lw} w`);
    }
    this.raw(`${x} ${y} ${w} ${h} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
    this.raw("Q");
  }

  line(x1, y1Top, x2, y2Top, color = colors.line, lw = 1) {
    this.raw("q");
    this.color(color, true);
    this.raw(`${lw} w`);
    this.raw(`${x1} ${PAGE.h - y1Top} m ${x2} ${PAGE.h - y2Top} l S`);
    this.raw("Q");
  }

  text(text, x, yTop, size = 9, font = "F2", color = colors.ink, maxChars = null, leading = null) {
    const lines = maxChars ? wrap(text, maxChars) : [text];
    const lineHeight = leading || size + 3;
    this.raw("BT");
    this.color(color);
    this.raw(`/${font} ${size} Tf`);
    lines.forEach((line, index) => {
      const y = PAGE.h - yTop - index * lineHeight;
      this.raw(`${x} ${y.toFixed(2)} Td (${esc(line)}) Tj`);
      this.raw(`${-x} ${-y.toFixed(2)} Td`);
    });
    this.raw("ET");
    return yTop + (lines.length - 1) * lineHeight;
  }

  pill(text, x, y, w, fill, color = colors.ink) {
    this.rect(x, y, w, 18, fill, null);
    this.text(text, x + 7, y + 12, 7.5, "F1", color);
  }

  card(x, y, w, h, title, value, note, accent = colors.primary) {
    this.rect(x, y, w, h, colors.panel, colors.line);
    this.rect(x, y, 4, h, accent);
    this.text(title, x + 13, y + 18, 8, "F1", colors.muted);
    this.text(value, x + 13, y + 43, 18, "F1", colors.ink);
    if (note) this.text(note, x + 13, y + 61, 7.5, "F2", colors.muted);
  }

  table(x, y, cols, rows, widths) {
    const rowH = 24;
    let cx = x;
    this.rect(x, y, widths.reduce((a, b) => a + b, 0), rowH, colors.soft, colors.line);
    cols.forEach((col, i) => {
      this.text(col, cx + 7, y + 15, 7.2, "F1", colors.muted);
      cx += widths[i];
    });
    rows.forEach((row, r) => {
      const yy = y + rowH * (r + 1);
      this.rect(x, yy, widths.reduce((a, b) => a + b, 0), rowH, colors.panel, colors.line);
      cx = x;
      row.forEach((cell, i) => {
        this.text(cell, cx + 7, yy + 15, 7.4, "F2", colors.ink);
        cx += widths[i];
      });
    });
  }

  appFrame(active, title) {
    this.rect(34, 84, 774, 456, colors.panel, colors.line);
    this.rect(34, 84, 148, 456, colors.sidebar);
    this.text("Village Bank", 52, 111, 13, "F1", "#ffffff");
    const nav = ["Dashboard", "Cycles", "Members", "Declarations", "Savings", "Loans", "Common Interest", "Penalties", "Monthly Closing", "Ledger", "Reports", "Audit Trail"];
    nav.forEach((n, i) => {
      const y = 140 + i * 25;
      if (n === active) this.rect(46, y - 13, 118, 20, "#1e4f78");
      this.text(n, 55, y, 7.7, n === active ? "F1" : "F2", "#e7eef7");
    });
    this.rect(182, 84, 626, 52, "#ffffff", colors.line);
    this.text(title, 202, 113, 13, "F1", colors.ink);
    this.pill("Cycle 2026", 613, 100, 72, colors.infoBg, colors.accent);
    this.pill("March", 694, 100, 52, colors.soft, colors.ink);
    this.pill("Admin", 754, 100, 38, colors.successBg, colors.primary);
  }
}

const pdf = new Pdf();

function styleGuide() {
  pdf.page("Village Banking Mockup Design Pack", "Visual direction, screen mockups, and workflow guidance");
  pdf.rect(34, 92, 774, 418, colors.panel, colors.line);
  pdf.text("Design Personality", 58, 126, 15, "F1");
  pdf.text("Quiet financial operations interface: clear, auditable, compact, and built for repeated monthly work.", 58, 150, 10, "F2", colors.muted, 90);
  pdf.text("Typography", 58, 195, 12, "F1");
  pdf.text("Primary app font: Inter. Fallbacks: system-ui, Segoe UI, Helvetica, Arial, sans-serif.", 58, 214, 9);
  pdf.text("Page titles: 20-24px semibold. Section titles: 14-16px semibold. Tables/forms: 13-14px regular.", 58, 231, 9);
  pdf.text("Color Palette", 450, 126, 12, "F1");
  const swatches = [
    ["Ink", colors.ink], ["Muted", colors.muted], ["Primary", colors.primary],
    ["Teal", colors.primary2], ["Blue", colors.accent], ["Warning", colors.warn],
    ["Danger", colors.danger], ["Surface", colors.bg],
  ];
  swatches.forEach(([name, c], i) => {
    const x = 450 + (i % 2) * 145;
    const y = 146 + Math.floor(i / 2) * 42;
    pdf.rect(x, y, 30, 24, c, colors.line);
    pdf.text(name, x + 38, y + 10, 8, "F1");
    pdf.text(c, x + 38, y + 23, 7, "F2", colors.muted);
  });
  pdf.text("UI Rules", 58, 280, 12, "F1");
  [
    "Use dense tables for financial records and compact cards for totals.",
    "Every amount should drill into its ledger source.",
    "Use badges for compliance, locked states, approvals, and penalties.",
    "Keep destructive actions behind confirmation dialogs with reason fields.",
    "Avoid decorative hero layouts. This is an operations product."
  ].forEach((t, i) => pdf.text(`• ${t}`, 72, 302 + i * 18, 9));
}

function flowPage() {
  pdf.page("Primary App Flow", "Admin and member journeys through the monthly operating cycle");
  const nodes = [
    ["Cycle Setup", 62, 128, colors.infoBg],
    ["Enroll Members", 210, 128, colors.infoBg],
    ["Monthly Declarations", 358, 128, colors.successBg],
    ["Loan Payout Window", 526, 128, colors.warnBg],
    ["Monthly Closing", 62, 278, colors.successBg],
    ["Interest + Penalties", 230, 278, colors.warnBg],
    ["Common Interest", 398, 278, colors.infoBg],
    ["Lock Month + Reports", 566, 278, colors.dangerBg],
  ];
  nodes.forEach(([label, x, y, fill]) => {
    pdf.rect(x, y, 118, 56, fill, colors.line);
    pdf.text(label, x + 14, y + 32, 10, "F1", colors.ink);
  });
  [[180,156,210,156],[328,156,358,156],[476,156,526,156],[121,184,121,278],[180,306,230,306],[348,306,398,306],[516,306,566,306]].forEach(([x1,y1,x2,y2]) => pdf.line(x1,y1,x2,y2,colors.primary,1.8));
  pdf.text("Member Flow", 82, 420, 12, "F1");
  pdf.text("Login -> View obligations -> Submit declaration -> Track savings, loans, penalties, and statements.", 82, 442, 9, "F2", colors.muted);
  pdf.text("Admin Flow", 82, 474, 12, "F1");
  pdf.text("Configure cycle -> approve activity -> post ledger transactions -> run closing -> review snapshots -> lock month.", 82, 496, 9, "F2", colors.muted);
}

function dashboard() {
  pdf.page("Screen 1: Admin Dashboard", "First admin screen: current month health, pending actions, and financial totals");
  pdf.appFrame("Dashboard", "Admin Dashboard");
  const x = 202, y = 158;
  pdf.card(x, y, 135, 76, "Savings Collected", "K84,000", "+K6,000 this month", colors.primary);
  pdf.card(x + 150, y, 135, 76, "Loans Outstanding", "K51,500", "11 active balances", colors.accent);
  pdf.card(x + 300, y, 135, 76, "Common Interest", "K4,200", "Preview for March", colors.primary2);
  pdf.card(x + 450, y, 135, 76, "Unpaid Penalties", "K700", "7 members flagged", colors.warn);
  pdf.rect(x, 252, 360, 196, colors.panel, colors.line);
  pdf.text("Monthly Closing Progress", x + 18, 278, 12, "F1");
  ["Validate inputs", "Assess declarations", "Calculate interest", "Allocate common interest", "Review and lock"].forEach((s, i) => {
    pdf.pill(i < 2 ? "Done" : i === 2 ? "Now" : "Next", x + 20, 304 + i * 25, 44, i < 2 ? colors.successBg : i === 2 ? colors.infoBg : colors.soft, i < 2 ? colors.primary : colors.accent);
    pdf.text(s, x + 76, 317 + i * 25, 8.5);
  });
  pdf.rect(x + 382, 252, 203, 196, colors.panel, colors.line);
  pdf.text("Priority Queue", x + 400, 278, 12, "F1");
  [["5", "Loan approvals"], ["7", "Failed declarations"], ["3", "Penalty conversions"], ["1", "Month ready to close"]].forEach(([n, t], i) => {
    pdf.text(n, x + 404, 311 + i * 34, 16, "F1", i === 1 ? colors.warn : colors.primary);
    pdf.text(t, x + 434, 311 + i * 34, 8.5);
  });
}

function cycleSetup() {
  pdf.page("Screen 2: Cycle Setup", "Cycle-specific business rules before members begin operating");
  pdf.appFrame("Cycles", "Create Cycle");
  const sections = [
    ["Cycle Dates", 202, 158, [["Start date", "01 Jan 2026"], ["End date", "31 Dec 2026"], ["Rounding", "HALF_UP, 2 decimals"]]],
    ["Savings Rules", 508, 158, [["Savings cap", "K30,000"], ["Savings interest", "15% monthly"], ["Social fund", "K240 once"]]],
    ["Loan Rules", 202, 306, [["Minimum borrowing", "K20,000"], ["Loan interest", "15% monthly"], ["Payout window", "4th to 5th"]]],
    ["Penalty Rules", 508, 306, [["Failure to declare", "K100"], ["Convertible", "Yes"], ["Declaration window", "28th to 3rd"]]],
  ];
  sections.forEach(([title, x, y, rows]) => {
    pdf.rect(x, y, 278, 118, colors.panel, colors.line);
    pdf.text(title, x + 16, y + 25, 12, "F1");
    rows.forEach(([k, v], i) => {
      pdf.text(k, x + 18, y + 53 + i * 24, 8, "F2", colors.muted);
      pdf.text(v, x + 145, y + 53 + i * 24, 9, "F1");
    });
  });
}

function members() {
  pdf.page("Screen 3: Members", "Operational member table with compliance and balances");
  pdf.appFrame("Members", "Members");
  pdf.rect(202, 154, 586, 44, colors.panel, colors.line);
  pdf.text("Search members, filter by declaration, borrowing compliance, or penalty status", 220, 181, 9, "F2", colors.muted);
  pdf.table(202, 218, ["Member", "Savings", "Borrowed", "Loan", "Declaration", "Compliance", "Penalty"], [
    ["M. Phiri", "K12,500", "K0", "K0", "Missed", "Never", "K100"],
    ["A. Banda", "K30,000", "K22,000", "K8,900", "Declared", "Met", "K0"],
    ["T. Mwansa", "K18,000", "K9,000", "K10,350", "Declared", "Below", "K0"],
    ["L. Tembo", "K25,000", "K20,000", "K4,100", "Declared", "Met", "K0"],
    ["N. Chanda", "K7,500", "K0", "K0", "Missed", "Never", "K100"],
  ], [95, 72, 76, 68, 84, 78, 62]);
}

function statement() {
  pdf.page("Screen 4: Member Statement", "Traceable monthly statement with running financial components");
  pdf.appFrame("Members", "Member Statement: Mary Phiri");
  pdf.card(202, 158, 135, 68, "Accumulated Savings", "K14,375", "Principal K12,500", colors.primary);
  pdf.card(352, 158, 135, 68, "Outstanding Loan", "K0", "No active loan", colors.accent);
  pdf.card(502, 158, 135, 68, "Borrowing Status", "Never", "K20,000 shortfall", colors.warn);
  pdf.card(652, 158, 135, 68, "Penalties", "K100", "Failure to declare", colors.danger);
  pdf.table(202, 254, ["Date", "Type", "Debit", "Credit", "Balance", "Source"], [
    ["01 Mar", "B/F savings", "-", "-", "K12,500", "Feb close"],
    ["03 Mar", "Savings interest", "-", "K1,875", "K14,375", "Monthly close"],
    ["04 Mar", "Penalty assessed", "K100", "-", "K100 due", "Missed declaration"],
    ["05 Mar", "Common interest", "K430", "-", "K430 due", "Allocation run"],
  ], [64, 132, 70, 70, 82, 132]);
}

function declaration() {
  pdf.page("Screen 5: Declaration Form", "Member-facing monthly declaration with window status");
  pdf.appFrame("Declarations", "Submit Declaration");
  pdf.rect(202, 154, 586, 42, colors.successBg, colors.line);
  pdf.text("Declaration window open: 28 Feb 2026 to 3 Mar 2026", 222, 180, 10, "F1", colors.primary);
  const fields = [["Savings amount", "K1,000"], ["Loan request", "K5,000"], ["Loan top-up", "K0"], ["Principal repayment", "K0"], ["Loan interest repayment", "K0"], ["Common-interest payment", "K430"]];
  fields.forEach(([label, value], i) => {
    const x = 222 + (i % 2) * 282;
    const y = 230 + Math.floor(i / 2) * 70;
    pdf.text(label, x, y, 8, "F1", colors.muted);
    pdf.rect(x, y + 10, 240, 34, colors.panel, colors.line);
    pdf.text(value, x + 12, y + 32, 11, "F2");
  });
  pdf.rect(222, 456, 116, 34, colors.primary);
  pdf.text("Submit Declaration", 238, 478, 9, "F1", "#ffffff");
}

function loanApproval() {
  pdf.page("Screen 6: Loan Approval", "Admin review queue for original loans and top-ups");
  pdf.appFrame("Loans", "Loan Approval Queue");
  pdf.table(202, 166, ["Member", "Type", "Requested", "Borrowed", "Outstanding", "Status", "Action"], [
    ["A. Banda", "Top-up", "K3,000", "K22,000", "K8,900", "Pending", "Approve"],
    ["M. Phiri", "Original", "K5,000", "K0", "K0", "Pending", "Review"],
    ["T. Mwansa", "Original", "K11,000", "K9,000", "K10,350", "Pending", "Approve"],
  ], [92, 75, 75, 75, 82, 72, 75]);
  pdf.rect(202, 304, 586, 136, colors.panel, colors.line);
  pdf.text("Approval Drawer", 222, 330, 12, "F1");
  pdf.text("Shows effect before posting: new loan principal, expected monthly interest, cumulative borrowed amount, and ledger transaction preview.", 222, 354, 9, "F2", colors.muted, 88);
  pdf.rect(222, 396, 92, 30, colors.primary);
  pdf.text("Approve", 248, 416, 9, "F1", "#ffffff");
  pdf.rect(326, 396, 92, 30, colors.panel, colors.danger);
  pdf.text("Reject", 355, 416, 9, "F1", colors.danger);
}

function closing() {
  pdf.page("Screen 7: Monthly Closing Wizard", "Controlled workflow for official monthly processing");
  pdf.appFrame("Monthly Closing", "March Closing");
  const steps = ["Validate Inputs", "Declarations", "Penalties", "Savings Interest", "Loan Interest", "Common Interest", "Review", "Lock"];
  steps.forEach((s, i) => {
    const x = 212 + i * 70;
    pdf.rect(x, 158, 42, 42, i < 3 ? colors.successBg : i === 3 ? colors.infoBg : colors.soft, colors.line);
    pdf.text(String(i + 1), x + 16, 183, 13, "F1", i < 3 ? colors.primary : colors.accent);
    pdf.text(s, x - 7, 218, 6.5, "F2", colors.muted);
  });
  pdf.rect(202, 256, 586, 190, colors.panel, colors.line);
  pdf.text("Step 4: Calculate Savings Interest", 222, 286, 14, "F1");
  pdf.text("Formula: savings interest = 15% x (brought forward accumulated savings + current month deposit).", 222, 314, 9, "F2", colors.muted, 86);
  pdf.table(222, 342, ["Members", "Base", "Interest", "Exceptions"], [
    ["42", "K116,400", "K17,460", "0"],
    ["Cap warnings", "2 members", "-", "Needs review"],
  ], [90, 100, 100, 132]);
}

function commonInterest() {
  pdf.page("Screen 8: Common-Interest Allocation", "Transparent allocation based on borrowing compliance");
  pdf.appFrame("Common Interest", "Common Interest Allocation");
  pdf.card(202, 158, 135, 68, "Pool Contributions", "K96,000", "Savings + fees", colors.primary);
  pdf.card(352, 158, 135, 68, "Loans Issued", "K68,000", "March payouts", colors.accent);
  pdf.card(502, 158, 135, 68, "Unborrowed Money", "K28,000", "Contribution less loans", colors.warn);
  pdf.card(652, 158, 135, 68, "CI Pool", "K4,200", "15% of unborrowed", colors.primary2);
  pdf.table(202, 258, ["Member", "Borrowed", "Status", "Shortfall", "Weight", "Base", "Charge"], [
    ["M. Phiri", "K0", "Never", "K20,000", "0.40", "K11,200", "K1,680"],
    ["N. Chanda", "K0", "Never", "K20,000", "0.40", "K11,200", "K1,680"],
    ["T. Mwansa", "K9,000", "Below", "K11,000", "0.20", "K5,600", "K840"],
  ], [86, 74, 72, 78, 62, 74, 72]);
}

function penalties() {
  pdf.page("Screen 9: Penalties", "Assess, pay, waive, or convert penalties into auditable loan balances");
  pdf.appFrame("Penalties", "Penalty Management");
  pdf.table(202, 166, ["Member", "Month", "Type", "Assessed", "Paid", "Status", "Action"], [
    ["M. Phiri", "Mar", "Failure declare", "K100", "K0", "Assessed", "Convert"],
    ["N. Chanda", "Mar", "Failure declare", "K100", "K0", "Assessed", "Mark paid"],
    ["B. Zulu", "Feb", "Late payment", "K50", "K50", "Paid", "View"],
  ], [86, 54, 116, 72, 58, 84, 76]);
  pdf.rect(202, 304, 586, 130, colors.dangerBg, colors.line);
  pdf.text("Conversion Confirmation", 222, 332, 12, "F1", colors.danger);
  pdf.text("Converting an unpaid penalty creates a CONVERTED_PENALTY_LOAN ledger transaction. It becomes part of standing loan balance and starts accruing monthly loan interest.", 222, 358, 9, "F2", colors.ink, 88);
  pdf.text("Required: admin approval and reason.", 222, 400, 9, "F1", colors.danger);
}

function reports() {
  pdf.page("Screen 10: Reports", "Exportable reports driven by ledger and official monthly snapshots");
  pdf.appFrame("Reports", "Reports");
  const cards = [
    ["Member Statements", "Monthly and cycle-wide balances"],
    ["Pool Summary", "Inflows, loans, unborrowed money"],
    ["Savings Report", "Principal, interest, cap progress"],
    ["Loan Report", "Disbursements, repayments, balances"],
    ["Common Interest", "Eligibility, shortfall, charges"],
    ["Penalty Report", "Assessed, paid, converted, waived"],
  ];
  cards.forEach(([t, n], i) => {
    const x = 210 + (i % 3) * 190;
    const y = 166 + Math.floor(i / 3) * 106;
    pdf.rect(x, y, 166, 78, colors.panel, colors.line);
    pdf.text(t, x + 16, y + 28, 11, "F1");
    pdf.text(n, x + 16, y + 51, 8, "F2", colors.muted, 26);
  });
  pdf.rect(210, 404, 548, 44, colors.soft, colors.line);
  pdf.text("Filters: Cycle, Month, Member, Status, Date Range, Export PDF/CSV", 232, 431, 9, "F1", colors.ink);
}

function memberDashboard() {
  pdf.page("Screen 11: Member Dashboard", "Simplified member experience focused on obligations and personal progress");
  pdf.rect(34, 84, 774, 456, colors.panel, colors.line);
  pdf.rect(34, 84, 774, 54, "#ffffff", colors.line);
  pdf.text("Village Bank", 58, 117, 14, "F1", colors.primary);
  pdf.text("My Dashboard", 214, 117, 13, "F1");
  pdf.pill("Declaration Open", 654, 102, 94, colors.successBg, colors.primary);
  pdf.card(64, 166, 160, 76, "My Savings", "K14,375", "Interest included", colors.primary);
  pdf.card(244, 166, 160, 76, "My Loan", "K0", "No standing loan", colors.accent);
  pdf.card(424, 166, 160, 76, "Common Interest Due", "K1,680", "Due this month", colors.warn);
  pdf.card(604, 166, 160, 76, "Penalty", "K100", "Missed declaration", colors.danger);
  pdf.rect(64, 280, 700, 132, colors.panel, colors.line);
  pdf.text("This Month", 84, 308, 13, "F1");
  pdf.text("Submit declaration, pay obligations, and track progress toward the K20,000 borrowing requirement.", 84, 334, 9, "F2", colors.muted);
  pdf.rect(84, 370, 132, 34, colors.primary);
  pdf.text("Submit Declaration", 105, 392, 9, "F1", "#ffffff");
}

function button(label, x, y, w, kind = "primary") {
  const fill = kind === "primary" ? colors.primary : kind === "danger" ? colors.danger : kind === "blue" ? colors.accent : colors.panel;
  const stroke = kind === "secondary" ? colors.line : null;
  const textColor = kind === "secondary" ? colors.ink : "#ffffff";
  pdf.rect(x, y, w, 28, fill, stroke);
  pdf.text(label, x + 12, y + 18, 8, "F1", textColor);
}

function input(label, value, x, y, w = 230) {
  pdf.text(label, x, y, 7.5, "F1", colors.muted);
  pdf.rect(x, y + 8, w, 30, colors.panel, colors.line);
  pdf.text(value, x + 10, y + 27, 8.5, "F2", colors.ink);
}

function tabbar(tabs, active, x, y) {
  let cx = x;
  tabs.forEach((tab) => {
    const w = Math.max(56, tab.length * 5.3 + 18);
    pdf.rect(cx, y, w, 26, tab === active ? colors.infoBg : colors.panel, colors.line);
    pdf.text(tab, cx + 9, y + 17, 7.5, tab === active ? "F1" : "F2", tab === active ? colors.accent : colors.muted);
    cx += w + 4;
  });
}

function authFrame(title, subtitle) {
  pdf.rect(34, 84, 774, 456, colors.panel, colors.line);
  pdf.rect(34, 84, 310, 456, colors.sidebar);
  pdf.text("Village Bank", 68, 140, 24, "F1", "#ffffff");
  pdf.text("Cycle-based savings, lending, declarations, penalties, and audit-ready monthly closing.", 68, 176, 11, "F2", "#dbeafe", 36);
  pdf.text("Design: calm finance system, not a marketing site.", 68, 420, 9, "F1", "#dbeafe");
  pdf.text(title, 414, 150, 20, "F1", colors.ink);
  pdf.text(subtitle, 414, 178, 9, "F2", colors.muted);
}

function screenInventory() {
  pdf.page("Complete Screen Inventory", "Pages included in the app mockup and how they group together");
  const groups = [
    ["Authentication", "Login, Sign Up, Forgot Password, Reset Password"],
    ["Admin Home", "Dashboard, notifications, priority queue"],
    ["Cycles", "Cycle List, Create/Edit Cycle, Cycle Detail, Month Calendar"],
    ["Members", "Member List, Create Member, Member Detail, Savings, Loans, Declarations, Penalties, Statement, Audit"],
    ["Declarations", "Declaration Queue, Submit/Edit Declaration, Declaration Detail"],
    ["Savings + Contributions", "Post Savings, Social Fund, Membership Fee, cap warnings"],
    ["Loans", "Loan Requests, Approval Drawer, Disbursement, Repayment, Loan Detail"],
    ["Common Interest", "Run Preview, Allocation Detail, Override"],
    ["Penalties", "Penalty List, Payment, Conversion, Waiver/Reversal"],
    ["Monthly Closing", "Wizard steps, Review Snapshots, Lock Month"],
    ["Ledger + Audit", "Ledger Explorer, Transaction Detail, Audit Trail"],
    ["Reports + Settings", "Report Center, Exports, Users/Roles, Penalty Types, Rounding"],
    ["Member Portal", "Member Dashboard, My Declaration, My Statement, My Loans, My Savings, My Penalties"],
  ];
  pdf.table(58, 104, ["Area", "Screens"], groups, [150, 590]);
}

function authScreens() {
  pdf.page("Auth Screen: Login", "Entry point for administrators and members");
  authFrame("Log in", "Use email and password to access the correct portal.");
  input("Email", "mary@example.com", 414, 214, 284);
  input("Password", "••••••••••", 414, 268, 284);
  pdf.text("□ Remember me", 414, 326, 8, "F2", colors.muted);
  pdf.text("Forgot password?", 608, 326, 8, "F1", colors.accent);
  button("Log In", 414, 358, 130, "primary");
  button("Create Account", 556, 358, 142, "secondary");
  pdf.text("Navigation: Log In -> Admin Dashboard or Member Dashboard depending on role.", 414, 426, 8.5, "F1", colors.primary, 48);

  pdf.page("Auth Screen: Sign Up", "Member account request or admin-created user invitation");
  authFrame("Create account", "Used for member self-registration where allowed, or invitation acceptance.");
  input("First name", "Mary", 414, 206, 132);
  input("Last name", "Phiri", 566, 206, 132);
  input("Phone", "+260 97 000 0000", 414, 260, 284);
  input("Email", "mary@example.com", 414, 314, 284);
  input("Password", "Minimum 8 characters", 414, 368, 284);
  button("Create Account", 414, 426, 132, "primary");
  button("Back to Login", 558, 426, 118, "secondary");

  pdf.page("Auth Screen: Password Recovery", "Forgot and reset password states");
  authFrame("Reset access", "Two-step recovery: request link, then set a new password.");
  input("Email", "mary@example.com", 414, 218, 284);
  button("Send Reset Link", 414, 272, 138, "blue");
  pdf.line(414, 326, 700, 326, colors.line);
  input("New password", "••••••••••", 414, 356, 284);
  input("Confirm password", "••••••••••", 414, 410, 284);
  button("Update Password", 414, 468, 140, "primary");
}

function navigationMap() {
  pdf.page("Navigation Flow Map", "How the main pages follow each other");
  const cols = [
    ["Login", "Role check", "Admin Dashboard", "Member Dashboard"],
    ["Admin Dashboard", "Cycle", "Members", "Declarations", "Loans", "Monthly Closing", "Reports"],
    ["Members", "Member Detail", "Statement", "Savings", "Loans", "Penalties", "Audit"],
    ["Monthly Closing", "Validate", "Penalties", "Interest", "Common Interest", "Review", "Lock Month"],
    ["Member Dashboard", "My Declaration", "My Statement", "My Loans", "My Penalties"],
  ];
  cols.forEach((items, c) => {
    const x = 54 + c * 150;
    items.forEach((item, r) => {
      const y = 120 + r * 56;
      pdf.rect(x, y, 124, 34, r === 0 ? colors.infoBg : colors.panel, colors.line);
      pdf.text(item, x + 10, y + 21, 8, r === 0 ? "F1" : "F2");
      if (r > 0) pdf.line(x + 62, y - 22, x + 62, y, colors.primary, 1.2);
    });
  });
}

function cyclesListDetail() {
  pdf.page("Admin Screen: Cycle List", "Manage multiple village banking cycles");
  pdf.appFrame("Cycles", "Cycles");
  button("New Cycle", 682, 154, 88, "primary");
  pdf.table(202, 196, ["Cycle", "Dates", "Members", "Status", "Action"], [
    ["2026 Main Cycle", "Jan-Dec 2026", "42", "Active", "View"],
    ["2025 Closed Cycle", "Jan-Dec 2025", "39", "Closed", "Reports"],
    ["2027 Draft", "Jan-Dec 2027", "0", "Draft", "Edit"],
  ], [154, 132, 70, 82, 76]);
  pdf.text("Buttons: New Cycle, View, Edit, Reports, Archive.", 202, 310, 8.5, "F1", colors.muted);

  pdf.page("Admin Screen: Cycle Detail", "Cycle rules, months, enrolled members, and actions");
  pdf.appFrame("Cycles", "Cycle Detail: 2026 Main Cycle");
  tabbar(["Overview", "Rules", "Months", "Members", "Penalty Types", "Audit"], "Overview", 202, 154);
  pdf.card(202, 200, 135, 68, "Status", "Active", "Current cycle", colors.primary);
  pdf.card(352, 200, 135, 68, "Members", "42", "39 active", colors.accent);
  pdf.card(502, 200, 135, 68, "Savings Cap", "K30,000", "Per member", colors.primary2);
  pdf.card(652, 200, 135, 68, "Min Borrowing", "K20,000", "Per cycle", colors.warn);
  button("Edit Rules", 202, 304, 86, "secondary");
  button("Enroll Members", 300, 304, 112, "primary");
  button("Generate Months", 424, 304, 120, "blue");
  button("Close Cycle", 556, 304, 92, "danger");
}

function memberCreateDetail() {
  pdf.page("Admin Screen: Create Member", "Add a member profile and optionally enroll into active cycle");
  pdf.appFrame("Members", "Create Member");
  input("First name", "Mary", 214, 160, 160);
  input("Last name", "Phiri", 394, 160, 160);
  input("Phone", "+260 97 000 0000", 574, 160, 190);
  input("Email", "mary@example.com", 214, 224, 250);
  input("Member code", "MBR-0042", 484, 224, 160);
  input("National ID", "Optional", 214, 288, 250);
  pdf.text("☑ Enroll into Cycle 2026", 214, 352, 8.5, "F2");
  button("Save Member", 214, 394, 104, "primary");
  button("Save + Add Another", 330, 394, 132, "blue");
  button("Cancel", 474, 394, 78, "secondary");

  pdf.page("Admin Screen: Member Detail", "Detailed member record with all drill-down tabs and actions");
  pdf.appFrame("Members", "Member Detail: Mary Phiri");
  tabbar(["Overview", "Savings", "Loans", "Declarations", "Penalties", "Statement", "Audit"], "Overview", 202, 154);
  pdf.card(202, 198, 135, 66, "Savings", "K14,375", "Principal K12,500", colors.primary);
  pdf.card(352, 198, 135, 66, "Borrowed", "K0", "K20,000 shortfall", colors.warn);
  pdf.card(502, 198, 135, 66, "Loan Balance", "K0", "No standing loan", colors.accent);
  pdf.card(652, 198, 135, 66, "Penalties", "K100", "Outstanding", colors.danger);
  button("Post Savings", 202, 292, 98, "primary");
  button("New Loan", 312, 292, 82, "blue");
  button("Record Payment", 406, 292, 112, "primary");
  button("Convert Penalty", 530, 292, 116, "danger");
  button("Export Statement", 658, 292, 120, "secondary");
  pdf.table(202, 344, ["Month", "Declaration", "Savings", "Loan", "Penalty", "Status"], [
    ["Jan", "Declared", "K5,000", "K0", "K0", "Never borrowed"],
    ["Feb", "Declared", "K7,500", "K0", "K0", "Never borrowed"],
    ["Mar", "Missed", "K0", "K0", "K100", "Penalty due"],
  ], [68, 104, 90, 86, 80, 136]);
}

function declarationsAdmin() {
  pdf.page("Admin Screen: Declaration Queue", "Review, filter, and open monthly declarations");
  pdf.appFrame("Declarations", "Declaration Queue");
  button("New Declaration", 648, 154, 122, "primary");
  pdf.table(202, 196, ["Member", "Submitted", "Savings", "Loan Req.", "Repay", "Status", "Action"], [
    ["A. Banda", "02 Mar", "K2,000", "K0", "K500", "On time", "View"],
    ["M. Phiri", "-", "K0", "K0", "K0", "Missed", "Assess"],
    ["T. Mwansa", "03 Mar", "K1,500", "K11,000", "K0", "On time", "Review"],
  ], [86, 76, 70, 74, 64, 76, 84]);

  pdf.page("Admin Screen: Declaration Detail", "Declaration content and actions before ledger posting");
  pdf.appFrame("Declarations", "Declaration Detail: T. Mwansa");
  pdf.rect(202, 160, 586, 94, colors.panel, colors.line);
  pdf.text("Submitted on 03 Mar 2026 at 14:20. Within declaration window.", 222, 188, 9, "F1", colors.primary);
  pdf.text("Savings K1,500 | Loan Request K11,000 | Principal Repayment K0 | Common Interest K0", 222, 216, 9, "F2");
  button("Approve Inputs", 222, 282, 108, "primary");
  button("Edit Declaration", 342, 282, 112, "secondary");
  button("Cancel Declaration", 466, 282, 128, "danger");
  button("Create Loan Request", 606, 282, 140, "blue");
}

function savingsAndContributions() {
  pdf.page("Admin Screen: Savings + Contributions", "Post savings deposits, social fund, and membership payments");
  pdf.appFrame("Savings", "Savings and Contributions");
  input("Member", "Mary Phiri", 214, 160, 210);
  input("Month", "March 2026", 444, 160, 160);
  input("Savings deposit", "K1,000", 624, 160, 140);
  pdf.rect(214, 232, 548, 58, colors.warnBg, colors.line);
  pdf.text("Cap Check: current principal K29,500. Maximum additional deposit allowed K500.", 234, 264, 9, "F1", colors.warn);
  button("Post Savings", 214, 324, 104, "primary");
  button("Post Social Fund", 330, 324, 120, "blue");
  button("Post Membership", 462, 324, 126, "blue");
  button("Cancel", 600, 324, 78, "secondary");
  pdf.text("All successful posts create ledger transactions.", 214, 384, 8.5, "F1", colors.muted);
}

function loanDetailRepayment() {
  pdf.page("Admin Screen: Loan Disbursement", "Approve and post a loan or top-up during payout window");
  pdf.appFrame("Loans", "Disburse Loan");
  input("Member", "Mary Phiri", 214, 160, 210);
  input("Request type", "Original Loan", 444, 160, 160);
  input("Approved amount", "K5,000", 624, 160, 140);
  pdf.rect(214, 232, 548, 72, colors.infoBg, colors.line);
  pdf.text("Posting preview: LOAN_DISBURSEMENT K5,000. Cumulative borrowed becomes K5,000. Outstanding loan becomes K5,000.", 234, 262, 9, "F1", colors.accent, 80);
  button("Disburse Loan", 214, 340, 112, "primary");
  button("Adjust Amount", 338, 340, 112, "secondary");
  button("Reject Request", 462, 340, 108, "danger");

  pdf.page("Admin Screen: Loan Detail + Repayment", "Loan statement and repayment posting");
  pdf.appFrame("Loans", "Loan Detail: Mary Phiri");
  pdf.card(202, 158, 135, 68, "Outstanding", "K5,750", "Includes interest", colors.accent);
  pdf.card(352, 158, 135, 68, "Principal", "K5,000", "Original loan", colors.primary);
  pdf.card(502, 158, 135, 68, "Interest", "K750", "March assessment", colors.warn);
  button("Record Repayment", 652, 178, 124, "primary");
  pdf.table(202, 258, ["Date", "Type", "Principal", "Interest", "Balance", "Action"], [
    ["04 Mar", "Disbursement", "K5,000", "-", "K5,000", "View"],
    ["31 Mar", "Interest", "-", "K750", "K5,750", "View"],
    ["02 Apr", "Repayment", "-K1,000", "-K300", "K4,450", "Reverse"],
  ], [70, 112, 86, 78, 82, 82]);
}

function commonInterestOverride() {
  pdf.page("Admin Screen: Common-Interest Override", "Authorized adjustment while preserving calculated value");
  pdf.appFrame("Common Interest", "Override Allocation");
  input("Member", "Mary Phiri", 214, 160, 210);
  input("Calculated charge", "K1,680", 444, 160, 140);
  input("Final charge", "K1,500", 604, 160, 140);
  input("Reason", "Approved committee adjustment", 214, 232, 530);
  pdf.rect(214, 296, 530, 62, colors.dangerBg, colors.line);
  pdf.text("Override stores original value, overridden value, admin, timestamp, and reason. It does not delete the calculated allocation.", 234, 326, 9, "F1", colors.danger, 76);
  button("Approve Override", 214, 392, 130, "danger");
  button("Cancel", 356, 392, 78, "secondary");
}

function closingReviewLock() {
  pdf.page("Admin Screen: Closing Review + Lock", "Final review before month becomes official");
  pdf.appFrame("Monthly Closing", "Review and Lock March");
  pdf.table(202, 166, ["Check", "Result", "Exceptions", "Action"], [
    ["Declarations", "35 declared, 7 missed", "7 penalties", "View"],
    ["Savings interest", "K17,460 posted", "0", "View"],
    ["Loan interest", "K7,725 posted", "0", "View"],
    ["Common interest", "K4,200 allocated", "1 override", "View"],
    ["Snapshots", "42 prepared", "0", "View"],
  ], [138, 170, 96, 92]);
  button("Lock Month", 202, 334, 104, "danger");
  button("Recalculate Draft", 318, 334, 130, "blue");
  button("Export Closing Report", 460, 334, 150, "secondary");
}

function ledgerAuditSettings() {
  pdf.page("Admin Screen: Ledger Explorer", "Trace every amount to source transactions");
  pdf.appFrame("Ledger", "Ledger Explorer");
  button("Export CSV", 680, 154, 90, "secondary");
  pdf.table(202, 196, ["Date", "Member", "Type", "Amount", "Source", "Action"], [
    ["03 Mar", "Mary Phiri", "PENALTY_ASSESSMENT", "K100", "Missed declaration", "View"],
    ["04 Mar", "T. Mwansa", "LOAN_DISBURSEMENT", "K11,000", "Loan request", "View"],
    ["31 Mar", "All", "SAVINGS_INTEREST", "K17,460", "Monthly close", "View"],
  ], [66, 96, 146, 70, 120, 64]);

  pdf.page("Admin Screen: Transaction Detail", "Ledger posting detail with reversal action");
  pdf.appFrame("Ledger", "Transaction Detail");
  pdf.rect(202, 160, 586, 112, colors.panel, colors.line);
  pdf.text("Transaction: PENALTY_ASSESSMENT | Amount K100 | Source: March declaration compliance | Posted by Admin", 222, 190, 9, "F1", colors.ink, 86);
  pdf.table(222, 300, ["Account", "Debit", "Credit"], [
    ["Penalty Receivable", "K100", "-"],
    ["Penalty Income", "-", "K100"],
  ], [190, 110, 110]);
  button("Reverse Transaction", 222, 398, 138, "danger");
  button("Back to Ledger", 372, 398, 112, "secondary");

  pdf.page("Admin Screen: Audit Trail", "Who changed what, when, and why");
  pdf.appFrame("Audit Trail", "Audit Trail");
  pdf.table(202, 166, ["Time", "User", "Action", "Entity", "Reason", "View"], [
    ["09:14", "Admin", "OVERRIDE", "CI Allocation", "Committee adjustment", "Open"],
    ["09:40", "Admin", "LOCK", "March Month", "Closing approved", "Open"],
    ["10:02", "Treasurer", "REVERSE", "Ledger Txn", "Wrong member", "Open"],
  ], [62, 82, 92, 108, 152, 54]);

  pdf.page("Admin Screen: Settings", "Users, roles, penalty types, windows, and system preferences");
  pdf.appFrame("Settings", "Settings");
  tabbar(["Users", "Roles", "Penalty Types", "Rounding", "Notifications"], "Users", 202, 154);
  pdf.table(202, 204, ["Name", "Email", "Role", "Status", "Action"], [
    ["Admin User", "admin@example.com", "Admin", "Active", "Edit"],
    ["Mary Phiri", "mary@example.com", "Member", "Active", "Disable"],
    ["Audit View", "audit@example.com", "Auditor", "Active", "Edit"],
  ], [100, 164, 82, 76, 76]);
  button("Invite User", 202, 334, 94, "primary");
  button("Add Penalty Type", 308, 334, 126, "blue");
  button("Save Settings", 446, 334, 112, "primary");
}

function memberPortalScreens() {
  pdf.page("Member Screen: My Declaration", "Member declaration with submit, save draft, and cancel buttons");
  pdf.rect(34, 84, 774, 456, colors.panel, colors.line);
  pdf.rect(34, 84, 774, 54, "#ffffff", colors.line);
  pdf.text("Village Bank", 58, 117, 14, "F1", colors.primary);
  pdf.text("My Declaration", 214, 117, 13, "F1");
  input("Savings amount", "K1,000", 74, 166, 220);
  input("Loan request", "K0", 314, 166, 220);
  input("Principal repayment", "K0", 554, 166, 220);
  input("Loan interest repayment", "K0", 74, 236, 220);
  input("Common-interest payment", "K430", 314, 236, 220);
  input("Notes", "Optional", 554, 236, 220);
  button("Submit", 74, 330, 84, "primary");
  button("Save Draft", 170, 330, 94, "blue");
  button("Cancel", 276, 330, 78, "secondary");

  pdf.page("Member Screen: My Statement", "Personal transaction and monthly balance view");
  pdf.rect(34, 84, 774, 456, colors.panel, colors.line);
  pdf.text("My Statement", 64, 124, 17, "F1");
  tabbar(["March", "Cycle to Date", "Savings", "Loans", "Penalties"], "March", 64, 154);
  pdf.table(64, 206, ["Date", "Description", "Debit", "Credit", "Balance", "Open"], [
    ["01 Mar", "Savings brought forward", "-", "-", "K12,500", "View"],
    ["03 Mar", "Savings interest", "-", "K1,875", "K14,375", "View"],
    ["04 Mar", "Penalty", "K100", "-", "K100 due", "View"],
  ], [70, 210, 88, 88, 110, 60]);
  button("Download PDF", 64, 342, 112, "secondary");

  pdf.page("Member Screen: My Loans, Savings, and Penalties", "Member-only detail pages");
  pdf.rect(34, 84, 774, 456, colors.panel, colors.line);
  pdf.card(64, 126, 200, 82, "My Savings", "K14,375", "View deposits and interest", colors.primary);
  button("View Savings Detail", 84, 226, 132, "secondary");
  pdf.card(312, 126, 200, 82, "My Loans", "K0", "Borrowing shortfall K20,000", colors.accent);
  button("View Loan Detail", 332, 226, 118, "secondary");
  pdf.card(560, 126, 200, 82, "My Penalties", "K100", "Failure to declare", colors.danger);
  button("View Penalty Detail", 580, 226, 126, "secondary");
  pdf.text("Member pages are read-only except declaration submission and allowed payment/declaration actions.", 64, 330, 9, "F1", colors.muted);
}

styleGuide();
screenInventory();
flowPage();
navigationMap();
authScreens();
dashboard();
cyclesListDetail();
cycleSetup();
members();
memberCreateDetail();
statement();
declaration();
declarationsAdmin();
savingsAndContributions();
loanApproval();
loanDetailRepayment();
closing();
commonInterest();
commonInterestOverride();
penalties();
closingReviewLock();
reports();
ledgerAuditSettings();
memberDashboard();
memberPortalScreens();
pdf.finish();

function buildPdf(pages) {
  const objects = [];
  const add = (s) => {
    objects.push(s);
    return objects.length;
  };
  const catalogId = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = add("");
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];

  pages.forEach((stream) => {
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let doc = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(doc));
    doc += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(doc);
  doc += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) doc += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  doc += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return doc;
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buildPdf(pdf.pages), "binary");
console.log(out);
