import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandDispatcher } from "../../src/cli/CommandDispatcher.js";
import { EditorSession } from "../../src/application/EditorSession.js";

test("help works before init while document commands report the prescribed error", () => {
  const dispatcher = new CommandDispatcher();
  assert.match(dispatcher.dispatch("help"), /create <type>/);
  for (const line of ["tree", "show r", "move r 1 2", "delete r", "undo", "redo", "create g g"]) {
    assert.throws(() => dispatcher.dispatch(line), { message: "no document. use 'init' or 'read' first" });
  }
});
test("dispatcher initializes defaults and validates explicit dimensions atomically", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  assert.equal(dispatcher.dispatch("init"), "canvas 800x600 created");
  assert.equal(dispatcher.dispatch("init 100"), "canvas 100x600 created");
  assert.equal(dispatcher.dispatch("init 400 200"), "canvas 400x200 created");
  const previous = session.document;
  for (const line of ["init 0 100", "init NaN 100", "init 1 2 3"]) {
    assert.throws(() => dispatcher.dispatch(line));
    assert.equal(session.document, previous);
  }
  assert.throws(() => dispatcher.dispatch("undo"), /not allowed after io command/);
});
test("dispatcher creates all types with nested in placement and precise feedback", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  assert.equal(dispatcher.dispatch("create g scene"), "g#scene created");
  assert.equal(dispatcher.dispatch("create g node in scene"), "g#node created in g#scene");
  assert.equal(dispatcher.dispatch("create rect r 1 2 3 4 #4a90d9 in node"), "rect#r created in g#node");
  dispatcher.dispatch("create circle c 1 2 3 in node");
  dispatcher.dispatch("create ellipse e 1 2 3 4 in node");
  dispatcher.dispatch("create line l 1 2 3 4 black in scene");
  dispatcher.dispatch('create text t 1 2 "开始 # end" in node');
  assert.deepEqual(session.document.get("node").children.map(shape => shape.id), ["r", "c", "e", "t"]);
  assert.equal(session.document.parentOf("l")?.id, "scene");
  assert.deepEqual(session.document.get("r").styles, { fill: "#4a90d9" });
  assert.match(dispatcher.dispatch("show t"), /"开始 # end"/);
});
test("empty text and the literal word in are valid content", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch('create text empty 1 2 ""');
  dispatcher.dispatch('create text word 1 2 "in"');
  assert.match(dispatcher.dispatch("show empty"), /""/);
  assert.match(dispatcher.dispatch("show word"), /"in"/);
});
test("leaf movement, undo and redo use current coordinates in their feedback", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch("create circle c 100 100 20 red");
  assert.equal(dispatcher.dispatch("move c 30 0"), "circle#c moved to (130,100)");
  assert.equal(dispatcher.dispatch("undo"), "circle#c moved back to (100,100)");
  assert.equal(dispatcher.dispatch("redo"), "circle#c moved to (130,100)");
  assert.equal(dispatcher.dispatch("show c"), "circle#c  parent=svg\n  cx=130 cy=100 r=20\n  fill=red");
});
test("group movement and deletion restore a whole subtree through one undo", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g g");
  dispatcher.dispatch("create rect r 1 2 3 4 in g");
  assert.equal(dispatcher.dispatch("move g 10 20"), "g#g moved by (10,20)");
  assert.equal(dispatcher.dispatch("undo"), "g#g moved back by (-10,-20)");
  assert.equal(dispatcher.dispatch("redo"), "g#g moved by (10,20)");
  assert.equal(dispatcher.dispatch("delete g"), "g#g deleted");
  assert.equal(dispatcher.dispatch("tree"), "svg (800x600)");
  assert.equal(dispatcher.dispatch("undo"), "g#g restored into svg");
  assert.match(dispatcher.dispatch("show r"), /x=11 y=22/);
  assert.equal(dispatcher.dispatch("redo"), "g#g deleted");
});
test("queries, comments and failed commands preserve the redo branch", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create rect r 0 0 10 10");
  dispatcher.dispatch("move r 5 6");
  dispatcher.dispatch("undo");
  for (const line of ["tree", "tree r", "show r", "help", "", " # comment"]) dispatcher.dispatch(line);
  for (const line of [
    "create rect r 0 0 1 1", "create circle bad 0 0 -1", "create g orphan in missing",
    "create g orphan in r", "create box box", "move r NaN 0", "delete absent",
    "move r 1 2 # not a comment", "create text t 1 2 \"open",
  ]) assert.throws(() => dispatcher.dispatch(line));
  assert.equal(session.document.find("bad"), undefined);
  assert.equal(session.document.find("orphan"), undefined);
  assert.equal(session.document.find("box"), undefined);
  assert.equal(dispatcher.dispatch("redo"), "rect#r moved to (5,6)");
});
test("new editing clears redo and init establishes a new barrier", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g old");
  dispatcher.dispatch("undo");
  dispatcher.dispatch("create g new");
  assert.throws(() => dispatcher.dispatch("redo"), /nothing to redo/);
  dispatcher.dispatch("init 100 200");
  assert.equal(dispatcher.dispatch("tree"), "svg (100x200)");
  assert.throws(() => dispatcher.dispatch("undo"), /not allowed after io command/);
  assert.throws(() => dispatcher.dispatch("create circle bad 0 0 -1"), /non-negative/);
  assert.throws(() => dispatcher.dispatch("redo"), /not allowed after io command/);
});
test("dispatcher rejects extra arguments, malformed in suffixes and unknown names", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  for (const line of [
    "help extra", "tree a b", "show", "show r extra", "undo extra", "redo extra",
    "delete", "delete a b", "move r 1", "move r 1 2 3", "create", "create g g in",
    "create g g in g extra", "create rect r 0 0 1 1 red extra",
  ]) assert.throws(() => dispatcher.dispatch(line));
  for (const name of ["unknown", "toString", "__proto__", "INIT"]) {
    assert.throws(() => dispatcher.dispatch(name), { message: "unknown command: " + name });
  }
  assert.equal(dispatcher.dispatch("tree"), "svg (800x600)");
});

