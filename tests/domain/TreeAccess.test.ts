import assert from "node:assert/strict";
import { test } from "node:test";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/Rect.js";
import type { Shape } from "../../src/domain/Shape.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import * as treeAccess from "../../src/domain/TreeAccess.js";

interface WriteAccess {
  replaceChildren(children: readonly Shape[]): void;
  release(): void;
}

// Probe exported hooks rather than assuming that renaming the old symbol is a fix.
function acquire(group: Group): WriteAccess {
  const symbols = Object.values(treeAccess).filter(value => typeof value === "symbol");
  assert.equal(symbols.length, 1);
  const key = symbols[0];
  assert.notEqual(key, undefined);
  return Reflect.apply(Reflect.get(group, key!), group, []) as WriteAccess;
}

test("exported tree hooks cannot replace children or grant access to an attached group", () => {
  const rect = new Rect("r", 0, 0, 1, 1);
  const inner = new Group("inner", [rect]);
  const group = new Group("g", [inner]);
  const doc = new SvgDocument();
  doc.add(group);

  for (const target of [group, inner]) {
    for (const key of Object.values(treeAccess)) {
      if (typeof key !== "symbol") continue;
      for (const argumentsList of [[[]], [], [doc, []], [{}, []]]) {
        assert.throws(
          () => Reflect.apply(Reflect.get(target, key), target, argumentsList),
          /claimed|permission|denied/u,
        );
      }
    }
  }
  assert.deepEqual(group.children, [inner]);
  assert.deepEqual(inner.children, [rect]);
  assert.equal(doc.find("r"), rect);
  assert.equal(doc.parentOf("r"), inner);
  assert.equal(doc.indexOf("r"), 0);
  assert.equal(doc.indexOf("inner"), 0);
});

test("released access cannot write or revoke a subsequent document claim", () => {
  const rect = new Rect("r", 0, 0, 1, 1);
  const group = new Group("g", [rect]);
  const access = acquire(group);
  const doc = new SvgDocument();

  assert.throws(() => doc.add(group), /claimed/u);
  assert.equal(doc.find("g"), undefined);
  assert.equal(doc.find("r"), undefined);
  assert.deepEqual(doc.children, []);

  access.release();
  doc.add(group);
  assert.throws(() => access.replaceChildren([]), /revoked/u);
  assert.throws(() => access.release(), /revoked/u);
  assert.deepEqual(group.children, [rect]);
  assert.equal(doc.find("r"), rect);
  assert.equal(doc.indexOf("r"), 0);
});

test("failed subtree acquisition releases earlier claims before a later retry", () => {
  const unlocked = new Group("unlocked");
  const locked = new Group("locked");
  const incoming = new Group("incoming", [unlocked, locked]);
  const foreignAccess = acquire(locked);
  const doc = new SvgDocument();

  assert.throws(() => doc.add(incoming), /claimed/u);
  assert.deepEqual(doc.children, []);
  for (const id of ["incoming", "unlocked", "locked"]) {
    assert.equal(doc.find(id), undefined);
  }

  foreignAccess.release();
  doc.add(incoming);
  assert.equal(doc.get("incoming"), incoming);
  assert.equal(doc.parentOf("unlocked"), incoming);
  assert.equal(doc.parentOf("locked"), incoming);
  const rect = new Rect("r", 0, 0, 1, 1);
  doc.add(rect, "unlocked");
  assert.equal(doc.indexOf("r"), 0);

  doc.remove("incoming");
  const other = new SvgDocument();
  other.add(incoming);
  assert.equal(doc.find("r"), undefined);
  assert.equal(other.find("r"), rect);
  assert.equal(other.indexOf("r"), 0);
});
