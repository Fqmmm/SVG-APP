import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandDispatcher } from "../../src/composition/defaults/CommandDispatcher.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";

test("shape and structure handlers share one undo history and preserve each command feedback", () => {
  const session = new EditorSession();
  const cli = new CommandDispatcher(session);
  cli.dispatch("init");
  cli.dispatch("create g parent");
  cli.dispatch("create rect r 1 2 3 4");
  assert.equal(cli.dispatch("addto parent r"), "rect#r moved into g#parent");
  assert.equal(cli.dispatch("move r 5 6"), "rect#r moved to (6,8)");
  assert.equal(cli.dispatch("set r fill red"), 'rect#r updated: fill="red"');
  assert.equal(cli.dispatch("undo"), "rect#r updated: fill=(unset)");
  assert.equal(cli.dispatch("undo"), "rect#r moved back to (1,2)");
  assert.equal(cli.dispatch("undo"), "rect#r restored into svg");
  assert.equal(session.document.parentOf("r"), null);
  assert.equal(cli.dispatch("redo"), "rect#r moved into g#parent");
  assert.equal(cli.dispatch("redo"), "rect#r moved to (6,8)");
  assert.equal(cli.dispatch("redo"), 'rect#r updated: fill="red"');
});

test("document errors precede usage errors and optional Phase 2 commands remain unavailable", () => {
  const cli = new CommandDispatcher();
  for (const command of ["move", "group", "tree too many", "undo extra", "save a b"]) {
    assert.throws(() => cli.dispatch(command), { message: "no document. use 'init' or 'read' first" });
  }
  for (const command of ["stats", "dir"]) {
    assert.throws(() => cli.dispatch(command), { message: "unknown command: " + command });
  }
  cli.dispatch("init");
  assert.throws(() => cli.dispatch("create box b"), /unknown shape type: box/);
  assert.doesNotMatch(cli.dispatch("help"), /stats|dir|box/);
});
