const test = require("node:test"),
  assert = require("node:assert/strict");
const { setup } = require("./d1-harness.cjs");
test("D1 workspace preserves Markdown, IDs, screening and source-aware imports", async () => {
  const { db, workspace } = await setup();
  try {
    const markdown = "    code\r\n\r\n## Heading\r\n- **Bold**\r\n";
    const w = await workspace.applyExtensionWorkspacePatch({
      websites: {
        upsert: [
          {
            id: "new-site",
            domain: "example.com",
            name: "Example",
            category: "AI",
            description: markdown,
            shortDescription: markdown,
            active: true,
          },
        ],
      },
    });
    assert.equal(w.websites[0].description, markdown.replace(/\r\n/g, "\n"));
    await workspace.importExtensionProspectReport({
      sourceDomain: "source.example",
      records: [{ rootDomain: "directory.example", as: 20 }],
    });
    await workspace.importExtensionProspectReport({
      sourceDomain: "source.example",
      records: [{ rootDomain: "directory.example", as: 10 }],
    });
    await workspace.importExtensionProspectReport({
      sourceDomain: "second.example",
      records: [{ rootDomain: "directory.example", as: 30 }],
    });
    const row = (await db.query("SELECT * FROM extension_prospects")).rows[0];
    assert.equal(row.source_count, 2);
    assert.equal(row.authority, 30);
    await workspace.applyExtensionOpportunityDecision({
      action: "exclude",
      rootDomain: "directory.example",
      reason: "manual review",
    });
    await workspace.importExtensionProspectReport({
      sourceDomain: "source.example",
      records: [{ rootDomain: "directory.example", as: 40 }],
    });
    const after = (await workspace.loadExtensionWorkspace()).prospects[0];
    assert.equal(after.excluded, true);
    assert.equal(after.excludedReason, "manual review");
  } finally {
    await db.close();
  }
});
test("concurrent D1 creates retry without lost writes; failed patches leave no partial changes", async () => {
  const { db, workspace } = await setup();
  try {
    const make = (domain) =>
      workspace.applyExtensionWorkspacePatch({
        resources: {
          upsert: [
            { id: "new", domain, url: `https://${domain}`, active: true },
          ],
        },
      });
    await Promise.all([make("one.example"), make("two.example")]);
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM resources")).rows[0].n,
      2,
    );
    const result = await Promise.allSettled([
      make("same.example"),
      make("same.example"),
    ]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(
      workspace.applyExtensionWorkspacePatch({
        resources: {
          upsert: [
            {
              id: "new",
              domain: "rollback.example",
              url: "https://rollback.example",
              active: true,
            },
          ],
        },
        submissions: {
          upsert: [{ websiteId: "999", resourceId: "new", status: "pending" }],
        },
      }),
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*) AS n FROM resources WHERE domain='rollback.example'",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("reports larger than a D1 row round-trip through bounded parts", async () => {
  const { db, store, service } = await setup();
  try {
    const report = { day: "2026-10-08", note: "历史".repeat(1100000) };
    const id = await store.mutateState(
      (state) =>
        state.insert("backlink_operation_reports", {
          day: report.day,
          run_id: null,
          report,
        }).id,
    );
    const restored = await service.readOperations(report.day, String(id));
    assert.equal(restored.report.note, report.note);
    assert.ok(
      (await db.query("SELECT count(*) AS n FROM backlink_report_parts"))
        .rows[0].n > 1,
    );
  } finally {
    await db.close();
  }
});
