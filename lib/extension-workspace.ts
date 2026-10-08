import {
  readState,
  mutateState,
  type WorkspaceState,
  type Table,
} from "@/lib/d1-workspace-store";
import type { Row } from "@/lib/database";

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

export interface OpportunityDecisionPayload {
  action?: unknown;
  rootDomain?: unknown;
  reason?: unknown;
}

export class ProspectReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProspectReportInputError";
  }
}

export class OpportunityDecisionInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OpportunityDecisionInputError";
    this.status = status;
  }
}

const VALID_PROSPECT_STATUSES = new Set([
  "pending",
  "can_add",
  "login_required",
  "paid",
  "later",
]);
const VALID_SCREENING_WRITE_STATUSES = new Set([
  "screened",
  "needs_review",
  "fetch_failed",
]);
const VALID_SCREENING_CATEGORIES = new Set([
  "direct_submit",
  "guest_post",
  "paid_or_contact",
  "possible",
  "no_obvious_opportunity",
]);
const VALID_SCREENING_COSTS = new Set(["unknown", "free", "paid", "mixed"]);
const VALID_SUBMISSION_STATUSES = new Set([
  "pending",
  "requested",
  "placed",
  "live",
  "rejected",
  "removed",
]);
const VALID_OPPORTUNITY_DECISIONS = new Set(["confirm", "exclude", "restore"]);

function text(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownText(value: unknown): string {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
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
  if (!candidate) return "";
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
        ? candidate
        : `https://${candidate}`,
    );
    return ["http:", "https:"].includes(url.protocol)
      ? url.hostname
          .toLowerCase()
          .replace(/^www\./, "")
          .replace(/\.$/, "")
      : "";
  } catch {
    return "";
  }
}

