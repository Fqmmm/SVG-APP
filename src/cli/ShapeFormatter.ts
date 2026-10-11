import type { ShapeVisitor } from "../domain/ShapeVisitor.js";
import type { Shape } from "../domain/Shape.js";
import type { Rect } from "../domain/Rect.js";
import type { Circle } from "../domain/Circle.js";
import type { Ellipse } from "../domain/Ellipse.js";
import type { Line } from "../domain/Line.js";
import type { Text } from "../domain/Text.js";
import type { Group } from "../domain/Group.js";

export class ShapeFormatter implements ShapeVisitor<string> {
  summary(shape: Shape): string {
    const details = [shape.accept(this), this.styles(shape)].filter(value => value !== "").join(" ");
    return shape.type + "#" + shape.id + (details === "" ? "" : "  " + details);
  }

  show(shape: Shape, parent: Group | null): string {
    const lines = [shape.type + "#" + shape.id + "  parent=" + (parent === null ? "svg" : parent.type + "#" + parent.id)];
    const geometry = shape.accept(this);
    const styles = this.styles(shape);
    if (geometry !== "") lines.push("  " + geometry);
    if (styles !== "") lines.push("  " + styles);
    return lines.join("\n");
  }

  visitRect(shape: Rect): string {
    const { x, y, width, height } = shape.geometry;
    return "x=" + x + " y=" + y + " w=" + width + " h=" + height;
  }

  visitCircle(shape: Circle): string {
    const { cx, cy, r } = shape.geometry;
    return "cx=" + cx + " cy=" + cy + " r=" + r;
  }

  visitEllipse(shape: Ellipse): string {
    const { cx, cy, rx, ry } = shape.geometry;
    return "cx=" + cx + " cy=" + cy + " rx=" + rx + " ry=" + ry;
  }

  visitLine(shape: Line): string {
    const { x1, y1, x2, y2 } = shape.geometry;
    return "(" + x1 + "," + y1 + ") -> (" + x2 + "," + y2 + ")";
  }

  visitText(shape: Text): string {
    const { x, y } = shape.geometry;
    return "(" + x + "," + y + ") " + JSON.stringify(shape.content);
  }

  visitGroup(_shape: Group): string { return ""; }

  private styles(shape: Shape): string {
    return Object.entries(shape.styles).map(([key, value]) => {
      const displayed = typeof value === "string" && /\s|"/u.test(value) ? JSON.stringify(value) : String(value);
      return key + "=" + displayed;
    }).join(" ");
  }
}
