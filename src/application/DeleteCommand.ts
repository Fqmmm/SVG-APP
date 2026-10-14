import { EditCommand } from "./EditCommand.js";
import type { Shape } from "../domain/Shape.js";
import type { ShapeState } from "../domain/ShapeState.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export class DeleteCommand extends EditCommand {
  private target: Shape | undefined;
  private parentId: string | undefined;
  private position: number | undefined;
  private savedState: ShapeState | undefined;

  constructor(private readonly id: string) {
    super();
  }

  protected override executeEdit(document: SvgDocument): void {
    const shape = document.get(this.id);
    if (this.target !== undefined && shape !== this.target) {
      throw new Error("command target changed: " + this.id);
    }
    const parentId = document.parentOf(this.id)?.id;
    const position = document.indexOf(this.id);
    const state = shape.captureState();
    document.remove(this.id);
    this.target = shape;
    this.parentId = parentId;
    this.position = position;
    this.savedState = state;
  }

  protected override undoEdit(document: SvgDocument): void {
    // Add validates the whole subtree before changing the tree or its indexes.
    document.add(this.target!, this.parentId, this.position);
    this.savedState!.restore();
  }
}
