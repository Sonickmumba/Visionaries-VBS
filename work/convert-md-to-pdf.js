const fs = require("fs");
const path = require("path");

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node convert-md-to-pdf.js input.md output.pdf");
  process.exit(1);
}

const markdown = fs.readFileSync(inputPath, "utf8");
const page = { width: 612, height: 792, margin: 48 };
const usableWidth = page.width - page.margin * 2;
const bottom = page.margin;

function escapePdfText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

function stripInlineMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1");
}

function wrapText(text, maxChars) {
  const clean = text.replace(/\t/g, "  ");
  if (!clean) return [""];

  const lines = [];
  let current = "";

  for (const word of clean.split(/\s+/)) {
    if (!word) continue;
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function parseMarkdown(md) {
  const items = [];
  const lines = md.split(/\r?\n/);
  let inCode = false;
  let codeLang = "";
  let codeLines = [];

  function flushCode() {
    if (codeLang === "mermaid") {
      items.push({ type: "h3", text: "ERD Diagram Source" });
    }
    for (const line of codeLines) {
      const chunks = line.length ? line.match(/.{1,112}/g) : [""];
      for (const chunk of chunks) {
        items.push({ type: "code", text: chunk });
      }
    }
    items.push({ type: "space" });
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
      items.push({ type: "space" });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      items.push({ type: `h${Math.min(level, 4)}`, text: stripInlineMarkdown(heading[2]) });
      continue;
    }

    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      for (const wrapped of wrapText(`• ${stripInlineMarkdown(bullet[1])}`, 95)) {
        items.push({ type: "body", text: wrapped });
      }
      continue;
    }

    for (const wrapped of wrapText(stripInlineMarkdown(line), 98)) {
      items.push({ type: "body", text: wrapped });
    }
  }

  if (inCode) flushCode();
  return items;
}

const styles = {
  h1: { font: "F1", size: 18, leading: 24, before: 8, after: 4 },
  h2: { font: "F1", size: 14, leading: 19, before: 10, after: 3 },
  h3: { font: "F1", size: 11, leading: 15, before: 8, after: 2 },
  h4: { font: "F1", size: 10, leading: 14, before: 6, after: 1 },
  body: { font: "F2", size: 9, leading: 12, before: 0, after: 0 },
  code: { font: "F3", size: 6.2, leading: 8, before: 0, after: 0 },
  space: { font: "F2", size: 9, leading: 6, before: 0, after: 0 },
};

const pages = [];
let currentPage = [];
let y = page.height - page.margin;

function newPage() {
  if (currentPage.length) pages.push(currentPage);
  currentPage = [];
  y = page.height - page.margin;
}

for (const item of parseMarkdown(markdown)) {
  const style = styles[item.type] || styles.body;
  const needed = style.before + style.leading + style.after;
  if (y - needed < bottom) newPage();
  y -= style.before;
  if (item.type !== "space") {
    currentPage.push({ ...style, text: item.text, x: page.margin, y });
  }
  y -= style.leading + style.after;
}
if (currentPage.length) pages.push(currentPage);

function contentStream(lines, pageNumber) {
  const parts = ["BT"];
  for (const line of lines) {
    parts.push(`/${line.font} ${line.size} Tf`);
    parts.push(`${line.x} ${line.y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj`);
    parts.push(`${-line.x} ${-line.y.toFixed(2)} Td`);
  }
  parts.push("/F2 8 Tf");
  parts.push(`${page.width - page.margin - 55} 28 Td (Page ${pageNumber}) Tj`);
  parts.push("ET");
  return parts.join("\n");
}

const objects = [];
function addObject(value) {
  objects.push(value);
  return objects.length;
}

const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
const pagesId = addObject("");
const fontHelveticaBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
const fontHelveticaId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
const fontCourierId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
const pageIds = [];

pages.forEach((pageLines, index) => {
  const stream = contentStream(pageLines, index + 1);
  const contentId = addObject(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  const pageId = addObject(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
      `/Resources << /Font << /F1 ${fontHelveticaBoldId} 0 R /F2 ${fontHelveticaId} 0 R /F3 ${fontCourierId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`
  );
  pageIds.push(pageId);
});

objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

let pdf = "%PDF-1.4\n";
const offsets = [0];

objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
});

const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += "0000000000 65535 f \n";
for (let i = 1; i < offsets.length; i += 1) {
  pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, pdf, "binary");
