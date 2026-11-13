import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { DirCommand } from "../../src/plugins/dir/DirCommand.js";
import { NodeDirectoryAccess } from "../../src/plugins/dir/NodeDirectoryAccess.js";

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "svg-dir-"));
  mkdirSync(join(directory, "folder"));
  writeFileSync(join(directory, "folder", "nested.txt"), "nested");
  writeFileSync(join(directory, ".hidden"), "hidden");
  writeFileSync(join(directory, "z.txt"), "z");
  return directory;
}

function removeFixture(directory: string): void {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  rmSync(directory, { recursive: true, force: true });
}

test("Node directory adapter and dir command list real direct entries without following links", () => {
  const directory = fixture();
  try {
    symlinkSync(join(directory, "folder"), join(directory, "link"), "junction");
    class FixedDirectory extends NodeDirectoryAccess {
      override currentDirectory(): string {
        return directory;
      }
    }
    const command = new DirCommand(new FixedDirectory());
    assert.equal(command.execute([]), "[DIR]  folder\n[FILE]  .hidden\n[FILE]  z.txt\n[LINK]  link");
    assert.doesNotMatch(command.execute([]), /nested/);
    assert.equal(new NodeDirectoryAccess().currentDirectory(), process.cwd());
  } finally {
    removeFixture(directory);
  }
});

test("real adapter returns an empty list and command reports missing directory failures", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-dir-empty-"));
  try {
    const adapter = new NodeDirectoryAccess();
    assert.deepEqual(adapter.entries(directory), []);
    const missing = join(directory, "missing");
    class MissingDirectory extends NodeDirectoryAccess {
      override currentDirectory(): string {
        return missing;
      }
    }
    assert.throws(() => new DirCommand(new MissingDirectory()).execute([]), { message: "cannot read directory: " + missing });
  } finally {
    removeFixture(directory);
  }
});
