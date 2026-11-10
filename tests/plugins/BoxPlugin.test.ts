import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Framework, RegisteredShapeFactory, EditorSession, CreateCommand, MoveCommand, ScaleCommand,
  SetCommand, DeleteCommand, AttributeRouter, Rect, Text, Group,
} from "../../src/extensions/index.js";
import boxPlugin from "../../src/plugins/box/index.js";
import { Box } from "../../src/plugins/box/Box.js";

function setup() {
  const framework = new Framework();
  boxPlugin.activate(framework);
  const factory = new RegisteredShapeFactory(framework.shapes);
  const session = new EditorSession();
  session.initialize();
  const box = factory.create("box", "n", ["120", "100", "160", "60", "start"]);
  session.execute(new CreateCommand(box));
  return { framework, factory, session, box: box as Box, router: new AttributeRouter(framework.attributes) };
}

test("box activates on an empty framework and constructs its own complete subtree", () => {
  const { framework, box } = setup();
  assert.deepEqual(framework.shapes.all().map(provider => provider.name), ["box"]);
  assert.deepEqual(framework.attributes.all().map(handler => handler.name), ["box-attributes"]);
  assert.deepEqual(framework.decorators.all().map(decorator => decorator.name), ["box-type-label"]);
  assert.equal(box.type, "box");
  assert.equal(box.asContainer(), box);
  assert.deepEqual(box.geometry, {});
  assert.deepEqual(box.children.map(child => child.id), ["n-rect", "n-label"]);
  assert.deepEqual(box.frame.geometry, { x: 120, y: 100, width: 160, height: 60 });
  assert.equal(box.frame.styles["fill"], "#4a90d9");
  assert.deepEqual(box.label.geometry, { x: 140, y: 135 });
  assert.equal(box.label.content, "start");
  assert.throws(() => box.assertUngroupable(), /cannot ungroup composite shape: n/);
});

test("move, scale, propagated attributes and deletion are complete undo units", () => {
  const { session, box, router } = setup();
  session.document.add(new Text("extra", 5, 6, "extra"), "n");
  session.execute(new MoveCommand("n", 10, 20));
  assert.equal(box.frame.geometry.x, 130);
  assert.equal(box.label.geometry.y, 155);
  assert.equal(session.document.get("extra").geometry["x"], 15);
  session.undo();
  assert.equal(box.frame.geometry.x, 120);
  session.redo();
  session.execute(new ScaleCommand("n", 2));
  assert.equal(box.frame.geometry.width, 320);
  assert.equal(box.label.geometry.x, 300);
  session.undo();
  session.execute(new SetCommand("n", "fill", "red", router));
  assert.equal(box.frame.styles["fill"], "red");
  assert.equal(box.styles["fill"], undefined);
  session.undo();
  assert.equal(box.frame.styles["fill"], "#4a90d9");
  session.redo();
  assert.equal(box.frame.styles["fill"], "red");
  session.execute(new SetCommand("n", "label", "second", router));
  assert.equal(box.label.content, "second");
  session.undo();
  assert.equal(box.label.content, "start");
  session.redo();
  session.execute(new DeleteCommand("n"));
  assert.equal(session.document.find("n-label"), undefined);
  session.undo();
  assert.equal(session.document.get("n"), box);
  assert.equal(box.label.content, "second");
  session.redo();
  assert.equal(session.document.find("extra"), undefined);
});

test("required component constraints reject deletion and relocation but allow extras and ordering", () => {
  const { session, box } = setup();
  const document = session.document;
  document.add(new Group("other"));
  for (const id of ["n-rect", "n-label"]) {
    assert.throws(() => document.remove(id), /required box component/);
    assert.throws(() => document.reparent(id, "other"), /required box component/);
  }
  document.reparent("n-rect", "n", 1);
  assert.deepEqual(box.children.map(child => child.id), ["n-label", "n-rect"]);
  document.add(new Text("extra", 0, 0, "extra"), "n");
  document.reparent("extra", "other");
  assert.equal(document.parentOf("extra")?.id, "other");
  assert.throws(() => new Box("bad", [new Rect("bad-rect", 0, 0, 1, 1)]), /required box component/);
  assert.throws(() => new Box("bad", [new Text("bad-rect", 0, 0, ""), new Text("bad-label", 0, 0, "")]), /required box component/);
});

test("all derived IDs are checked atomically and failed edits retain redo", () => {
  for (const collision of ["next", "next-rect", "next-label"]) {
    const { session, factory } = setup();
    session.document.add(new Text(collision, 0, 0, "existing"));
    session.execute(new MoveCommand("n", 10, 0));
    session.undo();
    const before = session.document.children;
    assert.throws(() => session.execute(new CreateCommand(factory.create("box", "next", ["1", "2", "3", "4", "title"]))), /id already exists/);
    assert.deepEqual(session.document.children, before);
    session.redo();
    assert.equal(session.document.get("n-rect").geometry["x"], 130);
  }
});

test("handler failure rolls back several child changes and preserves history without fallback", () => {
  const { session, box, framework } = setup();
  const failing = new Framework();
  failing.attributes.register({
    name: "fail-after-edit",
    handles(shape, attribute) {
      return shape instanceof Box && attribute === "fill";
    },
    apply() {
      box.setFill("red");
      box.setLabel("partial");
      throw new Error("partial failure");
    },
  });
  session.execute(new MoveCommand("n", 10, 0));
  session.undo();
  assert.throws(() => session.execute(new SetCommand("n", "fill", "red", new AttributeRouter(failing.attributes))), /partial failure/);
  assert.equal(box.frame.styles["fill"], "#4a90d9");
  assert.equal(box.label.content, "start");
  session.redo();
  assert.equal(box.frame.geometry.x, 130);
  framework.attributes.register(failing.attributes.all()[0]!);
  assert.throws(() => session.execute(new SetCommand("n", "fill", "red", new AttributeRouter(framework.attributes))), /ambiguous attribute handler: box\/fill/);
  assert.equal(box.frame.styles["fill"], "#4a90d9");
});

test("fallback attributes retain their whitelist and malformed values preserve both components", () => {
  const { session, box, router, factory } = setup();
  session.execute(new SetCommand("n", "stroke", "black", router));
  assert.equal(box.styles["stroke"], "black");
  for (const [attribute, value] of [["unknown", "x"], ["label", 42], ["fill", 42]] as const) {
    assert.throws(() => session.execute(new SetCommand("n", attribute, value, router)));
  }
  assert.equal(box.label.content, "start");
  assert.equal(box.frame.styles["fill"], "#4a90d9");
  assert.throws(() => factory.create("box", "bad", ["0", "0", "-1", "5", "title"]));
  assert.throws(() => factory.create("box", "bad", ["0", "0", "1", "5"]));
});

test("box type decoration applies only to box instances and is independent of other decorators", () => {
  const { framework, session, box } = setup();
  const decorator = framework.decorators.all()[0]!;
  assert.equal(decorator.decorate({ document: session.document, shape: box }), "(box)");
  assert.equal(decorator.decorate({ document: session.document, shape: undefined }), undefined);
  assert.equal(decorator.decorate({ document: session.document, shape: box.frame }), undefined);
});
