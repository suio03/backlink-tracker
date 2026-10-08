import type { D1PreparedStatement } from "@cloudflare/workers-types";
/** Small personal workspace: compute mutations from a consistent D1 snapshot,
 * then commit only changed rows in one optimistic, atomic batch. No partial writes,
 * advisory locks, or network calls inside the mutation callback. */
import {
  getDatabase,
  decodeRow,
  encodeValue,
  databaseError,
  type Row,
} from "./database";
export const tables = [
  "websites",
  "resources",
  "website_extended_info",
  "backlinks",
  "extension_prospects",
  "extension_prospect_sources",
  "extension_form_workflows",
  "extension_generated_content",
  "backlink_operation_runs",
  "backlink_operation_attempts",
  "backlink_operation_checks",
  "backlink_operation_resource_reviews",
  "backlink_operation_reports",
] as const;
export type Table = (typeof tables)[number];
export const keys: Record<Table, string[]> = Object.fromEntries(
  tables.map((t) => [
    t,
    t === "extension_prospects"
      ? ["root_domain"]
      : t === "extension_prospect_sources"
        ? ["root_domain", "source_domain"]
        : t === "extension_form_workflows"
          ? ["workflow_id"]
          : ["id"],
  ]),
) as Record<Table, string[]>;
const keyOf = (table: Table, row: Row) =>
  JSON.stringify(keys[table].map((k) => row[k]));
