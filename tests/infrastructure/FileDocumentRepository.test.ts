import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileDocumentRepository } from "../../src/infrastructure/FileDocumentRepository.js";
import { SvgDocument } from "../../src/domain/SvgDocument.js";
import { Text } from "../../src/domain/Text.js";

test("file repository writes UTF-8 SVG and reads it back from a path with spaces", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const file = join(directory, "中文 diagram.svg");
    const doc = new SvgDocument(40, 20);
    doc.add(new Text("t", 1, 2, "开始 & 结束"));
    const repository = new FileDocumentRepository();
    repository.write(file, doc);
    assert.match(readFileSync(file, "utf8"), /开始 &amp; 结束/);
    assert.equal(repository.read(file).document.get("t").type, "text");
    assert.deepEqual(readdirSync(directory), ["中文 diagram.svg"]);
    repository.write(file, new SvgDocument(100, 200));
    assert.equal(repository.read(file).document.width, 100);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("filesystem errors use prescribed read and write messages", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const missing = join(directory, "missing.svg");
    const repository = new FileDocumentRepository();
    assert.throws(() => repository.read(missing), { message: "cannot read file: " + missing });
    assert.throws(() => repository.write(join(directory, "absent", "out.svg"), new SvgDocument()), /cannot write file:/);
    assert.throws(() => repository.write(directory, new SvgDocument()), { message: "cannot write file: " + directory });
    assert.deepEqual(readdirSync(directory), []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("serialization failure preserves existing bytes and leaves no temporary file", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const file = join(directory, "out.svg");
    writeFileSync(file, "original bytes");
    const doc = new SvgDocument(); doc.add(new Text("t", 0, 0, "\u0000"));
    assert.throws(() => new FileDocumentRepository().write(file, doc), /XML character/);
    assert.equal(readFileSync(file, "utf8"), "original bytes");
    assert.deepEqual(readdirSync(directory), ["out.svg"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("bad XML and invalid UTF-8 are rejected rather than loaded with replacement characters", () => {
  const directory = mkdtempSync(join(tmpdir(), "svg-app-"));
  try {
    const file = join(directory, "bad.svg");
    writeFileSync(file, "<svg><rect></svg>");
    assert.throws(() => new FileDocumentRepository().read(file), /invalid SVG/);
    writeFileSync(file, Buffer.from([0xff, 0xfe, 0x3c]));
    assert.throws(() => new FileDocumentRepository().read(file));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
