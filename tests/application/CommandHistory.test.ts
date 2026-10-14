import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandHistory } from "../../src/application/CommandHistory.js";
import { CreateCommand } from "../../src/application/CreateCommand.js";
import { MoveCommand } from "../../src/application/MoveCommand.js";
import { DeleteCommand } from "../../src/application/DeleteCommand.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Rect } from "../../src/domain/Rect.js";
import { Group } from "../../src/domain/Group.js";

test("history undoes in reverse execution order and redoes in forward order", () => {
  const doc = new SvgDocument();
  const history = new CommandHistory(doc);
  const rect = new Rect("r", 1, 2, 3, 4);
  const create = new CreateCommand(rect);
  const move = new MoveCommand("r", 10, 20);
  history.execute(create);
  history.execute(move);
  assert.equal(history.undoCount, 2);
  assert.equal(history.redoCount, 0);
  assert.equal(history.undo(), move);
  assert.equal(rect.geometry.x, 1);
  assert.equal(history.undo(), create);
  assert.equal(doc.find("r"), undefined);
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 2);
  assert.equal(history.redo(), create);
  assert.equal(history.redo(), move);
  assert.equal(doc.get("r"), rect);
  assert.equal(rect.geometry.x, 11);
  assert.equal(history.undoCount, 2);
  assert.equal(history.redoCount, 0);
});

test("a successful new edit discards the redo branch", () => {
  const doc = new SvgDocument();
  const history = new CommandHistory(doc);
  history.execute(new CreateCommand(new Rect("a", 0, 0, 1, 1)));
  history.undo();
  history.execute(new CreateCommand(new Rect("b", 0, 0, 1, 1)));
  assert.equal(history.redoCount, 0);
  assert.throws(() => history.redo(), /nothing to redo/);
  assert.equal(doc.find("a"), undefined);
  assert.equal(doc.get("b").id, "b");
});

test("failed new edits preserve both history stacks and allow the previous redo", () => {
  const doc = new SvgDocument();
  const history = new CommandHistory(doc);
  const rect = new Rect("r", 1, 2, 3, 4);
  history.execute(new CreateCommand(rect));
  history.execute(new MoveCommand("r", 10, 20));
  history.undo();
  assert.throws(
    () => history.execute(new CreateCommand(new Rect("r", 0, 0, 1, 1))),
    /id already exists/,
  );
  assert.throws(() => history.execute(new MoveCommand("missing", 1, 2)), /no such shape/);
  assert.equal(history.undoCount, 1);
  assert.equal(history.redoCount, 1);
  assert.deepEqual(rect.geometry, { x: 1, y: 2, width: 3, height: 4 });
  history.redo();
  assert.equal(rect.geometry.x, 11);
});

test("failed undo keeps its command available until the conflict is resolved", () => {
  const doc = new SvgDocument();
  const history = new CommandHistory(doc);
  const rect = new Rect("r", 1, 2, 3, 4);
  doc.add(rect);
  history.execute(new DeleteCommand("r"));
  const conflict = new Rect("r", 0, 0, 1, 1);
  doc.add(conflict);
  assert.throws(() => history.undo(), /id already exists/);
  assert.equal(history.undoCount, 1);
  assert.equal(history.redoCount, 0);
  assert.equal(doc.get("r"), conflict);
  doc.remove("r");
  history.undo();
  assert.equal(doc.get("r"), rect);
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 1);
});

test("failed redo keeps its command available until the conflict is resolved", () => {
  const doc = new SvgDocument();
  const history = new CommandHistory(doc);
  const rect = new Rect("r", 1, 2, 3, 4);
  history.execute(new CreateCommand(rect));
  history.undo();
  const conflict = new Rect("r", 0, 0, 1, 1);
  doc.add(conflict);
  assert.throws(() => history.redo(), /id already exists/);
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 1);
  assert.equal(doc.get("r"), conflict);
  doc.remove("r");
  history.redo();
  assert.equal(doc.get("r"), rect);
});

test("a group move consumes one history unit and restores all children", () => {
  const a = new Rect("a", 1, 2, 3, 4);
  const b = new Rect("b", 5, 6, 7, 8);
  const doc = new SvgDocument();
  doc.add(new Group("g", [a, new Group("inner", [b])]));
  const history = new CommandHistory(doc);
  history.execute(new MoveCommand("g", 100, 200));
  assert.equal(history.undoCount, 1);
  history.undo();
  assert.equal(a.geometry.x, 1);
  assert.equal(b.geometry.x, 5);
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 1);
});

test("empty history reports errors without changing counts", () => {
  const history = new CommandHistory(new SvgDocument());
  assert.throws(() => history.undo(), /nothing to undo/);
  assert.throws(() => history.redo(), /nothing to redo/);
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 0);
});

