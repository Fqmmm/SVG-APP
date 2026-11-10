import assert from "node:assert/strict";
import { test } from "node:test";
import { Framework, SvgDocument, Group, Rect, Text, EditorSession, MoveCommand, DocumentSnapshot } from "../../src/extensions/index.js";
import starPlugin from "../../src/plugins/modified-star/index.js";
import { ModifiedStarDecorator } from "../../src/plugins/modified-star/ModifiedStarDecorator.js";

function snapshot(document: SvgDocument): DocumentSnapshot {
  return new DocumentSnapshot(document, shape => {
    return shape instanceof Text ? shape.content : undefined;
  });
}

function label(star: ModifiedStarDecorator, document: SvgDocument, id?: string): string | undefined {
  return star.decorate({ document, shape: id === undefined ? undefined : document.get(id), snapshot: snapshot(document) });
}

test("modified-star independently registers one decorator on an empty framework", () => {
  const framework = new Framework();
  starPlugin.activate(framework);
  assert.deepEqual(framework.decorators.all().map(item => item.name), ["modified-star"]);
  assert.equal(framework.shapes.all().length, 0);
  assert.equal(framework.commands.all().length, 0);
  assert.equal(framework.attributes.all().length, 0);
});

test("new content, save, edit, undo back to saved content and redo form a content-based state machine", () => {
  const star = new ModifiedStarDecorator();
  const session = new EditorSession();
  session.initialize();
  const document = session.document;
  assert.equal(label(star, document), "*");
  document.add(new Group("g", [new Rect("r", 1, 2, 3, 4)]));
  assert.equal(label(star, document, "r"), "*");
  star.checkpoint(document, snapshot(document));
  session.establishBarrier();
  assert.equal(label(star, document), undefined);
  session.execute(new MoveCommand("r", 5, 0));
  for (const id of [undefined, "g", "r"]) {
    assert.equal(label(star, document, id), "*");
  }
  session.undo();
  for (const id of [undefined, "g", "r"]) {
    assert.equal(label(star, document, id), undefined);
  }
  session.redo();
  assert.equal(label(star, document), "*");
  star.checkpoint(document, snapshot(document));
  assert.equal(label(star, document, "r"), undefined);
  session.execute(new MoveCommand("r", 0, 0));
  assert.equal(label(star, document), undefined);
});

test("text changes propagate to ancestors; deletion and order changes mark containers and keep unaffected leaves clean", () => {
  const star = new ModifiedStarDecorator();
  const document = new SvgDocument();
  const text = new Text("t", 1, 2, "before");
  document.add(new Group("g", [text, new Rect("r", 1, 2, 3, 4)]));
  star.checkpoint(document, snapshot(document));
  text.set("text", "after");
  assert.equal(label(star, document, "t"), "*");
  assert.equal(label(star, document, "g"), "*");
  assert.equal(label(star, document, "r"), undefined);
  text.set("text", "before");
  document.reparent("t", "g", 1);
  assert.equal(label(star, document, "g"), "*");
  assert.equal(label(star, document, "t"), undefined);
  star.checkpoint(document, snapshot(document));
  assert.equal(label(star, document, "g"), undefined);
  assert.equal(label(star, document), undefined);
  document.remove("t");
  assert.equal(label(star, document, "g"), "*");
  assert.equal(label(star, document), "*");
  assert.equal(label(star, document, "r"), undefined);
});

test("baseline state is isolated between documents and decorator instances, including equal IDs", () => {
  const first = new ModifiedStarDecorator();
  const second = new ModifiedStarDecorator();
  const a = new SvgDocument();
  const b = new SvgDocument();
  a.add(new Rect("same", 0, 0, 1, 1));
  b.add(new Rect("same", 0, 0, 1, 1));
  first.checkpoint(a, snapshot(a));
  assert.equal(label(first, a), undefined);
  assert.equal(label(first, b), "*");
  assert.equal(label(second, a), "*");
  first.checkpoint(b, snapshot(b));
  a.get("same").move(1, 0);
  assert.equal(label(first, a, "same"), "*");
  assert.equal(label(first, b, "same"), undefined);
  b.resize(500, 400);
  assert.equal(label(first, b), "*");
  assert.equal(label(first, b, "same"), undefined);
});

test("a missing host snapshot is reported as a contract error", () => {
  const document = new SvgDocument();
  const star = new ModifiedStarDecorator();
  star.checkpoint(document, snapshot(document));
  assert.throws(() => star.decorate({ document, shape: undefined }), /modified-star requires document snapshots/);
});

test("nodes added after saving are dirty and removing them restores saved content", () => {
  const star = new ModifiedStarDecorator();
  const document = new SvgDocument();
  document.add(new Group("g", [new Rect("saved", 0, 0, 1, 1)]));
  star.checkpoint(document, snapshot(document));
  document.add(new Rect("new", 1, 2, 3, 4), "g");
  assert.equal(label(star, document, "new"), "*");
  assert.equal(label(star, document, "g"), "*");
  assert.equal(label(star, document), "*");
  assert.equal(label(star, document, "saved"), undefined);
  document.remove("new");
  assert.equal(label(star, document), undefined);
});

test("a new document can be marked without projecting its snapshot", () => {
  const star = new ModifiedStarDecorator();
  assert.equal(star.decorate({ document: new SvgDocument(), shape: undefined,
    get snapshot(): DocumentSnapshot {
      throw new Error("unnecessary projection");
    },
  }), "*");
});
