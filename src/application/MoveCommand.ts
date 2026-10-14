import { ShapeEditCommand } from "./ShapeEditCommand.js";
import type { Shape } from "../domain/Shape.js";

export class MoveCommand extends ShapeEditCommand {
  constructor(
    id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    super(id);
  }

  protected override changeShape(shape: Shape): void {
    shape.move(this.dx, this.dy);
  }
}
