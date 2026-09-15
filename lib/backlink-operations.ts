import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { transaction } from '@/lib/database';
import { loadExtensionWorkspace } from '@/lib/extension-workspace';
import { buildReport, dayInMelbourne, emptyLedger, httpUrl, domainOf, hasSubmission, type Ledger, type Row } from '@/lib/backlink-operations-core';

export class OperationsError extends Error { constructor(message: string, public status = 400) { super(message); } }
function ensure(condition: unknown, message: string, status = 400): asserts condition { if (!condition) throw new OperationsError(message,status); }
const clean = (value: unknown, max = 2000) => String(value || '').trim().slice(0,max);
const uuid = (v: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
export async function loadLedger(client: PoolClient): Promise<Ledger> {
  const ready = await client.query("SELECT to_regclass('backlink_operation_runs') AS name");
  if (!ready.rows[0].name) return emptyLedger();
  const runs = await client.query('SELECT * FROM backlink_operation_runs ORDER BY created_at DESC');
  const attempts = await client.query('SELECT * FROM backlink_operation_attempts ORDER BY created_at');
  const checks = await client.query('SELECT * FROM backlink_operation_checks ORDER BY checked_at,id');
  const reviews = await client.query('SELECT * FROM backlink_operation_resource_reviews ORDER BY checked_at,id');
  const reports = await client.query('SELECT id,day,run_id,created_at FROM backlink_operation_reports ORDER BY created_at DESC');
  return { runs: runs.rows, attempts: attempts.rows, checks: checks.rows, reviews: reviews.rows, reports: reports.rows };
}
async function state(client: PoolClient, day = dayInMelbourne()) {
  const workspace = await loadExtensionWorkspace(client);
  const ledger = await loadLedger(client);
  return { workspace, ledger, report: buildReport(workspace,ledger,day) };
}
export async function readOperations(day: string, snapshot?: string) {
  return transaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const ready = !!(await client.query("SELECT to_regclass('backlink_operation_runs') AS name")).rows[0].name;
    if (snapshot) {
      ensure(ready && /^\d+$/.test(snapshot),'日报不存在',404);
      const row = (await client.query('SELECT report,created_at FROM backlink_operation_reports WHERE id=$1',[snapshot])).rows[0];
      ensure(row,'日报不存在',404);
      return { ready, archived: true, report: row.report, savedAt: row.created_at };
    }
    return { ready, archived: false, report: (await state(client,day)).report };
  });
}
async function snapshot(client: PoolClient, runId: string | null = null) {
  const {report} = await state(client);
  await client.query('INSERT INTO backlink_operation_reports(day,run_id,report) VALUES($1,$2,$3::jsonb)',[report.day,runId,JSON.stringify({...report,reports:[]})]);
}
export async function mutateOperations(input: Row) {
  return transaction(async client => {
    // Serialize all operations writes: quota, deduplication, snapshots and FIFO additions.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('backlink-operations-v1'))");
    ensure((await client.query("SELECT to_regclass('backlink_operation_runs') AS name")).rows[0].name,'请先应用运营台数据库迁移',503);
    const {workspace,ledger,report} = await state(client);
    const action = clean(input.action,40);
    if (action === 'start') {
      let run = ledger.runs.find(r=>dayInMelbourne(r.created_at)===report.day && r.status==='open');
      if (!run) run = (await client.query('INSERT INTO backlink_operation_runs(id,day) VALUES($1,$2) RETURNING *',[randomUUID(),report.day])).rows[0];
      ensure(run, '无法创建任务', 500);
      for (const site of report.sites) {
        if (!site.id || !site.active) continue;
        const available = Math.max(0,site.remaining-site.reserved);
        for (const resource of site.candidates.slice(0,available)) {
          await client.query("INSERT INTO backlink_operation_attempts(id,run_id,website_id,resource_id,status) VALUES($1,$2,$3,$4,'reserved')",[randomUUID(),run.id,site.id,resource.resourceId]);
        }
      }
      await snapshot(client,run.id);
      return { message: '已建立／补充今日待办。请交给 Codex 执行，或逐项处理并记录结果。', runId: run.id };
    }
    if (action === 'preflight') {
      ensure(uuid(input.attemptId),'无效待办编号');
      const attempt=ledger.attempts.find(a=>a.id===input.attemptId);
      ensure(attempt && attempt.status==='reserved','先核实该待办的已有结果，不能直接重试',409);
      const run=ledger.runs.find(r=>r.id===attempt.run_id);
      ensure(run && run.status==='open' && dayInMelbourne(run.created_at)===report.day,'任务已结束或跨日，请重新核实并准备今日任务',409);
      const site=report.sites.find(s=>s.id===String(attempt.website_id));
      ensure(site && site.active && site.today<5,'网站已停用或今日已达标',409);
      const resource=report.resources.find(r=>r.resourceId===String(attempt.resource_id));
      ensure(resource && ['free','exchange'].includes(resource.status),'资源条件已变化，请重新核实',409);
      ensure(!workspace.submissions.some(s=>s.websiteId===String(attempt.website_id) && s.resourceId===String(attempt.resource_id) && hasSubmission(s)),'已存在投递记录，不能重复投递',409);
      return {message:'当前可以处理此待办；最终提交前仍须核实外站是否已有该产品',day:report.day,attemptId:attempt.id,website:site.domain,resource:resource.domain,entryUrl:resource.url,remaining:site.remaining};
    }
    if (action === 'attempt') {
      ensure(uuid(input.attemptId),'无效待办编号');
      const attempt = ledger.attempts.find(a=>a.id===input.attemptId);
      ensure(attempt,'待办不存在',404);
      const result = clean(input.result,20);
      ensure(['submitted','failed','uncertain'].includes(result),'无效投递结果');
      if (attempt.status === result && !['reserved','uncertain'].includes(attempt.status)) return { message: '该结果已经记录，未重复计数' };
      ensure(['reserved','uncertain'].includes(attempt.status),'该待办已处理',409);
      const note = clean(input.note);
      const evidence = httpUrl(input.evidenceUrl);
      ensure(note,'请记录实际结果或阻塞原因');
      ensure(result !== 'submitted' || evidence,'成功投递需要提交结果页或提交入口地址');
      if (result === 'submitted') {
        const site = report.sites.find(s=>s.id===String(attempt.website_id));
        ensure(site && site.today < 5,'今日已经达到 5 次成功投递，请先核实记录',409);
        const previous = workspace.submissions.find(s=>s.websiteId===String(attempt.website_id) && s.resourceId===String(attempt.resource_id));
        ensure(!hasSubmission(previous),'数据库已有投递记录，请核实，不要重复提交',409);
        const now = new Date().toISOString();
        const history = JSON.stringify([{status:'requested',at:now,url:evidence,note}]);
        await client.query(`INSERT INTO backlinks(website_id,resource_id,status,submitted_at,submission_url,status_history)
          VALUES($1,$2,'requested',$3,$4,$5::jsonb)
          ON CONFLICT(website_id,resource_id) DO UPDATE SET status='requested',submitted_at=EXCLUDED.submitted_at,
          submission_url=EXCLUDED.submission_url,status_history=backlinks.status_history || EXCLUDED.status_history,updated_at=CURRENT_TIMESTAMP`,[attempt.website_id,attempt.resource_id,now,evidence,history]);
      }
      await client.query('UPDATE backlink_operation_attempts SET status=$2,note=$3,evidence_url=$4,resolved_at=CURRENT_TIMESTAMP WHERE id=$1',[attempt.id,result,note,evidence || null]);
      await snapshot(client,attempt.run_id);
      return { message: '已保存投递结果与日报版本' };
    }
    if (action === 'check') {
      const submission = workspace.submissions.find(s=>s.websiteId===String(input.websiteId) && s.resourceId===String(input.resourceId));
      ensure(submission && hasSubmission(submission),'必须先有对应网站的投递记录');
      const result = clean(input.result,30);
      ensure(['listed','pending','missing_link','unreachable','removed'].includes(result),'无效检查结果');
      const note = clean(input.note);
      const evidence = httpUrl(input.evidenceUrl);
      const target = httpUrl(input.targetUrl);
      const website = workspace.websites.find(w=>w.id===String(input.websiteId));
      ensure(note,'请记录检查证据或未通过原因');
      ensure(result !== 'listed' || (evidence && target && domainOf(target)===domainOf(website?.domain)),'收录通过需要对方公开详情页，以及指向正确网站的链接');
      ensure(result !== 'listed' || domainOf(evidence)!==domainOf(website?.domain),'请填写对方的详情页，不能用自己的首页作为收录证据');
      await client.query('INSERT INTO backlink_operation_checks(website_id,resource_id,result,evidence_url,target_url,rel,note) VALUES($1,$2,$3,$4,$5,$6,$7)',[input.websiteId,input.resourceId,result,evidence||null,target||null,clean(input.rel,200),note]);
      // A transient failure never erases historical live status. Latest check is a separate ledger.
      if (result === 'listed') {
        const history = JSON.stringify([{status:'live',at:new Date().toISOString(),url:evidence,note}]);
        await client.query("UPDATE backlinks SET status='live',live_url=$3,target_url=$4,last_checked_at=CURRENT_TIMESTAMP,status_history=status_history || $5::jsonb,updated_at=CURRENT_TIMESTAMP WHERE website_id=$1 AND resource_id=$2",[input.websiteId,input.resourceId,evidence,target,history]);
      } else await client.query('UPDATE backlinks SET last_checked_at=CURRENT_TIMESTAMP WHERE website_id=$1 AND resource_id=$2',[input.websiteId,input.resourceId]);
      await snapshot(client);
      return { message: '已保存对方收录检查及证据' };
    }
    if (action === 'review') {
      const domain = domainOf(input.domain);
      ensure(report.resources.some(r=>r.domain===domain),'资源不存在');
      const result = clean(input.result,30);
      ensure(['free','exchange','unavailable','pending'].includes(result),'无效资源验证结果');
      const entry = httpUrl(input.entryUrl), note = clean(input.note);
      ensure(note,'请填写验证依据、费用或交换条件');
      ensure(!['free','exchange'].includes(result) || entry,'可投递资源需要有效提交入口');
      const current = report.resources.find(r=>r.domain===domain)!;
      const excluded = workspace.prospects.find(p=>domainOf(p.rootDomain)===domain)?.excluded;
      const inactive = workspace.resources.find(r=>domainOf(r.domain)===domain)?.active===false;
      ensure(!['free','exchange'].includes(result) || (!excluded && !inactive),'资源已被人工排除或停用，请先在原管理界面恢复',409);
      if (['free','exchange'].includes(result) && !current.resourceId) {
        await client.query("INSERT INTO resources(domain,url,category,notes) VALUES($1,$2,'tools-directory',$3) ON CONFLICT(domain) DO NOTHING",[domain,entry,note]);
      }
      await client.query('INSERT INTO backlink_operation_resource_reviews(domain,result,entry_url,note) VALUES($1,$2,$3,$4)',[domain,result,entry||null,note]);
      await snapshot(client);
      return { message: '已保存资源验证；保留原有人工判断与筛选记录' };
    }
    if (action === 'add') {
      const urls = [...new Set(clean(input.urls,20000).split(/[\n,]+/).map(v=>v.trim()).filter(Boolean))];
      ensure(urls.length>0 && urls.length<=100,'每次添加 1–100 个网址，每行一个');
      const known = new Set(report.resources.map(r=>r.domain));
      let added=0;
      for (const value of urls) {
        const url = httpUrl(/^https?:\/\//i.test(value)?value:`https://${value}`);
        const domain=domainOf(url);
        ensure(url && domain.includes('.'),'存在无效网址，请修正后重试');
        if (known.has(domain)) continue;
        await client.query(`INSERT INTO extension_prospects(root_domain,status,submission_url,import_order)
          SELECT $1,'pending',$2,COALESCE(MAX(import_order),-1)+1 FROM extension_prospects
          ON CONFLICT(root_domain) DO NOTHING`,[domain,url]);
        known.add(domain); added++;
      }
      await snapshot(client);
      return { message: `新增 ${added} 个资源，已追加到待验证队尾；重复项保持原位` };
    }
    if (action === 'snapshot') { await snapshot(client); return { message: '已保存今日报表，历史版本不会被覆盖' }; }
    if (action === 'close') {
      ensure(uuid(input.runId),'无效任务编号');
      const run=ledger.runs.find(r=>r.id===input.runId);
      ensure(run,'任务不存在',404);
      ensure(!ledger.attempts.some(a=>a.run_id===run.id && ['reserved','uncertain'].includes(a.status)),'请先处理待办及不明确的提交结果，再结束任务',409);
      await client.query("UPDATE backlink_operation_runs SET status='closed',closed_at=CURRENT_TIMESTAMP WHERE id=$1",[run.id]);
      await snapshot(client,run.id);
      return {message:'任务已结束，日报已保存'};
    }
    throw new OperationsError('不支持的操作');
  });
}
