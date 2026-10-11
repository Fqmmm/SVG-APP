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

test("Repl reports unfinished command support and continues reading", async () => {
  const input = Readable.from(["init 400 200\r\ncreate rect r1 0 0 10 10\r\n"]);
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => { text += chunk.toString("utf8"); });

  await new Repl(input, output).run();

  const response = "error: command handling is not available yet\nsvg> ";
  assert.equal(text, welcome + "svg> " + response.repeat(2));
});
