import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Framework } from "../../extensions/Framework.js";
import { isRecord, pluginManifest } from "./PluginManifest.js";
import { readPluginConfiguration } from "./PluginConfiguration.js";
import { resolvePlugin, PluginNotFound } from "./PluginPackage.js";
import { RegistrationConflict, ManifestMismatch } from "./PluginErrors.js";
import { createRegistrationContext } from "./RegistrationContext.js";
import { publishPlugin } from "./PluginActivation.js";

export interface Plugin {
  activate(context: Framework, options?: unknown): void | Promise<void>;
}

export interface CodePlugin {
  readonly module: string;
  readonly manifest: unknown;
  readonly plugin: unknown;
  readonly options?: unknown;
}

export class PluginLoader {
  constructor(private readonly framework: Framework, private readonly report: (message: string) => void) {
  }

  async activate(entry: CodePlugin): Promise<void> {
    let name = entry.module;
    try {
      const manifest = pluginManifest(entry.manifest);
      name = manifest.name;
      if (!isRecord(entry.plugin) || typeof entry.plugin["activate"] !== "function") {
        throw new Error("plugin must provide activate(context, options)");
      }
      const staged = createRegistrationContext();
      await (entry.plugin as unknown as Plugin).activate(staged, entry.options);
      publishPlugin(this.framework, staged, manifest);
    } catch (error) {
      this.failure(name, error);
    }
  }

  async loadCode(entry: { module: string; directory: string; load: () => Promise<Plugin>; options?: unknown }): Promise<void> {
    let name = entry.module;
    try {
      const resolved = resolvePlugin(entry.module, entry.directory);
      const manifest = pluginManifest(resolved.manifest);
      name = manifest.name;
      const plugin = await entry.load();
      await this.activate({ module: entry.module, manifest, plugin, options: entry.options });
    } catch (error) {
      this.failure(name, error);
    }
  }

  async loadConfiguration(path: string): Promise<void> {
    let entries;
    try {
      entries = readPluginConfiguration(path);
    } catch {
      this.report("error: invalid plugin config");
      return;
    }
    for (const entry of entries) {
      if (entry.enabled !== false) {
        await this.loadModule(entry.module, dirname(resolve(path)), entry.options);
      }
    }
  }

  private async loadModule(module: string, directory: string, options: unknown): Promise<void> {
    let name = module;
    try {
      const resolved = resolvePlugin(module, directory);
      const manifest = pluginManifest(resolved.manifest);
      name = manifest.name;
      const namespace: unknown = await import(pathToFileURL(resolved.entry).href);
      if (!isRecord(namespace) || !Object.hasOwn(namespace, "default")) {
        this.report("error: plugin has no default export: " + module);
        return;
      }
      await this.activate({ module, manifest, plugin: namespace["default"], options });
    } catch (error) {
      if (error instanceof PluginNotFound) {
        this.report("error: " + error.message);
        return;
      }
      this.failure(name, error);
    }
  }

  private failure(name: string, error: unknown): void {
    if (error instanceof PluginNotFound) {
      this.report("error: " + error.message);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    const exact = error instanceof RegistrationConflict || error instanceof ManifestMismatch;
    const detail = exact ? message : "plugin failed to activate: " + name + " (" + message + ")";
    this.report("error: " + detail.replace(/[\r\n]/gu, " "));
  }
}
