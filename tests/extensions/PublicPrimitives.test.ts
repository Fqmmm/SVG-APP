import assert from "node:assert/strict";
import { test } from "node:test";
import { Rect, Text, Circle, Ellipse, Line } from "../../src/extensions/index.js";

test("all public primitive models can be used without activating a plugin", () => {
  assert.deepEqual(new Rect("r", 1, 2, 3, 4).geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(new Circle("c", 1, 2, 3).geometry, { cx: 1, cy: 2, r: 3 });
  assert.deepEqual(new Ellipse("e", 1, 2, 3, 4).geometry, { cx: 1, cy: 2, rx: 3, ry: 4 });
  assert.deepEqual(new Line("l", 1, 2, 3, 4).geometry, { x1: 1, y1: 2, x2: 3, y2: 4 });
  assert.equal(new Text("t", 1, 2, "title").content, "title");
});
