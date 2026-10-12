import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionReplay } from "./SessionReplay.js";
import { SvgParser } from "../../src/infrastructure/SvgParser.js";
import { SvgSerializer } from "../../src/infrastructure/SvgSerializer.js";

test("experiment section 6 replays all feedback and both trees through the real CLI", () => {
  const replay = new SessionReplay("phase8-session.cli");
  try {
    assert.deepEqual(replay.responses(), [
      "canvas 800x600 created", "rect#bg created", "text#title created", "circle#c1 created", "rect#box created",
      "g#markers created with 2 children",
      "svg (800x600)\n├── rect#bg  x=0 y=0 w=800 h=600 fill=#ffffff\n├── text#title  (20,40) \"My Diagram\"\n└── g#markers\n    ├── circle#c1  cx=100 cy=100 r=20 fill=red\n    └── rect#box  x=200 y=80 w=60 h=60 fill=#3366ff",
      "circle#c1 moved to (130,100)", "circle#c1 moved back to (100,100)", "circle#c1 moved to (130,100)",
      'text#title updated: text="My Diagram v2"', 'text#title updated: text="My Diagram"',
      "error: cannot group a container into its own descendant: markers", "rect#box deleted", "rect#box restored into g#markers",
      "saved to examples/phase8-demo.svg (5 elements)", "error: undo not allowed after io command",
      "warning: assigned id rect1 to unnamed <rect>\nread examples/phase8-other.svg (7 elements)",
      "svg (400x300)\n├── rect#rect1  x=0 y=0 w=400 h=300 fill=#ffffff\n├── text#t1  (10,290) \"imported\"\n├── circle#c1  cx=50 cy=50 r=10\n├── g#g1\n│   ├── rect#r2  x=0 y=0 w=10 h=10\n│   └── circle#c2  cx=5 cy=5 r=2\n└── ellipse#e1  cx=1 cy=2 rx=3 ry=4",
    ]);
    const doc = replay.document("phase8-demo.svg");
    assert.deepEqual(doc.children.map(shape => shape.id), ["bg", "title", "markers"]);
    assert.deepEqual(doc.get("markers").children.map(shape => shape.id), ["c1", "box"]);
    assert.equal(doc.get("c1").geometry["cx"], 130);
    assert.equal(doc.parentOf("box")?.id, "markers");
    assert.equal(doc.indexOf("box"), 1);
    assert.equal(doc.get("title").accept({ visitRect: () => "", visitCircle: () => "", visitEllipse: () => "",
      visitLine: () => "", visitGroup: () => "", visitText: shape => shape.content }), "My Diagram");
  } finally { replay.close(); }
});

test("experiment flowchart version A saves unchanged geometry and updated Chinese text", () => {
  const replay = new SessionReplay("phase8-flowchart.cli");
  try {
    const responses = replay.responses();
    assert.equal(responses.length, 14);
    assert.ok(responses.includes("g#node2 moved by (0,100)"));
    assert.ok(responses.includes("g#node2 moved back by (0,-100)"));
    assert.ok(responses.includes('text#process-label updated: text="处理数据 v2"'));
    assert.equal(responses.at(-1), "saved to examples/phase8-flowchart.svg (8 elements)");
    assert.ok(!responses.some(response => response.startsWith("error:")));
    const doc = replay.document("phase8-flowchart.svg");
    assert.deepEqual(doc.children.map(shape => shape.id), ["flowchart"]);
    assert.deepEqual(doc.get("flowchart").children.map(shape => shape.id), ["node1", "node2", "arrow1"]);
    assert.deepEqual(doc.get("node1").children.map(shape => shape.id), ["start", "start-label"]);
    assert.deepEqual(doc.get("node2").children.map(shape => shape.id), ["process", "process-label"]);
    assert.deepEqual(doc.get("process").geometry, { x: 520, y: 100, width: 160, height: 60 });
    assert.deepEqual(doc.get("process-label").geometry, { x: 545, y: 135 });
    assert.deepEqual(doc.get("arrow1").geometry, { x1: 280, y1: 130, x2: 520, y2: 130 });
    assert.match(replay.xml("phase8-flowchart.svg"), /处理数据 v2/);
  } finally { replay.close(); }
});

