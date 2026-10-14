import type { ShapeVisitor } from "../domain/ShapeVisitor.js";
import type { Shape } from "../domain/Shape.js";
import type { Rect } from "../domain/Rect.js";
import type { Circle } from "../domain/Circle.js";
import type { Ellipse } from "../domain/Ellipse.js";
import type { Line } from "../domain/Line.js";
import type { Text } from "../domain/Text.js";
import type { Group } from "../domain/Group.js";

export class PositionFormatter implements ShapeVisitor<string | undefined> {
  format(shape: Shape): string | undefined {
    return shape.accept(this);
  }

  visitRect(shape: Rect): string {
    return "(" + shape.geometry.x + "," + shape.geometry.y + ")";
  }

  visitCircle(shape: Circle): string {
    return "(" + shape.geometry.cx + "," + shape.geometry.cy + ")";
  }

  visitEllipse(shape: Ellipse): string {
    return "(" + shape.geometry.cx + "," + shape.geometry.cy + ")";
  }

  visitLine(shape: Line): string {
    const { x1, y1, x2, y2 } = shape.geometry;
    return "(" + x1 + "," + y1 + ") -> (" + x2 + "," + y2 + ")";
  }

  visitText(shape: Text): string {
    return "(" + shape.geometry.x + "," + shape.geometry.y + ")";
  }

  visitGroup(_shape: Group): undefined {
    return undefined;
  }
}
