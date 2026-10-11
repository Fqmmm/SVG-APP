import assert from "node:assert/strict";
import { test } from "node:test";
import { ScaleCommand } from "../../src/application/ScaleCommand.js";
import { CommandHistory } from "../../src/application/CommandHistory.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Rect } from "../../src/domain/Rect.js";
import { Circle } from "../../src/domain/Circle.js";
import { Ellipse } from "../../src/domain/Ellipse.js";
import { Line } from "../../src/domain/Line.js";
import { Text } from "../../src/domain/Text.js";
import { Group } from "../../src/domain/Group.js";

test("scale multiplies all five leaf geometries while preserving styles and text", () => {
  const shapes = [
    new Rect("r", 1, 2, 3, 4, "blue"), new Circle("c", 1, 2, 3),
    new Ellipse("e", 1, 2, 3, 4), new Line("l", 1, 2, 3, 4),
    new Text("t", 1, 2, "开始"),
  ];
  const expected = [
    { x: 2, y: 4, width: 6, height: 8 }, { cx: 2, cy: 4, r: 6 },
    { cx: 2, cy: 4, rx: 6, ry: 8 }, { x1: 2, y1: 4, x2: 6, y2: 8 },
    { x: 2, y: 4 },
  ];
  const doc = new SvgDocument();
  for (const [index, shape] of shapes.entries()) {
    shape.set("stroke-width", 2);
    doc.add(shape);
    const command = new ScaleCommand(shape.id, 2);
    const before = shape.geometry;
    command.execute(doc);
    assert.deepEqual(shape.geometry, expected[index]);
    assert.equal(shape.styles["stroke-width"], 2);
    command.undo(doc);
    assert.deepEqual(shape.geometry, before);
    command.execute(doc);
    assert.deepEqual(shape.geometry, expected[index]);
  }
  assert.deepEqual(shapes[0]!.styles, { fill: "blue", "stroke-width": 2 });
  assert.equal((shapes[4] as Text).content, "开始");
});

test("nested group scaling is one history unit and remains exact over ten replays", () => {
  const rect = new Rect("r", 0.1, 0.2, 3, 4);
  const text = new Text("t", 0.3, 0.4, "unchanged");
  const inner = new Group("inner", [text]);
  const group = new Group("g", [rect, inner]);
  const doc = new SvgDocument();
  doc.add(group);
  const history = new CommandHistory(doc);
  history.execute(new ScaleCommand("g", 0.3));
  for (let round = 0; round < 10; round += 1) {
    assert.deepEqual(rect.geometry, { x: 0.1 * 0.3, y: 0.2 * 0.3, width: 3 * 0.3, height: 4 * 0.3 });
    assert.deepEqual(text.geometry, { x: 0.3 * 0.3, y: 0.4 * 0.3 });
    assert.equal(history.undoCount, 1);
    history.undo();
    assert.deepEqual(rect.geometry, { x: 0.1, y: 0.2, width: 3, height: 4 });
    assert.deepEqual(text.geometry, { x: 0.3, y: 0.4 });
    history.redo();
  }
  assert.equal(doc.parentOf("t"), inner);
  assert.equal(doc.indexOf("r"), 0);
  assert.equal(text.content, "unchanged");
});

test("invalid factors and absent ids fail without changing geometry or command state", () => {
  const doc = new SvgDocument();
  const rect = new Rect("r", 1, 2, 3, 4);
  doc.add(rect);
  for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const command = new ScaleCommand("r", factor);
    assert.throws(() => command.execute(doc), { message: "scale factor must be positive" });
    assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
    assert.throws(() => command.undo(doc), /not executed/);
  }
  assert.throws(() => new ScaleCommand("absent", 2).execute(doc), /no such shape: absent/);
});

test("overflow rolls back earlier descendants and preserves the redo branch", () => {
  const rect = new Rect("r", 1, 2, 3, 4);
  const large = new Circle("large", Number.MAX_VALUE, 0, 1);
  const group = new Group("g", [rect, large]);
  const doc = new SvgDocument();
  doc.add(group);
  const history = new CommandHistory(doc);
  history.execute(new ScaleCommand("r", 2));
  history.undo();
  assert.throws(() => history.execute(new ScaleCommand("g", 2)), /invalid number/);
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(large.geometry.cx, Number.MAX_VALUE);
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 1);
  history.redo();
  assert.deepEqual(rect.geometry, { x: 2, y: 4, width: 6, height: 8 });
});

test("scale snapshots refuse to restore onto a replacement with the same id", () => {
  const doc = new SvgDocument();
  const original = new Rect("r", 1, 2, 3, 4);
  doc.add(original);
  const command = new ScaleCommand("r", 2);
  command.execute(doc);
  doc.remove("r");
  const replacement = new Rect("r", 10, 20, 30, 40);
  doc.add(replacement);
  assert.throws(() => command.undo(doc), /command target changed: r/);
  assert.deepEqual(replacement.geometry, { x: 10, y: 20, width: 30, height: 40 });
  doc.remove("r");
  doc.add(original);
  command.undo(doc);
  assert.deepEqual(original.geometry, { x: 1, y: 2, width: 3, height: 4 });
});
