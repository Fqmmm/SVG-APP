import type { TreeDecorator, TreeNodeContext } from "../../extensions/index.js";
import { Box } from "./Box.js";

export class BoxTypeDecorator implements TreeDecorator {
  readonly name = "box-type-label";

  decorate(context: TreeNodeContext): string | undefined {
    return context.shape instanceof Box ? "(box)" : undefined;
  }
}
