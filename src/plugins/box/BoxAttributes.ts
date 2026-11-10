import type { AttributeHandler, Shape } from "../../extensions/index.js";
import { Box } from "./Box.js";

export class BoxAttributes implements AttributeHandler {
  readonly name = "box-attributes";

  handles(shape: Shape, attribute: string): boolean {
    return shape instanceof Box && (attribute === "fill" || attribute === "label");
  }

  apply(shape: Shape, attribute: string, value: string | number): void {
    if (!(shape instanceof Box) || !this.handles(shape, attribute)) {
      throw new Error("unsupported box attribute: " + attribute);
    }
    if (attribute === "fill") {
      shape.setFill(value);
      return;
    }
    shape.setLabel(value);
  }
}
