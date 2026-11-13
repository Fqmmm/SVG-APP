import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { projectDirectory } from "../../src/composition/ProjectDirectory.js";

test("code assembly finds the project from source or nested build layouts", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-project-"));
  try {
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "svg-app" }));
    mkdirSync(join(directory, "output"));
    writeFileSync(join(directory, "output", "package.json"), JSON.stringify({ name: "build-output", type: "module" }));
    for (const entry of ["src/composition/codePlugins.ts", "output/deep/modules/codePlugins.js"]) {
      assert.equal(projectDirectory(pathToFileURL(join(directory, entry))), directory);
    }
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }
});