test("trailing in requires a container once required shape parameters are complete", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g existing");
  dispatcher.dispatch("move existing 1 2");
  dispatcher.dispatch("undo");
  const before = session.document.children;
  for (const line of [
    "create rect r 0 0 1 1 in", 'create rect r 0 0 1 1 "in"',
    "create circle c 0 0 1 in", "create ellipse e 0 0 1 2 in",
    "create line l 0 0 1 2 in", 'create line l 0 0 1 2 "in"',
    "create text t 1 2 hello in", "create g g in",
  ]) {
    assert.throws(() => dispatcher.dispatch(line), { message: "missing container id after in" });
    assert.deepEqual(session.document.children, before);
  }
  assert.equal(dispatcher.dispatch("redo"), "g#existing moved by (1,2)");
});

test("literal in remains valid text both at root and in a container named in", () => {
  const dispatcher = new CommandDispatcher();
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g in");
  dispatcher.dispatch('create text root 1 2 "in"');
  dispatcher.dispatch('create text child 3 4 "in" in in');
  assert.equal(dispatcher.dispatch("show root"), 'text#root  parent=svg\n  (1,2) "in"');
  assert.equal(dispatcher.dispatch("show child"), 'text#child  parent=g#in\n  (3,4) "in"');
});

test("create undo and redo feedback restores root and nested placement", () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  dispatcher.dispatch("init");
  dispatcher.dispatch("create g g");
  assert.equal(dispatcher.dispatch("undo"), "g#g removed");
  assert.equal(session.document.find("g"), undefined);
  assert.equal(dispatcher.dispatch("redo"), "g#g created");
  dispatcher.dispatch("create rect r 1 2 3 4 in g");
  const rect = session.document.get("r");
  assert.equal(dispatcher.dispatch("undo"), "rect#r removed");
  assert.deepEqual(session.document.get("g").children, []);
  assert.equal(dispatcher.dispatch("redo"), "rect#r created in g#g");
  assert.equal(session.document.get("r"), rect);
  assert.equal(session.document.parentOf("r")?.id, "g");
  assert.equal(session.document.indexOf("r"), 0);
});
