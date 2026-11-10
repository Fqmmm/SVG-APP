import assert from "node:assert/strict";
import { test } from "node:test";
import { Rect, Text } from "../../src/extensions/index.js";

test("public rectangle and text models can be used without activating a plugin", () => {
  assert.deepEqual(new Rect("r", 1, 2, 3, 4).geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(new Text("t", 1, 2, "title").content, "title");
});
