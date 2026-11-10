import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { RegisteredShapeFactory } from "../../src/extensions/index.js";
import { createEditor } from "../../src/composition/createEditor.js";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { RegisteredSvgParser } from "../../src/infrastructure/RegisteredSvgParser.js";
import { RegisteredSvgSerializer } from "../../src/infrastructure/RegisteredSvgSerializer.js";
import boxPlugin from "../../src/plugins/box/index.js";
import statsPlugin from "../../src/plugins/stats/index.js";
import { Box } from "../../src/plugins/box/Box.js";
import { BoxProvider } from "../../src/plugins/box/BoxProvider.js";

function setup(enabled = true) {
  const framework = createDefaultFramework();
  if (enabled) {
    boxPlugin.activate(framework);
  }
  const factory = new RegisteredShapeFactory(framework.shapes);
  return { ...createEditor(framework), parser: new RegisteredSvgParser(factory), serializer: new RegisteredSvgSerializer(factory) };
}

const xml = '<svg xmlns="http://www.w3.org/2000/svg"><g id="n" data-kind="box" stroke="black"><rect id="n-rect" x="1" y="2" width="3" height="4" fill="red"/><text id="n-label" x="9" y="10">A &amp; B</text></g></svg>';

test("nested boxes and additional children survive serialization with original identities, order and styles", () => {
  const editor = setup();
  const run = (line: string) => editor.dispatcher.dispatch(line);
  run("init");
  run('create box outer 1 2 3 4 "A & B"');
  assert.match(run('create box inner 5 6 7 8 "nested" in outer'), /in box#outer$/);
  run('create text extra 9 10 "extra" in outer');
  run("front outer-rect");
  const saved = editor.serializer.serialize(editor.session.document);
  assert.match(saved, /<g id="outer" data-kind="box">/);
  const parsed = editor.parser.parse(saved);
  assert.deepEqual(parsed.warnings, []);
  assert.ok(parsed.document.get("inner") instanceof Box);
  assert.deepEqual(parsed.document.get("outer").children.map(child => child.id), ["outer-label", "inner", "extra", "outer-rect"]);
  assert.equal((parsed.document.get("outer") as Box).label.content, "A & B");
  assert.equal(editor.serializer.serialize(parsed.document), saved);
  const imported = editor.parser.parse(xml).document.get("n") as Box;
  assert.equal(imported.styles["stroke"], "black");
  assert.equal(imported.frame.styles["fill"], "red");
  assert.deepEqual(imported.label.geometry, { x: 9, y: 10 });
});

test("disabled box plugin imports ordinary groups with a warning and keeps all component data", () => {
  const editor = setup(false);
  editor.dispatcher.dispatch("init");
  assert.throws(() => editor.dispatcher.dispatch('create box n 1 2 3 4 title'), /unknown shape type: box/);
  const parsed = editor.parser.parse(xml);
  assert.deepEqual(parsed.warnings, ["warning: treating box n as an ordinary group"]);
  const group = parsed.document.get("n");
  assert.equal(group.type, "g");
  assert.deepEqual(group.children.map(child => child.id), ["n-rect", "n-label"]);
  const saved = editor.serializer.serialize(parsed.document);
  assert.doesNotMatch(saved, /data-kind/);
  assert.match(saved, /A &amp; B/);
  assert.match(saved, /stroke="black"/);
});

test("installed plugin rejects missing, wrongly typed, nested instead of direct, or duplicate required parts", () => {
  const { parser } = setup();
  const cases = [
    xml.replace(/<text.*?<\/text>/u, ""),
    xml.replace('id="n-rect"', 'id="other"'),
    xml.replace('<rect id="n-rect" x="1" y="2" width="3" height="4" fill="red"/>', '<text id="n-rect" x="1" y="2">wrong</text>'),
    xml.replace('<text id="n-label"', '<g id="nested"><text id="n-label"').replace('</text>', '</text></g>'),
    xml.replace('id="n-label"', 'id="n-rect"'),
  ];
  for (const source of cases) {
    assert.throws(() => parser.parse(source), /invalid SVG:.*(?:required box component|id already exists)/);
  }
  assert.throws(() => parser.parse(xml.replace('stroke="black"', 'x="9"')), /unknown attribute: x/);
  assert.throws(() => parser.parse(xml.replace('<rect', 'body<rect')), /unexpected text/);
});

test("failed read preserves document identity, path and redo history", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-box-read-"));
  try {
    const editor = setup();
    editor.dispatcher.dispatch("init");
    editor.dispatcher.dispatch('create box old 1 2 3 4 "old"');
    const valid = join(directory, "valid.svg");
    editor.session.save(valid);
    editor.dispatcher.dispatch("move old 10 0");
    editor.dispatcher.dispatch("undo");
    const before = editor.session.document;
    const broken = join(directory, "broken.svg");
    writeFileSync(broken, xml.replace(/<text.*?<\/text>/u, ""));
    assert.throws(() => editor.session.read(broken), /required box component/);
    assert.equal(editor.session.document, before);
    assert.equal(editor.session.path, valid);
    editor.dispatcher.dispatch("redo");
    assert.equal((before.get("old") as Box).frame.geometry.x, 11);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
});

test("public structural commands cannot extract required parts and failures preserve redo", () => {
  const editor = setup();
  const run = (line: string) => editor.dispatcher.dispatch(line);
  run("init");
  run('create box n 1 2 3 4 "title"');
  run("create g other");
  run("move n 10 0");
  run("undo");
  for (const line of ["delete n-rect", "delete n-label", "addto other n-rect", "group stolen n-label", "ungroup n"]) {
    assert.throws(() => run(line), /required box component|cannot ungroup composite shape: n/);
  }
  assert.equal(editor.session.document.find("stolen"), undefined);
  run("redo");
  assert.equal((editor.session.document.get("n") as Box).frame.geometry.x, 11);
  run("delete n");
  run("undo");
  assert.equal(editor.session.document.get("n-label").id, "n-label");
});

test("box feedback matches the sample and stats includes its two leaves but counts it as a container", () => {
  const editor = setup();
  statsPlugin.activate(editor.framework);
  const run = (line: string) => editor.dispatcher.dispatch(line);
  run("init");
  assert.equal(run('create box n 120 100 160 60 "start"'), "box#n created (g#n + rect#n-rect + text#n-label)");
  assert.equal(run("move n 0 100"), "box#n moved by (0,100)");
  assert.equal(run("undo"), "box#n moved back by (0,-100)");
  assert.equal(run("set n fill red"), "box#n fill propagated to n-rect");
  assert.equal(run("undo"), "box#n fill restored to n-rect");
  assert.equal((editor.session.document.get("n") as Box).frame.styles["fill"], "#4a90d9");
  assert.equal(run("redo"), "box#n fill propagated to n-rect");
  assert.equal(run('set n label "second"'), 'box#n label updated: "second"');
  assert.equal(run("undo"), 'box#n label restored: "start"');
  assert.equal(run("redo"), 'box#n label updated: "second"');
  assert.match(run("tree"), /g#n \(box\)/);
  assert.equal(run("stats"), "rect: 1  text: 1  (total 2, containers 1)");
});

test("imported boxes without an explicit frame fill omit it from presentation attributes", () => {
  const editor = setup();
  const document = editor.parser.parse(xml.replace(' fill="red"', "")).document;
  const box = document.get("n") as Box;
  const attributes = new BoxProvider().present(box).attributes!;
  assert.equal(Object.hasOwn(attributes, "fill"), false);
  assert.deepEqual(attributes, { label: "A & B" });
  assert.equal(box.frame.styles["fill"], undefined);
});
