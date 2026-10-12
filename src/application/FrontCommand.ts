import { StructureCommand } from "./StructureCommand.js";
import { StructureEdit } from "./StructureEdit.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export class FrontCommand extends StructureCommand {
  constructor(private readonly id: string) { super(); }

  protected override buildEdit(document: SvgDocument): StructureEdit {
    const edit = new StructureEdit(document);
    edit.move(document.get(this.id), document.parentOf(this.id));
    return edit;
  }
}