function normalizeHttpUrl(value: unknown): string {
  const candidate = text(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function normalizeScreeningEvidence(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).reduce<JsonRecord[]>((normalized, item) => {
    if (typeof item === "string") {
      const evidenceText = text(item).slice(0, 500);
      if (evidenceText) normalized.push({ text: evidenceText });
      return normalized;
    }
    if (!item || typeof item !== "object") return normalized;
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
    if (!item || typeof item !== "object") return normalized;
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
    throw new ProspectReportInputError("Screening results are required");
  }
  if (payload.results.length > 250) {
    throw new ProspectReportInputError("Screening batch exceeds 250 results");
  }

  const byDomain = new Map<string, JsonRecord>();
  for (const value of payload.results) {
    if (!value || typeof value !== "object") continue;
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
    if (screeningStatus !== "fetch_failed" && !screeningCategory) continue;
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
      : "unknown";
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
    throw new ProspectReportInputError("A valid source domain is required");
  }
  if (!Array.isArray(payload?.records)) {
    throw new ProspectReportInputError("Report records are required");
  }
  if (payload.records.length > 100_000) {
    throw new ProspectReportInputError("Report exceeds the 100,000 row limit");
  }

  const byDomain = new Map<
    string,
    { rootDomain: string; authority: number | null }
  >();
  for (const value of payload.records) {
    if (!value || typeof value !== "object") continue;
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
    throw new ProspectReportInputError("Report contains no valid domains");
  }
  return { sourceDomain, records: normalized };
}

function boolean(value: unknown, fallback = true): boolean {
  return typeof value === "boolean" ? value : fallback;
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
        (item): item is JsonRecord => Boolean(item) && typeof item === "object",
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function serializeProspect(row: JsonRecord) {
  return {
    rootDomain: row.root_domain,
    as: row.authority,
    csvFileCount: row.csv_file_count,
    sourceCount: Number(row.source_count) || 0,
    sourceFiles: row.source_files || "",
    status: row.status,
    submissionUrl: row.submission_url || "",
    notes: row.notes || "",
    excluded: row.excluded,
    excludedAt: row.excluded_at || "",
    excludedReason: row.excluded_reason || "",
    lastOpenedAt: row.last_opened_at || "",
    lastImportedAt: row.last_imported_at || "",
    lastSeenAt: row.last_seen_at || "",
    screeningStatus: row.screening_status || "unscreened",
    screeningCategory: row.screening_category || "",
    screeningConfidence:
      row.screening_confidence === null
        ? null
        : Number(row.screening_confidence),
    screeningCost: row.screening_cost || "unknown",
    screeningEntryUrl: row.screening_entry_url || "",
    screeningSummary: row.screening_summary || "",
    screeningEvidence: Array.isArray(row.screening_evidence)
      ? row.screening_evidence
      : [],
    screeningRuleset: row.screening_ruleset || "",
    screenedAt: row.screened_at || "",
    importOrder: row.import_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeResource(row: JsonRecord) {
  return {
    id: String(row.id),
    domain: row.domain,
    url: row.url,
    contactEmail: row.contact_email || "",
    authority: Number(row.domain_authority) || 0,
    category: row.category,
    cost: Number(row.cost) || 0,
    notes: row.notes || "",
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeSubmission(row: JsonRecord) {
  return {
    id: String(row.id),
    websiteId: String(row.website_id),
    resourceId: String(row.resource_id),
    status: row.status,
    anchorText: row.anchor_text || "",
    targetUrl: row.target_url || "",
    submissionUrl: row.submission_url || "",
    liveUrl: row.live_url || "",
    submittedAt: row.submitted_at || "",
    lastCheckedAt: row.last_checked_at || "",
    statusHistory: Array.isArray(row.status_history) ? row.status_history : [],
    placementDate: row.placement_date || "",
    removalDate: row.removal_date || "",
    cost: Number(row.cost) || 0,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function workspaceFromState(state: WorkspaceState) {
  const websites = {
    rows: state
      .table("websites")
      .map(
        (w): Row => ({
          ...w,
          ...Object.fromEntries(
            Object.entries(
              state
                .table("website_extended_info")
                .find((i) => i.website_id === w.id) || {},
            ).filter(([k]) =>
              [
                "support_email",
                "title",
                "description",
                "short_description",
              ].includes(k),
            ),
          ),
          product_url: state
            .table("website_extended_info")
            .find((i) => i.website_id === w.id)?.url,
        }),
      )
      .sort((a, b) => a.id - b.id),
  };
  const resources = {
    rows: [...state.table("resources")].sort((a, b) => a.id - b.id),
  };
  const submissions = {
    rows: [...state.table("backlinks")].sort((a, b) => a.id - b.id),
  };
  const prospects = {
    rows: [...state.table("extension_prospects")].sort(
      (a, b) =>
        a.import_order - b.import_order ||
        a.root_domain.localeCompare(b.root_domain),
    ),
  };
  const workflows = {
    rows: [...state.table("extension_form_workflows")].sort(
      (a, b) => a.resource_id - b.resource_id,
    ),
  };
  const queue = prospects.rows
    .filter((row) => !row.excluded && row.queue_position !== null)
    .sort((a, b) => Number(a.queue_position) - Number(b.queue_position))
    .map((row) => row.root_domain);

  return {
    schemaVersion: 1,
    meta: {
      source: "backlink-desk-d1",
      updatedAt: new Date().toISOString(),
    },
    prospects: prospects.rows.map((row) => ({
      rootDomain: row.root_domain,
      as: row.authority,
      csvFileCount: row.csv_file_count,
      sourceCount: Number(row.source_count) || 0,
      sourceFiles: row.source_files || "",
      status: row.status,
      submissionUrl: row.submission_url || "",
      notes: row.notes || "",
      excluded: row.excluded,
      excludedAt: row.excluded_at || "",
      excludedReason: row.excluded_reason || "",
      lastOpenedAt: row.last_opened_at || "",
      lastImportedAt: row.last_imported_at || "",
      lastSeenAt: row.last_seen_at || "",
      screeningStatus: row.screening_status || "unscreened",
      screeningCategory: row.screening_category || "",
      screeningConfidence:
        row.screening_confidence === null
          ? null
          : Number(row.screening_confidence),
      screeningCost: row.screening_cost || "unknown",
      screeningEntryUrl: row.screening_entry_url || "",
      screeningSummary: row.screening_summary || "",
      screeningEvidence: Array.isArray(row.screening_evidence)
        ? row.screening_evidence
        : [],
      screeningRuleset: row.screening_ruleset || "",
      screenedAt: row.screened_at || "",
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
      supportEmail: row.support_email || "",
      title: row.title || "",
      shortDescription: row.short_description || "",
      description: row.description || "",
      url: row.product_url || `https://${row.domain}`,
      active: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    resources: resources.rows.map((row) => ({
      id: String(row.id),
      domain: row.domain,
      url: row.url,
      contactEmail: row.contact_email || "",
      authority: Number(row.domain_authority) || 0,
      category: row.category,
      cost: Number(row.cost) || 0,
      notes: row.notes || "",
      active: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    submissions: submissions.rows.map((row) => ({
      id: String(row.id),
      websiteId: String(row.website_id),
      resourceId: String(row.resource_id),
      status: row.status,
      anchorText: row.anchor_text || "",
      targetUrl: row.target_url || "",
      submissionUrl: row.submission_url || "",
      liveUrl: row.live_url || "",
      submittedAt: row.submitted_at || "",
      lastCheckedAt: row.last_checked_at || "",
      statusHistory: Array.isArray(row.status_history)
        ? row.status_history
        : [],
      placementDate: row.placement_date || "",
      removalDate: row.removal_date || "",
      cost: Number(row.cost) || 0,
      notes: row.notes || "",
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
  return workspaceFromState(await readState());
}
const same = (a: unknown, b: unknown) => String(a) === String(b);
const nextOrder = (s: WorkspaceState) =>
  Math.max(
    -1,
    ...s.table("extension_prospects").map((r) => Number(r.import_order) || 0),
  ) + 1;
function patchRow(
  state: WorkspaceState,
  table: Table,
  row: Row | undefined,
  values: Row,
): Row {
  if (row) {
    Object.assign(row, values, { updated_at: state.now });
    return row;
  }
  return state.insert(table, values);
}
export async function importExtensionProspectReport(
  payload: ProspectReportPayload,
) {
  const report = normalizeProspectReport(payload);
  return mutateState((state) => {
    let added = 0;
    let order = nextOrder(state);
    for (const record of [...report.records].sort((a, b) =>
      a.rootDomain.localeCompare(b.rootDomain),
    )) {
      let row = state
        .table("extension_prospects")
        .find((p) => p.root_domain === record.rootDomain);
      if (!row) {
        row = state.insert("extension_prospects", {
          root_domain: record.rootDomain,
          authority: record.authority,
          import_order: order++,
        });
        added++;
      } else if (record.authority !== null)
        row.authority =
          row.authority === null
            ? record.authority
            : Math.max(row.authority, record.authority);
      Object.assign(row, {
        last_imported_at: state.now,
        last_seen_at: state.now,
        updated_at: state.now,
      });
      const source = state
        .table("extension_prospect_sources")
        .find(
          (r) =>
            r.root_domain === record.rootDomain &&
            r.source_domain === report.sourceDomain,
        );
      if (source) {
        if (record.authority !== null)
          source.authority =
            source.authority === null
              ? record.authority
              : Math.max(source.authority, record.authority);
        source.last_seen_at = state.now;
      } else
        state.insert("extension_prospect_sources", {
          root_domain: record.rootDomain,
          source_domain: report.sourceDomain,
          authority: record.authority,
        });
      row.source_count = state
        .table("extension_prospect_sources")
        .filter((r) => r.root_domain === record.rootDomain).length;
    }
    return {
      workspace: workspaceFromState(state),
      summary: {
        sourceDomain: report.sourceDomain,
        added,
        existing: report.records.length - added,
        total: report.records.length,
      },
    };
  });
}
export async function applyProspectScreeningResults(
  payload: ProspectScreeningPayload,
) {
  const results = normalizeProspectScreeningPayload(payload);
  if (!results.length)
    throw new ProspectReportInputError(
      "Screening batch contains no valid results",
    );
  return mutateState((state) => {
    let updated = 0;
    for (const result of results) {
      const row = state
        .table("extension_prospects")
        .find((r) => r.root_domain === result.rootDomain);
      if (!row) continue;
      Object.assign(row, {
        screening_status: result.screeningStatus,
        screening_category: result.screeningCategory,
        screening_confidence: result.screeningConfidence,
        screening_cost: result.screeningCost,
        screening_entry_url: result.screeningEntryUrl || null,
        screening_summary: result.screeningSummary || null,
        screening_evidence: result.screeningEvidence,
        screening_ruleset: result.screeningRuleset || null,
        screened_at: result.screenedAt || state.now,
        updated_at: state.now,
      });
      updated++;
    }
    return {
      received: results.length,
      updated,
      missing: results.length - updated,
    };
  });
}
export async function applyExtensionOpportunityDecision(
  payload: OpportunityDecisionPayload,
) {
  const action = text(payload.action),
    rootDomain = normalizeDomain(payload.rootDomain),
    reason = text(payload.reason).slice(0, 200) || "manual";
  if (!rootDomain)
    throw new OpportunityDecisionInputError("A valid rootDomain is required");
  if (!VALID_OPPORTUNITY_DECISIONS.has(action))
    throw new OpportunityDecisionInputError(
      "action must be confirm, exclude, or restore",
    );
  return mutateState((state) => {
    let prospect = state
      .table("extension_prospects")
      .find((r) => r.root_domain === rootDomain);
    let resource = state
      .table("resources")
      .find((r) => r.domain.trim().toLowerCase() === rootDomain);
    if ((!prospect && !resource) || (action === "restore" && !prospect))
      throw new OpportunityDecisionInputError("Opportunity not found", 404);
    if (action === "exclude") {
      if (!prospect)
        prospect = state.insert("extension_prospects", {
          root_domain: rootDomain,
          authority: resource!.domain_authority,
          import_order: nextOrder(state),
        });
      Object.assign(prospect, {
        excluded: true,
        excluded_at: state.now,
        excluded_reason: reason,
        updated_at: state.now,
      });
    } else if (action === "restore")
      Object.assign(prospect!, {
        excluded: false,
        excluded_at: null,
        excluded_reason: null,
        updated_at: state.now,
      });
    else {
      if (prospect)
        Object.assign(prospect, {
          status: "can_add",
          excluded: false,
          excluded_at: null,
          excluded_reason: null,
          updated_at: state.now,
        });
      if (!resource)
        resource = state.insert("resources", {
          domain: rootDomain,
          url:
            prospect!.screening_entry_url ||
            prospect!.submission_url ||
            `https://${rootDomain}`,
          domain_authority: Number(prospect!.authority) || 0,
          category: prospect!.screening_category || "directory",
          notes: prospect!.notes || null,
        });
      else resource.updated_at = state.now;
      for (const website of state.table("websites").filter((w) => w.is_active))
        state.ensureBacklink(website.id, resource.id);
    }
    return {
      action,
      rootDomain,
      prospect: prospect ? serializeProspect(prospect) : null,
      resource:
        action === "confirm" && resource ? serializeResource(resource) : null,
      submissions:
        action === "confirm"
          ? state
              .table("backlinks")
              .filter((r) => same(r.resource_id, resource!.id))
              .sort((a, b) => a.website_id - b.website_id)
              .map(serializeSubmission)
          : [],
    };
  });
}
export async function applyExtensionWorkspacePatch(rawPatch: WorkspacePatch) {
  return mutateState((state) => {
    const remove = (table: Table, field: string, ids: string[]) =>
      state.remove(table, (r) => ids.includes(String(r[field])));
    remove(
      "extension_prospects",
      "root_domain",
      strings(rawPatch.prospects?.remove),
    );
    remove(
      "extension_prospect_sources",
      "root_domain",
      strings(rawPatch.prospects?.remove),
    );
    remove(
      "extension_form_workflows",
      "workflow_id",
      strings(rawPatch.workflows?.remove),
    );
    remove("backlinks", "id", strings(rawPatch.submissions?.remove));
    for (const [table, field, ids] of [
      ["websites", "website_id", strings(rawPatch.websites?.remove)],
      ["resources", "resource_id", strings(rawPatch.resources?.remove)],
    ] as [Table, string, string[]][]) {
      remove(table, "id", ids);
      for (const child of [
        "backlinks",
        "extension_generated_content",
        ...(table === "websites"
          ? ["website_extended_info"]
          : ["extension_form_workflows"]),
      ] as Table[])
        remove(child, field, ids);
      // Operation ledger FKs intentionally prevent deleting historical submissions.
    }
    for (const p of records(rawPatch.prospects?.upsert)) {
      const domain = text(p.rootDomain);
      if (!domain) continue;
      patchRow(
        state,
        "extension_prospects",
        state
          .table("extension_prospects")
          .find((r) => r.root_domain === domain),
        {
          root_domain: domain,
          authority: nullableNumber(p.as),
          csv_file_count: nullableNumber(p.csvFileCount),
          source_files: text(p.sourceFiles) || null,
          status: VALID_PROSPECT_STATUSES.has(text(p.status))
            ? text(p.status)
            : "pending",
          submission_url: text(p.submissionUrl) || null,
          notes: text(p.notes) || null,
          excluded: boolean(p.excluded, false),
          excluded_at: nullableDate(p.excludedAt),
          excluded_reason: text(p.excludedReason) || null,
          last_opened_at: nullableDate(p.lastOpenedAt),
          last_imported_at: nullableDate(p.lastImportedAt),
          import_order: number(p.importOrder),
          ...(nullableDate(p.createdAt)
            ? { created_at: nullableDate(p.createdAt) }
            : {}),
        },
      );
    }
    const websiteIds = new Map<string, number>(),
      resourceIds = new Map<string, number>();
    for (const w of records(rawPatch.websites?.upsert)) {
      const domain = text(w.domain);
      if (!domain) continue;
      const id = numericId(w.id);
      const existing = id
        ? state.table("websites").find((r) => same(r.id, id))
        : state.table("websites").find((r) => r.domain === domain);
      const row = patchRow(state, "websites", existing, {
        ...(id ? { id } : {}),
        domain,
        name: text(w.name) || domain,
        category: markdownText(w.category),
        is_active: boolean(w.active),
        ...(nullableDate(w.createdAt)
          ? { created_at: nullableDate(w.createdAt) }
          : {}),
      });
      websiteIds.set(text(w.id), row.id);
      patchRow(
        state,
        "website_extended_info",
        state
          .table("website_extended_info")
          .find((r) => same(r.website_id, row.id)),
        {
          website_id: row.id,
          support_email: text(w.supportEmail) || null,
          title: text(w.title) || null,
          short_description: markdownText(w.shortDescription) || null,
          description: markdownText(w.description) || null,
          url: text(w.url) || null,
        },
      );
    }
    for (const r of records(rawPatch.resources?.upsert)) {
      const domain = text(r.domain);
      if (!domain) continue;
      const id = numericId(r.id);
      const existing = id
        ? state.table("resources").find((row) => same(row.id, id))
        : undefined;
      if (
        !id &&
        state
          .table("resources")
          .some(
            (row) => row.domain.trim().toLowerCase() === domain.toLowerCase(),
          )
      )
        throw Object.assign(
          new Error("A resource with this domain already exists"),
          { code: "23505" },
        );
      const row = patchRow(state, "resources", existing, {
        ...(id ? { id } : {}),
        domain,
        url: text(r.url) || `https://${domain}`,
        contact_email: text(r.contactEmail) || null,
        domain_authority: number(r.authority),
        category: text(r.category) || "directory",
        cost: number(r.cost),
        notes: text(r.notes) || null,
        is_active: boolean(r.active),
        ...(nullableDate(r.createdAt)
          ? { created_at: nullableDate(r.createdAt) }
          : {}),
      });
      resourceIds.set(text(r.id), row.id);
    }
    for (const s of records(rawPatch.submissions?.upsert)) {
      const websiteId =
          websiteIds.get(text(s.websiteId)) || numericId(s.websiteId),
        resourceId =
          resourceIds.get(text(s.resourceId)) || numericId(s.resourceId);
      if (!websiteId || !resourceId) continue;
      const id = numericId(s.id);
      const row =
        (id && state.table("backlinks").find((r) => same(r.id, id))) ||
        state
          .table("backlinks")
          .find(
            (r) =>
              same(r.website_id, websiteId) && same(r.resource_id, resourceId),
          );
      patchRow(state, "backlinks", row, {
        ...(!row && id ? { id } : {}),
        website_id: websiteId,
        resource_id: resourceId,
        status: VALID_SUBMISSION_STATUSES.has(text(s.status))
          ? text(s.status)
          : "pending",
        anchor_text: text(s.anchorText) || null,
        target_url: text(s.targetUrl) || null,
        placement_date: nullableDate(s.placementDate),
        removal_date: nullableDate(s.removalDate),
        cost: number(s.cost),
        notes: text(s.notes) || null,
        submitted_at: nullableDate(s.submittedAt),
        submission_url: text(s.submissionUrl) || null,
        live_url: text(s.liveUrl) || null,
        last_checked_at: nullableDate(s.lastCheckedAt),
        status_history: normalizeSubmissionHistory(s.statusHistory),
        ...(nullableDate(s.createdAt)
          ? { created_at: nullableDate(s.createdAt) }
          : {}),
      });
    }
    for (const w of records(rawPatch.workflows?.upsert)) {
      const id = text(w.id).slice(0, 200),
        resourceId =
          resourceIds.get(text(w.resourceId)) || numericId(w.resourceId);
      if (!id || !resourceId) continue;
      const steps = Array.isArray(w.steps) ? w.steps.slice(0, 30) : [];
      if (JSON.stringify(steps).length > 500_000)
        throw new Error("Workflow template is too large");
      patchRow(
        state,
        "extension_form_workflows",
        state
          .table("extension_form_workflows")
          .find((r) => same(r.resource_id, resourceId)),
        {
          workflow_id: id,
          resource_id: resourceId,
          domain: text(w.domain),
          name: text(w.name) || "Submission workflow",
          status: ["learning", "ready", "needs_relearn"].includes(
            text(w.status),
          )
            ? text(w.status)
            : "learning",
          version: Math.max(1, Math.trunc(number(w.version, 1))),
          steps,
          ...(nullableDate(w.createdAt)
            ? { created_at: nullableDate(w.createdAt) }
            : {}),
        },
      );
    }
    if (Array.isArray(rawPatch.queue)) {
      const positions = new Map(
        strings(rawPatch.queue).map((domain, index) => [domain, index]),
      );
      for (const p of state.table("extension_prospects")) {
        const position = p.excluded
          ? null
          : (positions.get(p.root_domain) ?? null);
        if (p.queue_position !== position)
          Object.assign(p, { queue_position: position, updated_at: state.now });
      }
    }
    return workspaceFromState(state);
  });
}