export class WorkspaceState {
  now = new Date().toISOString();
  constructor(
    public rows: Record<Table, Row[]>,
    public revision: number,
  ) {}
  table(name: Table) {
    return this.rows[name];
  }
  insert(name: Table, values: Row): Row {
    const row: Row = { created_at: this.now, updated_at: this.now, ...values };
    // Only add columns that actually exist on this table.
    if (name.startsWith("backlink_operation_")) delete row.updated_at;
    if (
      [
        "backlink_operation_checks",
        "backlink_operation_resource_reviews",
      ].includes(name)
    ) {
      delete row.created_at;
      row.checked_at ??= this.now;
    }
    if (name === "extension_prospect_sources") {
      delete row.created_at;
      delete row.updated_at;
      row.first_seen_at ??= this.now;
      row.last_seen_at ??= this.now;
    }
    if (
      keys[name].length === 1 &&
      keys[name][0] === "id" &&
      row.id === undefined
    )
      row.id =
        Math.max(0, ...this.rows[name].map((r) => Number(r.id) || 0)) + 1;
    const defaults: Partial<Record<Table, Row>> = {
      websites: { is_active: true },
      resources: {
        is_active: true,
        domain_authority: 0,
        cost: 0,
        category: "directory",
      },
      backlinks: { status: "pending", cost: 0, status_history: [] },
      extension_prospects: {
        status: "pending",
        excluded: false,
        import_order: 0,
        queue_position: null,
        source_count: 0,
        screening_evidence: [],
      },
      backlink_operation_runs: { status: "open" },
      backlink_operation_attempts: { note: "" },
    };
    const result = { ...defaults[name], ...row };
    this.rows[name].push(result);
    if (name === "websites" && result.is_active)
      for (const r of this.rows.resources.filter((r) => r.is_active))
        this.ensureBacklink(result.id, r.id);
    if (name === "resources" && result.is_active)
      for (const w of this.rows.websites.filter((w) => w.is_active))
        this.ensureBacklink(w.id, result.id);
    return result;
  }
  ensureBacklink(websiteId: number, resourceId: number) {
    return (
      this.rows.backlinks.find(
        (r) =>
          String(r.website_id) === String(websiteId) &&
          String(r.resource_id) === String(resourceId),
      ) ||
      this.insert("backlinks", {
        website_id: websiteId,
        resource_id: resourceId,
      })
    );
  }
  remove(name: Table, predicate: (row: Row) => boolean) {
    this.rows[name] = this.rows[name].filter((r) => !predicate(r));
  }
}
export async function readState(): Promise<WorkspaceState> {
  const db = await getDatabase();
  const results = await db.batch<Row>([
    db.prepare("SELECT revision FROM workspace_revision WHERE id=1"),
    ...tables.map((t) =>
      db.prepare(
        t === "backlink_operation_reports"
          ? "SELECT id,day,run_id,created_at FROM backlink_operation_reports"
          : `SELECT * FROM ${t}`,
      ),
    ),
  ]);
  return new WorkspaceState(
    Object.fromEntries(
      tables.map((t, i) => [t, results[i + 1].results.map(decodeRow)]),
    ) as Record<Table, Row[]>,
    Number(results[0].results[0].revision),
  );
}
function chunks(rows: Row[]): Row[][] {
  const result: Row[][] = [];
  let group: Row[] = [],
    size = 0;
  for (const row of rows) {
    const n = JSON.stringify(row).length;
    if (n > 1_500_000) throw new Error("Record exceeds safe D1 row size");
    if (group.length && size + n > 400_000) {
      result.push(group);
      group = [];
      size = 0;
    }
    group.push(row);
    size += n;
  }
  if (group.length) result.push(group);
  return result;
}
export async function mutateState<T>(
  fn: (state: WorkspaceState) => T | Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = await readState();
    const before = structuredClone(state.rows);
    const value = await fn(state);
    const db = await getDatabase();
    const writes: D1PreparedStatement[] = [];
    // Children first for deletes, parents first for upserts.
    for (const table of [...tables].reverse()) {
      const afterKeys = new Set(state.table(table).map((r) => keyOf(table, r)));
      const deleted = before[table].filter(
        (r) => !afterKeys.has(keyOf(table, r)),
      );
      for (const group of chunks(deleted))
        writes.push(
          db
            .prepare(
              `DELETE FROM ${table} WHERE EXISTS(SELECT 1 FROM json_each(?) j WHERE ${keys[table].map((k) => `${table}.${k}=json_extract(j.value,'$.${k}')`).join(" AND ")})`,
            )
            .bind(JSON.stringify(group)),
        );
    }
    for (const table of tables) {
      const originals = new Map(
        before[table].map((r) => [keyOf(table, r), JSON.stringify(r)]),
      );
      const changed = state
        .table(table)
        .filter((r) => originals.get(keyOf(table, r)) !== JSON.stringify(r));
      // Group by column set so optional new fields retain database defaults.
      const groups = new Map<string, Row[]>();
      for (const row of changed) {
        const columns = Object.keys(row)
          .filter(
            (c) => table !== "backlink_operation_reports" || c !== "report",
          )
          .sort();
        const k = columns.join(",");
        const encoded = Object.fromEntries(
          columns.map((c) => [c, encodeValue(row[c])]),
        );
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(encoded);
      }
      for (const [columnList, rows] of groups) {
        const columns = columnList.split(",");
        for (const group of chunks(rows)) {
          const updates = columns.filter((c) => !keys[table].includes(c));
          writes.push(
            db
              .prepare(
                `INSERT INTO ${table} (${columnList}) SELECT ${columns.map((c) => `json_extract(value,'$.${c}')`).join(",")} FROM json_each(?) WHERE 1 ON CONFLICT (${keys[table].join(",")}) DO ${updates.length ? "UPDATE SET " + updates.map((c) => `${c}=excluded.${c}`).join(",") : "NOTHING"}`,
              )
              .bind(JSON.stringify(group)),
          );
        }
      }
    }
    for (const row of state.table("backlink_operation_reports")) {
      if (!row.report) continue;
      const json = JSON.stringify(row.report),
        parts: Row[] = [];
      for (
        let offset = 0, part = 0;
        offset < json.length;
        offset += 12000, part++
      )
        parts.push({ part, data: json.slice(offset, offset + 12000) });
      for (const group of chunks(parts))
        writes.push(
          db
            .prepare(
              "INSERT INTO backlink_report_parts(report_id,part,data) SELECT ?,json_extract(value,'$.part'),json_extract(value,'$.data') FROM json_each(?)",
            )
            .bind(row.id, JSON.stringify(group)),
        );
    }
    if (!writes.length) return value;
    try {
      await db.batch([
        db
          .prepare("INSERT INTO workspace_guard(expected) VALUES (?)")
          .bind(state.revision),
        ...writes,
        db.prepare("DELETE FROM workspace_guard"),
      ]);
      return value;
    } catch (error) {
      if (String(error).includes("WORKSPACE_CONFLICT") && attempt < 3) continue;
      throw databaseError(error);
    }
  }
  throw new Error("Workspace changed concurrently; retry");
}
