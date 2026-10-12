import assert from "node:assert/strict";
import { test } from "node:test";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/Rect.js";
import { acquireTreeAccess } from "../../src/domain/TreeAccess.js";

test("batch structure changes move existing nodes and update every index atomically", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const p = new Group("p", [a]);
  const q = new Group("q", [b]);
  const doc = new SvgDocument();
  doc.add(p); doc.add(q);
  const g = new Group("g");
  doc.replaceStructure([g, p, q], new Map([[g, [a, b]], [p, []], [q, []]]));
  assert.deepEqual(doc.children, [g, p, q]);
  assert.deepEqual(g.children, [a, b]);
  assert.equal(doc.get("a"), a);
  assert.equal(doc.parentOf("a"), g);
  assert.equal(doc.indexOf("b"), 1);
  assert.equal(doc.indexOf("p"), 1);
});

test("batch structure rejects duplicate references, duplicate ids and cycles before mutation", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const inner = new Group("inner", [a]);
  const outer = new Group("outer", [inner]);
  const doc = new SvgDocument();
  doc.add(outer);
  assert.throws(() => doc.replaceStructure([outer, a], new Map()), /more than once/);
  assert.throws(() => doc.replaceStructure([outer, new Rect("a", 0, 0, 1, 1)], new Map()), /id already exists/);
  assert.throws(() => doc.replaceStructure([outer], new Map([[inner, [outer]]])), /more than once/);
  assert.deepEqual(doc.children, [outer]);
  assert.deepEqual(inner.children, [a]);
  assert.equal(doc.parentOf("a"), inner);
});

test("failed group access acquisition leaves the old tree intact and permits retry", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const doc = new SvgDocument();
  doc.add(a);
  const unlocked = new Group("unlocked");
  const locked = new Group("locked");
  const foreign = locked[acquireTreeAccess]();
  assert.throws(() => doc.replaceStructure([unlocked, locked, a], new Map()), /claimed/);
  assert.deepEqual(doc.children, [a]);
  assert.equal(doc.find("unlocked"), undefined);
  foreign.release();
  doc.replaceStructure([unlocked, locked, a], new Map());
  assert.equal(doc.get("unlocked"), unlocked);
  assert.equal(doc.indexOf("a"), 2);
});

test("batch structure cannot steal foreign nodes or modify an unrelated detached group", () => {
  const doc = new SvgDocument();
  const other = new SvgDocument();
  const foreign = new Rect("foreign", 0, 0, 1, 1);
  other.add(foreign);
  assert.throws(() => doc.replaceStructure([foreign], new Map()), /already belongs/);
  const unrelated = new Group("unrelated");
  assert.throws(() => doc.replaceStructure([], new Map([[unrelated, []]])), /unrelated group/);
  assert.deepEqual(doc.children, []);
  assert.equal(other.get("foreign"), foreign);
});

test("removed group overrides cannot retain unchecked foreign or duplicate references", () => {
  const child = new Rect("child", 0, 0, 1, 1);
  const group = new Group("g", [child]);
  const doc = new SvgDocument();
  doc.add(group);
  const other = new SvgDocument();
  const foreign = new Rect("foreign", 0, 0, 1, 1);
  other.add(foreign);
  assert.throws(() => doc.replaceStructure([], new Map([[group, [foreign]]])), /removed group must be empty/);
  assert.deepEqual(doc.children, [group]);
  assert.deepEqual(group.children, [child]);
  assert.equal(doc.parentOf("child"), group);
  assert.equal(other.get("foreign"), foreign);
});
