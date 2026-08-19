import type { PoolClient } from 'pg';
import { query, transaction } from '@/lib/database';

type JsonRecord = Record<string, unknown>;

export interface WorkspacePatch {
  prospects?: { upsert?: JsonRecord[]; remove?: string[] };
  websites?: { upsert?: JsonRecord[]; remove?: string[] };
  resources?: { upsert?: JsonRecord[]; remove?: string[] };
  submissions?: { upsert?: JsonRecord[]; remove?: string[] };
  queue?: string[];
}

const VALID_PROSPECT_STATUSES = new Set([
  'pending',
  'can_add',
  'login_required',
  'paid',
  'later',
]);
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
        source_files      TEXT,
        status            TEXT NOT NULL DEFAULT 'pending',
        submission_url    TEXT,
        notes             TEXT,
        excluded          BOOLEAN NOT NULL DEFAULT FALSE,
        excluded_at       TIMESTAMPTZ,
        excluded_reason   TEXT,
        last_opened_at    TIMESTAMPTZ,
        last_imported_at  TIMESTAMPTZ,
        import_order      INTEGER NOT NULL DEFAULT 0,
        queue_position    INTEGER,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_extension_prospects_status
        ON extension_prospects (status);
      CREATE INDEX IF NOT EXISTS idx_extension_prospects_queue
        ON extension_prospects (queue_position);
      ALTER TABLE website_extended_info
        ADD COLUMN IF NOT EXISTS short_description TEXT;
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
  const [websites, resources, submissions, prospects] = await Promise.all([
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
      sourceFiles: row.source_files || '',
      status: row.status,
      submissionUrl: row.submission_url || '',
      notes: row.notes || '',
      excluded: row.excluded,
      excludedAt: row.excluded_at || '',
      excludedReason: row.excluded_reason || '',
      lastOpenedAt: row.last_opened_at || '',
      lastImportedAt: row.last_imported_at || '',
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
      placementDate: row.placement_date || '',
      removalDate: row.removal_date || '',
      cost: Number(row.cost) || 0,
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export async function loadExtensionWorkspace() {
  await ensureExtensionWorkspaceSchema();
  return loadWithClient();
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
       is_active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING id`,
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
       is_active = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $10 RETURNING id`,
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
  ];

  let result;
  if (requestedId) {
    result = await client.query(
      `UPDATE backlinks SET website_id = $1, resource_id = $2,
       status = $3::backlink_status, anchor_text = $4, target_url = $5,
       placement_date = $6::date, removal_date = $7::date, cost = $8,
       notes = $9, updated_at = CURRENT_TIMESTAMP WHERE id = $11 RETURNING id`,
      [...values, requestedId],
    );
    if (!result.rowCount) {
      result = await client.query(
        `INSERT INTO backlinks (
           id, website_id, resource_id, status, anchor_text, target_url,
           placement_date, removal_date, cost, notes, created_at, updated_at
         ) VALUES (
           $11, $1, $2, $3::backlink_status, $4, $5, $6::date, $7::date,
           $8, $9, COALESCE($10::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
         ) ON CONFLICT (website_id, resource_id) DO UPDATE SET
           status = EXCLUDED.status, anchor_text = EXCLUDED.anchor_text,
           target_url = EXCLUDED.target_url, placement_date = EXCLUDED.placement_date,
           removal_date = EXCLUDED.removal_date, cost = EXCLUDED.cost,
           notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP RETURNING id`,
        [...values, requestedId],
      );
    }
  } else {
    await client.query(
      `INSERT INTO backlinks (
         website_id, resource_id, status, anchor_text, target_url,
         placement_date, removal_date, cost, notes, created_at, updated_at
       ) VALUES (
         $1, $2, $3::backlink_status, $4, $5, $6::date, $7::date,
         $8, $9, COALESCE($10::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
       ) ON CONFLICT (website_id, resource_id) DO UPDATE SET
         status = EXCLUDED.status, anchor_text = EXCLUDED.anchor_text,
         target_url = EXCLUDED.target_url, placement_date = EXCLUDED.placement_date,
         removal_date = EXCLUDED.removal_date, cost = EXCLUDED.cost,
         notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP`,
      values,
    );
  }
}

export async function applyExtensionWorkspacePatch(rawPatch: WorkspacePatch) {
  await ensureExtensionWorkspaceSchema();
  return transaction(async (client) => {
    const prospects = rawPatch.prospects || {};
    const websites = rawPatch.websites || {};
    const resources = rawPatch.resources || {};
    const submissions = rawPatch.submissions || {};

    const prospectRemovals = strings(prospects.remove);
    if (prospectRemovals.length) {
      await client.query(
        'DELETE FROM extension_prospects WHERE root_domain = ANY($1::text[])',
        [prospectRemovals],
      );
    }
    await upsertProspects(client, records(prospects.upsert));

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
