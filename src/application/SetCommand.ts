import { ShapeEditCommand } from "./ShapeEditCommand.js";
import type { Shape } from "../domain/Shape.js";

export class SetCommand extends ShapeEditCommand {
  constructor(
    id: string,
    private readonly attribute: string,
    private readonly value: string | number,
  ) {
    super(id);
  }

  protected override changeShape(shape: Shape): void {
    shape.set(this.attribute, this.value);
  }
}
