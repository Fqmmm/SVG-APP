import type { Framework } from "../../extensions/Framework.js";
import type { ExtensionRegistry } from "../../extensions/ExtensionRegistry.js";
import { ManifestMismatch, RegistrationConflict } from "./PluginErrors.js";
import { createRegistrationContext } from "./RegistrationContext.js";
import type { Contributions, PluginManifest } from "./PluginManifest.js";

function plan<T extends { readonly name: string }>(category: string, target: ExtensionRegistry<T>, source: ExtensionRegistry<T>) {
  const entries = source.all();
  return {
    check() {
      for (const entry of entries) {
        if (target.find(entry.name) !== undefined) {
          throw new RegistrationConflict(category, entry.name);
        }
      }
    },
    commit() {
      for (const entry of entries) {
        target.register(entry);
      }
    },
  };
}

function plans(target: Framework, source: Framework) {
  return [plan("shapes", target.shapes, source.shapes), plan("commands", target.commands, source.commands),
    plan("decorators", target.decorators, source.decorators), plan("attributes", target.attributes, source.attributes)];
}

function registered(source: Framework): Contributions {
  return {
    shapes: source.shapes.all().map(entry => entry.name).sort(),
    commands: source.commands.all().map(entry => entry.name).sort(),
    decorators: source.decorators.all().map(entry => entry.name).sort(),
    attributes: source.attributes.all().map(entry => entry.name).sort(),
  };
}

export function publishPlugin(target: Framework, staged: Framework, manifest: PluginManifest): void {
  const actual = registered(staged);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.contributes)) {
    throw new ManifestMismatch(manifest.name, JSON.stringify(manifest.contributes), JSON.stringify(actual));
  }
  const verified = createRegistrationContext();
  for (const transfer of plans(verified, staged)) {
    transfer.commit();
  }
  const pending = plans(target, verified);
  for (const transfer of pending) {
    transfer.check();
  }
  for (const transfer of pending) {
    transfer.commit();
  }
}