test("io barrier clears old history and only a successful edit unlocks it", () => {
  const doc = new SvgDocument();
  const history = new CommandHistory(doc);
  history.execute(new CreateCommand(new Rect("r", 1, 2, 3, 4)));
  history.execute(new MoveCommand("r", 10, 0));
  history.undo();
  history.establishBarrier();
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 0);
  assert.throws(() => history.undo(), /^Error: undo not allowed after io command$/);
  assert.throws(() => history.redo(), /^Error: undo not allowed after io command$/);
  assert.throws(() => history.execute(new MoveCommand("missing", 1, 2)), /no such shape/);
  assert.throws(() => history.undo(), /not allowed after io command/);
  assert.equal(doc.get("r").geometry.x, 1);
  history.execute(new MoveCommand("r", 5, 0));
  history.undo();
  assert.equal(doc.get("r").geometry.x, 1);
  assert.throws(() => history.undo(), /nothing to undo/);
  history.redo();
  assert.equal(doc.get("r").geometry.x, 6);
});

test("history refuses to record the same command object twice", () => {
  const doc = new SvgDocument();
  const history = new CommandHistory(doc);
  const command = new CreateCommand(new Rect("r", 1, 2, 3, 4));
  history.execute(command);
  history.undo();
  assert.throws(() => history.execute(command), /already recorded/);
  assert.equal(history.undoCount, 0);
  assert.equal(history.redoCount, 1);
  history.redo();
  assert.equal(doc.get("r").id, "r");
});

test("mixed create, move and delete history restores exact positions and values", () => {
  const a = new Rect("a", 0, 0, 1, 1);
  const b = new Rect("b", 0.1, 0.2, 3, 4);
  const group = new Group("g", [a]);
  const doc = new SvgDocument();
  doc.add(group);
  const history = new CommandHistory(doc);
  history.execute(new CreateCommand(b, "g"));
  history.execute(new MoveCommand("g", 0.2, 0.3));
  history.execute(new DeleteCommand("b"));
  history.undo();
  assert.deepEqual(group.children, [a, b]);
  history.undo();
  assert.deepEqual(b.geometry, { x: 0.1, y: 0.2, width: 3, height: 4 });
  history.undo();
  assert.deepEqual(group.children, [a]);
  for (let index = 0; index < 3; index += 1) history.redo();
  assert.deepEqual(group.children, [a]);
  assert.equal(doc.find("b"), undefined);
  assert.equal(a.geometry.x, 0.2);
});

test("history preserves exact floating-point coordinates over ten undo/redo cycles", () => {
  const doc = new SvgDocument();
  const rect = new Rect("r", 0.1, 0.2, 3, 4);
  doc.add(rect);
  const history = new CommandHistory(doc);
  const before = rect.geometry;
  history.execute(new MoveCommand("r", 0.2, 0.1));
  const after = { x: 0.1 + 0.2, y: 0.2 + 0.1, width: 3, height: 4 };
  assert.deepEqual(rect.geometry, after);

  for (let round = 0; round < 10; round += 1) {
    history.undo();
    assert.deepEqual(rect.geometry, before);
    assert.equal(history.undoCount, 0);
    assert.equal(history.redoCount, 1);
    history.redo();
    assert.deepEqual(rect.geometry, after);
    assert.equal(history.undoCount, 1);
    assert.equal(history.redoCount, 0);
  }
});

test("history redoes a nested group move exactly once per descendant", () => {
  const a = new Rect("a", 0.1, 0.2, 3, 4);
  const b = new Rect("b", 0.3, 0.4, 5, 6);
  const inner = new Group("inner", [b]);
  const group = new Group("g", [a, inner]);
  const doc = new SvgDocument();
  doc.add(group);
  const history = new CommandHistory(doc);
  const beforeA = a.geometry;
  const beforeB = b.geometry;
  const afterA = { x: 0.1 + 0.2, y: 0.2 + 0.3, width: 3, height: 4 };
  const afterB = { x: 0.3 + 0.2, y: 0.4 + 0.3, width: 5, height: 6 };
  history.execute(new MoveCommand("g", 0.2, 0.3));
  assert.deepEqual(a.geometry, afterA);
  assert.deepEqual(b.geometry, afterB);

  for (let round = 0; round < 10; round += 1) {
    history.undo();
    assert.deepEqual(a.geometry, beforeA);
    assert.deepEqual(b.geometry, beforeB);
    history.redo();
    assert.deepEqual(a.geometry, afterA);
    assert.deepEqual(b.geometry, afterB);
    assert.equal(history.undoCount, 1);
    assert.equal(history.redoCount, 0);
    assert.deepEqual(group.children, [a, inner]);
    assert.deepEqual(inner.children, [b]);
    assert.equal(doc.parentOf("b"), inner);
    assert.equal(doc.indexOf("b"), 0);
  }
});
