const fs = require("fs");
const path = require("path");

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node convert-md-to-html.js input.md output.html");
  process.exit(1);
}

const markdown = fs.readFileSync(inputPath, "utf8");

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

const lines = markdown.split(/\r?\n/);
const body = [];
let inCode = false;
let codeLang = "";
let codeLines = [];
let inList = false;

function closeList() {
  if (inList) {
    body.push("</ul>");
    inList = false;
  }
}

function flushCode() {
  const languageClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
  const label = codeLang === "mermaid" ? '<div class="diagram-label">ERD Diagram Source</div>' : "";
  body.push(`${label}<pre${languageClass}><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  codeLines = [];
  codeLang = "";
}

for (const rawLine of lines) {
  const line = rawLine.replace(/\s+$/g, "");

  if (line.startsWith("```")) {
    if (inCode) {
      flushCode();
      inCode = false;
    } else {
      closeList();
      inCode = true;
      codeLang = line.slice(3).trim();
      codeLines = [];
    }
    continue;
  }

  if (inCode) {
    codeLines.push(rawLine);
    continue;
  }

  if (!line.trim()) {
    closeList();
    continue;
  }

  const heading = line.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    closeList();
    const level = Math.min(heading[1].length, 4);
    body.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    continue;
  }

  const bullet = line.match(/^-\s+(.+)$/);
  if (bullet) {
    if (!inList) {
      body.push("<ul>");
      inList = true;
    }
    body.push(`<li>${inline(bullet[1])}</li>`);
    continue;
  }

  closeList();
  body.push(`<p>${inline(line)}</p>`);
}

closeList();
if (inCode) flushCode();

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Village Banking Schema and ERD Design</title>
  <style>
    @page { margin: 22mm 18mm; }
    body {
      color: #1f2933;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.48;
    }
    h1 {
      color: #102a43;
      font-size: 24px;
      margin: 0 0 8px;
      page-break-after: avoid;
    }
    h2 {
      border-bottom: 1px solid #d9e2ec;
      color: #243b53;
      font-size: 17px;
      margin: 24px 0 8px;
      padding-bottom: 4px;
      page-break-after: avoid;
    }
    h3 {
      color: #334e68;
      font-size: 13px;
      margin: 18px 0 6px;
      page-break-after: avoid;
    }
    h4 {
      color: #486581;
      font-size: 12px;
      margin: 14px 0 4px;
      page-break-after: avoid;
    }
    p { margin: 6px 0; }
    ul { margin: 6px 0 10px 20px; padding: 0; }
    li { margin: 2px 0; }
    code {
      background: #f0f4f8;
      border-radius: 3px;
      color: #102a43;
      font-family: Menlo, Consolas, monospace;
      font-size: 9px;
      padding: 1px 3px;
    }
    pre {
      background: #f7f9fb;
      border: 1px solid #d9e2ec;
      border-radius: 6px;
      color: #102a43;
      font-family: Menlo, Consolas, monospace;
      font-size: 7px;
      line-height: 1.35;
      margin: 8px 0 14px;
      overflow-wrap: normal;
      padding: 10px;
      white-space: pre-wrap;
    }
    pre code {
      background: transparent;
      border-radius: 0;
      font-size: inherit;
      padding: 0;
    }
    .diagram-label {
      background: #e6f6ff;
      border: 1px solid #bae3ff;
      border-radius: 6px;
      color: #0b4f71;
      display: inline-block;
      font-weight: 700;
      margin-top: 8px;
      padding: 4px 8px;
    }
  </style>
</head>
<body>
${body.join("\n")}
</body>
</html>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
