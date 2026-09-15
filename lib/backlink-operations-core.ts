/* eslint-disable @typescript-eslint/no-explicit-any */
export const DAILY_TARGET = 5;
export const SITE_DOMAINS = ['pixfy.io', 'scribix.io', 'fablepilot.com'];
export type Row = Record<string, any>; // Database/legacy JSON boundary; normalize below.
export interface Workspace { websites: Row[]; resources: Row[]; prospects: Row[]; submissions: Row[] }
export interface Ledger { runs: Row[]; attempts: Row[]; checks: Row[]; reviews: Row[]; reports: Row[] }
export const emptyLedger = (): Ledger => ({ runs: [], attempts: [], checks: [], reviews: [], reports: [] });
export function dayInMelbourne(value: string | Date = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function httpUrl(value: unknown): string {
  try { const u = new URL(String(value || '')); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function domainOf(value: unknown): string {
  try { return new URL(/^https?:\/\//i.test(String(value)) ? String(value) : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); } catch { return ''; }
}
const stamp = (v: unknown) => { const n = new Date(String(v || '')).getTime(); return Number.isFinite(n) ? n : 0; };
const key = (w: unknown, r: unknown) => `${w}:${r}`;
function latest(rows: Row[], getKey: (r: Row) => string) {
  const result = new Map<string, Row>();
  for (const row of [...rows].sort((a,b) => stamp(a.checked_at) - stamp(b.checked_at) || Number(a.id) - Number(b.id))) result.set(getKey(row), row);
  return result;
}
export function submissionDate(s: Row): string {
  // Prefer the original submission event, never updatedAt or verification time.
  const dates = [s.submittedAt, ...(Array.isArray(s.statusHistory) ? s.statusHistory.filter((h: Row) => ['requested','placed'].includes(h.status)).map((h: Row) => h.at) : [])].filter((v) => stamp(v));
  return dates.sort((a,b) => stamp(a)-stamp(b))[0] || '';
}
export function hasSubmission(s?: Row): boolean {
  return !!s && (!!submissionDate(s) || ['requested','placed','live','removed','rejected'].includes(s.status));
}
export function buildReport(workspace: Workspace, ledger: Ledger, day = dayInMelbourne()) {
  const reviews = latest(ledger.reviews, r => domainOf(r.domain));
  const checks = latest(ledger.checks, r => key(r.website_id,r.resource_id));
  const prospects = new Map(workspace.prospects.map(p => [domainOf(p.rootDomain),p]));
  const resourceDomains = new Set(workspace.resources.map(r => domainOf(r.domain)));
  const resources = [
    ...workspace.resources.map(r => ({ ...r, domain: domainOf(r.domain), resourceId: String(r.id), source: 'resource', prospect: prospects.get(domainOf(r.domain)) })),
    ...workspace.prospects.filter(p => !resourceDomains.has(domainOf(p.rootDomain))).map(p => ({ id: `prospect:${p.rootDomain}`, resourceId: '', domain: domainOf(p.rootDomain), url: p.submissionUrl || p.screeningEntryUrl || `https://${p.rootDomain}`, createdAt: p.createdAt, active: !p.excluded, source: 'prospect', prospect: p })),
  ].map((r: Row) => {
    const review = reviews.get(r.domain);
    const p = r.prospect;
    // Legacy confirmed resources are retained as confirmed; zero cost alone is NOT proof of free submission.
    const status = r.active === false || p?.excluded ? 'unavailable' : review?.result || (p?.status === 'paid' || r.cost > 0 ? 'unavailable' : p?.status === 'can_add' || r.source === 'resource' ? 'confirmed' : 'pending');
    return { id: String(r.id), resourceId: r.resourceId, domain: r.domain, url: httpUrl(review?.entry_url || p?.submissionUrl || r.url), status, source: r.source, createdAt: p?.createdAt && stamp(p.createdAt) < stamp(r.createdAt) ? p.createdAt : r.createdAt, checkedAt: review?.checked_at || '', note: review?.note || p?.notes || r.notes || '', screeningSummary: p?.screeningSummary || '', importOrder: p?.importOrder ?? null };
  }).sort((a,b) => stamp(a.createdAt)-stamp(b.createdAt) || (a.importOrder ?? Number.MAX_SAFE_INTEGER)-(b.importOrder ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id,undefined,{numeric:true}));
  const byResource = new Map(resources.filter(r=>r.resourceId).map(r=>[r.resourceId,r]));
  const sites = SITE_DOMAINS.map(domain => {
    const website = workspace.websites.find(w => domainOf(w.domain) === domain);
    if (!website) return { id: '', name: domain, domain, missing: true, active: false, today: 0, remaining: 5, unknownDates: 0, records: [], candidates: [], blockers: [], reserved: 0, attempts: [] };
    const siteId = String(website.id);
    const siteAttempts = ledger.attempts.filter(a=>String(a.website_id)===siteId);
    const submissions = workspace.submissions.filter(s=>String(s.websiteId)===siteId);
    const records = submissions.filter(hasSubmission).map(s => {
      const check = checks.get(key(siteId,s.resourceId));
      return { id: String(s.id), resourceId: String(s.resourceId), domain: byResource.get(String(s.resourceId))?.domain || `Resource ${s.resourceId}`, status: s.status, submittedAt: submissionDate(s), verification: check?.result || (s.status === 'live' ? 'legacy_live' : 'pending'), checkedAt: check?.checked_at || s.lastCheckedAt || '', liveUrl: httpUrl(check?.evidence_url || s.liveUrl), submissionUrl: httpUrl(s.submissionUrl), targetUrl: httpUrl(check?.target_url || s.targetUrl), rel: check?.rel || '', note: check?.note || s.notes || '', history: s.statusHistory || [] };
    });
    const todayPairs = new Set(records.filter(r=>dayInMelbourne(r.submittedAt)===day).map(r=>r.resourceId));
    for (const a of siteAttempts) if(a.status==='submitted' && dayInMelbourne(a.resolved_at)===day) todayPairs.add(String(a.resource_id));
    const reserved = siteAttempts.filter(a=>['reserved','uncertain'].includes(a.status));
    const candidates = resources.filter(r=>r.resourceId && ['free','exchange'].includes(r.status) && !submissions.some(s=>String(s.resourceId)===r.resourceId && hasSubmission(s)) && !siteAttempts.some(a=>String(a.resource_id)===r.resourceId && (a.status !== 'failed' || dayInMelbourne(a.resolved_at)===day)));
    return { id: siteId, name: website.name, domain, missing: false, active: website.active !== false, today: todayPairs.size, remaining: Math.max(0,DAILY_TARGET-todayPairs.size), unknownDates: records.filter(r=>!r.submittedAt).length, records: records.sort((a,b)=>stamp(b.submittedAt)-stamp(a.submittedAt)), candidates: website.active === false ? [] : candidates, blockers: reserved.map(a=>({...a, domain: byResource.get(String(a.resource_id))?.domain || String(a.resource_id)})), reserved: reserved.length, attempts: siteAttempts.map(a=>({...a,domain: byResource.get(String(a.resource_id))?.domain || String(a.resource_id)})) };
  });
  return { day, timezone: 'Australia/Melbourne', target: DAILY_TARGET, generatedAt: new Date().toISOString(), sites, resources, runs: ledger.runs, reports: ledger.reports };
}
export type OperationsReport = ReturnType<typeof buildReport>;
