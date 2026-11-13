import { CommandArguments } from "../../extensions/index.js";
import type { Command } from "../../extensions/index.js";
import type { DirectoryAccess, DirectoryEntry } from "./DirectoryAccess.js";

export class DirCommand implements Command {
  readonly name = "dir";
  readonly help = ["dir"];
  readonly requiresDocument = false;

  constructor(private readonly directory: DirectoryAccess) {
  }

  execute(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 0, "dir");
    return this.format(this.read());
  }

  private read(): readonly DirectoryEntry[] {
    let path = "<cwd unavailable>";
    try {
      path = this.directory.currentDirectory();
      return this.directory.entries(path);
    } catch {
      throw new Error("cannot read directory: " + path);
    }
  }

  private format(entries: readonly DirectoryEntry[]): string {
    const kinds = ["directory", "file", "link", "other"];
    const markers = new Map([["directory", "[DIR]"], ["file", "[FILE]"], ["link", "[LINK]"], ["other", "[OTHER]"]]);
    for (const entry of entries) {
      if (!markers.has(entry.kind)) {
        throw new Error("invalid directory entry kind: " + entry.kind);
      }
    }
    const ordered = entries.filter(entry => entry.name !== "." && entry.name !== "..").sort((left, right) => {
      const group = kinds.indexOf(left.kind) - kinds.indexOf(right.kind);
      return group || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    });
    return ordered.length === 0 ? "(empty directory)" : ordered.map(entry => {
      return markers.get(entry.kind)! + "  " + entry.name;
    }).join("\n");
  }
}
