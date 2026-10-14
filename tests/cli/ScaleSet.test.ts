import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CommandDispatcher } from "../../src/cli/CommandDispatcher.js";
import { EditorSession } from "../../src/application/EditorSession.js";

test("scale CLI checks syntax, document and factor errors and appears in help", () => {
  const dispatcher = new CommandDispatcher();
  assert.match(dispatcher.dispatch("help"), /scale <id> <factor>/);
  assert.throws(() => dispatcher.dispatch("scale r 2"), /no document/);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create rect r 1 2 3 4");
  for (const line of ["scale", "scale r", "scale r 2 extra"]) {
    assert.throws(() => dispatcher.dispatch(line), { message: "usage: scale <id> <factor>" });
  }
  for (const factor of ["0", "-1"]) {
    assert.throws(() => dispatcher.dispatch("scale r " + factor), { message: "scale factor must be positive" });
  }
  for (const factor of ["NaN", "Infinity", "0x10"]) {
    assert.throws(() => dispatcher.dispatch("scale r " + factor), /invalid number/);
  }
});

test("scale feedback and undo/redo match the geometry actually shown", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch("create rect r 1 2 3 4 blue");
  assert.equal(dispatcher.dispatch("scale r 2"), "rect#r scaled by 2");
  assert.match(dispatcher.dispatch("show r"), /x=2 y=4 w=6 h=8/);
  assert.equal(dispatcher.dispatch("undo"), "rect#r scale restored");
  assert.match(dispatcher.dispatch("show r"), /x=1 y=2 w=3 h=4/);
  assert.equal(dispatcher.dispatch("redo"), "rect#r scaled by 2");
  assert.match(dispatcher.dispatch("show r"), /x=2 y=4 w=6 h=8/);
});

test("set CLI reports actual normalized values and distinguishes omitted styles", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch("create rect r 1 2 3 4");
  assert.equal(dispatcher.dispatch("set r fill red"), 'rect#r updated: fill="red"');
  assert.equal(dispatcher.dispatch("undo"), "rect#r updated: fill=(unset)");
  assert.doesNotMatch(dispatcher.dispatch("show r"), /fill=/);
  assert.equal(dispatcher.dispatch("redo"), 'rect#r updated: fill="red"');
  assert.equal(dispatcher.dispatch("set r stroke-width 2e0"), "rect#r updated: stroke-width=2");
  assert.equal(dispatcher.dispatch("set r width 7.5e1"), "rect#r updated: width=75");
  assert.equal(dispatcher.dispatch("undo"), "rect#r updated: width=3");
  assert.equal(dispatcher.dispatch("redo"), "rect#r updated: width=75");
});

test("set text supports Chinese, spaces, escaped quotes, hashes and empty content", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch('create text t 1 2 "开始"');
  const line = "set t text \"内容 \\\"Hi\\\" # end\"";
  assert.equal(dispatcher.dispatch(line), "text#t updated: text=\"内容 \\\"Hi\\\" # end\"");
  assert.equal(dispatcher.dispatch('set t text ""'), 'text#t updated: text=""');
  assert.equal(dispatcher.dispatch("undo"), "text#t updated: text=\"内容 \\\"Hi\\\" # end\"");
  assert.equal(dispatcher.dispatch("undo"), 'text#t updated: text="开始"');
});

test("group scale and set preserve explicit child styles and undo as whole commands", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g g");
  dispatcher.dispatch("create rect r 1 2 3 4 blue in g");
  dispatcher.dispatch("set r stroke-width 2");
  assert.equal(dispatcher.dispatch("set g fill red"), 'g#g updated: fill="red"');
  assert.deepEqual(session.document.get("r").styles, { fill: "blue", "stroke-width": 2 });
  dispatcher.dispatch("scale g .5");
  assert.deepEqual(session.document.get("r").geometry, { x: 0.5, y: 1, width: 1.5, height: 2 });
  assert.equal(session.document.get("r").styles["stroke-width"], 2);
  dispatcher.dispatch("undo");
  assert.deepEqual(session.document.get("r").geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(dispatcher.dispatch("undo"), "g#g updated: fill=(unset)");
  assert.deepEqual(session.document.get("g").styles, {});
});

