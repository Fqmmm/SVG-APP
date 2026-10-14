import assert from "node:assert/strict";
import { test } from "node:test";
import { GroupCommand } from "../../src/application/GroupCommand.js";
import { UngroupCommand } from "../../src/application/UngroupCommand.js";
import { CommandHistory } from "../../src/application/CommandHistory.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/Rect.js";

test("same-parent group follows tree order and restores original indexes in one undo", () => {
  const [a, b, c, d] = ["a", "b", "c", "d"].map(id => new Rect(id, 1, 2, 3, 4));
  const doc = new SvgDocument();
  for (const shape of [a!, b!, c!, d!]) doc.add(shape);
  const history = new CommandHistory(doc);
  history.execute(new GroupCommand("g", ["c", "a"]));
  const group = doc.get("g");
  assert.deepEqual(doc.children, [group, b, d]);
  assert.deepEqual(group.children, [a, c]);
  assert.equal(doc.parentOf("a"), group);
  assert.equal(doc.indexOf("c"), 1);
  assert.equal(history.undoCount, 1);
  for (let round = 0; round < 5; round += 1) {
    history.undo();
    assert.deepEqual(doc.children, [a, b, c, d]);
    assert.equal(doc.find("g"), undefined);
    assert.equal(doc.indexOf("a"), 0);
    assert.equal(doc.indexOf("c"), 2);
    history.redo();
    assert.equal(doc.get("g"), group);
    assert.deepEqual(group.children, [a, c]);
  }
});

test("cross-parent grouping uses LCA and earliest branch while preserving empty parents", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const c = new Rect("c", 0, 0, 1, 1);
  const d = new Rect("d", 0, 0, 1, 1);
  const p = new Group("p", [a, b]);
  const q = new Group("q", [c, d]);
  const outer = new Group("outer", [p, q]);
  const doc = new SvgDocument(); doc.add(outer);
  const history = new CommandHistory(doc);
  history.execute(new GroupCommand("g", ["d", "a"]));
  const group = doc.get("g");
  assert.deepEqual(outer.children, [group, p, q]);
  assert.deepEqual(group.children, [a, d]);
  assert.deepEqual(p.children, [b]);
  assert.deepEqual(q.children, [c]);
  assert.equal(doc.parentOf("g"), outer);
  history.undo();
  assert.deepEqual(outer.children, [p, q]);
  assert.deepEqual(p.children, [a, b]);
  assert.deepEqual(q.children, [c, d]);
  assert.equal(doc.indexOf("d"), 1);
  history.execute(new GroupCommand("all", ["d", "b", "c", "a"]));
  assert.deepEqual(p.children, []);
  assert.deepEqual(q.children, []);
  assert.equal(doc.get("p"), p);
  assert.equal(doc.get("q"), q);
});

test("single-target and mixed-depth grouping choose the correct insertion position", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const inner = new Group("inner", [a]);
  const parent = new Group("parent", [inner, b]);
  const doc = new SvgDocument(); doc.add(parent);
  const single = new GroupCommand("single", ["a"]);
  single.execute(doc);
  assert.equal(doc.parentOf("single"), inner);
  single.undo(doc);
  const mixed = new GroupCommand("mixed", ["b", "a"]);
  mixed.execute(doc);
  assert.deepEqual(parent.children, [doc.get("mixed"), inner]);
  assert.deepEqual(doc.get("mixed").children, [a, b]);
  mixed.undo(doc);
  assert.deepEqual(parent.children, [inner, b]);
  assert.deepEqual(inner.children, [a]);
});

test("group validation rejects invalid ids, repeated targets, missing targets and ancestor selection", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const inner = new Group("inner", [a]);
  const doc = new SvgDocument(); doc.add(inner);
  for (const command of [
    new GroupCommand("", ["a"]), new GroupCommand("inner", ["a"]),
    new GroupCommand("g", []), new GroupCommand("g", ["a", "a"]),
    new GroupCommand("g", ["a", "missing"]),
  ]) {
    assert.throws(() => command.execute(doc));
    assert.equal(doc.find("g"), undefined);
    assert.deepEqual(inner.children, [a]);
  }
  assert.throws(() => new GroupCommand("g", ["a", "inner"]).execute(doc), {
    message: "cannot group a container into its own descendant: inner",
  });
});

