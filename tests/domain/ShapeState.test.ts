import assert from "node:assert/strict";
import { test } from "node:test";
import { Rect } from "../../src/domain/Rect.js";

test("captured state rejects replacement of its restore method and remains reusable", () => {
  const rect = new Rect("r", 0.1, 0.2, 3, 4);
  const state = rect.captureState();
  assert.throws(() => Object.assign(state, {
    restore: () => {
    }
  }), TypeError);
  assert.equal(Object.isFrozen(state), true);

  for (let round = 0; round < 2; round += 1) {
    rect.move(10, 20);
    rect.set("fill", "red");
    state.restore();
    assert.deepEqual(rect.geometry, { x: 0.1, y: 0.2, width: 3, height: 4 });
    assert.deepEqual(rect.styles, {});
  }
});
