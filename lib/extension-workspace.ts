import type { PoolClient } from 'pg';
import { query, transaction } from '@/lib/database';

type JsonRecord = Record<string, unknown>;

export interface WorkspacePatch {
  prospects?: { upsert?: JsonRecord[]; remove?: string[] };
  websites?: { upsert?: JsonRecord[]; remove?: string[] };
  resources?: { upsert?: JsonRecord[]; remove?: string[] };
  submissions?: { upsert?: JsonRecord[]; remove?: string[] };
  workflows?: { upsert?: JsonRecord[]; remove?: string[] };
  queue?: string[];
}

export interface ProspectReportPayload {
  sourceDomain?: unknown;
  records?: unknown;
}

export interface ProspectScreeningPayload {
  results?: unknown;
}

export class ProspectReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProspectReportInputError';
  }
}

const VALID_PROSPECT_STATUSES = new Set([
  'pending',
  'can_add',
  'login_required',
  'paid',
  'later',
]);
const VALID_SCREENING_WRITE_STATUSES = new Set([
  'screened',
  'needs_review',
  'fetch_failed',
]);
const VALID_SCREENING_CATEGORIES = new Set([
  'direct_submit',
  'guest_post',
  'paid_or_contact',
  'possible',
  'no_obvious_opportunity',
]);
const VALID_SCREENING_COSTS = new Set(['unknown', 'free', 'paid', 'mixed']);
const VALID_SUBMISSION_STATUSES = new Set([
  'pending',
  'requested',
  'placed',
  'live',
  'rejected',
  'removed',
]);

let schemaReady: Promise<void> | null = null;

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableDate(value: unknown): string | null {
  const candidate = text(value);
  return candidate || null;
}

function normalizeScreeningDate(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeDomain(value: unknown): string {
  const candidate = text(value);
  if (!candidate) return '';
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
        ? candidate
        : `https://${candidate}`,
    );
    return ['http:', 'https:'].includes(url.protocol)
      ? url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
      : '';
  } catch {
    return '';
  }
}

function normalizeHttpUrl(value: unknown): string {
  const candidate = text(value);
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

function normalizeScreeningEvidence(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).reduce<JsonRecord[]>((normalized, item) => {
    if (typeof item === 'string') {
      const evidenceText = text(item).slice(0, 500);
      if (evidenceText) normalized.push({ text: evidenceText });
      return normalized;
    }
    if (!item || typeof item !== 'object') return normalized;
    const record = item as JsonRecord;
    const evidence = {
      type: text(record.type ?? record.kind).slice(0, 80),
      ruleId: text(record.ruleId ?? record.rule_id).slice(0, 120),
      text: text(record.text).slice(0, 500),
      url: normalizeHttpUrl(record.url),
    };
    if (Object.values(evidence).some(Boolean)) normalized.push(evidence);
    return normalized;
  }, []);
}

function normalizeSubmissionHistory(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-100).reduce<JsonRecord[]>((normalized, item) => {
    if (!item || typeof item !== 'object') return normalized;
    const record = item as JsonRecord;
    const status = text(record.status);
    if (!VALID_SUBMISSION_STATUSES.has(status)) return normalized;
    normalized.push({
      status,
      at: normalizeScreeningDate(record.at),
      url: normalizeHttpUrl(record.url),
      note: text(record.note).slice(0, 500),
    });
    return normalized;
  }, []);
}

