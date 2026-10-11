import assert from "node:assert/strict";
import { test } from "node:test";
import { Ellipse } from "../../src/domain/Ellipse.js";

test("Ellipse moves positions while preserving dimensions and styles", () => {
  const shape = new Ellipse("e1", 10, 20, 30, 40);
  shape.set("stroke-width", "2");
  shape.move(-2.5, 4);
  assert.deepEqual(shape.geometry, { cx: 7.5, cy: 24, rx: 30, ry: 40 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Ellipse scales all geometry but preserves stroke width", () => {
  const shape = new Ellipse("e1", 10, 20, 30, 40);
  shape.set("stroke-width", 2);
  shape.scale(0.5);
  assert.deepEqual(shape.geometry, { cx: 5, cy: 10, rx: 15, ry: 20 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Ellipse validates attribute changes before updating geometry", () => {
  const shape = new Ellipse("e1", 10, 20, 30, 40);
  shape.set("ry", "75");
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, rx: 30, ry: 75 });
  assert.throws(() => shape.set("ry", "not-a-number"), /invalid number/);
  assert.throws(() => shape.set("unlisted", 1), /unknown attribute: unlisted/);
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, rx: 30, ry: 75 });
});

test("Ellipse rejects invalid constructor geometry", () => {
  assert.throws(() => new Ellipse("bad", 0, 0, 1, -1));
});

test("Ellipse rejects invalid transforms without changing state", () => {
  const shape = new Ellipse("e1", 10, 20, 30, 40);
  for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => shape.scale(factor), /scale factor must be positive/);
  }
  assert.throws(() => shape.move(Number.NaN, 0), /invalid number/);
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, rx: 30, ry: 40 });
});

test("Ellipse rejects overflow without leaving a partial update", () => {
  const shape = new Ellipse("large", Number.MAX_VALUE, 0, 1, 1);
  const before = shape.geometry;
  assert.throws(() => shape.move(Number.MAX_VALUE, 3), /invalid number/);
  assert.deepEqual(shape.geometry, before);
  assert.throws(() => shape.scale(2), /invalid number/);
  assert.deepEqual(shape.geometry, before);
});

test("Ellipse restores geometry and the absence of a style attribute", () => {
  const shape = new Ellipse("e1", 10, 20, 30, 40);
  const state = shape.captureState();
  shape.move(0.1, 0.2);
  shape.scale(3);
  shape.set("fill", "red");
  state.restore();
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, rx: 30, ry: 40 });
  assert.deepEqual(shape.styles, {});
  shape.move(10, 10);
  state.restore();
  assert.deepEqual(shape.geometry, { cx: 10, cy: 20, rx: 30, ry: 40 });
});
