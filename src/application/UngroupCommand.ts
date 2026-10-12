import { StructureCommand } from "./StructureCommand.js";
import { StructureEdit } from "./StructureEdit.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export class UngroupCommand extends StructureCommand {
  constructor(private readonly id: string) { super(); }

  protected override buildEdit(document: SvgDocument): StructureEdit {
    const group = document.get(this.id).asContainer();
    if (group === undefined) throw new Error("not a container: " + this.id);
    const parent = document.parentOf(this.id);
    if (parent === null) throw new Error("cannot ungroup top-level container: " + this.id);
    const edit = new StructureEdit(document);
    const siblings = [...parent.children];
    siblings.splice(document.indexOf(this.id), 1, ...group.children);
    edit.replace(parent, siblings);
    edit.replace(group, []);
    return edit;
  }
}