function normalizeProspectScreeningPayload(payload: ProspectScreeningPayload) {
  if (!Array.isArray(payload?.results)) {
    throw new ProspectReportInputError('Screening results are required');
  }
  if (payload.results.length > 250) {
    throw new ProspectReportInputError('Screening batch exceeds 250 results');
  }

  const byDomain = new Map<string, JsonRecord>();
  for (const value of payload.results) {
    if (!value || typeof value !== 'object') continue;
    const record = value as JsonRecord;
    const rootDomain = normalizeDomain(record.rootDomain ?? record.root_domain);
    const screeningStatus = text(
      record.screeningStatus ?? record.screening_status,
    );
    if (!rootDomain || !VALID_SCREENING_WRITE_STATUSES.has(screeningStatus)) {
      continue;
    }
    const requestedCategory = text(
      record.screeningCategory ?? record.screening_category,
    );
    const screeningCategory = VALID_SCREENING_CATEGORIES.has(requestedCategory)
      ? requestedCategory
      : null;
    if (screeningStatus !== 'fetch_failed' && !screeningCategory) continue;
    const requestedConfidence = nullableNumber(
      record.screeningConfidence ?? record.screening_confidence,
    );
    const screeningConfidence =
      requestedConfidence === null
        ? null
        : Math.max(0, Math.min(100, Math.round(requestedConfidence)));
    const requestedCost = text(record.screeningCost ?? record.screening_cost);
    const screeningCost = VALID_SCREENING_COSTS.has(requestedCost)
      ? requestedCost
      : 'unknown';
    byDomain.set(rootDomain, {
      rootDomain,
      screeningStatus,
      screeningCategory,
      screeningConfidence,
      screeningCost,
      screeningEntryUrl: normalizeHttpUrl(
        record.screeningEntryUrl ?? record.screening_entry_url,
      ),
      screeningSummary: text(
        record.screeningSummary ?? record.screening_summary,
      ).slice(0, 500),
      screeningEvidence: normalizeScreeningEvidence(
        record.screeningEvidence ?? record.screening_evidence,
      ),
      screeningRuleset: text(
        record.screeningRuleset ?? record.screening_ruleset,
      ).slice(0, 100),
      screenedAt: normalizeScreeningDate(
        record.screenedAt ?? record.screened_at,
      ),
    });
  }
  return [...byDomain.values()];
}

function normalizeProspectReport(payload: ProspectReportPayload) {
  const sourceDomain = normalizeDomain(payload?.sourceDomain);
  if (!sourceDomain) {
    throw new ProspectReportInputError('A valid source domain is required');
  }
  if (!Array.isArray(payload?.records)) {
    throw new ProspectReportInputError('Report records are required');
  }
  if (payload.records.length > 100_000) {
    throw new ProspectReportInputError('Report exceeds the 100,000 row limit');
  }

  const byDomain = new Map<string, { rootDomain: string; authority: number | null }>();
  for (const value of payload.records) {
    if (!value || typeof value !== 'object') continue;
    const record = value as JsonRecord;
    const rootDomain = normalizeDomain(record.domain ?? record.rootDomain);
    if (!rootDomain) continue;
    const authority = nullableNumber(record.as ?? record.authority);
    const existing = byDomain.get(rootDomain);
    if (!existing) {
      byDomain.set(rootDomain, { rootDomain, authority });
    } else if (
      authority !== null &&
      (existing.authority === null || authority > existing.authority)
    ) {
      existing.authority = authority;
    }
  }
  const normalized = [...byDomain.values()];
  if (!normalized.length) {
    throw new ProspectReportInputError('Report contains no valid domains');
  }
  return { sourceDomain, records: normalized };
}

function boolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numericId(value: unknown): number | null {
  const candidate = text(value);
  if (!/^\d+$/.test(candidate)) return null;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord => Boolean(item) && typeof item === 'object',
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

export async function ensureExtensionWorkspaceSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      CREATE TABLE IF NOT EXISTS extension_prospects (
        root_domain       TEXT PRIMARY KEY,
        authority         INTEGER,
        csv_file_count    INTEGER,
        source_count      INTEGER NOT NULL DEFAULT 0,
        source_files      TEXT,
        status            TEXT NOT NULL DEFAULT 'pending',
        submission_url    TEXT,
        notes             TEXT,
        excluded          BOOLEAN NOT NULL DEFAULT FALSE,
        excluded_at       TIMESTAMPTZ,
        excluded_reason   TEXT,
        last_opened_at    TIMESTAMPTZ,
        last_imported_at  TIMESTAMPTZ,
        last_seen_at      TIMESTAMPTZ,
        import_order      INTEGER NOT NULL DEFAULT 0,
        queue_position    INTEGER,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_extension_prospects_status
        ON extension_prospects (status);
      CREATE INDEX IF NOT EXISTS idx_extension_prospects_queue
        ON extension_prospects (queue_position);
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS source_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screening_status TEXT NOT NULL DEFAULT 'unscreened';
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screening_category TEXT;
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screening_confidence INTEGER;
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screening_cost TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screening_entry_url TEXT;
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screening_summary TEXT;
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screening_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screening_ruleset TEXT;
      ALTER TABLE extension_prospects
        ADD COLUMN IF NOT EXISTS screened_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_extension_prospects_screening_status
        ON extension_prospects (screening_status);
      CREATE INDEX IF NOT EXISTS idx_extension_prospects_screening_category
        ON extension_prospects (screening_category);
      CREATE TABLE IF NOT EXISTS extension_prospect_sources (
        root_domain       TEXT NOT NULL REFERENCES extension_prospects(root_domain) ON DELETE CASCADE,
        source_domain     TEXT NOT NULL,
        authority         INTEGER,
        first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (root_domain, source_domain)
      );
      CREATE INDEX IF NOT EXISTS idx_extension_prospect_sources_source
        ON extension_prospect_sources (source_domain);
      CREATE TABLE IF NOT EXISTS extension_form_workflows (
        workflow_id       TEXT PRIMARY KEY,
        resource_id       BIGINT NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
        domain            TEXT NOT NULL,
        name              TEXT NOT NULL DEFAULT 'Submission workflow',
        status            TEXT NOT NULL DEFAULT 'learning',
        version           INTEGER NOT NULL DEFAULT 1,
        steps             JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_extension_form_workflows_resource
        ON extension_form_workflows (resource_id);
      ALTER TABLE website_extended_info
        ADD COLUMN IF NOT EXISTS short_description TEXT;
      ALTER TABLE backlinks
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
      ALTER TABLE backlinks
        ADD COLUMN IF NOT EXISTS submission_url TEXT;
      ALTER TABLE backlinks
        ADD COLUMN IF NOT EXISTS live_url TEXT;
      ALTER TABLE backlinks
        ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
      ALTER TABLE backlinks
        ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;
      CREATE INDEX IF NOT EXISTS idx_backlinks_last_checked_at
        ON backlinks (last_checked_at);
      CREATE TABLE IF NOT EXISTS extension_generated_content (
        id                BIGSERIAL PRIMARY KEY,
        website_id        BIGINT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
        resource_id       BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        request_hash      TEXT NOT NULL,
        language          TEXT NOT NULL DEFAULT 'auto',
        model             TEXT NOT NULL,
        content           JSONB NOT NULL,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (website_id, resource_id, request_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_extension_generated_content_pair
        ON extension_generated_content (website_id, resource_id);
    `).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function loadWithClient(client: PoolClient | null = null) {
  const run = (sql: string, params?: unknown[]) =>
    client ? client.query(sql, params) : query(sql, params);
  const [websites, resources, submissions, prospects, workflows] = await Promise.all([
    run(`
      SELECT
        w.*,
        i.support_email,
        i.title,
        i.description,
        i.url AS product_url,
        COALESCE(to_jsonb(i)->>'short_description', '') AS short_description
      FROM websites w
      LEFT JOIN website_extended_info i ON i.website_id = w.id
      ORDER BY w.id
    `),
    run('SELECT * FROM resources ORDER BY id'),
    run('SELECT * FROM backlinks ORDER BY id'),
    run('SELECT * FROM extension_prospects ORDER BY import_order, root_domain'),
    run('SELECT * FROM extension_form_workflows ORDER BY resource_id'),
  ]);

  const queue = prospects.rows
    .filter((row) => !row.excluded && row.queue_position !== null)
    .sort((a, b) => Number(a.queue_position) - Number(b.queue_position))
    .map((row) => row.root_domain);

  return {
    schemaVersion: 1,
    meta: {
      source: 'backlink-tracker-postgresql',
      updatedAt: new Date().toISOString(),
    },
    prospects: prospects.rows.map((row) => ({
      rootDomain: row.root_domain,
      as: row.authority,
      csvFileCount: row.csv_file_count,
      sourceCount: Number(row.source_count) || 0,
      sourceFiles: row.source_files || '',
      status: row.status,
      submissionUrl: row.submission_url || '',
      notes: row.notes || '',
      excluded: row.excluded,
      excludedAt: row.excluded_at || '',
      excludedReason: row.excluded_reason || '',
      lastOpenedAt: row.last_opened_at || '',
      lastImportedAt: row.last_imported_at || '',
      lastSeenAt: row.last_seen_at || '',
      screeningStatus: row.screening_status || 'unscreened',
      screeningCategory: row.screening_category || '',
      screeningConfidence:
        row.screening_confidence === null
          ? null
          : Number(row.screening_confidence),
      screeningCost: row.screening_cost || 'unknown',
      screeningEntryUrl: row.screening_entry_url || '',
      screeningSummary: row.screening_summary || '',
      screeningEvidence: Array.isArray(row.screening_evidence)
        ? row.screening_evidence
        : [],
      screeningRuleset: row.screening_ruleset || '',
      screenedAt: row.screened_at || '',
      importOrder: row.import_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    queue,
    websites: websites.rows.map((row) => ({
      id: String(row.id),
      domain: row.domain,
      name: row.name,
      category: row.category,
      supportEmail: row.support_email || '',
      title: row.title || '',
      shortDescription: row.short_description || '',
      description: row.description || '',
      url: row.product_url || `https://${row.domain}`,
      active: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    resources: resources.rows.map((row) => ({
      id: String(row.id),
      domain: row.domain,
      url: row.url,
      contactEmail: row.contact_email || '',
      authority: Number(row.domain_authority) || 0,
      category: row.category,
      cost: Number(row.cost) || 0,
      notes: row.notes || '',
      active: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    submissions: submissions.rows.map((row) => ({
      id: String(row.id),
      websiteId: String(row.website_id),
      resourceId: String(row.resource_id),
      status: row.status,
      anchorText: row.anchor_text || '',
      targetUrl: row.target_url || '',
      submissionUrl: row.submission_url || '',
      liveUrl: row.live_url || '',
      submittedAt: row.submitted_at || '',
      lastCheckedAt: row.last_checked_at || '',
      statusHistory: Array.isArray(row.status_history) ? row.status_history : [],
      placementDate: row.placement_date || '',
      removalDate: row.removal_date || '',
      cost: Number(row.cost) || 0,
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    workflows: workflows.rows.map((row) => ({
      id: row.workflow_id,
      resourceId: String(row.resource_id),
      domain: row.domain,
      name: row.name,
      status: row.status,
      version: Number(row.version) || 1,
      steps: Array.isArray(row.steps) ? row.steps : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export async function loadExtensionWorkspace() {
  await ensureExtensionWorkspaceSchema();
  return loadWithClient();
}

export async function importExtensionProspectReport(
  payload: ProspectReportPayload,
) {
  await ensureExtensionWorkspaceSchema();
  const report = normalizeProspectReport(payload);
  const rootDomains = report.records.map((record) => record.rootDomain);

  return transaction(async (client) => {
    const existing = await client.query(
      'SELECT root_domain FROM extension_prospects WHERE root_domain = ANY($1::text[])',
      [rootDomains],
    );
    const existingDomains = new Set(
      existing.rows.map((row) => String(row.root_domain)),
    );
    const serialized = JSON.stringify(
      report.records.map((record) => ({
        root_domain: record.rootDomain,
        authority: record.authority,
      })),
    );

    await client.query(
      `
        WITH incoming AS (
          SELECT
            row.root_domain,
            row.authority,
            (ROW_NUMBER() OVER (ORDER BY row.root_domain) - 1)::INTEGER AS order_offset
          FROM jsonb_to_recordset($1::jsonb)
            AS row(root_domain TEXT, authority INTEGER)
        ),
        base_order AS (
          SELECT COALESCE(MAX(import_order), -1) + 1 AS next_order
          FROM extension_prospects
        ),
        upserted AS (
          INSERT INTO extension_prospects (
            root_domain, authority, source_count, status, last_imported_at,
            last_seen_at, import_order, created_at, updated_at
          )
          SELECT
            incoming.root_domain,
            incoming.authority,
            0,
            'pending',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            base_order.next_order + incoming.order_offset,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          FROM incoming
          CROSS JOIN base_order
          ON CONFLICT (root_domain) DO UPDATE SET
            authority = CASE
              WHEN extension_prospects.authority IS NULL THEN EXCLUDED.authority
              WHEN EXCLUDED.authority IS NULL THEN extension_prospects.authority
              ELSE GREATEST(extension_prospects.authority, EXCLUDED.authority)
            END,
            last_imported_at = CURRENT_TIMESTAMP,
            last_seen_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          RETURNING root_domain
        )
        INSERT INTO extension_prospect_sources (
          root_domain, source_domain, authority, first_seen_at, last_seen_at
        )
        SELECT upserted.root_domain, $2, incoming.authority,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM upserted
        JOIN incoming USING (root_domain)
        ON CONFLICT (root_domain, source_domain) DO UPDATE SET
          authority = CASE
            WHEN extension_prospect_sources.authority IS NULL THEN EXCLUDED.authority
            WHEN EXCLUDED.authority IS NULL THEN extension_prospect_sources.authority
            ELSE GREATEST(extension_prospect_sources.authority, EXCLUDED.authority)
          END,
          last_seen_at = CURRENT_TIMESTAMP
      `,
      [serialized, report.sourceDomain],
    );

    await client.query(
      `
        UPDATE extension_prospects AS prospect
        SET source_count = source.source_count,
            updated_at = CURRENT_TIMESTAMP
        FROM (
          SELECT root_domain, COUNT(*)::INTEGER AS source_count
          FROM extension_prospect_sources
          WHERE root_domain = ANY($1::text[])
          GROUP BY root_domain
        ) AS source
        WHERE prospect.root_domain = source.root_domain
      `,
      [rootDomains],
    );

    return {
      workspace: await loadWithClient(client),
      summary: {
        sourceDomain: report.sourceDomain,
        added: report.records.length - existingDomains.size,
        existing: existingDomains.size,
        total: report.records.length,
      },
    };
  });
}

export async function applyProspectScreeningResults(
  payload: ProspectScreeningPayload,
) {
  await ensureExtensionWorkspaceSchema();
  const results = normalizeProspectScreeningPayload(payload);
  if (!results.length) {
    throw new ProspectReportInputError('Screening batch contains no valid results');
  }
  const serialized = JSON.stringify(
    results.map((result) => ({
      root_domain: result.rootDomain,
      screening_status: result.screeningStatus,
      screening_category: result.screeningCategory,
      screening_confidence: result.screeningConfidence,
      screening_cost: result.screeningCost,
      screening_entry_url: result.screeningEntryUrl || null,
      screening_summary: result.screeningSummary || null,
      screening_evidence: result.screeningEvidence,
      screening_ruleset: result.screeningRuleset || null,
      screened_at: result.screenedAt,
    })),
  );
  const updated = await query(
    `
      WITH incoming AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS row(
          root_domain TEXT,
          screening_status TEXT,
          screening_category TEXT,
          screening_confidence INTEGER,
          screening_cost TEXT,
          screening_entry_url TEXT,
          screening_summary TEXT,
          screening_evidence JSONB,
          screening_ruleset TEXT,
          screened_at TIMESTAMPTZ
        )
      )
      UPDATE extension_prospects AS prospect
      SET screening_status = incoming.screening_status,
          screening_category = incoming.screening_category,
          screening_confidence = incoming.screening_confidence,
          screening_cost = incoming.screening_cost,
          screening_entry_url = incoming.screening_entry_url,
          screening_summary = incoming.screening_summary,
          screening_evidence = COALESCE(incoming.screening_evidence, '[]'::jsonb),
          screening_ruleset = incoming.screening_ruleset,
          screened_at = COALESCE(incoming.screened_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      FROM incoming
      WHERE prospect.root_domain = incoming.root_domain
      RETURNING prospect.root_domain
    `,
    [serialized],
  );
  return {
    received: results.length,
    updated: updated.rowCount || 0,
    missing: results.length - (updated.rowCount || 0),
  };
}

async function upsertProspects(client: PoolClient, values: JsonRecord[]) {
  for (const prospect of values) {
    const rootDomain = text(prospect.rootDomain);
    if (!rootDomain) continue;
    const status = text(prospect.status);
    await client.query(
      `
        INSERT INTO extension_prospects (
          root_domain, authority, csv_file_count, source_files, status,
          submission_url, notes, excluded, excluded_at, excluded_reason,
          last_opened_at, last_imported_at, import_order, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          COALESCE($14::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
        )
        ON CONFLICT (root_domain) DO UPDATE SET
          authority = EXCLUDED.authority,
          csv_file_count = EXCLUDED.csv_file_count,
          source_files = EXCLUDED.source_files,
          status = EXCLUDED.status,
          submission_url = EXCLUDED.submission_url,
          notes = EXCLUDED.notes,
          excluded = EXCLUDED.excluded,
          excluded_at = EXCLUDED.excluded_at,
          excluded_reason = EXCLUDED.excluded_reason,
          last_opened_at = EXCLUDED.last_opened_at,
          last_imported_at = EXCLUDED.last_imported_at,
          import_order = EXCLUDED.import_order,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        rootDomain,
        nullableNumber(prospect.as),
        nullableNumber(prospect.csvFileCount),
        text(prospect.sourceFiles) || null,
        VALID_PROSPECT_STATUSES.has(status) ? status : 'pending',
        text(prospect.submissionUrl) || null,
        text(prospect.notes) || null,
        boolean(prospect.excluded, false),
        nullableDate(prospect.excludedAt),
        text(prospect.excludedReason) || null,
        nullableDate(prospect.lastOpenedAt),
        nullableDate(prospect.lastImportedAt),
        number(prospect.importOrder),
        nullableDate(prospect.createdAt),
      ],
    );
  }
}

async function upsertWebsite(
  client: PoolClient,
  website: JsonRecord,
  idMap: Map<string, number>,
) {
  const sourceId = text(website.id);
  const requestedId = numericId(sourceId);
  const values = [
    text(website.domain),
    text(website.name) || text(website.domain),
    text(website.category),
    boolean(website.active),
    nullableDate(website.createdAt),
  ];
  if (!values[0]) return;

  let result;
  if (requestedId) {
    result = await client.query(
      `UPDATE websites SET domain = $1, name = $2, category = $3,
       is_active = $4, created_at = COALESCE($5::timestamptz, created_at),
       updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING id`,
      [...values, requestedId],
    );
    if (!result.rowCount) {
      result = await client.query(
        `INSERT INTO websites (id, domain, name, category, is_active, created_at, updated_at)
         VALUES ($6, $1, $2, $3, $4, COALESCE($5::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
         RETURNING id`,
        [...values, requestedId],
      );
    }
  } else {
    result = await client.query(
      `INSERT INTO websites (domain, name, category, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
       ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name,
       category = EXCLUDED.category, is_active = EXCLUDED.is_active,
       updated_at = CURRENT_TIMESTAMP RETURNING id`,
      values,
    );
  }
  const websiteId = Number(result.rows[0].id);
  idMap.set(sourceId, websiteId);
  await client.query(
    `INSERT INTO website_extended_info (
       website_id, support_email, title, short_description, description, url,
       created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (website_id) DO UPDATE SET
       support_email = EXCLUDED.support_email,
       title = EXCLUDED.title,
       short_description = EXCLUDED.short_description,
       description = EXCLUDED.description,
       url = EXCLUDED.url,
       updated_at = CURRENT_TIMESTAMP`,
    [
      websiteId,
      text(website.supportEmail) || null,
      text(website.title) || null,
      text(website.shortDescription) || null,
      text(website.description) || null,
      text(website.url) || null,
    ],
  );
}

async function upsertResource(
  client: PoolClient,
  resource: JsonRecord,
  idMap: Map<string, number>,
) {
  const sourceId = text(resource.id);
  const requestedId = numericId(sourceId);
  const domain = text(resource.domain);
  if (!domain) return;
  const values = [
    domain,
    text(resource.url) || `https://${domain}`,
    text(resource.contactEmail) || null,
    number(resource.authority),
    text(resource.category) || 'directory',
    number(resource.cost),
    text(resource.notes) || null,
    boolean(resource.active),
    nullableDate(resource.createdAt),
  ];

  let result;
  if (requestedId) {
    result = await client.query(
      `UPDATE resources SET domain = $1, url = $2, contact_email = $3,
       domain_authority = $4, category = $5, cost = $6, notes = $7,
       is_active = $8, created_at = COALESCE($9::timestamptz, created_at),
       updated_at = CURRENT_TIMESTAMP WHERE id = $10 RETURNING id`,
      [...values, requestedId],
    );
    if (!result.rowCount) {
      result = await client.query(
        `INSERT INTO resources (
           id, domain, url, contact_email, domain_authority, category, cost,
           notes, is_active, created_at, updated_at
         ) VALUES (
           $10, $1, $2, $3, $4, $5, $6, $7, $8,
           COALESCE($9::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
         ) RETURNING id`,
        [...values, requestedId],
      );
    }
  } else {
    result = await client.query(
      `INSERT INTO resources (
         domain, url, contact_email, domain_authority, category, cost, notes,
         is_active, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         COALESCE($9::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
       ) ON CONFLICT (domain) DO UPDATE SET
         url = EXCLUDED.url, contact_email = EXCLUDED.contact_email,
         domain_authority = EXCLUDED.domain_authority,
         category = EXCLUDED.category, cost = EXCLUDED.cost,
         notes = EXCLUDED.notes, is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP RETURNING id`,
      values,
    );
  }
  idMap.set(sourceId, Number(result.rows[0].id));
}

async function upsertSubmission(
  client: PoolClient,
  submission: JsonRecord,
  websiteIds: Map<string, number>,
  resourceIds: Map<string, number>,
) {
  const sourceId = text(submission.id);
  const requestedId = numericId(sourceId);
  const websiteId =
    websiteIds.get(text(submission.websiteId)) || numericId(submission.websiteId);
  const resourceId =
    resourceIds.get(text(submission.resourceId)) || numericId(submission.resourceId);
  if (!websiteId || !resourceId) return;
  const requestedStatus = text(submission.status);
  const values = [
    websiteId,
    resourceId,
    VALID_SUBMISSION_STATUSES.has(requestedStatus) ? requestedStatus : 'pending',
    text(submission.anchorText) || null,
    text(submission.targetUrl) || null,
    nullableDate(submission.placementDate),
    nullableDate(submission.removalDate),
    number(submission.cost),
    text(submission.notes) || null,
    nullableDate(submission.createdAt),
    nullableDate(submission.submittedAt),
    text(submission.submissionUrl) || null,
    text(submission.liveUrl) || null,
    nullableDate(submission.lastCheckedAt),
    JSON.stringify(normalizeSubmissionHistory(submission.statusHistory)),
  ];

  let result;
  if (requestedId) {
    result = await client.query(
      `UPDATE backlinks SET website_id = $1, resource_id = $2,
       status = $3, anchor_text = $4, target_url = $5,
       placement_date = $6::date, removal_date = $7::date, cost = $8,
       notes = $9, created_at = COALESCE($10::timestamptz, created_at),
       submitted_at = $11::timestamptz, submission_url = $12,
       live_url = $13, last_checked_at = $14::timestamptz,
       status_history = $15::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $16 RETURNING id`,
      [...values, requestedId],
    );
    if (!result.rowCount) {
      result = await client.query(
        `INSERT INTO backlinks (
           id, website_id, resource_id, status, anchor_text, target_url,
           placement_date, removal_date, cost, notes, created_at, submitted_at,
           submission_url, live_url, last_checked_at, status_history, updated_at
         ) VALUES (
           $16, $1, $2, $3, $4, $5, $6::date, $7::date,
           $8, $9, COALESCE($10::timestamptz, CURRENT_TIMESTAMP), $11::timestamptz,
           $12, $13, $14::timestamptz, $15::jsonb, CURRENT_TIMESTAMP
         ) ON CONFLICT (website_id, resource_id) DO UPDATE SET
           status = EXCLUDED.status, anchor_text = EXCLUDED.anchor_text,
           target_url = EXCLUDED.target_url, placement_date = EXCLUDED.placement_date,
           removal_date = EXCLUDED.removal_date, cost = EXCLUDED.cost,
           notes = EXCLUDED.notes, submitted_at = EXCLUDED.submitted_at,
           submission_url = EXCLUDED.submission_url, live_url = EXCLUDED.live_url,
           last_checked_at = EXCLUDED.last_checked_at,
           status_history = EXCLUDED.status_history,
           updated_at = CURRENT_TIMESTAMP RETURNING id`,
        [...values, requestedId],
      );
    }
  } else {
    await client.query(
      `INSERT INTO backlinks (
         website_id, resource_id, status, anchor_text, target_url,
         placement_date, removal_date, cost, notes, created_at, submitted_at,
         submission_url, live_url, last_checked_at, status_history, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6::date, $7::date,
         $8, $9, COALESCE($10::timestamptz, CURRENT_TIMESTAMP), $11::timestamptz,
         $12, $13, $14::timestamptz, $15::jsonb, CURRENT_TIMESTAMP
       ) ON CONFLICT (website_id, resource_id) DO UPDATE SET
         status = EXCLUDED.status, anchor_text = EXCLUDED.anchor_text,
         target_url = EXCLUDED.target_url, placement_date = EXCLUDED.placement_date,
         removal_date = EXCLUDED.removal_date, cost = EXCLUDED.cost,
         notes = EXCLUDED.notes, submitted_at = EXCLUDED.submitted_at,
         submission_url = EXCLUDED.submission_url, live_url = EXCLUDED.live_url,
         last_checked_at = EXCLUDED.last_checked_at,
         status_history = EXCLUDED.status_history,
         updated_at = CURRENT_TIMESTAMP`,
      values,
    );
  }
}

async function upsertWorkflow(
  client: PoolClient,
  workflow: JsonRecord,
  resourceIds: Map<string, number>,
) {
  const workflowId = text(workflow.id).slice(0, 200);
  const sourceResourceId = text(workflow.resourceId);
  const resourceId =
    resourceIds.get(sourceResourceId) || numericId(sourceResourceId);
  if (!workflowId || !resourceId) return;
  const steps = Array.isArray(workflow.steps) ? workflow.steps.slice(0, 30) : [];
  const serializedSteps = JSON.stringify(steps);
  if (serializedSteps.length > 500_000) {
    throw new Error('Workflow template is too large');
  }
  const requestedStatus = text(workflow.status);
  const status = ['learning', 'ready', 'needs_relearn'].includes(requestedStatus)
    ? requestedStatus
    : 'learning';
  await client.query(
    `INSERT INTO extension_form_workflows (
       workflow_id, resource_id, domain, name, status, version, steps,
       created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7::jsonb,
       COALESCE($8::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
     ) ON CONFLICT (resource_id) DO UPDATE SET
       workflow_id = EXCLUDED.workflow_id,
       domain = EXCLUDED.domain,
       name = EXCLUDED.name,
       status = EXCLUDED.status,
       version = EXCLUDED.version,
       steps = EXCLUDED.steps,
       updated_at = CURRENT_TIMESTAMP`,
    [
      workflowId,
      resourceId,
      text(workflow.domain),
      text(workflow.name) || 'Submission workflow',
      status,
      Math.max(1, Math.trunc(number(workflow.version, 1))),
      serializedSteps,
      nullableDate(workflow.createdAt),
    ],
  );
}

export async function applyExtensionWorkspacePatch(rawPatch: WorkspacePatch) {
  await ensureExtensionWorkspaceSchema();
  return transaction(async (client) => {
    const prospects = rawPatch.prospects || {};
    const websites = rawPatch.websites || {};
    const resources = rawPatch.resources || {};
    const submissions = rawPatch.submissions || {};
    const workflows = rawPatch.workflows || {};

    const prospectRemovals = strings(prospects.remove);
    if (prospectRemovals.length) {
      await client.query(
        'DELETE FROM extension_prospects WHERE root_domain = ANY($1::text[])',
        [prospectRemovals],
      );
    }
    await upsertProspects(client, records(prospects.upsert));

    const workflowRemovals = strings(workflows.remove);
    if (workflowRemovals.length) {
      await client.query(
        'DELETE FROM extension_form_workflows WHERE workflow_id = ANY($1::text[])',
        [workflowRemovals],
      );
    }

    const submissionRemovals = strings(submissions.remove)
      .map(numericId)
      .filter((id): id is number => Boolean(id));
    if (submissionRemovals.length) {
      await client.query('DELETE FROM backlinks WHERE id = ANY($1::bigint[])', [
        submissionRemovals,
      ]);
    }

    const websiteRemovals = strings(websites.remove)
      .map(numericId)
      .filter((id): id is number => Boolean(id));
    if (websiteRemovals.length) {
      await client.query('DELETE FROM websites WHERE id = ANY($1::bigint[])', [
        websiteRemovals,
      ]);
    }

    const resourceRemovals = strings(resources.remove)
      .map(numericId)
      .filter((id): id is number => Boolean(id));
    if (resourceRemovals.length) {
      await client.query('DELETE FROM resources WHERE id = ANY($1::bigint[])', [
        resourceRemovals,
      ]);
    }

    const websiteIds = new Map<string, number>();
    for (const website of records(websites.upsert)) {
      await upsertWebsite(client, website, websiteIds);
    }
    const resourceIds = new Map<string, number>();
    for (const resource of records(resources.upsert)) {
      await upsertResource(client, resource, resourceIds);
    }
    for (const submission of records(submissions.upsert)) {
      await upsertSubmission(client, submission, websiteIds, resourceIds);
    }
    for (const workflow of records(workflows.upsert)) {
      await upsertWorkflow(client, workflow, resourceIds);
    }

    if (Array.isArray(rawPatch.queue)) {
      const queue = strings(rawPatch.queue);
      await client.query('UPDATE extension_prospects SET queue_position = NULL');
      for (const [position, rootDomain] of queue.entries()) {
        await client.query(
          `UPDATE extension_prospects SET queue_position = $1, updated_at = CURRENT_TIMESTAMP
           WHERE root_domain = $2 AND excluded = FALSE`,
          [position, rootDomain],
        );
      }
    }

    return loadWithClient(client);
  });
}
