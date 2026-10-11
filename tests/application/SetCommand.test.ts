import assert from "node:assert/strict";
import { test } from "node:test";
import type { Shape } from "../../src/domain/Shape.js";
import { SetCommand } from "../../src/application/SetCommand.js";
import { ScaleCommand } from "../../src/application/ScaleCommand.js";
import { MoveCommand } from "../../src/application/MoveCommand.js";
import { DeleteCommand } from "../../src/application/DeleteCommand.js";
import { CommandHistory } from "../../src/application/CommandHistory.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Rect } from "../../src/domain/Rect.js";
import { Circle } from "../../src/domain/Circle.js";
import { Ellipse } from "../../src/domain/Ellipse.js";
import { Line } from "../../src/domain/Line.js";
import { Text } from "../../src/domain/Text.js";
import { Group } from "../../src/domain/Group.js";

test("set accepts every leaf geometry key and restores exact original values", () => {
  const shapes: Shape[] = [
    new Rect("r", 1, 2, 3, 4), new Circle("c", 1, 2, 3),
    new Ellipse("e", 1, 2, 3, 4), new Line("l", 1, 2, 3, 4),
    new Text("t", 1, 2, "original"),
  ];
  const doc = new SvgDocument();
  for (const shape of shapes) {
    doc.add(shape);
    for (const key of Object.keys(shape.geometry)) {
      const before = shape.geometry;
      const command = new SetCommand(shape.id, key, "7.5e1");
      command.execute(doc);
      assert.deepEqual(shape.geometry, { ...before, [key]: 75 });
      command.undo(doc);
      assert.deepEqual(shape.geometry, before);
      command.execute(doc);
      assert.equal(shape.geometry[key], 75);
      command.undo(doc);
    }
  }
});

test("set restores both omitted and explicit styles on every shape type", () => {
  const shapes: Shape[] = [
    new Rect("r", 0, 0, 1, 1), new Circle("c", 0, 0, 1),
    new Ellipse("e", 0, 0, 1, 1), new Line("l", 0, 0, 1, 1),
    new Text("t", 0, 0, ""), new Group("g"),
  ];
  const doc = new SvgDocument();
  for (const shape of shapes) {
    doc.add(shape);
    for (const [attribute, value] of [["fill", "red"], ["stroke", "blue"], ["stroke-width", "2"]] as const) {
      const command = new SetCommand(shape.id, attribute, value);
      command.execute(doc);
      assert.equal(shape.styles[attribute], attribute === "stroke-width" ? 2 : value);
      command.undo(doc);
      assert.equal(Object.hasOwn(shape.styles, attribute), false);
      command.execute(doc);
      const oldValue = shape.styles[attribute];
      const update = new SetCommand(shape.id, attribute, attribute === "stroke-width" ? 3 : "green");
      update.execute(doc);
      update.undo(doc);
      assert.equal(shape.styles[attribute], oldValue);
    }
  }
});

test("set text preserves Chinese, whitespace, quotes and empty content through history", () => {
  const text = new Text("t", 0.1, 0.2, "开始");
  const doc = new SvgDocument();
  doc.add(text);
  const history = new CommandHistory(doc);
  history.execute(new SetCommand("t", "text", ' new "内容" # '));
  assert.equal(text.content, ' new "内容" # ');
  history.execute(new SetCommand("t", "text", ""));
  assert.equal(text.content, "");
  history.undo();
  assert.equal(text.content, ' new "内容" # ');
  history.undo();
  assert.equal(text.content, "开始");
  history.redo();
  history.redo();
  assert.equal(text.content, "");
  assert.deepEqual(text.geometry, { x: 0.1, y: 0.2 });
});

