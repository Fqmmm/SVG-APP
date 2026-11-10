import assert from "node:assert/strict";
import { test } from "node:test";
import { DocumentSnapshot, SvgDocument, Rect, Text, Group } from "../../src/extensions/index.js";

function snapshot(document: SvgDocument): DocumentSnapshot {
  return new DocumentSnapshot(document, shape => {
    return shape instanceof Text ? shape.content : undefined;
  });
}

test("content snapshots include text, styles, geometry and descendants but ignore attribute insertion order", () => {
  const document = new SvgDocument();
  const text = new Text("t", 1, 2, "before");
  const frame = new Rect("r", 1, 2, 3, 4);
  const group = new Group("g", [text, frame]);
  document.add(group);
  const before = snapshot(document);
  text.set("text", "after");
  const edited = snapshot(document);
  assert.equal(edited.same(before, "t"), false);
  assert.equal(edited.same(before, "g"), false);
  assert.equal(edited.same(before, "r"), true);
  assert.equal(edited.same(before), false);
  text.set("text", "before");
  assert.equal(snapshot(document).same(before), true);
  frame.set("stroke", "black");
  frame.set("fill", "red");
  const styled = snapshot(document);
  const other = new SvgDocument();
  const sameFrame = new Rect("r", 1, 2, 3, 4, "red");
  sameFrame.set("stroke", "black");
  other.add(new Group("g", [new Text("t", 1, 2, "before"), sameFrame]));
  assert.equal(snapshot(other).same(styled), true);
  frame.move(1, 0);
  assert.equal(snapshot(document).same(styled, "r"), false);
});

test("snapshots track parent membership, sibling order, deletion and canvas dimensions", () => {
  const document = new SvgDocument();
  document.add(new Group("a", [new Rect("r", 0, 0, 1, 1), new Rect("s", 0, 0, 1, 1)]));
  document.add(new Group("b"));
  const original = snapshot(document);
  document.reparent("r", "a", 1);
  assert.equal(snapshot(document).same(original, "a"), false);
  assert.equal(snapshot(document).same(original, "r"), true);
  const beforeMove = snapshot(document);
  document.reparent("r", "b");
  assert.equal(snapshot(document).same(beforeMove, "r"), false);
  assert.equal(snapshot(document).same(beforeMove, "b"), false);
  assert.equal(snapshot(document).same(beforeMove, "a"), false);
  const beforeDelete = snapshot(document);
  document.remove("r");
  assert.equal(snapshot(document).same(beforeDelete, "b"), false);
  const beforeResize = snapshot(document);
  document.resize(500, 400);
  assert.equal(snapshot(document).same(beforeResize), false);
  assert.equal(snapshot(document).same(beforeResize, "s"), true);
});

test("geometry insertion order does not affect equality and unknown IDs do not compare equal", () => {
  class ReorderedRect extends Rect {
    override get geometry() {
      const values = super.geometry;
      return { height: values.height, width: values.width, y: values.y, x: values.x };
    }
  }
  const a = new SvgDocument();
  const b = new SvgDocument();
  a.add(new Rect("r", 1, 2, 3, 4));
  b.add(new ReorderedRect("r", 1, 2, 3, 4));
  assert.equal(snapshot(a).same(snapshot(b)), true);
  assert.equal(snapshot(a).same(snapshot(b), "missing"), false);
});
