import assert from "node:assert/strict";
import { test } from "node:test";
import { Text } from "../../src/domain/Text.js";
import { ShapeFactory } from "../../src/application/ShapeFactory.js";
import { SvgShapeReader } from "../../src/infrastructure/SvgShapeReader.js";

const factory = new ShapeFactory();

test("CLI geometry and SVG px attributes construct identical shapes through separate inputs", () => {
  const reader = new SvgShapeReader(factory);
  const fromCli = factory.create("rect", "r", ["-1.5e2", ".5", "0", "2.", "blue"]);
  const fromSvg = reader.read("rect", "r", new Map([
    ["x", " -1.5e2px "], ["y", ".5px"], ["width", "0"], ["height", "2."], ["fill", "blue"],
  ]), "");
  assert.deepEqual(fromSvg.geometry, fromCli.geometry);
  assert.deepEqual(fromSvg.styles, fromCli.styles);
  assert.throws(() => factory.create("rect", "r", ["1px", "2", "3", "4"]), /invalid number: x/);
});

test("SVG reader preserves ellipse defaults and text whitespace without CLI argument parsing", () => {
  const reader = new SvgShapeReader(factory);
  assert.deepEqual(reader.read("ellipse", "e", new Map([["ry", "3px"]]), "").geometry, { cx: 0, cy: 0, rx: 3, ry: 3 });
  const text = reader.read("text", "t", new Map(), "  in  ");
  assert.ok(text instanceof Text);
  assert.equal(text.content, "  in  ");
  assert.throws(() => reader.read("rect", "r", new Map(), "extra"), /unexpected text/);
  assert.throws(() => reader.read("text", "t", new Map([["text", "override"]]), "original"), /unknown attribute: text/);
});
