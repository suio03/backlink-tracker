import { randomUUID } from "node:crypto";
import { query } from "@/lib/database";
import {
  readState,
  mutateState,
  type WorkspaceState,
} from "@/lib/d1-workspace-store";
import { workspaceFromState } from "@/lib/extension-workspace";
import {
  buildReport,
  dayInMelbourne,
  httpUrl,
  domainOf,
  hasSubmission,
  type Ledger,
  type Row,
} from "@/lib/backlink-operations-core";

export class OperationsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function ensure(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new OperationsError(message, status);
}
const clean = (value: unknown, max = 2000) =>
  String(value || "")
    .trim()
    .slice(0, max);
const uuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value),
  );
const same = (a: unknown, b: unknown) => String(a) === String(b);
function ledger(state: WorkspaceState): Ledger {
  return {
    runs: [...state.table("backlink_operation_runs")].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    ),
    attempts: [...state.table("backlink_operation_attempts")].sort((a, b) =>
      String(a.created_at).localeCompare(String(b.created_at)),
    ),
    checks: [...state.table("backlink_operation_checks")].sort(
      (a, b) =>
        String(a.checked_at).localeCompare(String(b.checked_at)) || a.id - b.id,
    ),
    reviews: [...state.table("backlink_operation_resource_reviews")].sort(
      (a, b) =>
        String(a.checked_at).localeCompare(String(b.checked_at)) || a.id - b.id,
    ),
    reports: [...state.table("backlink_operation_reports")].sort(
      (a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id,
    ),
  };
}
function reportFor(state: WorkspaceState, day = dayInMelbourne()) {
  return buildReport(workspaceFromState(state), ledger(state), day);
}
function snapshot(state: WorkspaceState, runId: string | null = null) {
  const report = reportFor(state);
  state.insert("backlink_operation_reports", {
    day: report.day,
    run_id: runId,
    report: { ...report, reports: [] },
  });
}
export async function readOperations(day: string, snapshotId?: string) {
  if (snapshotId) {
    ensure(/^\d+$/.test(snapshotId), "日报不存在", 404);
    const row = (
      await query(
        "SELECT id,created_at FROM backlink_operation_reports WHERE id=$1",
        [snapshotId],
      )
    ).rows[0];
    ensure(row, "日报不存在", 404);
    const parts = (
      await query(
        "SELECT data FROM backlink_report_parts WHERE report_id=$1 ORDER BY part",
        [snapshotId],
      )
    ).rows;
    return {
      ready: true,
      archived: true,
      report: JSON.parse(parts.map((p) => p.data).join("")),
      savedAt: row.created_at,
    };
  }
  return {
    ready: true,
    archived: false,
    report: reportFor(await readState(), day),
  };
}
export async function mutateOperations(input: Row) {
  return mutateState((state) => {
    const workspace = workspaceFromState(state),
      history = ledger(state),
      report = buildReport(workspace, history, dayInMelbourne());
    const action = clean(input.action, 40);
    if (action === "start") {
      let run = history.runs.find(
        (r) =>
          dayInMelbourne(r.created_at) === report.day && r.status === "open",
      );
      if (!run)
        run = state.insert("backlink_operation_runs", {
          id: randomUUID(),
          day: report.day,
        });
      for (const site of report.sites) {
        if (!site.id || !site.active) continue;
        for (const resource of site.candidates.slice(
          0,
          Math.max(0, site.remaining - site.reserved),
        ))
          state.insert("backlink_operation_attempts", {
            id: randomUUID(),
            run_id: run.id,
            website_id: Number(site.id),
            resource_id: Number(resource.resourceId),
            status: "reserved",
          });
      }
      snapshot(state, run.id);
      return {
        message:
          "已建立／补充今日待办。请交给 Codex 执行，或逐项处理并记录结果。",
        runId: run.id,
      };
    }
    if (action === "preflight") {
      ensure(uuid(input.attemptId), "无效待办编号");
      const attempt = history.attempts.find((a) => a.id === input.attemptId);
      ensure(
        attempt && attempt.status === "reserved",
        "先核实该待办的已有结果，不能直接重试",
        409,
      );
      const run = history.runs.find((r) => r.id === attempt.run_id);
      ensure(
        run &&
          run.status === "open" &&
          dayInMelbourne(run.created_at) === report.day,
        "任务已结束或跨日，请重新核实并准备今日任务",
        409,
      );
      const site = report.sites.find(
        (s) => s.id === String(attempt.website_id),
      );
      ensure(
        site && site.active && site.today < 5,
        "网站已停用或今日已达标",
        409,
      );
      const resource = report.resources.find(
        (r) => r.resourceId === String(attempt.resource_id),
      );
      ensure(
        resource && ["free", "exchange"].includes(resource.status),
        "资源条件已变化，请重新核实",
        409,
      );
      ensure(
        !workspace.submissions.some(
          (s) =>
            s.websiteId === String(attempt.website_id) &&
            s.resourceId === String(attempt.resource_id) &&
            hasSubmission(s),
        ),
        "已存在投递记录，不能重复投递",
        409,
      );
      return {
        message: "当前可以处理此待办；最终提交前仍须核实外站是否已有该产品",
        day: report.day,
        attemptId: attempt.id,
        website: site.domain,
        resource: resource.domain,
        entryUrl: resource.url,
        remaining: site.remaining,
      };
    }
    if (action === "attempt") {
      ensure(uuid(input.attemptId), "无效待办编号");
      const attempt = history.attempts.find((a) => a.id === input.attemptId);
      ensure(attempt, "待办不存在", 404);
      const result = clean(input.result, 20);
      ensure(
        ["submitted", "failed", "uncertain"].includes(result),
        "无效投递结果",
      );
      if (
        attempt.status === result &&
        !["reserved", "uncertain"].includes(attempt.status)
      )
        return { message: "该结果已经记录，未重复计数" };
      ensure(
        ["reserved", "uncertain"].includes(attempt.status),
        "该待办已处理",
        409,
      );
      const note = clean(input.note),
        evidence = httpUrl(input.evidenceUrl);
      ensure(note, "请记录实际结果或阻塞原因");
      ensure(
        result !== "submitted" || evidence,
        "成功投递需要提交结果页或提交入口地址",
      );
      if (result === "submitted") {
        const site = report.sites.find(
          (s) => s.id === String(attempt.website_id),
        );
        ensure(
          site && site.today < 5,
          "今日已经达到 5 次成功投递，请先核实记录",
          409,
        );
        ensure(
          !hasSubmission(
            workspace.submissions.find(
              (s) =>
                s.websiteId === String(attempt.website_id) &&
                s.resourceId === String(attempt.resource_id),
            ),
          ),
          "数据库已有投递记录，请核实，不要重复提交",
          409,
        );
        const row = state.ensureBacklink(
          attempt.website_id,
          attempt.resource_id,
        );
        Object.assign(row, {
          status: "requested",
          submitted_at: state.now,
          submission_url: evidence,
          status_history: [
            ...(row.status_history || []),
            { status: "requested", at: state.now, url: evidence, note },
          ],
          updated_at: state.now,
        });
      }
      Object.assign(attempt, {
        status: result,
        note,
        evidence_url: evidence || null,
        resolved_at: state.now,
      });
      snapshot(state, attempt.run_id);
      return { message: "已保存投递结果与日报版本" };
    }
    if (action === "check") {
      const submission = workspace.submissions.find(
        (s) =>
          same(s.websiteId, input.websiteId) &&
          same(s.resourceId, input.resourceId),
      );
      ensure(
        submission && hasSubmission(submission),
        "必须先有对应网站的投递记录",
      );
      const result = clean(input.result, 30);
      ensure(
        [
          "listed",
          "pending",
          "missing_link",
          "unreachable",
          "removed",
        ].includes(result),
        "无效检查结果",
      );
      const note = clean(input.note),
        evidence = httpUrl(input.evidenceUrl),
        target = httpUrl(input.targetUrl),
        website = workspace.websites.find((w) => same(w.id, input.websiteId));
      ensure(note, "请记录检查证据或未通过原因");
      ensure(
        result !== "listed" ||
          (evidence &&
            target &&
            domainOf(target) === domainOf(website?.domain)),
        "收录通过需要对方公开详情页，以及指向正确网站的链接",
      );
      ensure(
        result !== "listed" || domainOf(evidence) !== domainOf(website?.domain),
        "请填写对方的详情页，不能用自己的首页作为收录证据",
      );
      state.insert("backlink_operation_checks", {
        website_id: Number(input.websiteId),
        resource_id: Number(input.resourceId),
        result,
        evidence_url: evidence || null,
        target_url: target || null,
        rel: clean(input.rel, 200),
        note,
      });
      const row = state
        .table("backlinks")
        .find(
          (r) =>
            same(r.website_id, input.websiteId) &&
            same(r.resource_id, input.resourceId),
        )!;
      Object.assign(row, { last_checked_at: state.now, updated_at: state.now });
      if (result === "listed")
        Object.assign(row, {
          status: "live",
          live_url: evidence,
          target_url: target,
          status_history: [
            ...(row.status_history || []),
            { status: "live", at: state.now, url: evidence, note },
          ],
        });
      snapshot(state);
      return { message: "已保存对方收录检查及证据" };
    }
    if (action === "review") {
      const domain = domainOf(input.domain);
      ensure(
        report.resources.some((r) => r.domain === domain),
        "资源不存在",
      );
      const result = clean(input.result, 30);
      ensure(
        ["free", "exchange", "unavailable", "pending"].includes(result),
        "无效资源验证结果",
      );
      const entry = httpUrl(input.entryUrl),
        note = clean(input.note);
      ensure(note, "请填写验证依据、费用或交换条件");
      ensure(
        !["free", "exchange"].includes(result) || entry,
        "可投递资源需要有效提交入口",
      );
      const current = report.resources.find((r) => r.domain === domain)!;
      ensure(
        !["free", "exchange"].includes(result) ||
          (!workspace.prospects.find((p) => domainOf(p.rootDomain) === domain)
            ?.excluded &&
            workspace.resources.find((r) => domainOf(r.domain) === domain)
              ?.active !== false),
        "资源已被人工排除或停用，请先在原管理界面恢复",
        409,
      );
      if (
        ["free", "exchange"].includes(result) &&
        !current.resourceId &&
        !state.table("resources").some((r) => r.domain === domain)
      )
        state.insert("resources", {
          domain,
          url: entry,
          category: "tools-directory",
          notes: note,
        });
      state.insert("backlink_operation_resource_reviews", {
        domain,
        result,
        entry_url: entry || null,
        note,
      });
      snapshot(state);
      return { message: "已保存资源验证；保留原有人工判断与筛选记录" };
    }
    if (action === "add") {
      const urls = [
        ...new Set(
          clean(input.urls, 20000)
            .split(/[\n,]+/)
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ];
      ensure(
        urls.length > 0 && urls.length <= 100,
        "每次添加 1–100 个网址，每行一个",
      );
      const known = new Set(report.resources.map((r) => r.domain));
      let added = 0;
      for (const value of urls) {
        const url = httpUrl(
            /^https?:\/\//i.test(value) ? value : `https://${value}`,
          ),
          domain = domainOf(url);
        ensure(url && domain.includes("."), "存在无效网址，请修正后重试");
        if (known.has(domain)) continue;
        const importOrder =
          Math.max(
            -1,
            ...state
              .table("extension_prospects")
              .map((r) => Number(r.import_order) || 0),
          ) + 1;
        state.insert("extension_prospects", {
          root_domain: domain,
          submission_url: url,
          import_order: importOrder,
        });
        known.add(domain);
        added++;
      }
      snapshot(state);
      return {
        message: `新增 ${added} 个资源，已追加到待验证队尾；重复项保持原位`,
      };
    }
    if (action === "snapshot") {
      snapshot(state);
      return { message: "已保存今日报表，历史版本不会被覆盖" };
    }
    if (action === "close") {
      ensure(uuid(input.runId), "无效任务编号");
      const run = history.runs.find((r) => r.id === input.runId);
      ensure(run, "任务不存在", 404);
      ensure(
        !history.attempts.some(
          (a) =>
            a.run_id === run.id && ["reserved", "uncertain"].includes(a.status),
        ),
        "请先处理待办及不明确的提交结果，再结束任务",
        409,
      );
      Object.assign(run, { status: "closed", closed_at: state.now });
      snapshot(state, run.id);
      return { message: "任务已结束，日报已保存" };
    }
    throw new OperationsError("不支持的操作");
  });
}
