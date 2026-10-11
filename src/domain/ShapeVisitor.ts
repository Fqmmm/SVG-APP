import type { Rect } from "./Rect.js";
import type { Circle } from "./Circle.js";
import type { Ellipse } from "./Ellipse.js";
import type { Line } from "./Line.js";
import type { Text } from "./Text.js";
import type { Group } from "./Group.js";

export interface ShapeVisitor<R> {
  visitRect(shape: Rect): R;
  visitCircle(shape: Circle): R;
  visitEllipse(shape: Ellipse): R;
  visitLine(shape: Line): R;
  visitText(shape: Text): R;
  visitGroup(shape: Group): R;
}
