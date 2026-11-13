import assert from "node:assert/strict";
import { test } from "node:test";
import { Framework, ShapeDefinition, ShapeViews, SvgDocument } from "../../src/extensions/index.js";
import { Text } from "../../src/domain/primitives/Text.js";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { RegisteredShapeFactory } from "../../src/application/shapes/RegisteredShapeFactory.js";
import { RegisteredSvgParser } from "../../src/infrastructure/svg/RegisteredSvgParser.js";
import { RegisteredSvgSerializer } from "../../src/infrastructure/svg/RegisteredSvgSerializer.js";

class Caption extends Text {
  override get type(): string {
    return "caption";
  }
}

test("text-bearing providers require a persistence accessor before registration", () => {
  const framework = new Framework();
  assert.throws(() => framework.shapes.register({
    name: "caption", help: "caption",
    definition: new ShapeDefinition({ geometry: ["x", "y"], hasText: true }, (id, input) => {
      return new Caption(id, input.geometry["x"]!, input.geometry["y"]!, input.content!);
    }),
  }), /invalid shape text contract: caption/);
  assert.equal(framework.shapes.all().length, 0);
});

test("display-only content cannot silently become persisted element text", () => {
  const framework = createDefaultFramework();
  const provider = framework.shapes.get("rect");
  const custom = new Framework();
  custom.shapes.register({ ...provider, present() {
    return { summary: "display", content: "display-only" };
  } });
  const factory = new RegisteredShapeFactory(custom.shapes);
  const document = new RegisteredSvgParser(factory).parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="r"/></svg>').document;
  assert.throws(() => new ShapeViews(factory).summary(document.get("r")), /invalid shape presentation: rect/);
  const xml = new RegisteredSvgSerializer(factory).serialize(document);
  assert.doesNotMatch(xml, /display-only/);
  assert.equal(new RegisteredSvgParser(factory).parse(xml).document.get("r").type, "rect");
});

test("parent text and metadata errors retain precedence over invalid child types", () => {
  const parser = new RegisteredSvgParser(new RegisteredShapeFactory(createDefaultFramework().shapes));
  assert.throws(() => parser.parse('<svg xmlns="http://www.w3.org/2000/svg"><g id="g">oops<foo/></g></svg>'),
    { message: "invalid SVG: unexpected text in shape: g" });
  assert.throws(() => parser.parse('<svg xmlns="http://www.w3.org/2000/svg"><g id="g" data-kind="weird"><foo/></g></svg>'),
    { message: "invalid SVG: unsupported data-kind: weird" });
});


test("a custom text provider persists escaped Unicode independently of its presentation", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "caption", help: "caption",
    definition: new ShapeDefinition({ geometry: ["x", "y"], hasText: true }, (id, input) => {
      return new Caption(id, input.geometry["x"]!, input.geometry["y"]!, input.content!);
    }),
    text(shape) {
      assert.ok(shape instanceof Caption);
      return shape.content;
    },
  });
  const factory = new RegisteredShapeFactory(framework.shapes);
  const parser = new RegisteredSvgParser(factory);
  const source = '<svg xmlns="http://www.w3.org/2000/svg"><caption id="c" x="10" y="20">hello &amp; &lt;world&gt; &#x4e2d;</caption></svg>';
  const original = parser.parse(source).document;
  const xml = new RegisteredSvgSerializer(factory).serialize(original);
  assert.match(xml, /hello &amp; &lt;world&gt;/);
  const restored = parser.parse(xml).document.get("c");
  assert.ok(restored instanceof Caption);
  assert.equal(restored.content, "hello & <world> \u4e2d");
  assert.deepEqual(restored.geometry, original.get("c").geometry);
});

test("a text accessor on a non-text schema is rejected rather than producing an unreadable SVG", () => {
  const framework = new Framework();
  assert.throws(() => framework.shapes.register({
    name: "badge", help: "badge",
    definition: new ShapeDefinition({ geometry: [] }, id => {
      return new Caption(id, 0, 0, "ignored");
    }),
    text() {
      return "display-only";
    },
  }), /invalid shape text contract: badge/);
});

test("empty names have a distinct validation error and unknown document shapes have a user-facing error", () => {
  const framework = new Framework();
  assert.throws(() => framework.commands.register({
    name: " ", help: [], requiresDocument: false,
    execute() {
      return "";
    },
  }), /invalid registration name: commands/);
  const document = new RegisteredSvgParser(new RegisteredShapeFactory(createDefaultFramework().shapes))
    .parse('<svg xmlns="http://www.w3.org/2000/svg"><text id="t">hello</text></svg>').document;
  assert.throws(() => new RegisteredSvgSerializer(new RegisteredShapeFactory(framework.shapes)).serialize(document),
    /unknown shape type: text \(is the plugin loaded\?\)/);
});

test("a JavaScript text accessor returning undefined fails rather than dropping data", () => {
  const framework = createDefaultFramework();
  framework.shapes.register({
    name: "caption", help: "caption",
    definition: new ShapeDefinition({ geometry: ["x", "y"], hasText: true }, (id, input) => {
      return new Caption(id, input.geometry["x"]!, input.geometry["y"]!, input.content!);
    }),
    text() {
      return undefined as unknown as string;
    },
  });
  const factory = new RegisteredShapeFactory(framework.shapes);
  assert.throws(() => new RegisteredSvgParser(factory).parse('<svg xmlns="http://www.w3.org/2000/svg"><caption id="c">hello</caption></svg>'),
    /invalid shape text: caption/);
  const document = new SvgDocument();
  document.add(new Caption("c", 0, 0, "hello"));
  assert.throws(() => new RegisteredSvgSerializer(factory).serialize(document), /invalid shape text: caption/);
});
