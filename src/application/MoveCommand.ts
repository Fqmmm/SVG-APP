import { EditCommand } from "./EditCommand.js";
import type { Shape } from "../domain/Shape.js";
import type { ShapeState } from "../domain/ShapeState.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export class MoveCommand extends EditCommand {
  private target: Shape | undefined;
  private before: ShapeState | undefined;
  private after: ShapeState | undefined;

  constructor(
    private readonly id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    super();
  }

  protected override executeEdit(document: SvgDocument): void {
    const shape = document.get(this.id);
    if (this.target !== undefined) {
      this.checkTarget(shape);
      this.after!.restore();
      return;
    }
    const before = shape.captureState();
    shape.move(this.dx, this.dy);
    this.target = shape;
    this.before = before;
    this.after = shape.captureState();
  }

  protected override undoEdit(document: SvgDocument): void {
    this.checkTarget(document.get(this.id));
    this.before!.restore();
  }

  private checkTarget(shape: Shape): void {
    if (shape !== this.target) throw new Error("command target changed: " + this.id);
  }
}
