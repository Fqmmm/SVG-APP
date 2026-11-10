import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const entry = fileURLToPath(new URL("../../src/main.js", import.meta.url));

function run(cwd: string, input: string, args: readonly string[] = []): string {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, input, encoding: "utf8", timeout: 10_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  return result.stdout;
}

test("config assembly alone reproduces the Phase 1 version B session and saved SVG", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-box-assembly-"));
  try {
    const input = readFileSync(join(repository, "doc/transcript/box.txt"), "utf8");
    const expected = JSON.parse(readFileSync(join(repository, "doc/transcript/box.expected.json"), "utf8")) as { stdout: string };
    const svg = readFileSync(join(repository, "doc/transcript/box.expected.svg"), "utf8").replace(/\r\n/gu, "\n");
    const outputPath = join(directory, "flowchart-box.svg");
    assert.equal(existsSync(outputPath), false);
    const configured = run(directory, input, ["--config", join(repository, "tests/fixtures/plugins.box-only.config.json")]);
    assert.equal(configured, expected.stdout);
    assert.equal(readFileSync(outputPath, "utf8"), svg);
    const readBack = run(directory, "read flowchart-box.svg\nstats\nset n1 label changed\nundo\n", ["--config", join(repository, "tests/fixtures/plugins.box-only.config.json")]);
    assert.match(readBack, /read flowchart-box.svg \(8 elements\)/);
    assert.match(readBack, /rect: 2  text: 2  line: 1  \(total 5, containers 3\)/);
    assert.match(readBack, /box#n1 label restored:/);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
});

test("box is absent when disabled and its saved subtree degrades with warnings", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-box-disabled-"));
  try {
    const config = join(directory, "plugins.config.json");
    writeFileSync(config, JSON.stringify({ plugins: [{ module: join(repository, "src/plugins/box"), enabled: false }] }));
    const source = join(directory, "input.svg");
    writeFileSync(source, readFileSync(join(repository, "doc/transcript/box.expected.svg"), "utf8"));
    const output = run(directory, 'help\ninit\ncreate box n 1 2 3 4 "title"\nread input.svg\ntree\n', ["--config", config]);
    assert.doesNotMatch(output, /  box <id>/);
    assert.match(output, /unknown shape type: box/);
    assert.match(output, /warning: treating box n1 as an ordinary group/);
    assert.match(output, /warning: treating box n2 as an ordinary group/);
    assert.doesNotMatch(output, /g#n[12] \(box\)/);
    assert.match(output, /rect#n2-rect/);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
});
