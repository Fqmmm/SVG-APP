import assert from "node:assert/strict";
import { test } from "node:test";
import { DeleteCommand } from "../../src/application/DeleteCommand.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Rect } from "../../src/domain/Rect.js";
import { Text } from "../../src/domain/Text.js";
import { Group } from "../../src/domain/Group.js";

test("delete undo restores a root node between its original siblings", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 1, 2, 3, 4);
  const c = new Rect("c", 0, 0, 1, 1);
  const doc = new SvgDocument();
  for (const shape of [a, b, c]) doc.add(shape);
  const command = new DeleteCommand("b");
  command.execute(doc);
  assert.deepEqual(doc.children, [a, c]);
  assert.equal(doc.find("b"), undefined);
  command.undo(doc);
  assert.deepEqual(doc.children, [a, b, c]);
  assert.equal(doc.get("b"), b);
  assert.equal(doc.parentOf("b"), null);
  assert.equal(doc.indexOf("b"), 1);
  command.execute(doc);
  assert.deepEqual(doc.children, [a, c]);
});

test("delete undo restores an entire nested subtree and all indexes", () => {
  const rect = new Rect("r", 1, 2, 3, 4, "blue");
  const text = new Text("t", 5, 6, "开始");
  const inner = new Group("inner", [rect, text]);
  const before = new Group("before");
  const after = new Group("after");
  const parent = new Group("parent", [before, inner, after]);
  const doc = new SvgDocument();
  doc.add(parent);
  const command = new DeleteCommand("inner");
  command.execute(doc);
  assert.deepEqual(parent.children, [before, after]);
  for (const id of ["inner", "r", "t"]) assert.equal(doc.find(id), undefined);
  command.undo(doc);
  assert.deepEqual(parent.children, [before, inner, after]);
  assert.equal(doc.parentOf("inner"), parent);
  assert.equal(doc.indexOf("inner"), 1);
  assert.equal(doc.get("r"), rect);
  assert.equal(doc.get("t"), text);
  assert.equal(doc.parentOf("r"), inner);
  assert.equal(doc.parentOf("t"), inner);
  assert.equal(doc.indexOf("r"), 0);
  assert.equal(doc.indexOf("t"), 1);
  command.execute(doc);
  command.undo(doc);
  assert.deepEqual(parent.children, [before, inner, after]);
});

test("delete undo also restores the saved geometry, text and omitted attributes", () => {
  const rect = new Rect("r", 0.1, 0.2, 3, 4);
  const text = new Text("t", 5, 6, "original");
  const group = new Group("g", [rect, text]);
  const doc = new SvgDocument();
  doc.add(group);
  const command = new DeleteCommand("g");
  command.execute(doc);
  // Detached objects may still be held by a caller.
  rect.move(100, 100);
  rect.set("fill", "red");
  text.set("text", "changed");
  group.set("stroke", "black");
  command.undo(doc);
  assert.deepEqual(rect.geometry, { x: 0.1, y: 0.2, width: 3, height: 4 });
  assert.deepEqual(rect.styles, {});
  assert.equal(text.content, "original");
  assert.deepEqual(group.styles, {});
});

test("failed delete undo is atomic and can be retried after an id conflict is removed", () => {
  const doc = new SvgDocument();
  const rect = new Rect("r", 1, 2, 3, 4);
  const group = new Group("g", [rect]);
  doc.add(group);
  const command = new DeleteCommand("g");
  command.execute(doc);
  const conflict = new Rect("r", 0, 0, 1, 1);
  doc.add(conflict);
  assert.throws(() => command.undo(doc), /id already exists: r/);
  assert.deepEqual(doc.children, [conflict]);
  assert.equal(doc.find("g"), undefined);
  doc.remove("r");
  command.undo(doc);
  assert.equal(doc.get("r"), rect);
  assert.deepEqual(doc.children, [group]);
});

test("deleting an absent id fails without changing existing nodes", () => {
  const doc = new SvgDocument();
  const group = new Group("g");
  doc.add(group);
  const command = new DeleteCommand("missing");
  assert.throws(() => command.execute(doc), /no such shape: missing/);
  assert.deepEqual(doc.children, [group]);
  assert.throws(() => command.undo(doc), /not executed/);
});
