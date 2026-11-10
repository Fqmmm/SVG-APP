import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isRecord } from "./plugins/PluginManifest.js";

export function projectDirectory(origin: URL): string {
  let directory = dirname(fileURLToPath(origin));
  while (true) {
    const path = join(directory, "package.json");
    if (existsSync(path)) {
      const manifest: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (isRecord(manifest) && manifest["name"] === "svg-app") {
        return directory;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error("svg-app project package.json not found");
    }
    directory = parent;
  }
}
