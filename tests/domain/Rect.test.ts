import assert from "node:assert/strict";
import { test } from "node:test";
import { Rect } from "../../src/domain/Rect.js";

test("Rect moves positions while preserving dimensions and styles", () => {
  const shape = new Rect("r1", 10, 20, 100, 50);
  shape.set("stroke-width", "2");
  shape.move(-2.5, 4);
  assert.deepEqual(shape.geometry, { x: 7.5, y: 24, width: 100, height: 50 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Rect scales all geometry but preserves stroke width", () => {
  const shape = new Rect("r1", 10, 20, 100, 50);
  shape.set("stroke-width", 2);
  shape.scale(0.5);
  assert.deepEqual(shape.geometry, { x: 5, y: 10, width: 50, height: 25 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Rect validates attribute changes before updating geometry", () => {
  const shape = new Rect("r1", 10, 20, 100, 50);
  shape.set("width", "75");
  assert.deepEqual(shape.geometry, { x: 10, y: 20, width: 75, height: 50 });
  assert.throws(() => shape.set("width", "not-a-number"), /invalid number/);
  assert.throws(() => shape.set("unlisted", 1), /unknown attribute: unlisted/);
  assert.deepEqual(shape.geometry, { x: 10, y: 20, width: 75, height: 50 });
});

test("Rect rejects invalid constructor geometry", () => {
  assert.throws(() => new Rect("bad", 0, 0, -1, 10));
});

test("Rect rejects invalid transforms without changing state", () => {
  const shape = new Rect("r1", 10, 20, 100, 50);
  for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => shape.scale(factor), /scale factor must be positive/);
  }
  assert.throws(() => shape.move(Number.NaN, 0), /invalid number/);
  assert.deepEqual(shape.geometry, { x: 10, y: 20, width: 100, height: 50 });
});

test("Rect rejects overflow without leaving a partial update", () => {
  const shape = new Rect("large", Number.MAX_VALUE, 0, 1, 1);
  const before = shape.geometry;
  assert.throws(() => shape.move(Number.MAX_VALUE, 3), /invalid number/);
  assert.deepEqual(shape.geometry, before);
  assert.throws(() => shape.scale(2), /invalid number/);
  assert.deepEqual(shape.geometry, before);
});

test("Rect restores geometry and the absence of a style attribute", () => {
  const shape = new Rect("r1", 10, 20, 100, 50);
  const state = shape.captureState();
  shape.move(0.1, 0.2);
  shape.scale(3);
  shape.set("fill", "red");
  state.restore();
  assert.deepEqual(shape.geometry, { x: 10, y: 20, width: 100, height: 50 });
  assert.deepEqual(shape.styles, {});
  shape.move(10, 10);
  state.restore();
  assert.deepEqual(shape.geometry, { x: 10, y: 20, width: 100, height: 50 });
});
