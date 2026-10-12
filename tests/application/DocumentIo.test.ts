import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorSession } from "../../src/application/EditorSession.js";
import type { DocumentRepository } from "../../src/application/DocumentRepository.js";
import type { DocumentReadResult } from "../../src/application/DocumentReadResult.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Rect } from "../../src/domain/Rect.js";
import { CreateCommand } from "../../src/application/CreateCommand.js";

class MemoryRepository implements DocumentRepository {
  failure = false;
  readonly reads: string[] = [];
  readonly writes: string[] = [];
  readonly incoming = new SvgDocument(40, 20);

  read(path: string): DocumentReadResult {
    if (this.failure) {
      throw new Error("cannot read file: " + path);
    }
    this.reads.push(path);
    return { document: this.incoming, warnings: ["warning: example"] };
  }

  write(path: string, _document: SvgDocument): void {
    if (this.failure) {
      throw new Error("cannot write file: " + path);
    }
    this.writes.push(path);
  }
}

test("read replaces the active document and establishes a barrier only on success", () => {
  const repository = new MemoryRepository();
  const session = new EditorSession(repository);
  assert.deepEqual(session.read("input.svg").warnings, ["warning: example"]);
  assert.equal(session.document, repository.incoming);
  assert.equal(session.path, "input.svg");
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  session.execute(new CreateCommand(new Rect("r", 0, 0, 1, 1)));
  session.undo();
  repository.failure = true;
  assert.throws(() => session.read("bad.svg"), /cannot read file/);
  assert.equal(session.document, repository.incoming);
  assert.equal(session.path, "input.svg");
  session.redo();
  assert.equal(session.document.get("r").id, "r");
});

test("save uses the last successful read or save path and successful save blocks undo", () => {
  const repository = new MemoryRepository();
  const session = new EditorSession(repository);
  session.read("input.svg");
  session.execute(new CreateCommand(new Rect("r", 0, 0, 1, 1)));
  session.save();
  assert.deepEqual(repository.writes, ["input.svg"]);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  session.save("other.svg"); session.save();
  assert.deepEqual(repository.writes, ["input.svg", "other.svg", "other.svg"]);
  assert.equal(session.path, "other.svg");
});

test("failed save preserves the default path and redo stack; initialize resets the path", () => {
  const repository = new MemoryRepository();
  const session = new EditorSession(repository);
  session.read("input.svg");
  session.execute(new CreateCommand(new Rect("r", 0, 0, 1, 1)));
  session.undo();
  repository.failure = true;
  assert.throws(() => session.save("bad.svg"));
  assert.equal(session.path, "input.svg");
  session.redo();
  assert.equal(session.document.get("r").id, "r");
  session.initialize();
  assert.equal(session.path, undefined);
  assert.throws(() => session.save(), /no file path/);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
});

test("canvas changes create a barrier, invalid dimensions preserve document and redo", () => {
  const session = new EditorSession();
  session.initialize(80, 60);
  session.execute(new CreateCommand(new Rect("r", 1, 2, 3, 4)));
  session.undo();
  assert.throws(() => session.resize(0, 20));
  assert.equal(session.document.width, 80);
  session.redo();
  session.resize(100, 200);
  assert.equal(session.document.width, 100);
  assert.equal(session.document.height, 200);
  assert.deepEqual(session.document.get("r").geometry, { x: 1, y: 2, width: 3, height: 4 });
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  assert.throws(() => session.redo(), /undo not allowed after io command/);
});

test("file commands reject blank paths and missing documents without modifying session state", () => {
  const repository = new MemoryRepository();
  const session = new EditorSession(repository);
  assert.throws(() => session.save("out.svg"), /no document/);
  assert.throws(() => session.resize(10, 20), /no document/);
  assert.throws(() => session.read(""), /invalid file path/);
  session.initialize();
  assert.throws(() => session.save(" "), /invalid file path/);
  assert.deepEqual(repository.reads, []);
  assert.deepEqual(repository.writes, []);
});
