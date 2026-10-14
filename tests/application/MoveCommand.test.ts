import assert from "node:assert/strict";
import { test } from "node:test";
import { MoveCommand } from "../../src/application/MoveCommand.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Rect } from "../../src/domain/Rect.js";
import { Circle } from "../../src/domain/Circle.js";
import { Ellipse } from "../../src/domain/Ellipse.js";
import { Line } from "../../src/domain/Line.js";
import { Text } from "../../src/domain/Text.js";
import { Group } from "../../src/domain/Group.js";

test("move restores exact original floating-point coordinates over repeated undo/redo", () => {
  const doc = new SvgDocument();
  const rect = new Rect("r", 0.1, 0.2, 3, 4, "blue");
  doc.add(rect);
  const before = rect.geometry;
  const command = new MoveCommand("r", 0.2, 0.1);
  command.execute(doc);
  const after = rect.geometry;
  assert.deepEqual(after, { x: 0.1 + 0.2, y: 0.2 + 0.1, width: 3, height: 4 });
  for (let round = 0; round < 10; round += 1) {
    command.undo(doc);
    assert.deepEqual(rect.geometry, before);
    command.execute(doc);
    assert.deepEqual(rect.geometry, after);
  }
  assert.deepEqual(rect.styles, { fill: "blue" });
});

test("move works through the shared interface of all five leaf types", () => {
  const shapes = [
    new Rect("r", 1, 2, 3, 4),
    new Circle("c", 1, 2, 3),
    new Ellipse("e", 1, 2, 3, 4),
    new Line("l", 1, 2, 3, 4),
    new Text("t", 1, 2, "hello"),
  ];
  const expected = [
    { x: 6, y: 9, width: 3, height: 4 },
    { cx: 6, cy: 9, r: 3 },
    { cx: 6, cy: 9, rx: 3, ry: 4 },
    { x1: 6, y1: 9, x2: 8, y2: 11 },
    { x: 6, y: 9 },
  ];
  const doc = new SvgDocument();
  for (const [index, shape] of shapes.entries()) {
    doc.add(shape);
    const before = shape.geometry;
    const command = new MoveCommand(shape.id, 5, 7);
    command.execute(doc);
    assert.deepEqual(shape.geometry, expected[index]);
    command.undo(doc);
    assert.deepEqual(shape.geometry, before);
  }
});

test("move of a nested group is one command and restores every descendant", () => {
  const rect = new Rect("r", 1, 2, 3, 4);
  const text = new Text("t", 5, 6, "开始");
  const inner = new Group("inner", [text]);
  const group = new Group("g", [rect, inner]);
  const doc = new SvgDocument();
  doc.add(group);
  const command = new MoveCommand("g", 10, -2);
  command.execute(doc);
  assert.equal(rect.geometry.x, 11);
  assert.deepEqual(text.geometry, { x: 15, y: 4 });
  command.undo(doc);
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(text.geometry, { x: 5, y: 6 });
  assert.equal(doc.parentOf("t"), inner);
  command.execute(doc);
  assert.deepEqual(text.geometry, { x: 15, y: 4 });
});

test("failed group move leaves all descendants unchanged", () => {
  const rect = new Rect("r", 1, 2, 3, 4);
  const large = new Circle("large", Number.MAX_VALUE, 0, 1);
  const group = new Group("g", [rect, large]);
  const doc = new SvgDocument();
  doc.add(group);
  const command = new MoveCommand("g", Number.MAX_VALUE, 0);
  assert.throws(() => command.execute(doc), /invalid number/);
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(large.geometry.cx, Number.MAX_VALUE);
  assert.throws(() => command.undo(doc), /not executed/);
});

test("move rejects missing ids and non-finite deltas without changing the tree", () => {
  const doc = new SvgDocument();
  const rect = new Rect("r", 1, 2, 3, 4);
  doc.add(rect);
  assert.throws(() => new MoveCommand("missing", 1, 2).execute(doc), /no such shape/);
  assert.throws(() => new MoveCommand("r", Number.NaN, 2).execute(doc), /invalid number/);
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(doc.children, [rect]);
});
