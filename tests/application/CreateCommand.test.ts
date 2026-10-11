import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateCommand } from "../../src/application/CreateCommand.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Rect } from "../../src/domain/Rect.js";
import { Group } from "../../src/domain/Group.js";

test("create executes, undoes and redoes the same root object", () => {
  const doc = new SvgDocument();
  const rect = new Rect("r", 1, 2, 3, 4);
  const command = new CreateCommand(rect);
  command.execute(doc);
  assert.equal(doc.get("r"), rect);
  command.undo(doc);
  assert.equal(doc.find("r"), undefined);
  command.execute(doc);
  assert.equal(doc.get("r"), rect);
  assert.equal(doc.indexOf("r"), 0);
});

test("create restores its specified parent and index on redo", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const group = new Group("g", [a, b]);
  const doc = new SvgDocument();
  doc.add(group);
  const rect = new Rect("r", 0, 0, 1, 1);
  const command = new CreateCommand(rect, "g", 1);
  command.execute(doc);
  assert.deepEqual(group.children, [a, rect, b]);
  command.undo(doc);
  assert.deepEqual(group.children, [a, b]);
  command.execute(doc);
  assert.deepEqual(group.children, [a, rect, b]);
  assert.equal(doc.parentOf("r"), group);
  assert.equal(doc.indexOf("r"), 1);
});

test("create of a nested group registers and removes every descendant", () => {
  const rect = new Rect("r", 0, 0, 1, 1);
  const inner = new Group("inner", [rect]);
  const group = new Group("g", [inner]);
  const doc = new SvgDocument();
  const command = new CreateCommand(group);
  command.execute(doc);
  assert.equal(doc.parentOf("r"), inner);
  command.undo(doc);
  for (const id of ["g", "inner", "r"]) assert.equal(doc.find(id), undefined);
  command.execute(doc);
  assert.equal(doc.get("r"), rect);
  assert.equal(doc.parentOf("inner"), group);
});

test("failed create leaves the document unchanged and can be retried", () => {
  const doc = new SvgDocument();
  const existing = new Rect("r", 0, 0, 1, 1);
  doc.add(existing);
  const incoming = new Rect("r", 1, 2, 3, 4);
  const command = new CreateCommand(incoming);
  assert.throws(() => command.execute(doc), /id already exists: r/);
  assert.deepEqual(doc.children, [existing]);
  doc.remove("r");
  command.execute(doc);
  assert.equal(doc.get("r"), incoming);
});

test("create rejects missing or leaf parents without registering the new shape", () => {
  const doc = new SvgDocument();
  doc.add(new Rect("leaf", 0, 0, 1, 1));
  for (const [parent, message] of [
    ["missing", "no such container: missing"],
    ["leaf", "not a container: leaf"],
  ] as const) {
    const command = new CreateCommand(new Rect("r", 0, 0, 1, 1), parent);
    assert.throws(() => command.execute(doc), { message });
    assert.equal(doc.find("r"), undefined);
  }
});

test("a command rejects invalid lifecycle calls and cross-document replay", () => {
  const doc = new SvgDocument();
  const other = new SvgDocument();
  const command = new CreateCommand(new Rect("r", 0, 0, 1, 1));
  assert.throws(() => command.undo(doc), /not executed/);
  command.execute(doc);
  assert.throws(() => command.execute(doc), /already executed/);
  assert.throws(() => command.undo(other), /different document/);
  assert.equal(doc.find("r")?.id, "r");
  command.undo(doc);
  assert.throws(() => command.undo(doc), /not executed/);
  assert.throws(() => command.execute(other), /different document/);
  command.execute(doc);
  assert.equal(doc.find("r")?.id, "r");
});