test("failed scale and set preserve redo and do not unlock an io barrier", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create rect r 1 2 3 4");
  dispatcher.dispatch("scale r 2");
  dispatcher.dispatch("undo");
  for (const line of ["scale r -1", "set r width -1", "set r x Infinity", "set r text hello", "set r fill", "set r fill red extra"]) {
    assert.throws(() => dispatcher.dispatch(line));
  }
  assert.deepEqual(session.document.get("r").geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(dispatcher.dispatch("redo"), "rect#r scaled by 2");
  dispatcher.dispatch("init");
  assert.throws(() => dispatcher.dispatch("set absent fill red"), /no such shape/);
  assert.throws(() => dispatcher.dispatch("scale absent 2"), /no such shape/);
  assert.throws(() => dispatcher.dispatch("undo"), /not allowed after io command/);
});

test("set rejects uninitialized use and malformed arity and help lists its syntax", () => {
  const dispatcher = new CommandDispatcher();
  assert.match(dispatcher.dispatch("help"), /set <id> <attr> <value>/);
  assert.throws(() => dispatcher.dispatch("set r fill red"), /no document/);
  dispatcher.dispatch("init");
  for (const line of ["set", "set r", "set r fill", "set r fill red extra"]) {
    assert.throws(() => dispatcher.dispatch(line), { message: "usage: set <id> <attr> <value>" });
  }
});

test("real CLI runs scale/set with empty text, validation errors and undo recovery", () => {
  const entry = fileURLToPath(new URL("../../src/main.js", import.meta.url));
  const result = spawnSync(process.execPath, [entry], {
    input: [
      "init", 'create text t 1 2 "开始"', 'set t text ""',
      "undo", "redo", "scale t 2", "scale t 0", "set t r 3", "undo", "show t",
    ].join("\n") + "\n",
    encoding: "utf8", timeout: 5_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "svg-editor 0.1 — type 'help' for commands\nsvg> " + [
    "canvas 800x600 created", "text#t created", 'text#t updated: text=""',
    'text#t updated: text="开始"', 'text#t updated: text=""',
    "text#t scaled by 2", "error: scale factor must be positive",
    "error: unknown attribute: r", "text#t scale restored",
    'text#t  parent=svg\n  (1,2) ""',
  ].join("\nsvg> ") + "\nsvg> ");
});

test("show and tree distinguish empty styles from omission through set undo/redo", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch("create rect r 1 2 3 4");
  for (const attribute of ["fill", "stroke"]) {
    const empty = attribute + '=""';
    assert.doesNotMatch(dispatcher.dispatch("show r"), new RegExp(attribute + "="));
    assert.equal(dispatcher.dispatch("set r " + attribute + ' ""'), "rect#r updated: " + empty);
    assert.ok(dispatcher.dispatch("show r").includes(empty));
    assert.ok(dispatcher.dispatch("tree").includes(empty));
    dispatcher.dispatch("set r " + attribute + " red");
    assert.equal(dispatcher.dispatch("undo"), "rect#r updated: " + empty);
    assert.ok(dispatcher.dispatch("show r").includes(empty));
    assert.equal(dispatcher.dispatch("undo"), "rect#r updated: " + attribute + "=(unset)");
    assert.doesNotMatch(dispatcher.dispatch("show r"), new RegExp(attribute + "="));
    assert.doesNotMatch(dispatcher.dispatch("tree"), new RegExp(attribute + "="));
    dispatcher.dispatch("redo");
    assert.ok(dispatcher.dispatch("show r").includes(empty));
    assert.ok(dispatcher.dispatch("tree").includes(empty));
    dispatcher.dispatch("undo");
  }
});
