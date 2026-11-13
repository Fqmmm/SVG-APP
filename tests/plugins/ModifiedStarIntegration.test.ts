import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { createEditor } from "../../src/composition/createEditor.js";
import { ShapeDefinition, Text } from "../../src/extensions/index.js";
import boxPlugin from "../../src/plugins/box/index.js";
import starPlugin from "../../src/plugins/modified-star/index.js";
import statsPlugin from "../../src/plugins/stats/index.js";
import dirPlugin from "../../src/plugins/dir/index.js";

function setup(starFirst = false) {
  const framework = createDefaultFramework();
  if (starFirst) {
    starPlugin.activate(framework);
  }
  boxPlugin.activate(framework);
  if (!starFirst) {
    starPlugin.activate(framework);
  }
  const editor = createEditor(framework);
  return { ...editor, run: (line: string) => editor.dispatcher.dispatch(line) };
}

function temporary(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "svg-star-integration-"));
  try {
    run(directory);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
}

test("saving before the first tree establishes a baseline; both independent labels obey registration order", () => {
  temporary(directory => {
    for (const starFirst of [false, true]) {
      const editor = setup(starFirst);
      editor.run("init");
      editor.run('create box n 1 2 3 4 "start"');
      editor.session.save(join(directory, "saved.svg"));
      assert.doesNotMatch(editor.run("tree"), /\*/);
      editor.run("set n fill red");
      const dirty = editor.run("tree");
      assert.match(dirty, /svg \(800x600\) \*/);
      assert.ok(dirty.includes(starFirst ? "g#n * (box)" : "g#n (box) *"));
      assert.match(dirty, /rect#n-rect.*fill=red \*/);
      assert.doesNotMatch(dirty.split("\n").find(line => line.includes("text#n-label"))!, /\*/);
      editor.run("undo");
      assert.doesNotMatch(editor.run("tree"), /\*/);
      editor.run("redo");
      assert.match(editor.run("tree n"), /\*/);
      editor.session.save();
      assert.doesNotMatch(editor.run("tree"), /\*/);
      assert.doesNotMatch(readFileSync(join(directory, "saved.svg"), "utf8"), /modified-star|\*/);
    }
  });
});

test("failed save/read keep the baseline, document, path and redo; successful read is clean and init is fresh", () => {
  temporary(directory => {
    const editor = setup();
    editor.run("init");
    editor.run('create box n 1 2 3 4 "title"');
    const saved = join(directory, "saved.svg");
    editor.session.save(saved);
    editor.run("set n fill red");
    editor.run("move n 5 0");
    editor.run("undo");
    const before = editor.session.document;
    const tree = editor.run("tree");
    assert.throws(() => editor.session.save(join(directory, "missing", "out.svg")), /cannot write file/);
    const invalid = join(directory, "invalid.svg");
    writeFileSync(invalid, '<svg xmlns="http://www.w3.org/2000/svg"><g id="broken" data-kind="box"/></svg>');
    assert.throws(() => editor.session.read(invalid), /required box component/);
    assert.equal(editor.session.document, before);
    assert.equal(editor.session.path, saved);
    assert.equal(editor.run("tree"), tree);
    editor.run("redo");
    assert.equal(editor.session.document.get("n-rect").geometry["x"], 6);
    editor.session.read(saved);
    assert.doesNotMatch(editor.run("tree"), /\*/);
    editor.run("set n label changed");
    assert.match(editor.run("tree"), /text#n-label.*changed.*\*/);
    editor.run("undo");
    assert.doesNotMatch(editor.run("tree"), /\*/);
    editor.run("init");
    assert.equal(editor.run("tree"), "svg (800x600) *");
    editor.run('create box n 1 2 3 4 "title"');
    assert.match(editor.run("tree n"), /g#n \(box\) \*/);
  });
});

test("tree/show/stats/dir leave dirty state and edit history unchanged", () => {
  temporary(directory => {
    const editor = setup();
    statsPlugin.activate(editor.framework);
    dirPlugin.activate(editor.framework);
    editor.run("init");
    editor.run('create box n 1 2 3 4 "title"');
    editor.session.save(join(directory, "saved.svg"));
    editor.run("move n 1 0");
    editor.run("undo");
    const clean = editor.run("tree");
    editor.run("show n");
    editor.run("stats");
    editor.run("dir");
    assert.equal(editor.run("tree"), clean);
    editor.run("redo");
    assert.match(editor.run("tree"), /\*/);
    editor.run("undo");
    assert.equal(editor.run("tree"), clean);
  });
});

test("disabling both labels keeps the Phase 1 tree byte-for-byte unchanged", () => {
  const editor = createEditor();
  editor.dispatcher.dispatch("init");
  editor.dispatcher.dispatch("create g scene");
  editor.dispatcher.dispatch("create rect r 1 2 3 4 red in scene");
  assert.equal(editor.dispatcher.dispatch("tree"), "svg (800x600)\n└── g#scene\n    └── rect#r  x=1 y=2 w=3 h=4 fill=red");
});

test("registered custom text types participate in dirty comparisons without type-name checks", () => {
  temporary(directory => {
    class Caption extends Text {
      override get type(): string {
        return "caption";
      }
    }
    const editor = setup();
    editor.framework.shapes.register({
      name: "caption", help: "  caption <id> <x> <y> title",
      definition: new ShapeDefinition({ geometry: ["x", "y"], hasText: true }, (id, input) => {
        return new Caption(id, input.geometry["x"]!, input.geometry["y"]!, input.content!);
      }),
      text(shape) {
        return (shape as Caption).content;
      },
    });
    editor.run("init");
    editor.run('create caption c 1 2 "before"');
    editor.session.save(join(directory, "caption.svg"));
    editor.run('set c text "after"');
    assert.match(editor.run("tree c"), /\*$/);
    editor.run("undo");
    assert.doesNotMatch(editor.run("tree c"), /\*/);
  });
});

test("checkpoint failures before or after modified-star preserve successful save/read paths, barriers and healthy baselines", () => {
  temporary(directory => {
    for (const brokenFirst of [false, true]) {
      const framework = createDefaultFramework();
      const registerBroken = (): void => {
        framework.decorators.register({
          name: "broken",
          decorate() {
            return undefined;
          },
          checkpoint() {
            throw new Error("boom");
          },
        });
      };
      if (brokenFirst) {
        registerBroken();
      }
      boxPlugin.activate(framework);
      starPlugin.activate(framework);
      if (!brokenFirst) {
        registerBroken();
      }
      const reports: string[] = [];
      const editor = createEditor(framework, message => {
        reports.push(message);
      });
      editor.dispatcher.dispatch("init");
      editor.dispatcher.dispatch('create box n 1 2 3 4 "title"');
      const file = join(directory, brokenFirst ? "first.svg" : "last.svg");
      assert.doesNotThrow(() => editor.session.save(file));
      assert.equal(editor.session.path, file);
      assert.match(readFileSync(file, "utf8"), /data-kind="box"/);
      assert.doesNotMatch(editor.dispatcher.dispatch("tree"), /\*/);
      assert.throws(() => editor.session.undo(), /undo not allowed after io command/);
      editor.dispatcher.dispatch("set n label edited");
      assert.doesNotThrow(() => editor.session.save());
      assert.doesNotMatch(editor.dispatcher.dispatch("tree"), /\*/);
      editor.dispatcher.dispatch("move n 1 0");
      assert.doesNotThrow(() => editor.session.read(file));
      assert.equal(editor.session.path, file);
      assert.doesNotMatch(editor.dispatcher.dispatch("tree"), /\*/);
      assert.throws(() => editor.session.undo(), /undo not allowed after io command/);
      assert.deepEqual(reports, Array(3).fill("error: checkpoint failed: broken"));
    }
  });
});
