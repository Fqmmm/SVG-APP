import type { ShapeVisitor } from "../domain/ShapeVisitor.js";
import type { Shape } from "../domain/Shape.js";
import type { Rect } from "../domain/Rect.js";
import type { Circle } from "../domain/Circle.js";
import type { Ellipse } from "../domain/Ellipse.js";
import type { Line } from "../domain/Line.js";
import type { Text } from "../domain/Text.js";
import type { Group } from "../domain/Group.js";

export class AttributeFormatter implements ShapeVisitor<string | number | undefined> {
  constructor(private readonly attribute: string) {}

  format(shape: Shape): string {
    const value = shape.accept(this);
    if (value === undefined) return "(unset)";
    return typeof value === "string" ? JSON.stringify(value) : String(value);
  }

  visitRect(shape: Rect): string | number | undefined { return this.value(shape); }
  visitCircle(shape: Circle): string | number | undefined { return this.value(shape); }
  visitEllipse(shape: Ellipse): string | number | undefined { return this.value(shape); }
  visitLine(shape: Line): string | number | undefined { return this.value(shape); }

  visitText(shape: Text): string | number | undefined {
    return this.attribute === "text" ? shape.content : this.value(shape);
  }

  visitGroup(shape: Group): string | number | undefined { return this.value(shape); }

  private value(shape: Shape): string | number | undefined {
    const styles = shape.styles;
    if (Object.hasOwn(styles, this.attribute)) return styles[this.attribute];
    const geometry = shape.geometry;
    return Object.hasOwn(geometry, this.attribute) ? geometry[this.attribute] : undefined;
  }
}
