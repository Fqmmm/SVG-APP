import assert from "node:assert/strict";
import { test } from "node:test";
import { Rect } from "../../src/domain/Rect.js";
import { Circle } from "../../src/domain/Circle.js";
import { Ellipse } from "../../src/domain/Ellipse.js";
import { Line } from "../../src/domain/Line.js";
import { Text } from "../../src/domain/Text.js";

test("shape styles preserve omitted attributes and explicit constructor colors", () => {
  assert.deepEqual(new Rect("r", 0, 0, 0, 0).styles, {});
  assert.deepEqual(new Rect("r", 0, 0, 1, 1, "blue").styles, { fill: "blue" });
  assert.deepEqual(new Circle("c", 0, 0, 0, "red").styles, { fill: "red" });
  assert.deepEqual(new Ellipse("e", 0, 0, 0, 0, "green").styles, { fill: "green" });
  assert.deepEqual(new Line("l", 0, 0, 1, 1, "black").styles, { stroke: "black" });
});

test("geometry and style views cannot be used to mutate a shape", () => {
  const shape = new Rect("r", 1, 2, 3, 4);
  const geometry = shape.geometry;
  const styles = shape.styles;
  assert.throws(() => Object.assign(geometry, { x: 99 }), TypeError);
  assert.throws(() => Object.assign(styles, { fill: "red" }), TypeError);
  assert.equal(shape.geometry.x, 1);
  assert.deepEqual(shape.styles, {});
});

test("numeric and identity validation rejects empty and non-finite values", () => {
  assert.throws(() => new Rect("", 0, 0, 1, 1), /invalid id/);
  assert.throws(() => new Rect("has space", 0, 0, 1, 1), /invalid id/);
  const shape = new Rect("r", 0, 0, 1, 1);
  for (const value of ["", "   ", "Infinity", "NaN", "0x10"]) {
    assert.throws(() => shape.set("x", value), /invalid number/);
  }
  assert.throws(() => shape.set("width", -1), /non-negative/);
  assert.throws(() => shape.set("stroke-width", -1), /non-negative/);
  assert.throws(() => shape.set("fill", 1), /must be text/);
  shape.set("x", "-1.25e2");
  assert.equal(shape.geometry.x, -125);
});

test("Text content is independent from geometry and included in its state", () => {
  const shape = new Text("t", 10, 20, "开始 & end");
  const state = shape.captureState();
  shape.set("text", "");
  shape.move(5, 10);
  assert.equal(shape.content, "");
  assert.deepEqual(shape.geometry, { x: 15, y: 30 });
  assert.throws(() => shape.set("text", 123), /must be text/);
  state.restore();
  assert.equal(shape.content, "开始 & end");
  assert.deepEqual(shape.geometry, { x: 10, y: 20 });
});
