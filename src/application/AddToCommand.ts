import { StructureCommand } from "./StructureCommand.js";
import { StructureEdit } from "./StructureEdit.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export class AddToCommand extends StructureCommand {
  constructor(private readonly parentId: string, private readonly id: string) {
    super();
  }

  protected override buildEdit(document: SvgDocument): StructureEdit {
    const target = document.find(this.parentId);
    if (target === undefined) {
      throw new Error("no such container: " + this.parentId);
    }
    const parent = target.asContainer();
    if (parent === undefined) {
      throw new Error("not a container: " + this.parentId);
    }
    const edit = new StructureEdit(document);
    edit.move(document.get(this.id), parent);
    return edit;
  }
}
