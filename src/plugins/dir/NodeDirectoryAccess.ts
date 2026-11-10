import { readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import type { DirectoryAccess, DirectoryEntry } from "./DirectoryAccess.js";

export class NodeDirectoryAccess implements DirectoryAccess {
  currentDirectory(): string {
    return process.cwd();
  }

  entries(path: string): readonly DirectoryEntry[] {
    return readdirSync(path, { withFileTypes: true }).map(entry => {
      return { name: entry.name, kind: this.kind(entry) };
    });
  }

  private kind(entry: Dirent): DirectoryEntry["kind"] {
    if (entry.isSymbolicLink()) {
      return "link";
    }
    if (entry.isDirectory()) {
      return "directory";
    }
    return entry.isFile() ? "file" : "other";
  }
}
