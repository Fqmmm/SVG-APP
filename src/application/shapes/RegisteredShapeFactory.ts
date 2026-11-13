import { validateShapeText } from "../../extensions/ShapeText.js";
import type { Shape } from "../../domain/Shape.js";
import type { ShapeProvider } from "../../extensions/ShapeProvider.js";
import type { ExtensionRegistry } from "../../extensions/ExtensionRegistry.js";
import { CreateArguments } from "./CreateArguments.js";
import type { ShapeInput } from "./ShapeInput.js";
import type { ShapeDefinition } from "./ShapeDefinition.js";

export class RegisteredShapeFactory {
  constructor(readonly providers: ExtensionRegistry<ShapeProvider>) {
  }

  create(type: string, id: string, parameters: readonly string[]): Shape {
    const definition = this.definition(type);
    const schema = definition.schema;
    const minimum = schema.geometry.length + (schema.hasText === true ? 1 : 0);
    const args = new CreateArguments(type, parameters, minimum, minimum + (schema.style === undefined ? 0 : 1));
    const geometry = Object.fromEntries(schema.geometry.map((name, index) => {
      return [name, args.number(index, name)];
    }));
    const content = schema.hasText === true ? args.text(schema.geometry.length) : undefined;
    const style = schema.style === undefined ? undefined : args.optional(schema.geometry.length);
    return this.fromInput(type, id, {
      geometry,
      ...(content === undefined ? {} : { content }),
      ...(style === undefined ? {} : { style }),
    });
  }

  fromInput(type: string, id: string, input: ShapeInput): Shape {
    const shape = this.definition(type).create(id, input);
    return this.validate(type, id, shape);
  }

  validate(type: string, id: string, shape: Shape): Shape {
    if (shape.type !== type || shape.id !== id) {
      throw new Error("invalid shape provider result: " + type);
    }
    validateShapeText(this.provider(type), shape);
    return shape;
  }

  forSvg(tag: string, kind: string | undefined): ShapeProvider {
    const candidates = this.providers.all().filter(provider => {
      return (provider.svg?.tag ?? provider.name) === tag && provider.svg?.kind === kind;
    });
    if (candidates.length > 1) {
      throw new Error("ambiguous SVG shape provider: " + tag + "/" + (kind ?? ""));
    }
    const provider = candidates[0];
    if (provider !== undefined) {
      return provider;
    }
    if (kind !== undefined) {
      return this.forSvg(tag, undefined);
    }
    throw new Error("unknown shape type: " + tag + " (is the plugin loaded?)");
  }

  provider(type: string): ShapeProvider {
    const provider = this.providers.find(type);
    if (provider === undefined) {
      throw new Error("unknown shape type: " + type + " (is the plugin loaded?)");
    }
    return provider;
  }

  definition(type: string): ShapeDefinition {
    return this.provider(type).definition;
  }
}
