import { AttributeValidator } from "../domain/AttributeValidator.js";
import type { Shape } from "../domain/Shape.js";
import type { RegisteredShapeFactory } from "../application/RegisteredShapeFactory.js";

export class SvgShapeReader {
  constructor(private readonly factory: RegisteredShapeFactory) {
  }

  read(type: string, id: string, attributes: ReadonlyMap<string, string>, content: string): Shape {
    const definition = this.factory.definition(type);
    const schema = definition.schema;
    if (schema.hasText !== true && content.trim() !== "") {
      throw new Error("unexpected text in shape: " + id);
    }
    const geometry = Object.fromEntries(schema.geometry.map(name => {
      const fallback = schema.missingGeometry?.get(name);
      const value = attributes.get(name) ?? (fallback === undefined ? undefined : attributes.get(fallback)) ?? "0";
      return [name, AttributeValidator.number(value.trim().replace(/px$/u, ""), name)];
    }));
    const shape = this.factory.fromInput(type, id, { geometry, ...(schema.hasText === true ? { content } : {}) });
    for (const [name, value] of attributes) {
      // CLI text is a pseudo-attribute; SVG text only comes from element content.
      if (name === "text") {
        throw new Error("unknown attribute: text");
      }
      if (!schema.geometry.includes(name)) {
        shape.set(name, value);
      }
    }
    return shape;
  }
}
