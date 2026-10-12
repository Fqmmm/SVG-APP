import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SvgParser } from "../../src/infrastructure/SvgParser.js";
import type { SvgDocument } from "../../src/domain/SvgDocument.js";

export class SessionReplay {
  private readonly directory = mkdtempSync(join(tmpdir(), "svg-app-session-"));
  readonly output: string;

  constructor(script: string) {
    try {
      mkdirSync(join(this.directory, "examples"));
      for (const fixture of ["phase8-other.svg", "phase8-unsupported.svg", "phase8-no-namespace.svg", "phase8-bad-reference.svg"]) {
        copyFileSync(this.example(fixture), join(this.directory, "examples", fixture));
      }
      const entry = fileURLToPath(new URL("../../src/main.js", import.meta.url));
      const result = spawnSync(process.execPath, [entry], {
        cwd: this.directory, input: readFileSync(this.example(script), "utf8"),
        encoding: "utf8", timeout: 10_000,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0);
      assert.equal(result.stderr, "");
      assert.ok(result.stdout.startsWith("svg-editor 0.1\nsvg> "));
      this.output = result.stdout;
    } catch (error) {
      this.close();
      throw error;
    }
  }

  responses(): readonly string[] {
    return this.output.split("svg> ").slice(1).map(part => part.replace(/\n$/u, "")).filter(part => part !== "");
  }

  xml(name: string): string { return readFileSync(join(this.directory, "examples", name), "utf8"); }
  document(name: string): SvgDocument { return new SvgParser().parse(this.xml(name)).document; }

  close(): void {
    const directory = resolve(this.directory);
    assert.ok(directory.startsWith(resolve(tmpdir()) + sep));
    rmSync(directory, { recursive: true, force: true });
  }

  private example(name: string): string {
    return fileURLToPath(new URL("../../../examples/" + name, import.meta.url));
  }
}
