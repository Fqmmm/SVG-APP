import { ShapeEditCommand } from "./ShapeEditCommand.js";
import type { Shape } from "../domain/Shape.js";

export class ScaleCommand extends ShapeEditCommand {
  constructor(id: string, private readonly factor: number) { super(id); }

  protected override changeShape(shape: Shape): void {
    shape.scale(this.factor);
  }
}
