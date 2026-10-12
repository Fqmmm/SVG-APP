import { EditCommand } from "./EditCommand.js";
import type { StructureEdit } from "./StructureEdit.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export abstract class StructureCommand extends EditCommand {
  private edit: StructureEdit | undefined;

  protected override executeEdit(document: SvgDocument): void {
    const edit = this.edit ?? this.buildEdit(document);
    edit.execute();
    this.edit = edit;
  }

  protected override undoEdit(_document: SvgDocument): void {
    this.edit!.undo();
  }

  protected abstract buildEdit(document: SvgDocument): StructureEdit;
}
