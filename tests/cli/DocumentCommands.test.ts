import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EditorSession } from "../../src/application/EditorSession.js";
import { CommandDispatcher } from "../../src/cli/CommandDispatcher.js";
import { FileDocumentRepository } from "../../src/infrastructure/FileDocumentRepository.js";
import { SvgParser } from "../../src/infrastructure/SvgParser.js";

test("canvas query preserves history while resize is a document barrier", () => {
  const dispatcher = new CommandDispatcher();
  assert.match(dispatcher.dispatch("help"), /canvas \[w\] \[h\]/);
  dispatcher.dispatch("init 40 20");
  dispatcher.dispatch("create rect r 1 2 3 4");
  assert.equal(dispatcher.dispatch("canvas"), "canvas 40x20");
  dispatcher.dispatch("undo"); dispatcher.dispatch("redo");
  assert.throws(() => dispatcher.dispatch("canvas 50"), /usage:/);
  assert.throws(() => dispatcher.dispatch("canvas 0 20"));
  dispatcher.dispatch("canvas 50 60");
  assert.equal(dispatcher.dispatch("canvas"), "canvas 50x60");
  assert.throws(() => dispatcher.dispatch("undo"), /undo not allowed after io command/);
});

test("CLI read works before init, reports assigned ids and uses the remembered save path", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const file = join(directory, "input file.svg");
    writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><g id="g"><rect/></g></svg>');
    const dispatcher = new CommandDispatcher(new EditorSession(new FileDocumentRepository()));
    assert.equal(dispatcher.dispatch("read " + JSON.stringify(file)),
      "warning: assigned id rect1 to unnamed <rect>\nread " + file + " (2 elements)");
    assert.throws(() => dispatcher.dispatch("undo"), /undo not allowed after io command/);
    dispatcher.dispatch("move rect1 3 4");
    assert.equal(dispatcher.dispatch("save"), "saved to " + file + " (2 elements)");
    assert.equal(new SvgParser().parse(readFileSync(file, "utf8")).document.get("rect1").geometry["x"], 3);
    assert.throws(() => dispatcher.dispatch("redo"), /undo not allowed after io command/);
    assert.throws(() => dispatcher.dispatch("read"), /usage:/);
    assert.throws(() => dispatcher.dispatch("save a b"), /usage:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("failed read or save preserves current tree, default path and redo", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const file = join(directory, "valid.svg"), bad = join(directory, "bad.svg");
    writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(bad, '<svg xmlns="http://www.w3.org/2000/svg"><rect transform="scale(2)"/></svg>');
    const session = new EditorSession(new FileDocumentRepository());
    const dispatcher = new CommandDispatcher(session);
    dispatcher.dispatch("read " + JSON.stringify(file));
    dispatcher.dispatch("create rect r 1 2 3 4");
    dispatcher.dispatch("undo");
    const before = dispatcher.dispatch("tree");
    assert.throws(() => dispatcher.dispatch("read " + JSON.stringify(bad)), /unsupported|unknown attribute/);
    assert.throws(() => dispatcher.dispatch("save " + JSON.stringify(join(directory, "absent", "out.svg"))), /cannot write file/);
    assert.equal(dispatcher.dispatch("tree"), before);
    assert.equal(session.path, file);
    assert.equal(dispatcher.dispatch("redo"), "rect#r created");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("serialized ungroup loses inherited fill and undo restores the original group style", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const file = join(directory, "test.svg");
    const dispatcher = new CommandDispatcher(new EditorSession(new FileDocumentRepository()));
    dispatcher.dispatch("init");
    dispatcher.dispatch("create g parent"); dispatcher.dispatch("create g g in parent");
    dispatcher.dispatch("set g fill blue"); dispatcher.dispatch("create rect r 1 2 3 4 in g");
    dispatcher.dispatch("ungroup g"); dispatcher.dispatch("undo");
    dispatcher.dispatch("save " + JSON.stringify(file));
    const restored = new SvgParser().parse(readFileSync(file, "utf8")).document;
    assert.equal(restored.parentOf("r")?.id, "g");
    assert.deepEqual(restored.get("g").styles, { fill: "blue" });
    assert.deepEqual(restored.get("r").styles, {});
    dispatcher.dispatch("ungroup g"); dispatcher.dispatch("save");
    const ungrouped = new SvgParser().parse(readFileSync(file, "utf8")).document;
    assert.equal(ungrouped.find("g"), undefined);
    assert.equal(ungrouped.parentOf("r")?.id, "parent");
    assert.deepEqual(ungrouped.get("r").styles, {});
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("real CLI reads and writes SVG paths with spaces and continues after file failure", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const file = join(directory, "output file.svg");
    const entry = fileURLToPath(new URL("../../src/main.js", import.meta.url));
    const result = spawnSync(process.execPath, [entry], {
      input: ["read " + JSON.stringify(join(directory, "missing.svg")), "init 400 200",
        'create text t 10 20 "中文 & 内容"', "save " + JSON.stringify(file),
      "read " + JSON.stringify(file), "show t", "undo"].join("\n") + "\n",
      encoding: "utf8", timeout: 5_000,
    });
    assert.equal(result.error, undefined); assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /error: cannot read file:/);
    assert.match(result.stdout, /中文 & 内容/);
    assert.match(result.stdout, /error: undo not allowed after io command/);
    assert.match(readFileSync(file, "utf8"), /中文 &amp; 内容/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("canvas resize is saved as matching width height and viewBox without scaling shapes", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const file = join(directory, "resized.svg");
    const dispatcher = new CommandDispatcher(new EditorSession(new FileDocumentRepository()));
    dispatcher.dispatch("init 400 200");
    dispatcher.dispatch("create rect r 1 2 3 4");
    dispatcher.dispatch("canvas 800 300");
    dispatcher.dispatch("save " + JSON.stringify(file));
    const xml = readFileSync(file, "utf8");
    assert.match(xml, /width="800" height="300" viewBox="0 0 800 300"/);
    const restored = new SvgParser().parse(xml).document;
    assert.equal(restored.width, 800);
    assert.equal(restored.height, 300);
    assert.deepEqual(restored.get("r").geometry, { x: 1, y: 2, width: 3, height: 4 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("invalid references and absent namespace leave the current document path and redo intact", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const valid = join(directory, "valid.svg"), bad = join(directory, "bad.svg");
    writeFileSync(valid, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const session = new EditorSession(new FileDocumentRepository());
    const dispatcher = new CommandDispatcher(session);
    dispatcher.dispatch("read " + JSON.stringify(valid));
    dispatcher.dispatch("create rect r 1 2 3 4");
    dispatcher.dispatch("undo");
    const document = session.document, before = dispatcher.dispatch("tree");
    for (const xml of [
      '<svg xmlns="http://www.w3.org/2000/svg"><text>a & b</text></svg>',
      '<svg><rect/></svg>',
    ]) {
      writeFileSync(bad, xml);
      assert.throws(() => dispatcher.dispatch("read " + JSON.stringify(bad)), /invalid SVG/);
      assert.equal(session.document, document);
      assert.equal(session.path, valid);
      assert.equal(dispatcher.dispatch("tree"), before);
    }
    dispatcher.dispatch("redo");
    assert.equal(session.document.get("r").id, "r");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
