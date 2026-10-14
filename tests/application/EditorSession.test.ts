import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorSession } from "../../src/application/EditorSession.js";
import { CreateCommand } from "../../src/application/CreateCommand.js";
import { MoveCommand } from "../../src/application/MoveCommand.js";
import { Rect } from "../../src/domain/Rect.js";

test("session rejects document access and editing before initialization", () => {
  const session = new EditorSession();
  const expected = /no document\. use 'init' or 'read' first/;
  assert.throws(() => session.document, expected);
  assert.throws(() => session.execute(new MoveCommand("r", 1, 2)), expected);
  assert.throws(() => session.undo(), expected);
  assert.throws(() => session.redo(), expected);
  assert.throws(() => session.establishBarrier(), expected);
});

test("initialization creates a default or explicitly sized document with an io barrier", () => {
  const session = new EditorSession();
  session.initialize();
  assert.equal(session.document.width, 800);
  assert.equal(session.document.height, 600);
  assert.throws(() => session.undo(), /not allowed after io command/);
  session.initialize(400, 200);
  assert.equal(session.document.width, 400);
  assert.equal(session.document.height, 200);
  assert.throws(() => session.redo(), /not allowed after io command/);
});

test("session coordinates edits, undo and redo while reads leave history alone", () => {
  const session = new EditorSession();
  session.initialize();
  const rect = new Rect("r", 1, 2, 3, 4);
  const create = new CreateCommand(rect);
  session.execute(create);
  assert.equal(session.document.get("r"), rect);
  assert.equal(session.undo(), create);
  assert.equal(session.document.find("r"), undefined);
  assert.equal(session.redo(), create);
  assert.equal(session.document.get("r"), rect);
});

test("failed initialization preserves the document and its existing redo branch", () => {
  const session = new EditorSession();
  session.initialize();
  const original = session.document;
  const rect = new Rect("r", 1, 2, 3, 4);
  session.execute(new CreateCommand(rect));
  session.execute(new MoveCommand("r", 10, 0));
  session.undo();
  assert.throws(() => session.initialize(0, 200), /positive/);
  assert.equal(session.document, original);
  session.redo();
  assert.equal(rect.geometry.x, 11);
});

test("reinitialization replaces the document and prevents commands leaking across documents", () => {
  const session = new EditorSession();
  session.initialize();
  const original = session.document;
  const command = new CreateCommand(new Rect("r", 1, 2, 3, 4));
  session.execute(command);
  session.undo();
  session.initialize(100, 200);
  assert.notEqual(session.document, original);
  assert.deepEqual(session.document.children, []);
  assert.throws(() => session.redo(), /not allowed after io command/);
  assert.throws(() => session.execute(command), /different document/);
  assert.deepEqual(session.document.children, []);
  assert.throws(() => session.undo(), /not allowed after io command/);
});

test("session barrier preserves the document but prevents crossing old edit history", () => {
  const session = new EditorSession();
  session.initialize();
  const rect = new Rect("r", 1, 2, 3, 4);
  session.execute(new CreateCommand(rect));
  session.establishBarrier();
  assert.equal(session.document.get("r"), rect);
  assert.throws(() => session.undo(), /not allowed after io command/);
  session.execute(new MoveCommand("r", 5, 0));
  session.undo();
  assert.equal(rect.geometry.x, 1);
  assert.throws(() => session.undo(), /nothing to undo/);
});
