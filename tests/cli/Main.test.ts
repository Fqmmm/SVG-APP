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
