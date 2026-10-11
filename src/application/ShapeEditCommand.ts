import { EditCommand } from "./EditCommand.js";
import type { Shape } from "../domain/Shape.js";
import type { ShapeState } from "../domain/ShapeState.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export abstract class ShapeEditCommand extends EditCommand {
  private target: Shape | undefined;
  private before: ShapeState | undefined;
  private after: ShapeState | undefined;

  protected constructor(private readonly id: string) { super(); }

  protected override executeEdit(document: SvgDocument): void {
    const shape = document.get(this.id);
    if (this.target !== undefined) {
      this.checkTarget(shape);
      this.after!.restore();
      return;
    }
    const before = shape.captureState();
    try {
      this.changeShape(shape);
      const after = shape.captureState();
      this.target = shape;
      this.before = before;
      this.after = after;
    } catch (error) {
      before.restore();
      throw error;
    }
  }

  protected override undoEdit(document: SvgDocument): void {
    this.checkTarget(document.get(this.id));
    this.before!.restore();
  }

  protected abstract changeShape(shape: Shape): void;

  private checkTarget(shape: Shape): void {
    if (shape !== this.target) throw new Error("command target changed: " + this.id);
  }
}
