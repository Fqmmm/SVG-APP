import type { Shape } from "../domain/Shape.js";
import type { AttributeHandler } from "./AttributeHandler.js";
import { ExtensionRegistry } from "./ExtensionRegistry.js";

export class AttributeRouter {
  constructor(private readonly handlers = new ExtensionRegistry<AttributeHandler>("attributes")) {
  }

  apply(shape: Shape, attribute: string, value: string | number): void {
    const matches = this.handlers.all().filter(handler => handler.handles(shape, attribute));
    if (matches.length > 1) {
      throw new Error("ambiguous attribute handler: " + shape.type + "/" + attribute);
    }
    const handler = matches[0];
    if (handler !== undefined) {
      handler.apply(shape, attribute, value);
      return;
    }
    shape.set(attribute, value);
  }
}
