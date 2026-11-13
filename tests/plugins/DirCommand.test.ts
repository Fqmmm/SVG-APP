import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable, PassThrough } from "node:stream";
import { createEditor } from "../../src/composition/createEditor.js";
import { createDefaultFramework } from "../../src/composition/createDefaultFramework.js";
import { RegisteredRepl } from "../../src/cli/RegisteredRepl.js";
import { DirCommand } from "../../src/plugins/dir/DirCommand.js";
import type { DirectoryAccess, DirectoryEntry } from "../../src/plugins/dir/DirectoryAccess.js";

class FakeDirectory implements DirectoryAccess {
  readonly calls: string[] = [];

  constructor(private readonly contents: readonly DirectoryEntry[] | Error) {
  }

  currentDirectory(): string {
    return "/fixed";
  }

  entries(path: string): readonly DirectoryEntry[] {
    this.calls.push(path);
    if (this.contents instanceof Error) {
      throw this.contents;
    }
    return this.contents;
  }
}

test("dir sorts directories before files, includes hidden entries, excludes dot entries and is stable", () => {
  const access = new FakeDirectory([
    { name: "z.txt", kind: "file" }, { name: "z-dir", kind: "directory" },
    { name: ".hidden", kind: "file" }, { name: "A-dir", kind: "directory" },
    { name: "a.txt", kind: "file" }, { name: ".", kind: "directory" },
    { name: "..", kind: "directory" }, { name: "link", kind: "link" },
  ]);
  const command = new DirCommand(access);
  const expected = "[DIR]  A-dir\n[DIR]  z-dir\n[FILE]  .hidden\n[FILE]  a.txt\n[FILE]  z.txt\n[LINK]  link";
  assert.equal(command.execute([]), expected);
  assert.equal(command.execute([]), expected);
  assert.deepEqual(access.calls, ["/fixed", "/fixed"]);
  assert.throws(() => command.execute(["unexpected"]), /usage: dir/);
  assert.equal(access.calls.length, 2);
});

test("dir supports empty directories, errors and an uninitialized editor", () => {
  const framework = createDefaultFramework();
  const editor = createEditor(framework);
  framework.commands.register(new DirCommand(new FakeDirectory([])));
  assert.equal(editor.dispatcher.dispatch("dir"), "(empty directory)");
  assert.match(editor.dispatcher.dispatch("help"), /^dir$/m);
  assert.throws(() => new DirCommand(new FakeDirectory(new Error("denied"))).execute([]),
    { message: "cannot read directory: /fixed" });
});

test("successful and failing dir queries do not alter document, path or undo/redo state", () => {
  for (const contents of [[], new Error("denied")]) {
    const access = new FakeDirectory(contents);
    const framework = createDefaultFramework();
    const editor = createEditor(framework);
    framework.commands.register(new DirCommand(access));
    editor.dispatcher.dispatch("init");
    editor.dispatcher.dispatch("create rect r 1 2 3 4");
    editor.dispatcher.dispatch("move r 5 6");
    editor.dispatcher.dispatch("undo");
    const document = editor.session.document;
    const query = (): void => {
      if (contents instanceof Error) {
        assert.throws(() => editor.dispatcher.dispatch("dir"), /cannot read directory/);
        return;
      }
      editor.dispatcher.dispatch("dir");
    };
    query();
    assert.equal(editor.session.document, document);
    assert.equal(editor.session.path, undefined);
    assert.deepEqual(document.get("r").geometry, { x: 1, y: 2, width: 3, height: 4 });
    editor.dispatcher.dispatch("redo");
    query();
    editor.dispatcher.dispatch("undo");
    assert.equal(document.get("r").geometry["x"], 1);
  }
});

test("a dir read error is reported by the REPL and subsequent commands still run", async () => {
  const framework = createDefaultFramework();
  framework.commands.register(new DirCommand(new FakeDirectory(new Error("denied"))));
  const editor = createEditor(framework);
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => {
    text += chunk.toString("utf8");
  });
  await new RegisteredRepl(Readable.from(["dir\ninit\ntree\n"]), output, editor.dispatcher).run();
  assert.match(text, /error: cannot read directory: \/fixed/);
  assert.match(text, /canvas 800x600 created/);
  assert.match(text, /svg \(800x600\)/);
});

test("cwd lookup failures use a stable directory error without leaking adapter exceptions", () => {
  class UnavailableDirectory extends FakeDirectory {
    override currentDirectory(): string {
      throw new Error("cwd unavailable");
    }
  }
  const access = new UnavailableDirectory([]);
  assert.throws(() => new DirCommand(access).execute([]), { message: "cannot read directory: <cwd unavailable>" });
  assert.deepEqual(access.calls, []);
});

test("special directory entries are marked and invalid adapter kinds fail explicitly", () => {
  assert.equal(new DirCommand(new FakeDirectory([{ name: "pipe", kind: "other" }])).execute([]), "[OTHER]  pipe");
  const invalid = { name: "bad", kind: "alien" as DirectoryEntry["kind"] };
  assert.throws(() => new DirCommand(new FakeDirectory([invalid])).execute([]), /invalid directory entry kind: alien/);
});
