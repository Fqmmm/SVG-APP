import assert from "node:assert/strict";
import { test } from "node:test";
import { AddToCommand } from "../../src/application/AddToCommand.js";
import { FrontCommand } from "../../src/application/FrontCommand.js";
import { BackCommand } from "../../src/application/BackCommand.js";
import { CommandHistory } from "../../src/application/CommandHistory.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/Rect.js";

test("addto appends a subtree and undo restores its old parent and sibling position", () => {
  const a = new Rect("a", 1, 2, 3, 4);
  const inner = new Group("inner", [a]);
  const b = new Group("b");
  const p = new Group("p", [b, inner]);
  const q = new Group("q", [new Group("first")]);
  const doc = new SvgDocument(); doc.add(p); doc.add(q);
  const history = new CommandHistory(doc);
  history.execute(new AddToCommand("q", "inner"));
  assert.deepEqual(p.children, [b]);
  assert.deepEqual(q.children.map(shape => shape.id), ["first", "inner"]);
  assert.equal(doc.parentOf("inner"), q);
  assert.equal(doc.parentOf("a"), inner);
  assert.equal(doc.indexOf("inner"), 1);
  history.undo();
  assert.deepEqual(p.children, [b, inner]);
  assert.equal(doc.parentOf("inner"), p);
  history.redo();
  assert.equal(doc.parentOf("inner"), q);
  assert.deepEqual(a.geometry, { x: 1, y: 2, width: 3, height: 4 });
});

test("same-parent addto appends and undo restores order", () => {
  const a = new Group("a"), b = new Group("b"), c = new Group("c");
  const g = new Group("g", [a, b, c]);
  const doc = new SvgDocument(); doc.add(g);
  const command = new AddToCommand("g", "a");
  command.execute(doc);
  assert.deepEqual(g.children, [b, c, a]);
  assert.equal(doc.indexOf("a"), 2);
  command.undo(doc);
  assert.deepEqual(g.children, [a, b, c]);
});

test("addto refuses missing or leaf destinations and self/descendant cycles atomically", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const inner = new Group("inner", [a]);
  const outer = new Group("outer", [inner]);
  const doc = new SvgDocument(); doc.add(outer);
  assert.throws(() => new AddToCommand("missing", "a").execute(doc), /no such container: missing/);
  assert.throws(() => new AddToCommand("a", "inner").execute(doc), /not a container: a/);
  assert.throws(() => new AddToCommand("outer", "outer").execute(doc), /descendant/);
  assert.throws(() => new AddToCommand("inner", "outer").execute(doc), /descendant/);
  assert.deepEqual(doc.children, [outer]);
  assert.deepEqual(outer.children, [inner]);
  assert.equal(doc.parentOf("a"), inner);
});

test("front and back reorder root siblings, preserve group contents and restore exact indexes", () => {
  const child = new Rect("child", 1, 2, 3, 4);
  const a = new Group("a"), b = new Group("b", [child]), c = new Group("c");
  const doc = new SvgDocument(); doc.add(a); doc.add(b); doc.add(c);
  const history = new CommandHistory(doc);
  history.execute(new FrontCommand("b"));
  assert.deepEqual(doc.children, [a, c, b]);
  assert.equal(doc.indexOf("b"), 2);
  history.execute(new BackCommand("b"));
  assert.deepEqual(doc.children, [b, a, c]);
  assert.equal(doc.indexOf("b"), 0);
  history.undo();
  assert.deepEqual(doc.children, [a, c, b]);
  history.undo();
  assert.deepEqual(doc.children, [a, b, c]);
  assert.equal(doc.indexOf("a"), 0);
  assert.equal(doc.indexOf("b"), 1);
  assert.equal(doc.indexOf("c"), 2);
  history.redo(); history.redo();
  assert.deepEqual(doc.children, [b, a, c]);
  assert.deepEqual(b.children, [child]);
  assert.equal(doc.parentOf("child"), b);
  assert.deepEqual(child.geometry, { x: 1, y: 2, width: 3, height: 4 });
});

test("nested front/back and already-at-boundary operations remain reversible", () => {
  const a = new Group("a"), b = new Group("b");
  const g = new Group("g", [a, b]);
  const doc = new SvgDocument(); doc.add(g);
  const front = new FrontCommand("a");
  front.execute(doc);
  assert.deepEqual(g.children, [b, a]);
  front.undo(doc);
  const back = new BackCommand("a");
  back.execute(doc);
  assert.deepEqual(g.children, [a, b]);
  back.undo(doc);
  assert.deepEqual(g.children, [a, b]);
  assert.throws(() => new FrontCommand("missing").execute(doc), /no such shape/);
  assert.throws(() => new BackCommand("missing").execute(doc), /no such shape/);
});
