import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, unlinkSync, existsSync, rmSync } from "node:fs";
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

function temporary(runTest: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "svg-label-assembly-"));
  try {
    mkdirSync(join(directory, "assets"));
    runTest(directory);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
}

test("both labels produce byte-identical stdout and newly saved SVG under code and config assembly", () => {
  temporary(directory => {
    const input = readFileSync(join(repository, "doc/transcript/labels.txt"), "utf8");
    const expected = JSON.parse(readFileSync(join(repository, "doc/transcript/labels.expected.json"), "utf8")) as { stdout: string };
    const svg = readFileSync(join(repository, "doc/transcript/labels.expected.svg"), "utf8").replace(/\r\n/gu, "\n");
    const path = join(directory, "assets", "labels.svg");
    const code = run(directory, input);
    assert.equal(code, expected.stdout);
    assert.equal(readFileSync(path, "utf8"), svg);
    unlinkSync(path);
    assert.equal(existsSync(path), false);
    const config = run(directory, input, ["--config", join(repository, "plugins.config.json")]);
    assert.equal(config, code);
    assert.equal(readFileSync(path, "utf8"), svg);
  });
});
