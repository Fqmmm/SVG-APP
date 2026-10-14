import assert from "node:assert/strict";
import { test } from "node:test";
import { Line } from "../../src/domain/Line.js";

test("Line moves positions while preserving dimensions and styles", () => {
  const shape = new Line("l1", 10, 20, 30, 40);
  shape.set("stroke-width", "2");
  shape.move(-2.5, 4);
  assert.deepEqual(shape.geometry, { x1: 7.5, y1: 24, x2: 27.5, y2: 44 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Line scales all geometry but preserves stroke width", () => {
  const shape = new Line("l1", 10, 20, 30, 40);
  shape.set("stroke-width", 2);
  shape.scale(0.5);
  assert.deepEqual(shape.geometry, { x1: 5, y1: 10, x2: 15, y2: 20 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Line validates attribute changes before updating geometry", () => {
  const shape = new Line("l1", 10, 20, 30, 40);
  shape.set("x2", "75");
  assert.deepEqual(shape.geometry, { x1: 10, y1: 20, x2: 75, y2: 40 });
  assert.throws(() => shape.set("x2", "not-a-number"), /invalid number/);
  assert.throws(() => shape.set("unlisted", 1), /unknown attribute: unlisted/);
  assert.deepEqual(shape.geometry, { x1: 10, y1: 20, x2: 75, y2: 40 });
});

test("Line rejects invalid constructor geometry", () => {
  assert.throws(() => new Line("bad", 0, 0, Number.NaN, 10));
});

test("Line rejects invalid transforms without changing state", () => {
  const shape = new Line("l1", 10, 20, 30, 40);
  for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => shape.scale(factor), /scale factor must be positive/);
  }
  assert.throws(() => shape.move(Number.NaN, 0), /invalid number/);
  assert.deepEqual(shape.geometry, { x1: 10, y1: 20, x2: 30, y2: 40 });
});

test("Line rejects overflow without leaving a partial update", () => {
  const shape = new Line("large", Number.MAX_VALUE, 0, 1, 1);
  const before = shape.geometry;
  assert.throws(() => shape.move(Number.MAX_VALUE, 3), /invalid number/);
  assert.deepEqual(shape.geometry, before);
  assert.throws(() => shape.scale(2), /invalid number/);
  assert.deepEqual(shape.geometry, before);
});

test("Line restores geometry and the absence of a style attribute", () => {
  const shape = new Line("l1", 10, 20, 30, 40);
  const state = shape.captureState();
  shape.move(0.1, 0.2);
  shape.scale(3);
  shape.set("fill", "red");
  state.restore();
  assert.deepEqual(shape.geometry, { x1: 10, y1: 20, x2: 30, y2: 40 });
  assert.deepEqual(shape.styles, {});
  shape.move(10, 10);
  state.restore();
  assert.deepEqual(shape.geometry, { x1: 10, y1: 20, x2: 30, y2: 40 });
});
