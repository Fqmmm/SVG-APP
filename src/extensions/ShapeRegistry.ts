import { usesElementText } from "./ShapeText.js";
import { ExtensionRegistry } from "./ExtensionRegistry.js";
import type { ShapeProvider } from "./ShapeProvider.js";

export class ShapeRegistry extends ExtensionRegistry<ShapeProvider> {
  constructor() {
    super("shapes");
  }

  override register(provider: ShapeProvider): void {
    if (usesElementText(provider) !== (typeof provider.text === "function")) {
      throw new Error("invalid shape text contract: " + provider.name);
    }
    super.register(provider);
  }
}
