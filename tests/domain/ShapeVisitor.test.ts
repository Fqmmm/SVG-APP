import assert from "node:assert/strict";
import { test } from "node:test";
import { Rect } from "../../src/domain/primitives/Rect.js";
import { Circle } from "../../src/domain/primitives/Circle.js";
import { Ellipse } from "../../src/domain/primitives/Ellipse.js";
import { Line } from "../../src/domain/primitives/Line.js";
import { Text } from "../../src/domain/primitives/Text.js";
import { Group } from "../../src/domain/Group.js";
import type { Shape } from "../../src/domain/Shape.js";
import type { ShapeVisitor } from "../../src/domain/ShapeVisitor.js";

test("the open visitor receives every built-in shape through the common interface", () => {
  const visitor: ShapeVisitor<string> = {
    visitShape(shape) {
      return shape.type + ":" + shape.id;
    },
  };
  const shapes: Shape[] = [
    new Rect("r", 0, 0, 2, 3), new Circle("c", 0, 0, 4),
    new Ellipse("e", 0, 0, 5, 6), new Line("l", 0, 0, 7, 8),
    new Text("t", 0, 0, "content"), new Group("g"),
  ];
  assert.deepEqual(shapes.map(shape => shape.accept(visitor)), [
    "rect:r", "circle:c", "ellipse:e", "line:l", "text:t", "g:g",
  ]);
});

test("the common visitor preserves each concrete geometry and text value", () => {
  const shapes: Shape[] = [
    new Rect("r", 1, 2, 3, 4), new Circle("c", 5, 6, 7),
    new Ellipse("e", 8, 9, 10, 11), new Line("l", 12, 13, 14, 15),
    new Text("t", 16, 17, "content"), new Group("g"),
  ];
  const visitor: ShapeVisitor<unknown> = {
    visitShape(shape) {
      return shape instanceof Text ? { geometry: shape.geometry, content: shape.content } : shape.geometry;
    },
  };
  assert.deepEqual(shapes.map(shape => shape.accept(visitor)), [
    { x: 1, y: 2, width: 3, height: 4 }, { cx: 5, cy: 6, r: 7 },
    { cx: 8, cy: 9, rx: 10, ry: 11 }, { x1: 12, y1: 13, x2: 14, y2: 15 },
    { geometry: { x: 16, y: 17 }, content: "content" }, {},
  ]);
});
