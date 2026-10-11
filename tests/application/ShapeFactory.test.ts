import assert from "node:assert/strict";
import { test } from "node:test";
import { ShapeFactory } from "../../src/application/ShapeFactory.js";

test("factory creates all six built-in shapes with validated geometry", () => {
  const factory = new ShapeFactory();
  const shapes = [
    factory.create("rect", "r", ["1", "2", "3", "4", "blue"]),
    factory.create("circle", "c", ["1", "2", "3", "red"]),
    factory.create("ellipse", "e", ["1", "2", "3", "4"]),
    factory.create("line", "l", ["1", "2", "3", "4", "black"]),
    factory.create("text", "t", ["1", "2", "开始"]),
    factory.create("g", "g", []),
  ];
  assert.deepEqual(shapes.map(shape => shape.type), ["rect", "circle", "ellipse", "line", "text", "g"]);
  assert.deepEqual(shapes[0]!.geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.deepEqual(shapes[1]!.styles, { fill: "red" });
  assert.deepEqual(shapes[2]!.geometry, { cx: 1, cy: 2, rx: 3, ry: 4 });
  assert.deepEqual(shapes[3]!.styles, { stroke: "black" });
  assert.deepEqual(shapes[4]!.geometry, { x: 1, y: 2 });
  assert.deepEqual(shapes[5]!.children, []);
});
test("factory preserves omitted styles and accepts decimal scientific notation", () => {
  const rect = new ShapeFactory().create("rect", "r", ["-1.5e2", ".5", "0", "2."]);
  assert.deepEqual(rect.geometry, { x: -150, y: 0.5, width: 0, height: 2 });
  assert.deepEqual(rect.styles, {});
});
test("factory rejects unknown, inherited property names and future plugin types", () => {
  for (const type of ["box", "hexagon", "toString", "__proto__", "Rect"]) {
    assert.throws(() => new ShapeFactory().create(type, "id", []), {
      message: "unknown shape type: " + type + " (is the plugin loaded?)",
    });
  }
});
test("factory rejects incorrect counts for every type", () => {
  const factory = new ShapeFactory();
  for (const [type, valid] of [
    ["rect", ["0", "0", "1", "1"]],
    ["circle", ["0", "0", "1"]],
    ["ellipse", ["0", "0", "1", "1"]],
    ["line", ["0", "0", "1", "1"]],
    ["text", ["0", "0", "hello"]],
    ["g", []],
  ] as const) {
    if (valid.length > 0) assert.throws(() => factory.create(type, "id", valid.slice(0, -1)), /argument count/);
    assert.throws(() => factory.create(type, "id", [...valid, "extra", "extra"]), /argument count/);
  }
});
test("factory refuses malformed numbers, negative sizes and invalid ids", () => {
  const factory = new ShapeFactory();
  for (const value of ["NaN", "Infinity", "0x10", ""]) {
    assert.throws(() => factory.create("circle", "c", ["0", "0", value]), /invalid number/);
  }
  assert.throws(() => factory.create("ellipse", "e", ["0", "0", "-1", "2"]), /non-negative/);
  assert.throws(() => factory.create("g", "has space", []), /invalid id/);
});
