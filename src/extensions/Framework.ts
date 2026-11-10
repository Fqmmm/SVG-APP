import { ExtensionRegistry } from "./ExtensionRegistry.js";
import { ShapeRegistry } from "./ShapeRegistry.js";
import type { Command } from "./Command.js";
import type { TreeDecorator } from "./TreeDecorator.js";
import type { AttributeHandler } from "./AttributeHandler.js";

export class Framework {
  readonly shapes = new ShapeRegistry();
  readonly commands = new ExtensionRegistry<Command>("commands");
  readonly decorators = new ExtensionRegistry<TreeDecorator>("decorators");
  readonly attributes = new ExtensionRegistry<AttributeHandler>("attributes");
}
