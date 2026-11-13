import type { TreeDecorator, TreeNodeContext } from "../../extensions/index.js";

export class ShapeTypeDecorator implements TreeDecorator {
  readonly name = "shape-type";

  decorate({ shape }: TreeNodeContext): string | undefined {
    return shape === undefined ? undefined : "(" + shape.type + ")";
  }
}
