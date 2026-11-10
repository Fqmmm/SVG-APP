import { readFileSync } from "node:fs";
import { isRecord } from "./PluginManifest.js";

export interface PluginConfigurationEntry {
  readonly module: string;
  readonly enabled?: boolean;
  readonly options?: unknown;
}

export function readPluginConfiguration(path: string): readonly PluginConfigurationEntry[] {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(value) || !Array.isArray(value["plugins"])) {
      throw new Error("invalid config");
    }
    return value["plugins"].map(entry => {
      if (!isRecord(entry) || typeof entry["module"] !== "string" || entry["module"].trim() === ""
        || (Object.hasOwn(entry, "enabled") && typeof entry["enabled"] !== "boolean")) {
        throw new Error("invalid config");
      }
      return { module: entry["module"], ...(Object.hasOwn(entry, "enabled") ? { enabled: entry["enabled"] as boolean } : {}),
        ...(Object.hasOwn(entry, "options") ? { options: entry["options"] } : {}) };
    });
  } catch {
    throw new Error("invalid plugin config");
  }
}
