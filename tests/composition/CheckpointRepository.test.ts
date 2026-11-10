import assert from "node:assert/strict";
import { test } from "node:test";
import { DocumentSnapshot, Framework, SvgDocument, ShapeViews, RegisteredShapeFactory, RegisteredTreeFormatter, Rect, EditorSession, CreateCommand, MoveCommand } from "../../src/extensions/index.js";
import { CheckpointRepository } from "../../src/composition/CheckpointRepository.js";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { createEditor } from "../../src/composition/createEditor.js";

// A fake repository verifies notification order without depending on a label plugin.
test("checkpoints are published only after successful reads and writes", () => {
  const framework = new Framework();
  const document = new SvgDocument();
  const observed: DocumentSnapshot[] = [];
  let fail = false;
  let wrote = false;
  framework.decorators.register({
    name: "observer",
    decorate() {
      return undefined;
    },
    checkpoint(target, content) {
      assert.equal(target, document);
      assert.ok(content instanceof DocumentSnapshot);
      if (observed.length === 1) {
        assert.equal(wrote, true);
      }
      observed.push(content);
    },
  });
  const source = {
    read() {
      if (fail) {
        throw new Error("read failed");
      }
      return { document, warnings: [] };
    },
    write() {
      if (fail) {
        throw new Error("write failed");
      }
      wrote = true;
    },
  };
  const repository = new CheckpointRepository(source, new ShapeViews(new RegisteredShapeFactory(framework.shapes)), framework.decorators);
  repository.read("input.svg");
  assert.equal(observed.length, 1);
  repository.write("output.svg", document);
  assert.equal(wrote, true);
  assert.equal(observed.length, 2);
  fail = true;
  assert.throws(() => repository.read("input.svg"), /read failed/);
  assert.throws(() => repository.write("output.svg", document), /write failed/);
  assert.equal(observed.length, 2);
});

test("tree decorators receive snapshots with content from registered provider text accessors", () => {
  const framework = createDefaultFramework();
  const seen: DocumentSnapshot[] = [];
  framework.decorators.register({
    name: "snapshot-reader",
    decorate(context) {
      assert.ok(context.snapshot instanceof DocumentSnapshot);
      seen.push(context.snapshot);
      return undefined;
    },
  });
  const editor = createEditor(framework);
  editor.dispatcher.dispatch("init");
  editor.dispatcher.dispatch('create text t 1 2 "before"');
  editor.dispatcher.dispatch("tree");
  assert.equal(seen.length, 2);
  assert.equal(seen[0], seen[1]);
  const before = seen[0]!;
  editor.dispatcher.dispatch('set t text "after"');
  editor.dispatcher.dispatch("tree t");
  assert.equal(seen[2]!.same(before, "t"), false);
});

test("one failed checkpoint reports its name and does not prevent later observers or successful I/O", () => {
  const framework = new Framework();
  const document = new SvgDocument();
  const reports: string[] = [];
  let healthyCalls = 0;
  framework.decorators.register({
    name: "broken",
    decorate() {
      return undefined;
    },
    checkpoint() {
      throw new Error("boom");
    },
  });
  framework.decorators.register({
    name: "healthy",
    decorate() {
      return undefined;
    },
    checkpoint() {
      healthyCalls += 1;
    },
  });
  const source = {
    read() {
      return { document, warnings: [] };
    },
    write() {
    },
  };
  const repository = new CheckpointRepository(source, new ShapeViews(new RegisteredShapeFactory(framework.shapes)),
    framework.decorators, message => {
      reports.push(message);
    });
  assert.doesNotThrow(() => repository.write("output.svg", document));
  assert.equal(repository.read("input.svg").document, document);
  assert.equal(healthyCalls, 2);
  assert.deepEqual(reports, ["error: checkpoint failed: broken", "error: checkpoint failed: broken"]);
});

test("even a failing diagnostic sink cannot turn committed I/O into a save failure", () => {
  const framework = new Framework();
  framework.decorators.register({
    name: "broken",
    decorate() {
      return undefined;
    },
    checkpoint() {
      throw new Error("boom");
    },
  });
  const repository = new CheckpointRepository({
    read() {
      return { document: new SvgDocument(), warnings: [] };
    },
    write() {
    },
  }, new ShapeViews(new RegisteredShapeFactory(framework.shapes)), framework.decorators, () => {
    throw new Error("diagnostic sink failed");
  });
  assert.doesNotThrow(() => repository.write("output.svg", new SvgDocument()));
  assert.doesNotThrow(() => repository.read("input.svg"));
});

class UnusedProjection extends ShapeViews {
  override snapshot(_document: SvgDocument): DocumentSnapshot {
    throw new Error("projection was requested");
  }
}

test("without checkpoint listeners the repository does not project document content", () => {
  const framework = new Framework();
  const document = new SvgDocument();
  const repository = new CheckpointRepository({
    read() {
      return { document, warnings: [] };
    },
    write() {
    },
  }, new UnusedProjection(new RegisteredShapeFactory(framework.shapes)), framework.decorators);
  assert.doesNotThrow(() => repository.read("input.svg"));
  assert.doesNotThrow(() => repository.write("output.svg", document));
});

test("tree snapshots are lazy even when a decorator only reads the shape", () => {
  const framework = createDefaultFramework();
  const document = new SvgDocument();
  document.add(new Rect("r", 1, 2, 3, 4));
  const formatter = new RegisteredTreeFormatter(new UnusedProjection(new RegisteredShapeFactory(framework.shapes)), framework.decorators);
  assert.doesNotThrow(() => formatter.document(document));
  framework.decorators.register({
    name: "plain",
    decorate(context) {
      return context.shape === undefined ? undefined : "(plain)";
    },
  });
  assert.match(formatter.document(document), /rect#r.*\(plain\)/);
  framework.decorators.register({
    name: "snapshot-user",
    decorate(context) {
      void context.snapshot;
      return undefined;
    },
  });
  assert.throws(() => formatter.document(document), /projection was requested/);
});

test("projection failures prevent writes and preserve active document, path, redo and checkpoints on read", () => {
  class FailingViews extends ShapeViews {
    fail = false;

    override snapshot(document: SvgDocument): DocumentSnapshot {
      if (this.fail) {
        throw new Error("projection failed");
      }
      return super.snapshot(document);
    }
  }
  const framework = createDefaultFramework();
  let writes = 0;
  let checkpoints = 0;
  framework.decorators.register({
    name: "checkpoint-counter",
    decorate() {
      return undefined;
    },
    checkpoint() {
      checkpoints += 1;
    },
  });
  const views = new FailingViews(new RegisteredShapeFactory(framework.shapes));
  const session = new EditorSession(new CheckpointRepository({
    read() {
      return { document: new SvgDocument(), warnings: [] };
    },
    write() {
      writes += 1;
    },
  }, views, framework.decorators));
  session.initialize();
  session.execute(new CreateCommand(new Rect("r", 1, 2, 3, 4)));
  session.save("original.svg");
  session.execute(new MoveCommand("r", 5, 0));
  session.undo();
  const document = session.document;
  views.fail = true;
  assert.throws(() => session.save("failed.svg"), /projection failed/);
  assert.throws(() => session.read("input.svg"), /projection failed/);
  assert.equal(writes, 1);
  assert.equal(checkpoints, 1);
  assert.equal(session.document, document);
  assert.equal(session.path, "original.svg");
  session.redo();
  assert.equal(document.get("r").geometry["x"], 6);
});
