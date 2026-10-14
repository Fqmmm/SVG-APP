import assert from "node:assert/strict";
import { test } from "node:test";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/Rect.js";
import { Circle } from "../../src/domain/Circle.js";

test("Group applies movement recursively through nested groups", () => {
  const rect = new Rect("r", 10, 20, 30, 40);
  const circle = new Circle("c", 50, 60, 10);
  const group = new Group("outer", [rect, new Group("inner", [circle])]);
  group.move(5, -10);
  assert.deepEqual(rect.geometry, { x: 15, y: 10, width: 30, height: 40 });
  assert.deepEqual(circle.geometry, { cx: 55, cy: 50, r: 10 });
  assert.deepEqual(group.geometry, {});
});

test("Group scales nested positions and dimensions exactly once", () => {
  const rect = new Rect("r", 10, 20, 30, 40);
  const circle = new Circle("c", 50, 60, 10);
  const group = new Group("outer", [rect, new Group("inner", [circle])]);
  group.scale(2);
  assert.deepEqual(rect.geometry, { x: 20, y: 40, width: 60, height: 80 });
  assert.deepEqual(circle.geometry, { cx: 100, cy: 120, r: 20 });
});

test("Group style updates preserve explicit and omitted child styles", () => {
  const explicit = new Rect("a", 0, 0, 10, 10, "blue");
  const inherited = new Rect("b", 0, 0, 10, 10);
  const group = new Group("g", [explicit, inherited]);
  group.set("fill", "red");
  assert.deepEqual(group.styles, { fill: "red" });
  assert.deepEqual(explicit.styles, { fill: "blue" });
  assert.deepEqual(inherited.styles, {});
  assert.throws(() => group.set("x", 10), /unknown attribute: x/);
});

test("Group rolls back earlier descendants when a later move overflows", () => {
  const rect = new Rect("r", 1, 2, 3, 4);
  const large = new Circle("large", Number.MAX_VALUE, 0, 1);
  const group = new Group("g", [rect, new Group("inner", [large])]);
  assert.throws(() => group.move(Number.MAX_VALUE, 5), /invalid number/);
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(large.geometry.cx, Number.MAX_VALUE);
  assert.equal(large.geometry.cy, 0);
});

test("Group rolls back earlier descendants when a later scale overflows", () => {
  const rect = new Rect("r", 1, 2, 3, 4);
  const large = new Circle("large", Number.MAX_VALUE, 0, 1);
  const group = new Group("g", [rect, large]);
  assert.throws(() => group.scale(2), /invalid number/);
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
});

test("Group state restores descendant attributes and its own omitted styles", () => {
  const rect = new Rect("r", 1, 2, 3, 4, "blue");
  const inner = new Group("inner", [rect]);
  const group = new Group("g", [inner]);
  const state = group.captureState();
  group.move(0.1, 0.2);
  rect.set("fill", "green");
  inner.set("stroke", "black");
  group.set("fill", "red");
  state.restore();
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(rect.styles, { fill: "blue" });
  assert.deepEqual(inner.styles, {});
  assert.deepEqual(group.styles, {});
});

test("Group exposes a read-only child list independent of constructor input", () => {
  const rect = new Rect("r", 0, 0, 1, 1);
  const input = [rect];
  const group = new Group("g", input);
  input.length = 0;
  assert.deepEqual(group.children.map(child => child.id), ["r"]);
  const view = group.children;
  assert.throws(() => Object.assign(view, { 0: group }), TypeError);
  assert.equal(Reflect.set(view, "0", group), false);
  assert.deepEqual(group.children.map(child => child.id), ["r"]);
});

test("Group rejects duplicate ids and repeated node references in a subtree", () => {
  const rect = new Rect("r", 0, 0, 1, 1);
  assert.throws(() => new Group("g", [rect, new Circle("r", 0, 0, 1)]), /id already exists: r/);
  assert.throws(() => new Group("g", [rect, rect]), /more than once/);
  assert.throws(() => new Group("r", [rect]), /id already exists: r/);
});

test("empty Group still validates transforms and accepts common styles", () => {
  const group = new Group("g");
  assert.throws(() => group.scale(0), /scale factor must be positive/);
  assert.throws(() => group.move(Number.NaN, 0), /invalid number/);
  group.move(10, 20);
  group.scale(2);
  group.set("stroke-width", 0);
  assert.deepEqual(group.children, []);
  assert.deepEqual(group.styles, { "stroke-width": 0 });
});
