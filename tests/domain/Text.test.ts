import assert from "node:assert/strict";
import { test } from "node:test";
import { Text } from "../../src/domain/Text.js";

test("Text moves positions while preserving dimensions and styles", () => {
  const shape = new Text("t1", 10, 20, "开始 & end");
  shape.set("stroke-width", "2");
  shape.move(-2.5, 4);
  assert.deepEqual(shape.geometry, { x: 7.5, y: 24 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Text scales all geometry but preserves stroke width", () => {
  const shape = new Text("t1", 10, 20, "开始 & end");
  shape.set("stroke-width", 2);
  shape.scale(0.5);
  assert.deepEqual(shape.geometry, { x: 5, y: 10 });
  assert.equal(shape.styles["stroke-width"], 2);
});

test("Text validates attribute changes before updating geometry", () => {
  const shape = new Text("t1", 10, 20, "开始 & end");
  shape.set("x", "75");
  assert.deepEqual(shape.geometry, { x: 75, y: 20 });
  assert.throws(() => shape.set("x", "not-a-number"), /invalid number/);
  assert.throws(() => shape.set("unlisted", 1), /unknown attribute: unlisted/);
  assert.deepEqual(shape.geometry, { x: 75, y: 20 });
});

test("Text rejects invalid constructor geometry", () => {
  assert.throws(() => new Text("bad", Number.POSITIVE_INFINITY, 0, ""));
});

test("Text rejects invalid transforms without changing state", () => {
  const shape = new Text("t1", 10, 20, "开始 & end");
  for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => shape.scale(factor), /scale factor must be positive/);
  }
  assert.throws(() => shape.move(Number.NaN, 0), /invalid number/);
  assert.deepEqual(shape.geometry, { x: 10, y: 20 });
});

test("Text rejects overflow without leaving a partial update", () => {
  const shape = new Text("large", Number.MAX_VALUE, 0, "large");
  const before = shape.geometry;
  assert.throws(() => shape.move(Number.MAX_VALUE, 3), /invalid number/);
  assert.deepEqual(shape.geometry, before);
  assert.throws(() => shape.scale(2), /invalid number/);
  assert.deepEqual(shape.geometry, before);
});

test("Text restores geometry and the absence of a style attribute", () => {
  const shape = new Text("t1", 10, 20, "开始 & end");
  const state = shape.captureState();
  shape.move(0.1, 0.2);
  shape.scale(3);
  shape.set("fill", "red");
  state.restore();
  assert.deepEqual(shape.geometry, { x: 10, y: 20 });
  assert.deepEqual(shape.styles, {});
  shape.move(10, 10);
  state.restore();
  assert.deepEqual(shape.geometry, { x: 10, y: 20 });
});
