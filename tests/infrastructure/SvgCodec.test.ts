import assert from "node:assert/strict";
import { test } from "node:test";
import { SvgParser } from "../../src/infrastructure/SvgParser.js";
import { SvgSerializer } from "../../src/infrastructure/SvgSerializer.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Group } from "../../src/domain/Group.js";
import { Rect } from "../../src/domain/Rect.js";
import { Text } from "../../src/domain/Text.js";
import { ShapeFactory } from "../../src/application/ShapeFactory.js";

const wrap = (body: string, attributes = 'width="400" height="200"'): string =>
  '<svg xmlns="http://www.w3.org/2000/svg" ' + attributes + '>' + body + '</svg>';

test("SVG roundtrip preserves all shapes, nested order, geometry and explicit style omission", () => {
  const xml = wrap('<g id="g" fill="blue"><rect id="r" x="1" y="2" width="3" height="4"/>'
    + '<g id="inner"><circle id="c" cx="5" cy="6" r="7" fill=""/><ellipse id="e" cx="8" cy="9" rx="10" ry="11"/>'
    + '<line id="l" x1="12" y1="13" x2="14" y2="15" stroke="black" stroke-width="2"/>'
    + '<text id="t" x="16" y="17">开始 &amp; &lt;结束&gt;</text></g></g>');
  const parser = new SvgParser();
  const original = parser.parse(xml);
  assert.deepEqual(original.warnings, []);
  const output = new SvgSerializer().serialize(original.document);
  assert.ok(output.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(output, /viewBox="0 0 400 200"/);
  assert.match(output, /fill=""/);
  const restored = parser.parse(output).document;
  for (const id of ["g", "r", "inner", "c", "e", "l", "t"]) {
    const before = original.document.get(id), after = restored.get(id);
    assert.equal(after.type, before.type);
    assert.deepEqual(after.geometry, before.geometry);
    assert.deepEqual(after.styles, before.styles);
    assert.deepEqual(after.children.map(child => child.id), before.children.map(child => child.id));
    assert.equal(restored.parentOf(id)?.id, original.document.parentOf(id)?.id);
    assert.equal(restored.indexOf(id), original.document.indexOf(id));
  }
  assert.deepEqual(restored.get("r").styles, {});
  assert.ok(restored.get("t").accept({
    visitRect: () => false, visitCircle: () => false,
    visitEllipse: () => false, visitLine: () => false, visitGroup: () => false,
    visitText: shape => shape.content === "开始 & <结束>"
  }));
});

test("missing ids are assigned in preorder after reserving every explicit id", () => {
  const result = new SvgParser().parse(wrap('<g><rect/><g id="g1"><rect id="rect1"/><rect/></g></g>'));
  assert.deepEqual(result.warnings, [
    "warning: assigned id g2 to unnamed <g>",
    "warning: assigned id rect2 to unnamed <rect>",
    "warning: assigned id rect3 to unnamed <rect>",
  ]);
  assert.equal(result.document.parentOf("rect2")?.id, "g2");
  assert.equal(result.document.parentOf("rect3")?.id, "g1");
  assert.deepEqual(result.document.get("rect2").geometry, { x: 0, y: 0, width: 0, height: 0 });
});

test("SVG rejects duplicate or invalid explicit ids instead of repairing them", () => {
  assert.equal(new SvgParser().parse(wrap('<rect id="valid"/>')).document.get("valid").id, "valid");
  for (const body of ['<rect id="a"/><g id="a"/>', '<rect id=""/>', '<rect id="a b"/>']) {
    assert.throws(() => new SvgParser().parse(wrap(body)));
  }
});

test("XML errors, unsafe declarations and unsupported visual data are rejected", () => {
  assert.equal(new SvgParser().parse(wrap("")).document.width, 400);
  const inputs = [
    "", '<svg><rect></svg>', '<svg/><svg/>', '<svg><rect x=1/></svg>',
    wrap('<text>&unknown;</text>'), wrap('<text>&#0;</text>'),
    '<!DOCTYPE svg [<!ENTITY e "hello">]>' + wrap('<text>&e;</text>'),
    '<?xml-stylesheet href="x.css"?>' + wrap(''),
    wrap('<path d="M0 0"/>'), wrap('<rect transform="translate(1,2)"/>'),
    wrap('<text font-size="16">x</text>'), wrap('<text><tspan>x</tspan></text>'),
    wrap('<rect style="fill:red"/>'), wrap('<rect onclick="x"/>'),
    wrap('<rect><circle/></rect>'), wrap('unexpected text'),
    wrap('', 'width="400" height="200" viewBox="10 0 400 200"'),
    wrap('', 'width="400" height="200" preserveAspectRatio="none"'),
  ];
  for (const xml of inputs) assert.throws(() => new SvgParser().parse(xml), xml);
});

test("SVG namespace, px dimensions and matching viewBox are handled without coordinate changes", () => {
  const doc = new SvgParser().parse('<s:svg xmlns:s="http://www.w3.org/2000/svg" width="400px" height="200px" viewBox="0,0,400,200">'
    + '<s:rect id="r" x="-1.5" width="2e1" height="3"/></s:svg>').document;
  assert.equal(doc.width, 400);
  assert.equal(doc.get("r").geometry["x"], -1.5);
  assert.equal(doc.get("r").geometry["width"], 20);
  assert.throws(() => new SvgParser().parse('<svg xmlns="urn:wrong"/>'), /namespace/);
  assert.throws(() => new SvgParser().parse(wrap('<rect xmlns="urn:wrong"/>')), /namespace/);
  assert.throws(() => new SvgParser().parse(wrap('', 'width="100%" height="200"')));
  assert.throws(() => new SvgParser().parse(wrap('', 'width="0" height="200"')));
});

test("XML comments and CDATA text are accepted, text whitespace and escapes survive roundtrip", () => {
  const content = ' 中文\t"&<>\n下一行\r末行';
  const doc = new SvgDocument();
  const text = new Text("t", 1, 2, content);
  text.set("fill", 'red"&\t\n');
  doc.add(text);
  const output = new SvgSerializer().serialize(doc);
  const restored = new SvgParser().parse(output).document.get("t");
  assert.deepEqual(restored.styles, text.styles);
  assert.equal(restored.accept({
    visitRect: () => "", visitCircle: () => "", visitEllipse: () => "",
    visitLine: () => "", visitGroup: () => "", visitText: shape => shape.content
  }), content);
  const parsed = new SvgParser().parse('<!-- comment -->' + wrap('<text id="t"><![CDATA[<内容>]]><!--skip-->&amp;</text>'));
  assert.match(new SvgSerializer().serialize(parsed.document), /&lt;内容&gt;&amp;/);
});

test("serializer rejects characters that cannot appear in XML rather than producing corrupt files", () => {
  for (const value of ["bad\u0000", "bad\ud800"]) {
    const doc = new SvgDocument();
    doc.add(new Text("t", 0, 0, value));
    assert.throws(() => new SvgSerializer().serialize(doc), /XML character/);
  }
});

test("plain group data-kind box is downgraded with feedback while preserving its subtree", () => {
  const result = new SvgParser().parse(wrap('<g id="box" data-kind="box"><rect id="r"/></g>'));
  assert.equal(result.document.get("box").type, "g");
  assert.equal(result.document.parentOf("r")?.id, "box");
  assert.ok(result.warnings.some(warning => warning.includes("box") && warning.includes("ordinary")));
});

test("shape factory imports XML attributes through its existing type lookup", () => {
  const factory = new ShapeFactory();
  const shape = factory.createFromAttributes("rect", "r", new Map([["width", "5"], ["fill", "in"]]), "");
  assert.deepEqual(shape.geometry, { x: 0, y: 0, width: 5, height: 0 });
  assert.deepEqual(shape.styles, { fill: "in" });
  assert.throws(() => factory.createFromAttributes("path", "p", new Map(), ""), /unknown shape type/);
  assert.throws(() => factory.createFromAttributes("rect", "r", new Map([["rx", "1"]]), ""), /unknown attribute/);
});

test("serialization follows current sibling order and preserves container styles without flattening", () => {
  const doc = new SvgDocument();
  const a = new Rect("a", 0, 0, 1, 1), b = new Rect("b", 0, 0, 1, 1);
  const group = new Group("g", [a, b]); group.set("fill", "blue"); doc.add(group);
  doc.reparent("a", "g");
  const xml = new SvgSerializer().serialize(doc);
  assert.ok(xml.indexOf('id="b"') < xml.indexOf('id="a"'));
  const restored = new SvgParser().parse(xml).document;
  assert.deepEqual(restored.get("a").styles, {});
  assert.deepEqual(restored.get("g").styles, { fill: "blue" });
});


test("XML text attributes cannot overwrite element content through the CLI text setter", () => {
  assert.throws(() => new SvgParser().parse(wrap('<text id="t" text="replacement">original</text>')), /unknown attribute: text/);
  assert.equal(new SvgParser().parse(wrap('<text id="t">original</text>')).document.get("t").type, "text");
});

test("canvas dimensions can come from matching viewBox but unsupported encodings and invalid geometry fail", () => {
  const doc = new SvgParser().parse(wrap('<rect id="r"/>', 'viewBox="0 0 300 150"')).document;
  assert.equal(doc.width, 300);
  assert.equal(doc.height, 150);
  for (const xml of [
    '<?xml version="1.0" encoding="ISO-8859-1"?>' + wrap(""),
    wrap('<rect width="-1"/>'), wrap('<line x1="Infinity"/>'),
    wrap('<rect stroke-width="-1"/>'), wrap('<g><rect xmlns=""/></g>'),
  ]) assert.throws(() => new SvgParser().parse(xml));
});

test("an omitted ellipse radius uses the other numeric radius as specified by SVG 2", () => {
  const doc = new SvgParser().parse(wrap('<ellipse id="x" rx="12"/><ellipse id="y" ry="8"/><ellipse id="empty"/>')).document;
  assert.deepEqual(doc.get("x").geometry, { cx: 0, cy: 0, rx: 12, ry: 12 });
  assert.deepEqual(doc.get("y").geometry, { cx: 0, cy: 0, rx: 8, ry: 8 });
  assert.deepEqual(doc.get("empty").geometry, { cx: 0, cy: 0, rx: 0, ry: 0 });
});

test("bare ampersands and malformed references fail in text and quoted attributes", () => {
  const parser = new SvgParser();
  assert.equal(parser.parse(wrap('<text id="t">valid &amp; &#38; &#x26;</text>')).document.get("t").type, "text");
  for (const value of ["a & b", "&", "&;", "&%", "&#-1;", "&amp", "&#xZZ;", "&unknown;"]) {
    assert.throws(() => parser.parse(wrap('<text id="t">' + value + '</text>')), /invalid SVG/);
    assert.throws(() => parser.parse(wrap('<rect id="r" fill="' + value + '"/>')), /invalid SVG/);
    assert.throws(() => parser.parse(wrap("<rect id='r' fill='" + value + "'/>")), /invalid SVG/);
  }
});

test("reference validation preserves literal ampersands in CDATA and comments", () => {
  const parser = new SvgParser();
  const xml = '<!-- & &#-1; -->' + wrap('<text id="t"><![CDATA[a & b &#-1; &unknown;]]><!-- & --> &amp; &#x1F600;</text>');
  const result = parser.parse(xml);
  assert.deepEqual(result.warnings, []);
  const serialized = new SvgSerializer().serialize(result.document);
  assert.match(serialized, /a &amp; b &amp;#-1; &amp;unknown; &amp; 😀/);
  assert.equal(parser.parse(serialized).document.get("t").type, "text");
});

test("namespace validation uses declarations from the file without SVG MIME defaults", () => {
  const parser = new SvgParser();
  assert.throws(() => parser.parse('<svg><rect id="r"/></svg>'), /unsupported SVG namespace/);
  assert.throws(() => parser.parse('<svg xmlns=""><rect id="r"/></svg>'), /unsupported SVG namespace/);
  assert.throws(() => parser.parse(wrap('<rect xmlns="" id="r"/>')), /unsupported SVG namespace/);
  assert.equal(parser.parse(wrap('<rect id="r"/>')).document.get("r").id, "r");
  assert.equal(parser.parse('<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:rect id="r"/></s:svg>').document.get("r").id, "r");
});

test("serialized SVG is byte-stable after parse and produces no further warnings", () => {
  const parser = new SvgParser(), serializer = new SvgSerializer();
  const first = parser.parse(wrap('<g fill="blue"><text>中文 &amp; 内容</text><text id="empty"/>'
    + '<rect id="r" fill=""/><g><circle r="2"/></g></g>'));
  assert.ok(first.warnings.length > 0);
  const xml = serializer.serialize(first.document);
  const second = parser.parse(xml);
  assert.deepEqual(second.warnings, []);
  assert.equal(serializer.serialize(second.document), xml);
  assert.deepEqual(parser.parse(serializer.serialize(second.document)).warnings, []);
});

test("text containing a CDATA closing sequence is escaped and restored exactly", () => {
  const doc = new SvgDocument();
  doc.add(new Text("t", 0, 0, "a]]>b"));
  const xml = new SvgSerializer().serialize(doc);
  assert.match(xml, /a]]&gt;b/);
  const restored = new SvgParser().parse(xml).document.get("t");
  assert.equal(restored.accept({
    visitRect: () => "", visitCircle: () => "", visitEllipse: () => "",
    visitLine: () => "", visitGroup: () => "", visitText: shape => shape.content
  }), "a]]>b");
});
