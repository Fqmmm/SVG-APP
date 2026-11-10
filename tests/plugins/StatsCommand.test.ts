import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorSession, Group } from "../../src/extensions/index.js";
import { createEditor } from "../../src/composition/createEditor.js";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import statsPlugin from "../../src/plugins/stats/index.js";
import { StatsCommand } from "../../src/plugins/stats/StatsCommand.js";
import { Tile } from "../extensions/fixtures/tile.js";

test("stats counts DFS leaves in first-seen type order and all containers without enumerating names", () => {
  const editor = createEditor();
  statsPlugin.activate(editor.framework);
  editor.dispatcher.dispatch("init");
  assert.equal(editor.dispatcher.dispatch("stats"), "(total 0, containers 0)");
  editor.dispatcher.dispatch("create g outer");
  editor.dispatcher.dispatch("create text t 1 2 hello in outer");
  editor.dispatcher.dispatch("create rect r 1 2 3 4 in outer");
  editor.dispatcher.dispatch("create g inner in outer");
  editor.dispatcher.dispatch("create circle c 1 2 3 in inner");
  editor.dispatcher.dispatch("create rect r2 1 2 3 4");
  class Compound extends Group {
    override get type(): string {
      return "test-container";
    }
  }
  editor.session.document.add(new Compound("compound"));
  assert.equal(editor.dispatcher.dispatch("stats"), "text: 1  rect: 2  circle: 1  (total 4, containers 3)");
  assert.match(editor.dispatcher.dispatch("help"), /^stats$/m);
  assert.throws(() => editor.dispatcher.dispatch("stats extra"), /usage: stats/);
});

test("stats is optional, requires a document and preserves both undo and redo", () => {
  const framework = createDefaultFramework();
  const editor = createEditor(framework);
  assert.throws(() => editor.dispatcher.dispatch("stats"), /unknown command: stats/);
  framework.commands.register(new StatsCommand());
  assert.throws(() => editor.dispatcher.dispatch("stats"), /no document/);
  editor.dispatcher.dispatch("init");
  editor.dispatcher.dispatch("create rect r 1 2 3 4");
  editor.dispatcher.dispatch("move r 10 20");
  editor.dispatcher.dispatch("stats");
  editor.dispatcher.dispatch("undo");
  assert.equal(editor.session.document.get("r").geometry["x"], 1);
  editor.dispatcher.dispatch("stats");
  editor.dispatcher.dispatch("redo");
  assert.equal(editor.session.document.get("r").geometry["x"], 11);
});

test("stats executes against public model objects without builtin command or shape plugins", () => {
  const session = new EditorSession();
  session.initialize();
  session.document.add(new Group("g", [new Tile("t", 1, 2, 3, 4)]));
  assert.equal(new StatsCommand().execute([], session), "tile: 1  (total 1, containers 1)");
});
