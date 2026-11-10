import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, existsSync } from "node:fs";
import { join, resolve, sep, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const entry = fileURLToPath(new URL("../../src/main.js", import.meta.url));

function run(cwd: string, input: string, args: readonly string[] = []) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, input, encoding: "utf8", timeout: 10_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  return result.stdout;
}

function clean(directory: string): void {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep)
    || resolve(directory).startsWith(join(repository, ".svg-assembly-")));
  rmSync(directory, { recursive: true, force: true });
}

test("code and config assembly produce identical help, stats, dir and saved SVG from a fixed directory", () => {
  const directory = mkdtempSync(join(repository, ".svg-assembly-"));
  try {
    const cwd = join(directory, "workspace");
    mkdirSync(join(cwd, "assets"), { recursive: true });
    writeFileSync(join(cwd, "a.txt"), "a");
    writeFileSync(join(cwd, ".hidden"), "hidden");
    writeFileSync(join(cwd, "assets", "source.svg"), readFileSync(join(repository, "doc/transcript/command-plugins-input.svg"), "utf8"));
    const config = join(directory, "plugins.config.json");
    writeFileSync(config, JSON.stringify({ plugins: [
      { module: relative(directory, join(repository, "src/plugins/stats")) }, { module: relative(directory, join(repository, "src/plugins/dir")) },
      { module: relative(directory, join(repository, "src/plugins/box")) },
      { module: relative(directory, join(repository, "src/plugins/modified-star")) },
    ] }));
    const input = readFileSync(join(repository, "doc/transcript/command-plugins.txt"), "utf8");
    const fromCode = run(cwd, input);
    const codeSvg = readFileSync(join(cwd, "assets", "saved.svg"), "utf8");
    assert.equal(fromCode, JSON.parse(readFileSync(join(repository, "doc/transcript/command-plugins.expected.json"), "utf8")).stdout);
    assert.equal(codeSvg, readFileSync(join(repository, "doc/transcript/command-plugins.expected.svg"), "utf8").replace(/\r\n/gu, "\n"));
    unlinkSync(join(cwd, "assets", "saved.svg"));
    assert.equal(existsSync(join(cwd, "assets", "saved.svg")), false);
    const fromConfig = run(cwd, input, ["--config", config]);
    assert.equal(fromConfig, fromCode);
    assert.equal(readFileSync(join(cwd, "assets", "saved.svg"), "utf8"), codeSvg);
    assert.match(fromCode, /rect: 1  text: 1  \(total 2, containers 1\)/);
    assert.match(fromCode, /circle: 1  \(total 1, containers 0\)/);
    const listing = "[DIR]  assets\n[FILE]  .hidden\n[FILE]  a.txt";
    assert.equal(fromCode.split(listing).length - 1, 3);
    assert.doesNotMatch(fromCode, /unknown command: (dir|stats)/);
  } finally {
    clean(directory);
  }
});

test("config independently enables commands and keeps disabled commands out of help", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-assembly-toggle-"));
  try {
    const config = join(directory, "plugins.config.json");
    writeFileSync(config, JSON.stringify({ plugins: [{ module: join(repository, "src/plugins/stats") }] }));
    const statsOnly = run(directory, "help\ninit\nstats\ndir\n", ["--config", config]);
    assert.match(statsOnly, /svg> \(total 0, containers 0\)/);
    assert.match(statsOnly, /error: unknown command: dir/);
    assert.doesNotMatch(statsOnly, /\ndir\n/);
    writeFileSync(config, JSON.stringify({ plugins: [{ module: join(repository, "src/plugins/dir") }] }));
    const dirOnly = run(directory, "help\ndir\nstats\n", ["--config", config]);
    assert.match(dirOnly, /\ndir\n/);
    assert.match(dirOnly, /error: unknown command: stats/);
    writeFileSync(config, JSON.stringify({ plugins: [] }));
    const base = run(directory, "help\nstats\ndir\n", ["--config", config]);
    const help = readFileSync(join(repository, "tests/extensions/fixtures/builtin-help.txt"), "utf8").replace(/\r\n/gu, "\n").trimEnd();
    assert.match(base, new RegExp("svg> " + help.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
    assert.match(base, /error: unknown command: stats/);
    assert.match(base, /error: unknown command: dir/);
  } finally {
    clean(directory);
  }
});

test("invalid configuration reports an error and still runs the default editor", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-assembly-invalid-"));
  try {
    const config = join(directory, "plugins.config.json");
    writeFileSync(config, "{");
    const output = run(directory, "init\ntree\n", ["--config", config]);
    assert.match(output, /^error: invalid plugin config\n/);
    assert.match(output, /canvas 800x600 created/);
    assert.match(output, /svg \(800x600\)/);
  } finally {
    clean(directory);
  }
});