test("group undo failure preserves tree and history, then succeeds after conflict removal", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const doc = new SvgDocument(); doc.add(a);
  const history = new CommandHistory(doc);
  history.execute(new GroupCommand("g", ["a"]));
  const group = doc.get("g");
  const extra = new Rect("extra", 0, 0, 1, 1);
  doc.add(extra);
  assert.throws(() => history.undo(), /structure changed/);
  assert.deepEqual(doc.children, [group, extra]);
  assert.equal(history.undoCount, 1);
  assert.equal(history.redoCount, 0);
  doc.remove("extra");
  history.undo();
  assert.deepEqual(doc.children, [a]);
});

test("ungroup promotes nested children at the original position and undo restores the same group", () => {
  const a = new Rect("a", 1, 2, 3, 4);
  const sub = new Group("sub");
  const before = new Group("before");
  const group = new Group("g", [a, sub]);
  group.set("fill", "red");
  const after = new Group("after");
  const parent = new Group("parent", [before, group, after]);
  const doc = new SvgDocument(); doc.add(parent);
  const history = new CommandHistory(doc);
  history.execute(new UngroupCommand("g"));
  assert.deepEqual(parent.children, [before, a, sub, after]);
  assert.equal(doc.find("g"), undefined);
  assert.equal(doc.parentOf("a"), parent);
  assert.equal(doc.indexOf("sub"), 2);
  assert.deepEqual(a.geometry, { x: 1, y: 2, width: 3, height: 4 });
  for (let round = 0; round < 5; round += 1) {
    history.undo();
    assert.deepEqual(parent.children, [before, group, after]);
    assert.deepEqual(group.children, [a, sub]);
    assert.deepEqual(group.styles, { fill: "red" });
    assert.equal(doc.parentOf("sub"), group);
    history.redo();
    assert.deepEqual(parent.children, [before, a, sub, after]);
  }
});

test("ungroup handles empty nested groups but rejects roots, leaves and absent ids", () => {
  const empty = new Group("empty");
  const rect = new Rect("r", 0, 0, 1, 1);
  const parent = new Group("parent", [empty, rect]);
  const doc = new SvgDocument(); doc.add(parent);
  const command = new UngroupCommand("empty");
  command.execute(doc);
  assert.deepEqual(parent.children, [rect]);
  command.undo(doc);
  assert.deepEqual(parent.children, [empty, rect]);
  assert.throws(() => new UngroupCommand("parent").execute(doc), { message: "cannot ungroup top-level container: parent" });
  assert.throws(() => new UngroupCommand("r").execute(doc), /not a container: r/);
  assert.throws(() => new UngroupCommand("missing").execute(doc), /no such shape/);
  assert.deepEqual(doc.children, [parent]);
});

test("duplicate group id reports the exact error without changing the existing tree", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const existing = new Group("existing");
  const doc = new SvgDocument();
  doc.add(a);
  doc.add(existing);
  const history = new CommandHistory(doc);
  assert.throws(() => history.execute(new GroupCommand("existing", ["a"])), {
    message: "id already exists: existing",
  });
  assert.deepEqual(doc.children, [a, existing]);
  assert.equal(doc.get("existing"), existing);
  assert.equal(doc.parentOf("a"), null);
  assert.equal(doc.indexOf("a"), 0);
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 0);
});

test("a group created at the svg root rejects ungroup but remains undoable", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const doc = new SvgDocument();
  doc.add(a);
  doc.add(b);
  const history = new CommandHistory(doc);
  history.execute(new GroupCommand("g", ["b", "a"]));
  const group = doc.get("g");
  assert.equal(doc.parentOf("g"), null);
  assert.deepEqual(doc.children, [group]);
  assert.deepEqual(group.children, [a, b]);
  assert.throws(() => history.execute(new UngroupCommand("g")), {
    message: "cannot ungroup top-level container: g",
  });
  assert.deepEqual(doc.children, [group]);
  assert.deepEqual(group.children, [a, b]);
  assert.equal(history.undoCount, 1);
  assert.equal(history.redoCount, 0);
  history.undo();
  assert.deepEqual(doc.children, [a, b]);
  assert.equal(doc.find("g"), undefined);
  assert.equal(doc.parentOf("a"), null);
  assert.equal(doc.indexOf("a"), 0);
  assert.equal(doc.indexOf("b"), 1);
  history.redo();
  assert.equal(doc.get("g"), group);
  assert.deepEqual(group.children, [a, b]);
});
