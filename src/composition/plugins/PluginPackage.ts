import { readFileSync, statSync, existsSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolveImport } from "import-meta-resolve";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { isRecord } from "./PluginManifest.js";

export interface PluginPackage {
  readonly manifest: unknown;
  readonly entry: string;
}

export class PluginNotFound extends Error {
  constructor(module: string) {
    super("plugin not found: " + module);
  }
}

function readManifest(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function nearestManifest(entry: string): unknown {
  let directory = dirname(entry);
  while (true) {
    const path = join(directory, "package.json");
    if (existsSync(path)) {
      const manifest = readManifest(path);
      if (isRecord(manifest) && Object.hasOwn(manifest, "contributes") && typeof manifest["name"] === "string") {
        return manifest;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error("plugin package.json not found");
    }
    directory = parent;
  }
}

export function resolvePlugin(module: string, baseDirectory: string): PluginPackage {
  if (!module.startsWith(".") && !isAbsolute(module)) {
    const parent = pathToFileURL(join(baseDirectory, "plugins.config.json"));
    let manifestPath: string | undefined;
    try {
      manifestPath = findPackageJSON(module, parent);
    } catch (error) {
      if (error instanceof Error && Object.hasOwn(error, "code") && (error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
        throw new PluginNotFound(module);
      }
      throw error;
    }
    if (manifestPath === undefined) {
      throw new PluginNotFound(module);
    }
    return { entry: fileURLToPath(resolveImport(module, parent.href)), manifest: readManifest(manifestPath) };
  }
  const location = resolve(baseDirectory, module);
  let directory: boolean;
  try {
    directory = statSync(location).isDirectory();
  } catch (error) {
    if (error instanceof Error && Object.hasOwn(error, "code") && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PluginNotFound(module);
    }
    throw error;
  }
  if (!directory) {
    return { entry: location, manifest: nearestManifest(location) };
  }
  const manifest = readManifest(join(location, "package.json"));
  const entry = resolve(location, isRecord(manifest) && typeof manifest["main"] === "string" ? manifest["main"] : "index.js");
  return { entry, manifest };
}
