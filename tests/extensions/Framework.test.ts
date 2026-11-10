import assert from "node:assert/strict";
import { join } from "node:path";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { EditorSession } from "../../src/application/EditorSession.js";
import { Framework } from "../../src/extensions/Framework.js";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/Rect.js";
import { RegisteredCommandDispatcher } from "../../src/cli/RegisteredCommandDispatcher.js";
import { RegisteredShapeFactory } from "../../src/application/RegisteredShapeFactory.js";
import { RegisteredSvgParser } from "../../src/infrastructure/RegisteredSvgParser.js";
import { RegisteredSvgSerializer } from "../../src/infrastructure/RegisteredSvgSerializer.js";
import { ShapeDefinition } from "../../src/application/ShapeDefinition.js";
import { Tile, registerTile } from "./fixtures/tile.js";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { createEditor } from "../../src/composition/createEditor.js";

test("an empty framework has four empty registries and no implicit extensions", () => {
  const framework = new Framework();
  assert.equal(framework.shapes.all().length, 0);
  assert.equal(framework.commands.all().length, 0);
  assert.equal(framework.decorators.all().length, 0);
  assert.equal(framework.attributes.all().length, 0);
  const cli = new RegisteredCommandDispatcher(new EditorSession(), framework);
  assert.throws(() => cli.dispatch("help"), /unknown command: help/);
});

test("commands register their help and document requirement without changing dispatch", () => {
  const framework = createDefaultFramework();
  const session = new EditorSession();
  const cli = new RegisteredCommandDispatcher(session, framework);
  framework.commands.register({
    name: "echo", help: ["echo <word>"], requiresDocument: false,
    execute(args) {
      return args.join(" ");
    },
  });
  assert.equal(cli.dispatch("echo hello"), "hello");
  assert.match(cli.dispatch("help"), /echo <word>/);
  assert.throws(() => framework.commands.register(framework.commands.get("echo")),
    /duplicate registration: commands\/echo/);
  framework.commands.register({
    name: "needs-document", help: [], requiresDocument: true,
    execute() {
      return "ready";
    },
  });
  assert.throws(() => cli.dispatch("needs-document"), /no document/);
  cli.dispatch("init");
  assert.equal(cli.dispatch("needs-document"), "ready");
  assert.doesNotMatch(cli.dispatch("help"), /stats|dir|box/);
});

// This provider lives in the test plugin, outside the default assembly.

