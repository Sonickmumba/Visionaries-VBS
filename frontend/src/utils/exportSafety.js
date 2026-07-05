const CSV_FORMULA_PREFIX = /^[\s]*[=+\-@\t\r]/;

export function escapeCsvCell(value) {
  const text = String(value ?? "");
  const safeText = CSV_FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function buildCsv(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
