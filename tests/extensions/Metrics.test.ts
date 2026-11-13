import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

test("metrics count function branches separately and retain imports and exported responsibilities", () => {
  const source = `import type { Shape } from "./Shape.js";
export class Example {
  run(value: number) {
    if (value > 0 && value < 10) { return 1; }
    return 0;
  }
  empty() {}
}
export const nested = () => {
  const inner = () => true ? 1 : 0;
  return inner();
};`;
  const result = spawnSync(process.execPath, [resolve("scripts/collect-metrics.mjs"), "--analyze"], {
    input: source, encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.imports, ["./Shape.js"]);
  assert.equal(report.exports.includes("Example"), true);
  assert.deepEqual(report.functions.map((entry: { complexity: number }) => entry.complexity), [3, 1, 1, 2]);
});

test("kernel dependencies point inward and plugins enter the kernel through the public SDK", () => {
  const result = spawnSync(process.execPath, [resolve("scripts/collect-metrics.mjs"), "--check-boundaries"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

function auditFixture(files: Record<string, string>) {
  return spawnSync(process.execPath, [resolve("scripts/collect-metrics.mjs"), "--audit-fixture"], {
    input: JSON.stringify(files), encoding: "utf8",
  });
}

test("dependency audit rejects plugin-to-assembly and private-core imports using virtual fixtures", () => {
  for (const target of ["../composition/createDefaultFramework.js", "../main.js", "../domain/Shape.js"]) {
    const destination = "src/" + target.slice(3).replace(/\.js$/u, ".ts");
    const result = auditFixture({
      "src/plugins/example.ts": 'import "' + target + '";',
      [destination]: "export const value = 1;",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dependency boundary violations/);
  }
});

test("domain modules cannot import built-in plugins through former compatibility paths", () => {
  const result = auditFixture({
    "src/domain/Circle.ts": 'export { Circle } from "../plugins/builtin/shapes/Circle.js";',
    "src/plugins/builtin/shapes/Circle.ts": 'export class Circle {}',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dependency boundary violations/);
});

test("metrics include role line totals and named SDK/module dependencies", () => {
  const result = auditFixture({
    "src/plugins/example.ts": 'import "../extensions/index.js";\n',
    "src/extensions/index.ts": 'export { Shape } from "../domain/Shape.js";\n',
    "src/domain/Shape.ts": 'export class Shape {}\n',
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.summary.linesByRole, { core: 2, assembly: 0, plugin: 1 });
  assert.match(report.diagram, /src\/extensions\/index/);
  assert.match(report.diagram, /src\/plugins/);
});

test("published metrics match current source hashes and the generator", () => {
  const result = spawnSync(process.execPath, [resolve("scripts/collect-metrics.mjs"), "--verify"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /metrics snapshot verified/);
});

test("metrics verification rejects a stale captured source hash", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-metrics-"));
  try {
    const inventory = JSON.parse(readFileSync("docs/metrics/framework/inventory.json", "utf8"));
    inventory.after.files[0].sha256 = "stale";
    writeFileSync(join(directory, "inventory.json"), JSON.stringify(inventory));
    const result = spawnSync(process.execPath, [resolve("scripts/collect-metrics.mjs"), "--verify", directory], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /metrics snapshot is stale/);
  } finally {
    assert.ok(directory.startsWith(join(tmpdir(), "svg-metrics-")));
    rmSync(directory, { recursive: true, force: true });
  }
});
