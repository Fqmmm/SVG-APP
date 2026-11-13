import type { AttributeHandler, Shape } from "../../extensions/index.js";

export class StyleAttributeHandler implements AttributeHandler {
  readonly name = "style-attributes";

  handles(_shape: Shape, attribute: string): boolean {
    return ["fill", "stroke", "stroke-width"].includes(attribute);
  }

  apply(shape: Shape, attribute: string, value: string | number): void {
    shape.set(attribute, value);
  }
}
