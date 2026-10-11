import { EditCommand } from "./EditCommand.js";
import type { Shape } from "../domain/Shape.js";
import type { ShapeState } from "../domain/ShapeState.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export class CreateCommand extends EditCommand {
  private insertionIndex: number | undefined;
  private createdState: ShapeState | undefined;

  constructor(
    private readonly shape: Shape,
    private readonly parentId?: string,
    index?: number,
  ) {
    super();
    this.insertionIndex = index;
  }

  protected override executeEdit(document: SvgDocument): void {
    const state = this.createdState ?? this.shape.captureState();
    document.add(this.shape, this.parentId, this.insertionIndex);
    state.restore();
    this.createdState = state;
    this.insertionIndex = document.indexOf(this.shape.id);
  }

  protected override undoEdit(document: SvgDocument): void {
    if (document.get(this.shape.id) !== this.shape) {
      throw new Error("command target changed: " + this.shape.id);
    }
    document.remove(this.shape.id);
  }
}
