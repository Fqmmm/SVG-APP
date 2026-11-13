import assert from "node:assert/strict";
import { test } from "node:test";
import { SvgFileBadge } from "../../src/decoration/SvgFileBadge.js";

test("only SVG ordinary files receive the exact badge and files are never modified", async () => {
  const paths: string[] = [];
  const badge = new SvgFileBadge({
    async isFile(path) {
      paths.push(path);
      return !path.endsWith("folder.svg");
    },
  });
  assert.equal(await badge.forPath("/example.svg"), "[]");
  assert.equal(await badge.forPath("/folder.svg"), undefined);
  assert.equal(await badge.forPath("/notes.txt"), undefined);
  assert.equal(await badge.forPath("/not.svg.backup"), undefined);
  assert.deepEqual(paths, ["/example.svg", "/folder.svg"]);
});

test("unavailable files produce no decoration and do not reject the request", async () => {
  const badge = new SvgFileBadge({
    async isFile() {
      throw new Error("file disappeared");
    },
  });
  assert.equal(await badge.forPath("/gone.svg"), undefined);
});