test("a registered shape creates, formats, moves, scales and round-trips without a typed visitor", () => {
  const framework = createDefaultFramework();
  registerTile(framework);
  const session = new EditorSession();
  const cli = new RegisteredCommandDispatcher(session, framework);
  cli.dispatch("init");
  assert.match(cli.dispatch("help"), /tile <id>/);
  assert.equal(cli.dispatch("create tile t 1 2 3 4"), "tile#t created");
  assert.match(cli.dispatch("tree"), /tile#t  tile-width=3/);
  cli.dispatch("move t 2 3");
  cli.dispatch("scale t 2");
  cli.dispatch("set t width 8");
  cli.dispatch("undo");
  assert.equal(session.document.get("t").geometry["width"], 6);
  cli.dispatch("redo");
  const factory = new RegisteredShapeFactory(framework.shapes);
  const xml = new RegisteredSvgSerializer(factory).serialize(session.document);
  assert.match(xml, /<tile id="t" x="6" y="10" width="8" height="8"\/>/);
  const restored = new RegisteredSvgParser(factory).parse(xml).document;
  assert.ok(restored.get("t") instanceof Tile);
  assert.deepEqual(restored.get("t").geometry, session.document.get("t").geometry);
  const empty = new RegisteredShapeFactory(new Framework().shapes);
  assert.throws(() => empty.create("tile", "t", []), /unknown shape type: tile/);
});

test("decorators append in registration order to canvas, containers and leaves; empty labels add nothing", () => {
  const framework = createDefaultFramework();
  const session = new EditorSession();
  const cli = new RegisteredCommandDispatcher(session, framework);
  cli.dispatch("init");
  cli.dispatch("create g scene");
  cli.dispatch("create rect r 1 2 3 4 in scene");
  const plain = cli.dispatch("tree");
  framework.decorators.register({
    name: "test-id",
    decorate({ shape }) {
      return "[" + (shape?.id ?? "canvas") + "]";
    },
  });
  framework.decorators.register({
    name: "empty", decorate() {
      return "";
    },
  });
  framework.decorators.register({
    name: "last", decorate() {
      return "last";
    },
  });
  assert.equal(cli.dispatch("tree"), plain.split("\n").map((line, index) => {
    return line + " [" + ["canvas", "scene", "r"][index] + "] last";
  }).join("\n"));
  assert.match(cli.dispatch("tree scene"), /^g#scene \[scene\] last/m);
});

test("attribute handlers edit one subtree as one undo unit and failures preserve redo and content", () => {
  const framework = createDefaultFramework();
  const session = new EditorSession();
  const cli = new RegisteredCommandDispatcher(session, framework);
  framework.attributes.register({
    name: "pair-width",
    handles(shape, attribute) {
      return shape.asContainer() !== undefined && attribute === "pair-width";
    },
    apply(shape, _attribute, value) {
      for (const child of shape.children) {
        child.set("width", value);
      }
    },
  });
  cli.dispatch("init");
  cli.dispatch("create g scene");
  cli.dispatch("create rect a 1 2 3 4 in scene");
  cli.dispatch("create rect b 1 2 5 4 in scene");
  cli.dispatch("set scene pair-width 10");
  assert.deepEqual(session.document.get("scene").children.map(child => child.geometry["width"]), [10, 10]);
  cli.dispatch("undo");
  assert.deepEqual(session.document.get("scene").children.map(child => child.geometry["width"]), [3, 5]);
  framework.attributes.register({
    name: "failing",
    handles(_shape, attribute) {
      return attribute === "fail";
    },
    apply(shape) {
      shape.children[0]!.set("width", 99);
      throw new Error("plugin failure");
    },
  });
  assert.throws(() => cli.dispatch("set scene fail value"), /plugin failure/);
  assert.equal(session.document.get("a").geometry["width"], 3);
  cli.dispatch("redo");
  assert.equal(session.document.get("a").geometry["width"], 10);
  framework.attributes.register({
    name: "conflict",
    handles(shape, attribute) {
      return shape instanceof Group && attribute === "pair-width";
    },
    apply() {
      throw new Error("must not run");
    },
  });
  assert.throws(() => cli.dispatch("set scene pair-width 20"), /ambiguous attribute handler/);
  assert.equal(session.document.get("a").geometry["width"], 10);
  cli.dispatch("set a fill red");
  assert.equal(session.document.get("a").styles["fill"], "red");
  assert.throws(() => cli.dispatch("set a label value"), /unknown attribute: label/);
});


test("one assembly shares registered shapes across create, save and read", () => {
  const framework = createDefaultFramework();
  registerTile(framework);
  const editor = createEditor(framework);
  const directory = mkdtempSync(join(tmpdir(), "svg-framework-"));
  try {
    const path = join(directory, "registered.svg");
    editor.dispatcher.dispatch("init");
    editor.dispatcher.dispatch("create tile t 1 2 3 4");
    editor.dispatcher.dispatch("save " + JSON.stringify(path));
    assert.match(readFileSync(path, "utf8"), /<tile /);
    editor.dispatcher.dispatch("read " + JSON.stringify(path));
    assert.ok(editor.session.document.get("t") instanceof Tile);
    assert.match(editor.dispatcher.dispatch("show t"), /tile-width=3/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("duplicate names are rejected in all four categories and registries are instance-local", () => {
  const framework = createDefaultFramework();
  registerTile(framework);
  assert.throws(() => registerTile(framework), /duplicate registration: shapes\/tile/);
  const decorator = { name: "test", decorate() {
    return "tag";
  } };
  framework.decorators.register(decorator);
  assert.throws(() => framework.decorators.register(decorator), /duplicate registration: decorators\/test/);
  const attribute = { name: "test", handles() {
    return false;
  }, apply() {
  } };
  framework.attributes.register(attribute);
  assert.throws(() => framework.attributes.register(attribute), /duplicate registration: attributes\/test/);
  const second = createDefaultFramework();
  assert.equal(second.shapes.find("tile"), undefined);
  assert.equal(second.decorators.all().length, 0);
  assert.equal(second.attributes.all().length, 0);
});

test("shape provider results must preserve the registered type and requested id before insertion", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "wrong", help: "wrong",
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Rect(id, 0, 0, 1, 1);
    }),
  });
  const editor = createEditor(framework);
  editor.dispatcher.dispatch("init");
  assert.throws(() => editor.dispatcher.dispatch("create wrong w"), /invalid shape provider result: wrong/);
  assert.equal(editor.session.document.children.length, 0);
  framework.shapes.register({
    name: "tile", help: "tile",
    definition: new ShapeDefinition({ geometry: [] }, () => {
      return new Tile("different", 0, 0, 1, 1);
    }),
  });
  assert.throws(() => new RegisteredShapeFactory(framework.shapes).create("tile", "requested", []), /invalid shape provider result/);
});

test("default help stays byte-for-byte identical to the existing CLI help", () => {
  const editor = createEditor();
  const expected = readFileSync("tests/extensions/fixtures/builtin-help.txt", "utf8").replace(/\r\n/gu, "\n").trimEnd();
  assert.equal(editor.dispatcher.dispatch("help"), expected);
});

test("a compound provider maps g metadata and parsed children without kernel type branches", () => {
  class Panel extends Group {
    override get type(): string {
      return "panel";
    }

    override get canUngroup(): boolean {
      return false;
    }
  }
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "panel", help: "  panel <id>", svg: { tag: "g", kind: "test-panel" },
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Panel(id);
    }),
    fromSvg(input) {
      return new Panel(input.id, input.children);
    },
  });
  const editor = createEditor(framework);
  editor.dispatcher.dispatch("init");
  editor.dispatcher.dispatch("create g outer");
  editor.dispatcher.dispatch("create panel p in outer");
  editor.dispatcher.dispatch("create rect r 1 2 3 4 in p");
  assert.throws(() => editor.dispatcher.dispatch("ungroup p"), /cannot ungroup panel: p/);
  const factory = new RegisteredShapeFactory(framework.shapes);
  const xml = new RegisteredSvgSerializer(factory).serialize(editor.session.document);
  assert.match(xml, /<g id="p" data-kind="test-panel">/);
  const restored = new RegisteredSvgParser(factory).parse(xml).document;
  assert.ok(restored.get("p") instanceof Panel);
  assert.equal(restored.parentOf("r")?.id, "p");
  assert.equal(restored.get("p").children[0], restored.get("r"));
  const without = new RegisteredSvgParser(new RegisteredShapeFactory(createDefaultFramework().shapes));
  assert.throws(() => without.parse(xml), /unsupported data-kind: test-panel/);
});

