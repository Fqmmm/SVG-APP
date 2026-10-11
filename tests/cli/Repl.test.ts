import assert from "node:assert/strict";
import { PassThrough, Readable } from "node:stream";
import { test } from "node:test";
import { Repl } from "../../src/cli/Repl.js";

const welcome = "svg-editor 0.1\n";

test("Repl displays a welcome message and prompt before input ends", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });
  const running = new Repl(input, output).run();

  try {
    assert.equal(text, welcome + "svg> ");
  } finally {
    input.end();
    await running;
  }
});

test("Repl finishes at EOF without repeating the initial prompt", async () => {
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });

  await new Repl(Readable.from([]), output).run();

  assert.equal(text, welcome + "svg> ");
});

test("Repl skips blank and comment lines and prompts for the next line", async () => {
  const input = Readable.from(["\n   \n  # a script comment\n"]);
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });

  await new Repl(input, output).run();

  assert.equal(text, welcome + "svg> ".repeat(4));
});

test("Repl dispatches commands from CRLF input and continues reading", async () => {
  const input = Readable.from(["init 400 200\r\ncreate rect r1 0 0 10 10\r\n"]);
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });

  await new Repl(input, output).run();

  const response = "canvas 400x200 created\nsvg> rect#r1 created\nsvg> ";
  assert.equal(text, welcome + "svg> " + response);
});

test("Repl reports one error per line and continues through parser and domain failures", async () => {
  const input = Readable.from([
    'tree\ninit 400 200\ncreate rect r 1 2 3 4\ncreate text t 1 2 "open\nmove r NaN 0\nmove r 5 6\nundo\nshow r\n',
  ]);
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });
  await new Repl(input, output).run();
  assert.equal(text, welcome + "svg> " + [
    "error: no document. use 'init' or 'read' first",
    "canvas 400x200 created", "rect#r created",
    "error: unterminated quoted argument", "error: invalid number: dx",
    "rect#r moved to (6,8)", "rect#r moved back to (1,2)",
    "rect#r  parent=svg\n  x=1 y=2 w=3 h=4",
  ].join("\nsvg> ") + "\nsvg> ");
});

test("Repl builds nested Chinese text, moves a group and prints its restored subtree", async () => {
  const input = Readable.from([
    'init\ncreate g node\ncreate text label 10 20 "开始 # end" in node\nmove node 0 100\nundo\ntree node\n',
  ]);
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });
  await new Repl(input, output).run();
  assert.equal(text, welcome + "svg> " + [
    "canvas 800x600 created", "g#node created",
    "text#label created in g#node", "g#node moved by (0,100)",
    "g#node moved back by (0,-100)", 'g#node\n└── text#label  (10,20) "开始 # end"',
  ].join("\nsvg> ") + "\nsvg> ");
});
