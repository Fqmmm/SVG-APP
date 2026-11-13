import assert from "node:assert/strict";
import { test } from "node:test";
import { SvgOutlineParser } from "../../src/outline/SvgOutlineParser.js";

const parser = new SvgOutlineParser();

test("nested groups and unnamed leaves retain source order and their exact source spans", () => {
  const source = '<svg><g id="flow"><rect id="start"/><g><text>Start</text></g></g></svg>';
  const [svg] = parser.parse(source);
  assert.equal(svg?.name, "svg");
  assert.deepEqual(svg?.span, { start: 0, end: source.length });
  const flow = svg?.children[0];
  assert.equal(flow?.name, "g#flow");
  assert.deepEqual(flow?.children.map(node => node.name), ["rect#start", "g"]);
  const rect = flow!.children[0]!;
  assert.equal(source.slice(rect.span.start, rect.span.end), '<rect id="start"/>');
  assert.equal(source.slice(rect.selection.start, rect.selection.end), "rect");
  assert.equal(flow?.children[1]?.children[0]?.name, "text");
});

test("CRLF, Chinese, emoji and multiple elements on one line keep UTF-16 offsets", () => {
  const source = '<svg>\r\n<!-- \u4e2d\u6587\ud83d\ude00 -->\r\n<circle/><text id="title">\u6807\u9898</text></svg>';
  const children = parser.parse(source)[0]!.children;
  assert.equal(children[0]!.span.start, source.indexOf("<circle"));
  assert.equal(children[1]!.selection.start, source.indexOf("<text") + 1);
  assert.equal(children[1]!.span.end, source.indexOf("</text>") + "</text>".length);
});

test("comments, CDATA and quoted greater-than characters never create fake elements", () => {
  const source = '<svg><!-- <rect/> --><g id="a&gt;b" data-note="x > y"><text><![CDATA[<circle/>]]></text></g></svg>';
  const group = parser.parse(source)[0]!.children[0]!;
  assert.equal(group.name, "g#a>b");
  assert.deepEqual(group.children.map(node => node.name), ["text"]);
  assert.deepEqual(group.children[0]!.children, []);
});

test("editing a name refreshes the outline without stale parser state", () => {
  assert.equal(parser.parse('<svg><g id="old"/></svg>')[0]?.children[0]?.name, "g#old");
  assert.equal(parser.parse('<svg><g id="new"/><path/></svg>')[0]?.children.length, 2);
  assert.equal(parser.parse('<svg><g id="new"/></svg>')[0]?.children[0]?.name, "g#new");
});

test("incomplete and malformed XML return an empty outline, then a later valid edit recovers", () => {
  for (const source of ["", "<svg", "<svg><g>", "<svg><g></svg>", "<svg><g></x></svg>", '<svg><rect id="open/></svg>', "<svg/><svg/>"]) {
    assert.deepEqual(parser.parse(source), [], source);
  }
  assert.equal(parser.parse("<svg/>")[0]?.name, "svg");
});

test("arbitrary SVG tags, missing and duplicate ids are displayed without CLI import rules", () => {
  const result = parser.parse('<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:path id="same"/><foreignObject id="same"/><rect/></s:svg>');
  assert.equal(result[0]?.name, "s:svg");
  assert.deepEqual(result[0]?.children.map(node => node.name), ["s:path#same", "foreignObject#same", "rect"]);
});
