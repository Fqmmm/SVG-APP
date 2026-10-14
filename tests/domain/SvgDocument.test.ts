import assert from "node:assert/strict";
import { test } from "node:test";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/Rect.js";
import { Circle } from "../../src/domain/Circle.js";

test("SvgDocument defaults to 800x600 and rejects invalid resize atomically", () => {
  const doc = new SvgDocument();
  assert.equal(doc.width, 800);
  assert.equal(doc.height, 600);
  doc.resize(400.5, 200);
  assert.throws(() => doc.resize(100, -1));
  assert.throws(() => doc.resize(Number.NaN, 100));
  assert.throws(() => new SvgDocument(0, 100));
  assert.equal(doc.width, 400.5);
  assert.equal(doc.height, 200);
});

test("SvgDocument finds nested shapes by case-sensitive id and records parents", () => {
  const lower = new Rect("r", 0, 0, 1, 1);
  const upper = new Circle("R", 0, 0, 1);
  const inner = new Group("inner", [lower]);
  const outer = new Group("outer", [inner, upper]);
  const doc = new SvgDocument();
  doc.add(outer);
  assert.equal(doc.find("r"), lower);
  assert.equal(doc.find("R"), upper);
  assert.equal(doc.find("missing"), undefined);
  assert.equal(doc.parentOf("r"), inner);
  assert.equal(doc.parentOf("inner"), outer);
  assert.equal(doc.parentOf("outer"), null);
  assert.throws(() => doc.get("missing"), /no such shape: missing/);
});

test("SvgDocument creates a child directly in an existing group", () => {
  const doc = new SvgDocument();
  const group = new Group("g");
  const rect = new Rect("r", 0, 0, 1, 1);
  doc.add(group);
  doc.add(rect, "g");
  assert.deepEqual(doc.children.map(child => child.id), ["g"]);
  assert.deepEqual(group.children.map(child => child.id), ["r"]);
  assert.equal(doc.parentOf("r"), group);
});

test("SvgDocument rejects duplicate ids including collisions deep in a new subtree", () => {
  const doc = new SvgDocument();
  const original = new Rect("r", 0, 0, 1, 1);
  doc.add(original);
  const incoming = new Group("g", [new Circle("r", 0, 0, 1)]);
  assert.throws(() => doc.add(incoming), /id already exists: r/);
  assert.equal(doc.find("r"), original);
  assert.equal(doc.find("g"), undefined);
  assert.deepEqual(doc.children, [original]);
});

test("SvgDocument rejects unknown and leaf containers without attaching the shape", () => {
  const doc = new SvgDocument();
  const rect = new Rect("r", 0, 0, 1, 1);
  doc.add(rect);
  const child = new Circle("c", 0, 0, 1);
  assert.throws(() => doc.add(child, "absent"), /no such container: absent/);
  assert.throws(() => doc.add(child, "r"), /not a container: r/);
  assert.equal(doc.find("c"), undefined);
  assert.deepEqual(doc.children, [rect]);
});

test("SvgDocument removal releases all descendant ids but preserves the detached subtree", () => {
  const child = new Rect("r", 0, 0, 1, 1);
  const inner = new Group("inner", [child]);
  const group = new Group("g", [inner]);
  const doc = new SvgDocument();
  doc.add(group);
  assert.equal(doc.remove("g"), group);
  for (const id of ["g", "inner", "r"]) assert.equal(doc.find(id), undefined);
  assert.deepEqual(group.children, [inner]);
  assert.deepEqual(inner.children, [child]);
  const other = new SvgDocument();
  other.add(group);
  assert.equal(other.find("r"), child);
});

test("SvgDocument removes and reinserts a nested node at its original position", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const c = new Rect("c", 0, 0, 1, 1);
  const group = new Group("g", [a, b, c]);
  const doc = new SvgDocument();
  doc.add(group);
  const index = doc.indexOf("b");
  const detached = doc.remove("b");
  assert.deepEqual(group.children.map(child => child.id), ["a", "c"]);
  doc.add(detached, "g", index);
  assert.deepEqual(group.children.map(child => child.id), ["a", "b", "c"]);
});

test("SvgDocument reparenting updates ownership and appends by default", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const p = new Group("p", [a]);
  const q = new Group("q", [b]);
  const doc = new SvgDocument();
  doc.add(p);
  doc.add(q);
  doc.reparent("a", "q");
  assert.deepEqual(p.children, []);
  assert.deepEqual(q.children, [b, a]);
  assert.equal(doc.indexOf("b"), 0);
  assert.equal(doc.indexOf("a"), 1);
  assert.equal(doc.parentOf("a"), q);
  assert.equal(doc.find("a"), a);
  doc.reparent("a");
  assert.equal(doc.parentOf("a"), null);
  assert.deepEqual(doc.children, [p, q, a]);
  assert.equal(doc.indexOf("p"), 0);
  assert.equal(doc.indexOf("q"), 1);
  assert.equal(doc.indexOf("a"), 2);
  assert.equal(doc.indexOf("b"), 0);
});

test("SvgDocument rejects self and descendant reparenting without changing the tree", () => {
  const inner = new Group("inner");
  const outer = new Group("outer", [inner]);
  const doc = new SvgDocument();
  doc.add(outer);
  assert.throws(() => doc.reparent("outer", "inner"), /descendant/);
  assert.throws(() => doc.reparent("outer", "outer"), /descendant/);
  assert.deepEqual(doc.children, [outer]);
  assert.deepEqual(outer.children, [inner]);
  assert.equal(doc.parentOf("inner"), outer);
});

