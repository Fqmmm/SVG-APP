import { AttributeRouter } from "../extensions/AttributeRouter.js";
import { ShapeEditCommand } from "./ShapeEditCommand.js";
import type { Shape } from "../domain/Shape.js";

export class SetCommand extends ShapeEditCommand {
  constructor(
    id: string,
    private readonly attribute: string,
    private readonly value: string | number,
    private readonly attributes = new AttributeRouter(),
  ) {
    super(id);
  }

  protected override changeShape(shape: Shape): void {
    this.attributes.apply(shape, this.attribute, this.value);
  }
}
