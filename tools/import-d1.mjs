#!/usr/bin/env node
// Offline conversion only. Never connects to or modifies PostgreSQL.
// Usage: node tools/import-d1.mjs /absolute/private/snapshot.json /absolute/private/output
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const [input, destination] = process.argv.slice(2);
if (!input || !destination)
  throw Error("Provide snapshot JSON and a private output directory");
const source = JSON.parse(fs.readFileSync(input, "utf8"));
const order = [
  "websites",
  "resources",
  "website_extended_info",
  "backlinks",
  "extension_prospects",
  "extension_prospect_sources",
  "extension_form_workflows",
  "extension_generated_content",
  "partner_links",
  "backlink_operation_runs",
  "backlink_operation_attempts",
  "backlink_operation_checks",
  "backlink_operation_resource_reviews",
  "backlink_operation_reports",
];
const literal = (v) =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "boolean"
      ? String(Number(v))
      : typeof v === "number"
        ? String(v)
        : "'" +
          (typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll(
            "'",
            "''",
          ) +
          "'";
fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
let statements = [],
  bytes = 0,
  index = 0;
const files = [];
function flush() {
  if (!statements.length) return;
  const filename = `data-${String(index++).padStart(4, "0")}.sql`;
  fs.writeFileSync(
    path.join(destination, filename),
    statements.join("\n") + "\n",
    { mode: 0o600 },
  );
  files.push(filename);
  statements = [];
  bytes = 0;
}
function add(sql) {
  if (Buffer.byteLength(sql) > 95000)
    throw Error("SQL statement exceeds D1 safe limit");
  if (bytes + Buffer.byteLength(sql) > 2_000_000) flush();
  statements.push(sql);
  bytes += Buffer.byteLength(sql);
}
// Import only into a new database. The guard suppresses automatic pending links.
add(
  "INSERT INTO workspace_guard(expected) SELECT revision FROM workspace_revision WHERE id=1;",
);
const counts = {},
  hashes = {};
for (const table of order) {
  const rows = source.tables[table] || [];
  counts[table] = rows.length;
  hashes[table] = crypto
    .createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
  for (const raw of rows) {
    const row = { ...raw };
    if (table === "partner_links") row.rel ??= "noopener";
    const report =
      table === "backlink_operation_reports" ? row.report : undefined;
    if (report !== undefined) delete row.report;
    // Preserve every original ID, timestamp, manual decision, and relationship.
    const columns = Object.keys(row);
    add(
      `INSERT INTO ${table} (${columns.map((c) => '"' + c + '"').join(",")}) VALUES (${columns.map((c) => literal(row[c])).join(",")});`,
    );
    if (report !== undefined) {
      const json = JSON.stringify(report);
      for (
        let offset = 0, part = 0;
        offset < json.length;
        offset += 12000, part++
      )
        add(
          `INSERT INTO backlink_report_parts(report_id,part,data) VALUES (${row.id},${part},${literal(json.slice(offset, offset + 12000))});`,
        );
    }
  }
}
add("DELETE FROM workspace_guard;");
flush();
fs.writeFileSync(
  path.join(destination, "manifest.json"),
  JSON.stringify(
    { sourceExportedAt: source.exportedAt, counts, hashes, files },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(JSON.stringify({ counts, files: files.length }));