test("mixed transforms structural edits and failed imports leave the expected saved document", () => {
  const replay = new SessionReplay("phase8-edges.cli");
  try {
    const errors = replay.responses().filter(response => response.startsWith("error:"));
    assert.equal(errors.length, 9);
    for (const message of [
      "cannot move a container into itself or its descendant: scene",
      "cannot ungroup top-level container: scene", "width must be non-negative",
      "cannot group a container into its own descendant: g", "id already exists: r",
      "invalid SVG: unknown attribute: transform", "invalid SVG: unsupported SVG namespace",
      "invalid SVG: invalid XML reference", "nothing to redo",
    ]) assert.ok(errors.some(error => error.includes(message)), message);
    const doc = replay.document("phase8-edges.svg");
    assert.equal(doc.width, 90);
    assert.equal(doc.height, 70);
    assert.deepEqual(doc.get("scene").children.map(shape => shape.id), ["g", "final"]);
    assert.deepEqual(doc.get("g").children.map(shape => shape.id), ["r", "c", "e", "l", "t"]);
    assert.deepEqual(doc.get("g").styles, { "stroke-width": 2 });
    assert.deepEqual(doc.get("r").geometry, { x: 0, y: 5, width: 6, height: 8 });
    assert.deepEqual(doc.get("c").geometry, { cx: 18, cy: 41, r: 10 });
    assert.deepEqual(doc.get("e").geometry, { cx: 6, cy: 13, rx: 4, ry: 6 });
    assert.deepEqual(doc.get("l").geometry, { x1: 0, y1: 5, x2: 4, y2: 9 });
    assert.deepEqual(doc.get("t").geometry, { x: 8, y: 13 });
    assert.equal(doc.find("extra"), undefined);
    assert.equal(doc.find("bad"), undefined);
    assert.equal(doc.parentOf("t")?.id, "g");
    assert.equal(doc.indexOf("final"), 1);
    assert.match(replay.xml("phase8-edges.svg"), /更新 &amp; &lt;内容&gt;/);
    assert.equal(replay.responses().filter(response => response.startsWith("saved to examples/phase8-edges.svg")).length, 3);
  } finally { replay.close(); }
});

test("complete session outputs remain stable across repeated parse and serialize", () => {
  for (const [script, output] of [
    ["phase8-session.cli", "phase8-demo.svg"],
    ["phase8-flowchart.cli", "phase8-flowchart.svg"],
    ["phase8-edges.cli", "phase8-edges.svg"],
  ] as const) {
    const replay = new SessionReplay(script);
    try {
      const xml = replay.xml(output);
      const parser = new SvgParser(), serializer = new SvgSerializer();
      const parsed = parser.parse(xml);
      assert.deepEqual(parsed.warnings, []);
      assert.equal(serializer.serialize(parsed.document), xml);
    } finally { replay.close(); }
  }
});

test("visual acceptance files preserve sibling order and explicit group-style semantics", () => {
  const replay = new SessionReplay("phase8-visual.cli");
  try {
    assert.ok(!replay.responses().some(response => response.startsWith("error:")));
    for (const [name, order] of [
      ["initial", ["blue", "red"]], ["front", ["red", "blue"]], ["back", ["blue", "red"]],
    ] as const) {
      const doc = replay.document("phase8-order-" + name + ".svg");
      assert.deepEqual(doc.children.map(shape => shape.id), order);
      assert.deepEqual(doc.get("blue").geometry, { x: 20, y: 20, width: 80, height: 80 });
      assert.deepEqual(doc.get("red").geometry, { x: 60, y: 20, width: 80, height: 80 });
      assert.deepEqual(doc.get("blue").styles, { fill: "blue" });
    }
    const grouped = replay.document("phase8-style-grouped.svg");
    const ungrouped = replay.document("phase8-style-ungrouped.svg");
    const restored = replay.document("phase8-style-restored.svg");
    assert.deepEqual(grouped.get("paint").styles, { fill: "blue" });
    assert.deepEqual(grouped.get("r").styles, {});
    assert.equal(grouped.parentOf("r")?.id, "paint");
    assert.equal(ungrouped.find("paint"), undefined);
    assert.equal(ungrouped.parentOf("r")?.id, "parent");
    assert.deepEqual(ungrouped.get("r").styles, {});
    assert.equal(restored.parentOf("r")?.id, "paint");
    assert.deepEqual(restored.get("paint").styles, { fill: "blue" });
    assert.equal(replay.xml("phase8-style-restored.svg"), replay.xml("phase8-style-grouped.svg"));
  } finally { replay.close(); }
});
