import assert from "node:assert/strict";
import { test } from "node:test";
import { ShapeFormatter } from "../../src/cli/ShapeFormatter.js";
import { PositionFormatter } from "../../src/cli/PositionFormatter.js";
import { TreeFormatter } from "../../src/cli/TreeFormatter.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Rect } from "../../src/domain/Rect.js";
import { Circle } from "../../src/domain/Circle.js";
import { Ellipse } from "../../src/domain/Ellipse.js";
import { Line } from "../../src/domain/Line.js";
import { Text } from "../../src/domain/Text.js";
import { Group } from "../../src/domain/Group.js";

test("shape summaries use visitors for all six types and only show explicit styles", () => {
  const formatter = new ShapeFormatter();
  const values = [
    [new Rect("r", 1, 2, 3, 4, "blue"), "rect#r  x=1 y=2 w=3 h=4 fill=blue"],
    [new Circle("c", 1, 2, 3), "circle#c  cx=1 cy=2 r=3"],
    [new Ellipse("e", 1, 2, 3, 4), "ellipse#e  cx=1 cy=2 rx=3 ry=4"],
    [new Line("l", 1, 2, 3, 4, "black"), "line#l  (1,2) -> (3,4) stroke=black"],
    [new Text("t", 1, 2, '开始 "end"'), 'text#t  (1,2) "开始 \\"end\\""'],
    [new Group("g"), "g#g"],
  ] as const;
  for (const [shape, expected] of values) assert.equal(formatter.summary(shape), expected);
});
test("show reports actual parent and geometry without adding implicit styles", () => {
  const doc = new SvgDocument();
  const circle = new Circle("c", 1, 2, 3, "red");
  doc.add(new Group("g", [circle]));
  const formatter = new ShapeFormatter();
  assert.equal(formatter.show(circle, doc.parentOf("c")), "circle#c  parent=g#g\n  cx=1 cy=2 r=3\n  fill=red");
  assert.equal(formatter.show(doc.get("g"), null), "g#g  parent=svg");
});
test("tree draws nested branches and supports a selected subtree", () => {
  const doc = new SvgDocument(400, 200);
  const rect = new Rect("r", 1, 2, 3, 4);
  const group = new Group("g", [rect, new Group("inner")]);
  doc.add(group);
  doc.add(new Circle("c", 1, 2, 3));
  const formatter = new TreeFormatter();
  assert.equal(formatter.document(doc), [
    "svg (400x200)", "├── g#g", "│   ├── rect#r  x=1 y=2 w=3 h=4",
    "│   └── g#inner", "└── circle#c  cx=1 cy=2 r=3",
  ].join("\n"));
  assert.equal(formatter.subtree(group), "g#g\n├── rect#r  x=1 y=2 w=3 h=4\n└── g#inner");
  assert.equal(formatter.subtree(rect), "rect#r  x=1 y=2 w=3 h=4");
});
test("empty tree and group positions have well-defined output", () => {
  assert.equal(new TreeFormatter().document(new SvgDocument()), "svg (800x600)");
  assert.equal(new PositionFormatter().format(new Rect("r", 1, 2, 3, 4)), "(1,2)");
  assert.equal(new PositionFormatter().format(new Circle("c", 5, 6, 7)), "(5,6)");
  assert.equal(new PositionFormatter().format(new Group("g")), undefined);
});
