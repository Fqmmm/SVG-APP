import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Framework, Group, ShapeDefinition, SvgDocument } from "../../src/extensions/index.js";
import { Text } from "../../src/domain/primitives/Text.js";
import { createEditor } from "../../src/composition/createEditor.js";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { RegisteredShapeFactory } from "../../src/application/shapes/RegisteredShapeFactory.js";
import { RegisteredSvgParser } from "../../src/infrastructure/svg/RegisteredSvgParser.js";
import { RegisteredSvgSerializer } from "../../src/infrastructure/svg/RegisteredSvgSerializer.js";

const wrap = (body: string): string => '<svg xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';

class Panel extends Group {
  override get type(): string {
    return "panel";
  }
}

class Caption extends Text {
  override get type(): string {
    return "caption";
  }
}

test("built-in leaves reject child structure before resolving an unknown child type", () => {
  const parser = new RegisteredSvgParser(new RegisteredShapeFactory(createDefaultFramework().shapes));
  for (const tag of ["rect", "circle", "ellipse", "line", "text"]) {
    assert.throws(() => parser.parse(wrap('<' + tag + ' id="leaf"><foo/></' + tag + '>')),
      { message: "invalid SVG: unsupported child element in " + tag });
  }
});

test("a custom importer cannot discard attributes or direct text even without a validation callback", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "panel", help: "panel", svg: { tag: "g", kind: "panel" },
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Panel(id);
    }),
    fromSvg(input) {
      return new Panel(input.id, input.children);
    },
  });
  const parser = new RegisteredSvgParser(new RegisteredShapeFactory(framework.shapes));
  assert.throws(() => parser.parse(wrap('<g id="p" data-kind="panel" fill="red"/>')),
    /SVG input not preserved: p\/fill/);
  assert.throws(() => parser.parse(wrap('<g id="p" data-kind="panel">stray<rect id="r"/></g>')),
    /unexpected text in shape: p/);
});

test("an empty preflight callback cannot silently accept unmatched kind metadata", () => {
  const framework = new Framework();
  framework.shapes.register({
    name: "panel", help: "panel", svg: { tag: "g" },
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Panel(id);
    }),
    validateSvg() {
      return [];
    },
    fromSvg(input) {
      return new Panel(input.id, input.children);
    },
  });
  assert.throws(() => new RegisteredSvgParser(new RegisteredShapeFactory(framework.shapes))
    .parse(wrap('<g id="p" data-kind="unrecognized"/>')), /unsupported data-kind: unrecognized/);
});

test("a custom text importer must preserve the decoded input body", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "caption", help: "caption",
    definition: new ShapeDefinition({ geometry: [], hasText: true }, (id, input) => {
      return new Caption(id, 0, 0, input.content!);
    }),
    text(shape) {
      assert.ok(shape instanceof Caption);
      return shape.content;
    },
    fromSvg(input) {
      return new Caption(input.id, 0, 0, "");
    },
  });
  assert.throws(() => new RegisteredSvgParser(new RegisteredShapeFactory(framework.shapes))
    .parse(wrap('<caption id="c">hello &amp; world</caption>')), /SVG input not preserved: c\/text/);
});

test("a custom container retaining attributes round-trips without mandatory preflight", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "panel", help: "panel", svg: { tag: "g", kind: "panel" },
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Panel(id);
    }),
    fromSvg(input) {
      const panel = new Panel(input.id, input.children);
      for (const [name, value] of input.attributes) {
        panel.set(name, value);
      }
      return panel;
    },
  });
  const factory = new RegisteredShapeFactory(framework.shapes);
  const parser = new RegisteredSvgParser(factory);
  const document = parser.parse(wrap('<g id="p" data-kind="panel" fill="red" stroke-width="2"><rect id="r"/></g>')).document;
  const restored = parser.parse(new RegisteredSvgSerializer(factory).serialize(document)).document;
  assert.deepEqual(restored.get("p").styles, { fill: "red", "stroke-width": 2 });
  assert.equal(restored.parentOf("r")?.id, "p");
});

test("element text on a container is rejected at creation and serialization", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "panel", help: "panel",
    definition: new ShapeDefinition({ geometry: [], hasText: true }, id => {
      return new Panel(id);
    }),
    text() {
      return "must not disappear";
    },
  });
  const factory = new RegisteredShapeFactory(framework.shapes);
  assert.throws(() => factory.create("panel", "p", ["title"]), /unsupported SVG text for container: panel/);
  const document = new SvgDocument();
  document.add(new Panel("p"));
  assert.throws(() => new RegisteredSvgSerializer(factory).serialize(document), /unsupported SVG text for container: panel/);
});

test("a container may explicitly store its CLI text parameter in child shapes", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "panel", help: "panel", svg: { tag: "g", kind: "panel", text: "children" },
    definition: new ShapeDefinition({ geometry: [], hasText: true }, (id, input) => {
      return new Panel(id, [new Text(id + "-label", 0, 0, input.content!)]);
    }),
    fromSvg(input) {
      return new Panel(input.id, input.children);
    },
  });
  const factory = new RegisteredShapeFactory(framework.shapes);
  const document = new SvgDocument();
  document.add(factory.create("panel", "p", ["label & text"]));
  const xml = new RegisteredSvgSerializer(factory).serialize(document);
  assert.match(xml, /<text[^>]*>label &amp; text<\/text>/);
  const restored = new RegisteredSvgParser(factory).parse(xml).document.get("p-label");
  assert.ok(restored instanceof Text);
  assert.equal(restored.content, "label & text");
});

test("failed input preservation checks keep the active document and redo branch", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "panel", help: "panel", svg: { tag: "g", kind: "panel" },
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Panel(id);
    }),
    fromSvg(input) {
      const panel = new Panel(input.id, input.children);
      panel.set("fill", "blue");
      return panel;
    },
  });
  const editor = createEditor(framework);
  editor.dispatcher.dispatch("init");
  editor.dispatcher.dispatch("create rect existing 1 2 3 4");
  editor.dispatcher.dispatch("move existing 10 20");
  editor.dispatcher.dispatch("undo");
  const original = editor.session.document;
  const directory = mkdtempSync(join(tmpdir(), "svg-input-"));
  try {
    const path = join(directory, "invalid.svg");
    writeFileSync(path, wrap('<g id="p" data-kind="panel" fill="red"/>'));
    assert.throws(() => editor.dispatcher.dispatch("read " + JSON.stringify(path)), /SVG input not preserved: p\/fill/);
    assert.equal(editor.session.document, original);
    assert.equal(editor.session.path, undefined);
    assert.equal(original.get("existing").geometry["x"], 1);
    editor.dispatcher.dispatch("redo");
    assert.equal(original.get("existing").geometry["x"], 11);
  } finally {
    assert.ok(directory.startsWith(join(tmpdir(), "svg-input-")));
    rmSync(directory, { recursive: true, force: true });
  }
});

test("child-stored text is an explicit container policy rather than a leaf escape hatch", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "caption", help: "caption", svg: { tag: "caption", text: "children" },
    definition: new ShapeDefinition({ geometry: [], hasText: true }, (id, input) => {
      return new Caption(id, 0, 0, input.content!);
    }),
  });
  assert.throws(() => new RegisteredShapeFactory(framework.shapes).create("caption", "c", ["hello"]),
    /SVG child text requires a container: caption/);
});
