import { Framework } from "../../extensions/Framework.js";
import type { ExtensionRegistry } from "../../extensions/ExtensionRegistry.js";
import { RegistrationConflict } from "./PluginErrors.js";

function guardRegistration<T extends { readonly name: string }>(registry: ExtensionRegistry<T>, category: string): void {
  const register = registry.register.bind(registry);
  registry.register = (extension: T): void => {
    if (registry.find(extension.name) !== undefined) {
      throw new RegistrationConflict(category, extension.name);
    }
    register(extension);
  };
}

export function createRegistrationContext(): Framework {
  const context = new Framework();
  guardRegistration(context.shapes, "shapes");
  guardRegistration(context.commands, "commands");
  guardRegistration(context.decorators, "decorators");
  guardRegistration(context.attributes, "attributes");
  return context;
}