test("SVG aliases reject ambiguous providers and compound providers cannot discard parsed children", () => {
  const ambiguous = createDefaultFramework();
  ambiguous.shapes.register({
    name: "shadow", svg: { tag: "rect" }, help: "shadow",
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Tile(id, 0, 0, 1, 1);
    }),
  });
  assert.throws(() => new RegisteredSvgParser(new RegisteredShapeFactory(ambiguous.shapes))
    .parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="r"/></svg>'), /ambiguous SVG shape provider/);
  class Drop extends Group {
    override get type(): string {
      return "drop";
    }
  }
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "drop", svg: { tag: "g", kind: "drop" }, help: "drop",
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Drop(id);
    }),
    fromSvg(input) {
      return new Drop(input.id);
    },
  });
  assert.throws(() => new RegisteredSvgParser(new RegisteredShapeFactory(framework.shapes))
    .parse('<svg xmlns="http://www.w3.org/2000/svg"><g id="d" data-kind="drop"><rect id="r"/></g></svg>'),
  /invalid shape provider children: drop/);
});

test("tree decorators reject multiline labels without changing the document", () => {
  const framework = createDefaultFramework();
  const editor = createEditor(framework);
  editor.dispatcher.dispatch("init");
  framework.decorators.register({
    name: "multiline",
    decorate() {
      return "first\nsecond";
    },
  });
  assert.throws(() => editor.dispatcher.dispatch("tree"), /tree decorator must return a single line: multiline/);
  assert.equal(editor.session.document.children.length, 0);
});
