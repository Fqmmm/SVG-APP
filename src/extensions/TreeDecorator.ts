import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export interface TreeNodeContext {
  readonly document: SvgDocument;
  readonly shape: Shape | undefined;
}

export interface TreeDecorator {
  readonly name: string;
  decorate(context: TreeNodeContext): string | undefined;
}