test("group set stores its own style and leaves descendants and structure unchanged", () => {
  const explicit = new Rect("explicit", 1, 2, 3, 4, "blue");
  const inherited = new Rect("inherited", 1, 2, 3, 4);
  const inner = new Group("inner", [inherited]);
  const group = new Group("g", [explicit, inner]);
  const doc = new SvgDocument();
  doc.add(group);
  const history = new CommandHistory(doc);
  history.execute(new SetCommand("g", "fill", "red"));
  assert.deepEqual(group.styles, { fill: "red" });
  assert.deepEqual(explicit.styles, { fill: "blue" });
  assert.deepEqual(inherited.styles, {});
  history.undo();
  assert.deepEqual(group.styles, {});
  history.redo();
  assert.deepEqual(group.styles, { fill: "red" });
  assert.deepEqual(group.children, [explicit, inner]);
  assert.equal(doc.parentOf("inherited"), inner);
});

test("set rejects attributes outside each type whitelist, invalid values and absent ids", () => {
  const shapes: Shape[] = [
    new Rect("r", 1, 2, 3, 4), new Circle("c", 1, 2, 3),
    new Ellipse("e", 1, 2, 3, 4), new Line("l", 1, 2, 3, 4),
    new Text("t", 1, 2, "original"), new Group("g"),
  ];
  const doc = new SvgDocument();
  for (const shape of shapes) {
    doc.add(shape);
    const before = shape.geometry;
    for (const attribute of ["id", "transform", "font-size", "unknown"]) {
      assert.throws(() => new SetCommand(shape.id, attribute, "1").execute(doc), {
        message: "unknown attribute: " + attribute,
      });
    }
    assert.throws(() => new SetCommand(shape.id, "stroke-width", "-1").execute(doc), /non-negative/);
    assert.throws(() => new SetCommand(shape.id, "fill", 123).execute(doc), /must be text/);
    assert.deepEqual(shape.geometry, before);
    assert.deepEqual(shape.styles, {});
  }
  assert.throws(() => new SetCommand("g", "x", "1").execute(doc), /unknown attribute: x/);
  assert.throws(() => new SetCommand("r", "r", "1").execute(doc), /unknown attribute: r/);
  assert.throws(() => new SetCommand("t", "text", 123).execute(doc), /must be text/);
  assert.throws(() => new SetCommand("r", "width", "-1").execute(doc), /non-negative/);
  assert.throws(() => new SetCommand("r", "x", "Infinity").execute(doc), /invalid number/);
  assert.throws(() => new SetCommand("absent", "fill", "red").execute(doc), /no such shape/);
});

test("failed set keeps both history stacks and redo remains usable", () => {
  const rect = new Rect("r", 1, 2, 3, 4);
  const doc = new SvgDocument();
  doc.add(rect);
  const history = new CommandHistory(doc);
  history.execute(new SetCommand("r", "fill", "red"));
  history.execute(new SetCommand("r", "width", "8"));
  history.undo();
  assert.throws(() => history.execute(new SetCommand("r", "height", "-1")), /non-negative/);
  assert.equal(history.undoCount, 1);
  assert.equal(history.redoCount, 1);
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(rect.styles, { fill: "red" });
  history.redo();
  assert.equal(rect.geometry.width, 8);
});

test("mixed move, scale, set and delete history restores exact state and missing styles", () => {
  const rect = new Rect("r", 0.1, 0.2, 3, 4);
  const doc = new SvgDocument();
  doc.add(rect);
  const history = new CommandHistory(doc);
  history.execute(new MoveCommand("r", 0.2, 0.3));
  history.execute(new ScaleCommand("r", 0.3));
  history.execute(new SetCommand("r", "fill", "red"));
  const final = rect.geometry;
  history.execute(new DeleteCommand("r"));
  for (let index = 0; index < 4; index += 1) history.undo();
  assert.deepEqual(rect.geometry, { x: 0.1, y: 0.2, width: 3, height: 4 });
  assert.deepEqual(rect.styles, {});
  for (let index = 0; index < 4; index += 1) history.redo();
  assert.equal(doc.find("r"), undefined);
  history.undo();
  assert.equal(doc.get("r"), rect);
  assert.deepEqual(rect.geometry, final);
  assert.deepEqual(rect.styles, { fill: "red" });
});
