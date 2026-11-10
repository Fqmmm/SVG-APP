import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
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

test("config alone replays edit/save/edit/undo/redo/read labels with stats and dir against golden evidence", () => {
  temporary(directory => {
    const input = readFileSync(join(repository, "doc/transcript/labels.txt"), "utf8");
    const expected = JSON.parse(readFileSync(join(repository, "doc/transcript/labels.expected.json"), "utf8")) as { stdout: string };
    assert.equal(existsSync(join(directory, "assets", "labels.svg")), false);
    const actual = run(directory, input, ["--config", join(repository, "plugins.config.json")]);
    assert.equal(actual, expected.stdout);
    assert.equal(readFileSync(join(directory, "assets", "labels.svg"), "utf8"),
      readFileSync(join(repository, "doc/transcript/labels.expected.svg"), "utf8").replace(/\r\n/gu, "\n"));
  });
});

test("labels can be independently disabled and reordered while the no-label Phase 1 tree is unchanged", () => {
  temporary(directory => {
    const config = join(directory, "plugins.json");
    const box = { module: join(repository, "src/plugins/box") };
    const star = { module: join(repository, "src/plugins/modified-star") };
    const input = 'init\ncreate box n 10 20 80 30 "title"\ntree\n';
    writeFileSync(config, JSON.stringify({ plugins: [box, { ...star, enabled: false }] }));
    const boxOnly = run(directory, input, ["--config", config]);
    assert.match(boxOnly, /g#n \(box\)/);
    assert.doesNotMatch(boxOnly, /\*/);
    assert.doesNotMatch(run(directory, input, ["--config", join(repository, "tests/fixtures/plugins.box-only.config.json")]), /\*/);
    writeFileSync(config, JSON.stringify({ plugins: [star, box] }));
    assert.match(run(directory, input, ["--config", config]), /g#n \* \(box\)/);
    writeFileSync(config, JSON.stringify({ plugins: [star] }));
    const source = join(repository, "doc/transcript/box.expected.svg").split(sep).join("/");
    const starOnly = run(directory, 'read "' + source + '"\nset n1-label text changed\ntree\n', ["--config", config]);
    assert.match(starOnly, /warning: treating box n1 as an ordinary group/);
    assert.doesNotMatch(starOnly, /\(box\)/);
    assert.match(starOnly, /text#n1-label.*changed.*\*/);
    writeFileSync(config, JSON.stringify({ plugins: [] }));
    const base = run(directory, 'init\ncreate g scene\ncreate rect r 1 2 3 4 red in scene\ntree\n', ["--config", config]);
    const banner = JSON.parse(readFileSync(join(repository, "doc/transcript/labels.expected.json"), "utf8")).stdout.split("svg> ")[0];
    assert.equal(base, banner + "svg> canvas 800x600 created\nsvg> g#scene created\nsvg> rect#r created in g#scene\nsvg> svg (800x600)\n└── g#scene\n    └── rect#r  x=1 y=2 w=3 h=4 fill=red\nsvg> ");
  });
});

test("CLI reports checkpoint failures but saves, reads and undo barriers remain successful", () => {
  temporary(directory => {
    writeFileSync(join(directory, "assets", "package.json"), JSON.stringify({
      name: "checkpoint-failure-fixture", type: "module", main: "broken.mjs", contributes: { decorators: ["broken"] },
    }));
    writeFileSync(join(directory, "assets", "broken.mjs"), `export default {
  activate(context) {
    context.decorators.register({
      name: "broken",
      decorate() {
        return undefined;
      },
      checkpoint() {
        throw new Error("boom");
      },
    });
  },
};`);
    const config = join(directory, "faulty.config.json");
    writeFileSync(config, JSON.stringify({ plugins: [
      { module: "./assets" }, { module: join(repository, "src/plugins/modified-star") },
    ] }));
    const output = run(directory, 'init\ncreate rect r 1 2 3 4\nsave assets/out.svg\nsave\nread assets/out.svg\nundo\ntree\n', ["--config", config]);
    assert.equal(output.split("error: checkpoint failed: broken").length - 1, 3);
    assert.equal(output.split("saved to assets/out.svg (1 elements)").length - 1, 2);
    assert.match(output, /read assets\/out.svg \(1 elements\)/);
    assert.match(output, /error: undo not allowed after io command/);
    assert.doesNotMatch(output, /error: boom|no file path|\*/);
    assert.match(readFileSync(join(directory, "assets", "out.svg"), "utf8"), /id="r"/);
  });
});
