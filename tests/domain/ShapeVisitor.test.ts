import assert from "node:assert/strict";
import { test } from "node:test";
import { Rect } from "../../src/domain/Rect.js";
import { Circle } from "../../src/domain/Circle.js";
import { Ellipse } from "../../src/domain/Ellipse.js";
import { Line } from "../../src/domain/Line.js";
import { Text } from "../../src/domain/Text.js";
import { Group } from "../../src/domain/Group.js";
import type { Shape } from "../../src/domain/Shape.js";
import type { ShapeVisitor } from "../../src/domain/ShapeVisitor.js";

test("each shape dispatches to its typed visitor method through the common interface", () => {
  const visitor: ShapeVisitor<string> = {
    visitRect: shape => "rect:" + shape.geometry.width,
    visitCircle: shape => "circle:" + shape.geometry.r,
    visitEllipse: shape => "ellipse:" + shape.geometry.ry,
    visitLine: shape => "line:" + shape.geometry.x2,
    visitText: shape => "text:" + shape.content,
    visitGroup: shape => "g:" + shape.children.length,
  };
  const shapes: Shape[] = [
    new Rect("r", 0, 0, 2, 3), new Circle("c", 0, 0, 4),
    new Ellipse("e", 0, 0, 5, 6), new Line("l", 0, 0, 7, 8),
    new Text("t", 0, 0, "标题"), new Group("g"),
  ];
  assert.deepEqual(shapes.map(shape => shape.accept(visitor)), [
    "rect:2", "circle:4", "ellipse:6", "line:7", "text:标题", "g:0",
  ]);
});
