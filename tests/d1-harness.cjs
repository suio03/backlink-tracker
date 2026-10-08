const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const root = path.join(__dirname, "..");
function moduleFrom(file, deps = {}) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require(name) {
      if (name in deps) return deps[name];
      if (name === "node:crypto") return require(name);
      throw Error(`Unexpected import ${name}`);
    },
    Date,
    Intl,
    URL,
    Set,
    Map,
    Buffer,
    console,
    process,
    structuredClone,
    TextEncoder,
  });
  return exports;
}
function splitSql(sql) {
  let rest = sql.replace(/--[^\n]*/g, "").trim();
  const parts = [];
  while (rest) {
    const end = /^CREATE TRIGGER/i.test(rest)
      ? rest.indexOf("END;") + 4
      : rest.indexOf(";") + 1;
    if (end <= 0) throw Error("Incomplete SQL");
    parts.push(rest.slice(0, end));
    rest = rest.slice(end).trim();
  }
  return parts;
}
async function setup() {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "test",
          modules: true,
          script: 'export default {fetch(){return new Response("test")}}',
          compatibilityDate: "2026-10-08",
          d1Databases: ["DB"],
        },
      ],
    }),
  );
  const binding = await mf.getD1Database("DB");
  for (const sql of splitSql(
    fs.readFileSync(
      path.join(root, "d1-migrations/0001_workspace.sql"),
      "utf8",
    ),
  ))
    await binding.prepare(sql).run();
  const database = moduleFrom("lib/database.ts", {
    "@opennextjs/cloudflare": {
      getCloudflareContext: async () => ({ env: { DB: binding } }),
    },
  });
  const store = moduleFrom("lib/d1-workspace-store.ts", {
    "./database": database,
  });
  const workspace = moduleFrom("lib/extension-workspace.ts", {
    "@/lib/d1-workspace-store": store,
  });
  const core = moduleFrom("lib/backlink-operations-core.ts");
  const service = moduleFrom("lib/backlink-operations.ts", {
    "@/lib/database": database,
    "@/lib/d1-workspace-store": store,
    "@/lib/extension-workspace": workspace,
    "@/lib/backlink-operations-core": core,
  });
  const db = {
    query: database.query,
    exec: async (sql) => {
      for (const statement of splitSql(sql)) await database.query(statement);
    },
    close: () => mf.dispose(),
  };
  return { db, database, binding, store, workspace, service, core };
}
module.exports = { setup, moduleFrom, splitSql };
