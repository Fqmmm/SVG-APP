import assert from "node:assert/strict";
import { test } from "node:test";
import { Circle } from "../../src/domain/Circle.js";

test("Circle moves positions while preserving dimensions and styles", () => {
  const shape = new Circle("c1", 10, 20, 30);
  shape.set("stroke-width", "2");
  shape.move(-2.5, 4);
  assert.deepEqual(shape.geometry, { cx: 7.5, cy: 24, r: 30 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Circle scales all geometry but preserves stroke width", () => {
  const shape = new Circle("c1", 10, 20, 30);
  shape.set("stroke-width", 2);
  shape.scale(0.5);
  assert.deepEqual(shape.geometry, { cx: 5, cy: 10, r: 15 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Circle validates attribute changes before updating geometry", () => {
  const shape = new Circle("c1", 10, 20, 30);
  shape.set("r", "75");
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, r: 75 });
  assert.throws(() => shape.set("r", "not-a-number"), /invalid number/);
  assert.throws(() => shape.set("unlisted", 1), /unknown attribute: unlisted/);
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, r: 75 });
});

test("Circle rejects invalid constructor geometry", () => {
  assert.throws(() => new Circle("bad", 0, 0, -1));
});

test("Circle rejects invalid transforms without changing state", () => {
  const shape = new Circle("c1", 10, 20, 30);
  for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => shape.scale(factor), /scale factor must be positive/);
  }
  assert.throws(() => shape.move(Number.NaN, 0), /invalid number/);
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, r: 30 });
});

test("Circle rejects overflow without leaving a partial update", () => {
  const shape = new Circle("large", Number.MAX_VALUE, 0, 1);
  const before = shape.geometry;
  assert.throws(() => shape.move(Number.MAX_VALUE, 3), /invalid number/);
  assert.deepEqual(shape.geometry, before);
  assert.throws(() => shape.scale(2), /invalid number/);
  assert.deepEqual(shape.geometry, before);
});

test("Circle restores geometry and the absence of a style attribute", () => {
  const shape = new Circle("c1", 10, 20, 30);
  const state = shape.captureState();
  shape.move(0.1, 0.2);
  shape.scale(3);
  shape.set("fill", "red");
  state.restore();
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, r: 30 });
  assert.deepEqual(shape.styles, {});
  shape.move(10, 10);
  state.restore();
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, r: 30 });
});
