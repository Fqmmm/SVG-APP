import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("CLI entry point starts and exits successfully when stdin closes", () => {
  const entryPoint = fileURLToPath(new URL("../../src/main.js", import.meta.url));
  const result = spawnSync(process.execPath, [entryPoint], {
    input: "",
    encoding: "utf8",
    timeout: 5_000,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "svg-editor 0.1\nsvg> ");
});

test("CLI entry point runs a complete edit/query/undo session until EOF", () => {
  const entryPoint = fileURLToPath(new URL("../../src/main.js", import.meta.url));
  const result = spawnSync(process.execPath, [entryPoint], {
    input: [
      "init 400 200", "create g flow", "create rect r 30 70 120 60 blue in flow",
      "move r 10 0", "undo", "redo", "delete r", "undo", "show r",
    ].join("\n") + "\n",
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "svg-editor 0.1\nsvg> " + [
    "canvas 400x200 created", "g#flow created", "rect#r created in g#flow",
    "rect#r moved to (40,70)", "rect#r moved back to (30,70)", "rect#r moved to (40,70)",
    "rect#r deleted", "rect#r restored into g#flow",
    "rect#r  parent=g#flow\n  x=40 y=70 w=120 h=60\n  fill=blue",
  ].join("\nsvg> ") + "\nsvg> ");
});
