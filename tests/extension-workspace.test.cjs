const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual write function with a recording database client, without
// opening a database connection or exposing internals in the production API.
const source = readFileSync(path.join(__dirname, '../lib/extension-workspace.ts'), 'utf8');
const compiled = ts.transpileModule(`${source}\nexport { upsertWebsite };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, {
  exports: moduleExports,
  require(name) {
    if (name === '@/lib/database') return {};
    throw new Error(`Unexpected dependency: ${name}`);
  },
});

for (const id of ['new-site', '7']) {
  test(`preserves Markdown in database parameters for website ${id}`, async () => {
    const markdown = '    indented code\r\n\r\n## Heading\r\n\r\n- **Bold** item  \r\n  - nested [link](https://example.com)\r\n\r\n```js\r\nconst value = 1;\r\n```\r\n';
    const expected = markdown.replace(/\r\n/g, '\n');
    const calls = [];
    const client = {
      async query(sql, values) {
        calls.push({ sql, values: Array.from(values) });
        return { rowCount: 1, rows: [{ id: 7 }] };
      },
    };
    const ids = new Map();
    await moduleExports.upsertWebsite(client, {
      id, domain: ' example.com ', name: ' Example  Website ',
      category: '- AI Character Generator\r\n- AI Image Generator\r\n',
      shortDescription: markdown, description: markdown,
      supportEmail: ' support@example.com ', title: ' Example  Title ',
      url: ' https://example.com/ ', active: true,
    }, ids);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].values[0], 'example.com');
    assert.equal(calls[0].values[1], 'Example Website');
    assert.equal(calls[0].values[2], '- AI Character Generator\n- AI Image Generator\n');
    assert.match(calls[1].sql, /INSERT INTO website_extended_info/);
    assert.deepEqual(calls[1].values, [7, 'support@example.com', 'Example Title', expected, expected, 'https://example.com/']);
    assert.equal(ids.get(id), 7);
  });
}
