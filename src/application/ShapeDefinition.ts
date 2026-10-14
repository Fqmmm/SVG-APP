import type { Shape } from "../domain/Shape.js";
import { AttributeValidator } from "../domain/AttributeValidator.js";

export class ShapeDefinition {
  constructor(
    private readonly geometryNames: readonly string[],
    private readonly creator: (id: string, parameters: readonly string[]) => Shape,
    private readonly hasText = false,
    private readonly missingGeometry: ReadonlyMap<string, string> = new Map(),
  ) {
  }

  create(id: string, parameters: readonly string[]): Shape {
    return this.creator(id, parameters);
  }

  fromAttributes(id: string, attributes: ReadonlyMap<string, string>, content: string): Shape {
    if (!this.hasText && content.trim() !== "") {
      throw new Error("unexpected text in shape: " + id);
    }
    const parameters = this.geometryNames.map(name => {
      const fallback = this.missingGeometry.get(name);
      const value = attributes.get(name) ?? (fallback === undefined ? undefined : attributes.get(fallback)) ?? "0";
      return String(AttributeValidator.number(value.trim().replace(/px$/u, ""), name));
    });
    if (this.hasText) {
      parameters.push(content);
    }
    const shape = this.creator(id, parameters);
    for (const [name, value] of attributes) {
      // CLI text is a pseudo-attribute; SVG text comes only from element content.
      if (name === "text") {
        throw new Error("unknown attribute: text");
      }
      if (!this.geometryNames.includes(name)) {
        shape.set(name, value);
      }
    }
    return shape;
  }
}
