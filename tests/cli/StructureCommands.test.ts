import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CommandDispatcher } from "../../src/cli/CommandDispatcher.js";
import { EditorSession } from "../../src/application/EditorSession.js";

test("structure command syntax and help are available with document-first errors", () => {
  const dispatcher = new CommandDispatcher();
  const help = dispatcher.dispatch("help");
  for (const name of ["group", "ungroup", "addto", "front", "back"]) {
    assert.ok(help.includes(name + " <"));
    assert.throws(() => dispatcher.dispatch(name), /no document/);
  }
  dispatcher.dispatch("init");
  for (const line of ["group", "group g", "ungroup", "ungroup g extra", "addto", "addto g", "addto g a extra", "front", "front a b", "back", "back a b"]) {
    assert.throws(() => dispatcher.dispatch(line), /usage:/);
  }
});

test("CLI group, addto and ungroup feedback follows current structure on replay", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g parent");
  dispatcher.dispatch("create rect a 1 2 3 4 in parent");
  dispatcher.dispatch("create rect b 1 2 3 4 in parent");
  assert.equal(dispatcher.dispatch("group g b a"), "g#g created with 2 children");
  assert.deepEqual(session.document.get("g").children.map(shape => shape.id), ["a", "b"]);
  assert.equal(dispatcher.dispatch("undo"), "g#g grouping undone");
  assert.equal(dispatcher.dispatch("redo"), "g#g created with 2 children");
  assert.equal(dispatcher.dispatch("ungroup g"), "g#g ungrouped");
  assert.equal(dispatcher.dispatch("undo"), "g#g restored");
  assert.equal(dispatcher.dispatch("redo"), "g#g ungrouped");
  dispatcher.dispatch("create g q");
  assert.equal(dispatcher.dispatch("addto q a"), "rect#a moved into g#q");
  assert.equal(dispatcher.dispatch("undo"), "rect#a restored into g#parent");
  assert.equal(dispatcher.dispatch("redo"), "rect#a moved into g#q");
});

test("CLI front/back feedback and tree order agree", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g a");
  dispatcher.dispatch("create g b");
  dispatcher.dispatch("create g c");
  assert.equal(dispatcher.dispatch("front b"), "g#b brought to front");
  assert.deepEqual(session.document.children.map(shape => shape.id), ["a", "c", "b"]);
  assert.equal(dispatcher.dispatch("undo"), "g#b order restored");
  assert.equal(dispatcher.dispatch("back b"), "g#b sent to back");
  assert.deepEqual(session.document.children.map(shape => shape.id), ["b", "a", "c"]);
  assert.equal(dispatcher.dispatch("undo"), "g#b order restored");
});

test("failed structure commands preserve redo, state and initial barrier", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  assert.throws(() => dispatcher.dispatch("group g missing"), /no such shape/);
  assert.throws(() => dispatcher.dispatch("undo"), /not allowed after io command/);
  dispatcher.dispatch("create g parent");
  dispatcher.dispatch("create rect a 1 2 3 4 in parent");
  dispatcher.dispatch("front a");
  dispatcher.dispatch("undo");
  const before = dispatcher.dispatch("tree");
  for (const line of [
    "group parent a", "group g a a", "group g parent a", "group g a missing",
    "addto a parent", "addto parent parent", "ungroup parent", "ungroup a",
    "front missing", "back missing",
  ]) {
    assert.throws(() => dispatcher.dispatch(line));
    assert.equal(dispatcher.dispatch("tree"), before);
  }
  assert.equal(dispatcher.dispatch("redo"), "rect#a brought to front");
});

test("real CLI supports mixed structural editing and error recovery", () => {
  const entry = fileURLToPath(new URL("../../src/main.js", import.meta.url));
  const result = spawnSync(process.execPath, [entry], {
    input: [
      "init", "create g p", "create rect a 1 2 3 4 in p",
      "create text b 5 6 \"开始\" in p", "group g b a", "front g", "back g",
      "ungroup g", "undo", "group bad p a", "tree g",
    ].join("\n") + "\n",
    encoding: "utf8", timeout: 5_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /g#g created with 2 children/);
  assert.match(result.stdout, /error: cannot group a container into its own descendant: p/);
  assert.match(result.stdout, /g#g\n├── rect#a  x=1 y=2 w=3 h=4\n└── text#b  \(5,6\) "开始"/);
});

test("group history composes with move, scale, set and delete without overwriting shape state", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g p");
  dispatcher.dispatch("create rect a 1 2 3 4 in p");
  dispatcher.dispatch('create text b 5 6 "内容" in p');
  const before = dispatcher.dispatch("tree");
  for (const line of ["group g b a", "move g 10 20", "scale g 2", "set g fill red", "set b text changed", "delete g"]) {
    dispatcher.dispatch(line);
  }
  assert.equal(session.document.find("a"), undefined);
  for (let step = 0; step < 6; step += 1) dispatcher.dispatch("undo");
  assert.equal(dispatcher.dispatch("tree"), before);
  assert.equal(session.document.indexOf("a"), 0);
  assert.equal(session.document.indexOf("b"), 1);
  for (let step = 0; step < 6; step += 1) dispatcher.dispatch("redo");
  assert.equal(session.document.find("g"), undefined);
  dispatcher.dispatch("undo");
  assert.deepEqual(session.document.get("g").styles, { fill: "red" });
  assert.deepEqual(session.document.get("a").geometry, { x: 22, y: 44, width: 6, height: 8 });
  assert.match(dispatcher.dispatch("show b"), /changed/);
});
