/* eslint-disable @typescript-eslint/no-explicit-any */
// Schema-bound rows preserve the existing API shapes at this database boundary.
import type { D1Database, D1DatabaseSession } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type Row = Record<string, any>; // Database rows have schema-defined dynamic columns.
export type QueryResult = { rows: any[]; rowCount: number };
const jsonColumns = new Set([
  "status_history",
  "screening_evidence",
  "steps",
  "content",
  "report",
]);
const booleanColumns = new Set(["is_active", "excluded"]);
export function decodeRow(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      jsonColumns.has(key) && typeof value === "string"
        ? JSON.parse(value)
        : booleanColumns.has(key) && value !== null
          ? Boolean(value)
          : value,
    ]),
  );
}
export function encodeValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "string") return value;
  throw new Error("Unsupported database value");
}
export async function getDatabase(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error("D1 DB binding is not configured");
  return env.DB;
}
// Keep the application's positional parameter API, without translating SQL dialects.
export function prepare(
  db: D1Database | D1DatabaseSession,
  sql: string,
  params: unknown[] = [],
) {
  const values: (string | number | null)[] = [];
  const statement = sql.replace(/\$(\d+)/g, (_, index) => {
    if (Number(index) > params.length)
      throw new Error("Missing query parameter");
    values.push(encodeValue(params[Number(index) - 1]));
    return "?";
  });
  return values.length
    ? db.prepare(statement).bind(...values)
    : db.prepare(statement);
}
export function databaseError(error: unknown): unknown {
  if (String(error).includes("UNIQUE constraint failed"))
    return Object.assign(new Error("Duplicate record"), { code: "23505" });
  return error;
}
export async function query(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult> {
  if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql))
    throw new Error("Use D1 batch for atomic writes");
  try {
    const result = await prepare(await getDatabase(), sql, params).all();
    return {
      rows: result.results.map(decodeRow),
      rowCount: result.results.length || result.meta.changes,
    };
  } catch (error) {
    throw databaseError(error);
  }
}
export async function batch(statements: { sql: string; params?: unknown[] }[]) {
  if (!statements.length) return [];
  const db = await getDatabase();
  return db.batch(statements.map((s) => prepare(db, s.sql, s.params)));
}
export async function testConnection() {
  await query("SELECT 1");
  return true;
}