test("SvgDocument failed reparenting preserves both parent lists", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const p = new Group("p", [a]);
  const q = new Group("q");
  const doc = new SvgDocument();
  doc.add(p);
  doc.add(q);
  assert.throws(() => doc.reparent("a", "q", 3), /invalid child index/);
  assert.throws(() => doc.reparent("a", "missing"), /no such container/);
  assert.throws(() => doc.reparent("a", "a"), /not a container/);
  assert.deepEqual(p.children, [a]);
  assert.deepEqual(q.children, []);
  assert.equal(doc.parentOf("a"), p);
});

test("SvgDocument prevents sharing a node between documents", () => {
  const shape = new Rect("r", 0, 0, 1, 1);
  const first = new SvgDocument();
  const second = new SvgDocument();
  first.add(shape);
  assert.throws(() => second.add(shape), /already belongs to a document/);
  assert.equal(second.find("r"), undefined);
  assert.equal(first.find("r"), shape);
});

test("SvgDocument validates nested ownership before registering any incoming node", () => {
  const shape = new Rect("r", 0, 0, 1, 1);
  const first = new SvgDocument();
  const second = new SvgDocument();
  first.add(shape);
  const incoming = new Group("g", [shape]);
  assert.throws(() => second.add(incoming), /already belongs to a document/);
  assert.equal(second.find("g"), undefined);
  assert.deepEqual(second.children, []);
  first.remove("r");
  second.add(incoming);
  assert.equal(second.parentOf("r"), incoming);
});

test("SvgDocument controls root and group child ordering without exposing mutable lists", () => {
  const doc = new SvgDocument();
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  doc.add(a);
  doc.add(b, undefined, 0);
  assert.deepEqual(doc.children, [b, a]);
  assert.equal(doc.indexOf("b"), 0);
  assert.equal(doc.indexOf("a"), 1);
  assert.throws(() => Object.assign(doc.children, { 0: a }), TypeError);
  doc.reparent("b", undefined, 1);
  assert.deepEqual(doc.children, [a, b]);
  assert.equal(doc.indexOf("a"), 0);
  assert.equal(doc.indexOf("b"), 1);
  assert.throws(() => doc.add(new Circle("c", 0, 0, 1), undefined, 0.5), /invalid child index/);
  assert.equal(doc.find("c"), undefined);
});

test("SvgDocument errors on unknown removal and leaves the document usable", () => {
  const doc = new SvgDocument();
  assert.throws(() => doc.remove("absent"), /no such shape: absent/);
  const rect = new Rect("r", 0, 0, 1, 1);
  doc.add(rect);
  assert.equal(doc.get("r"), rect);
});

test("same-group reordering updates the target and every remaining sibling index", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const c = new Rect("c", 0, 0, 1, 1);
  const group = new Group("g", [a, b, c]);
  const doc = new SvgDocument();
  doc.add(group);

  doc.reparent("a", "g", 2);
  assert.deepEqual(group.children, [b, c, a]);
  assert.equal(doc.indexOf("a"), 2);
  assert.equal(doc.indexOf("b"), 0);
  assert.equal(doc.indexOf("c"), 1);

  doc.reparent("a", "g", 0);
  assert.deepEqual(group.children, [a, b, c]);
  assert.equal(doc.indexOf("a"), 0);
  assert.equal(doc.indexOf("b"), 1);
  assert.equal(doc.indexOf("c"), 2);
});

test("moving a subtree preserves descendant lookup, parent and sibling indexes", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const inner = new Group("inner", [a, b]);
  const outer = new Group("outer", [inner]);
  const destination = new Group("destination");
  const doc = new SvgDocument();
  doc.add(outer);
  doc.add(destination);
  doc.reparent("inner", "destination");

  assert.deepEqual(outer.children, []);
  assert.deepEqual(destination.children, [inner]);
  assert.equal(doc.parentOf("inner"), destination);
  assert.equal(doc.indexOf("inner"), 0);
  assert.equal(doc.find("a"), a);
  assert.equal(doc.find("b"), b);
  assert.equal(doc.parentOf("a"), inner);
  assert.equal(doc.parentOf("b"), inner);
  assert.equal(doc.indexOf("a"), 0);
  assert.equal(doc.indexOf("b"), 1);
});

test("root and group views remain independent snapshots after structural edits", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0, 0, 1, 1);
  const group = new Group("g", [a]);
  const doc = new SvgDocument();
  doc.add(group);
  const rootView = doc.children;
  const groupView = group.children;

  assert.equal(Reflect.set(rootView, "0", b), false);
  assert.equal(Reflect.set(groupView, "0", b), false);
  assert.deepEqual(doc.children, [group]);
  assert.deepEqual(group.children, [a]);
  const editableCopy = [...groupView];
  editableCopy.splice(0, 1, b);
  assert.deepEqual(group.children, [a]);

  doc.add(b);
  doc.reparent("a");
  assert.deepEqual(rootView, [group]);
  assert.deepEqual(groupView, [a]);
  assert.deepEqual(doc.children, [group, b, a]);
  assert.deepEqual(group.children, []);
  assert.equal(doc.parentOf("a"), null);
  assert.equal(doc.indexOf("a"), 2);
});
