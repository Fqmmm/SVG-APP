import type { Shape } from "./Shape.js";

export interface ShapeVisitor<R> {
  visitShape(shape: Shape): R;
}
