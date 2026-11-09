import { StructureCommand } from "./StructureCommand.js";
import { StructureEdit } from "./StructureEdit.js";
import { Group } from "../domain/Group.js";
import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { TreeValidator } from "../domain/TreeValidator.js";

export class GroupCommand extends StructureCommand {
  private readonly targets: readonly string[];

  constructor(private readonly id: string, targets: readonly string[]) {
    super();
    this.targets = Object.freeze([...targets]);
  }

  protected override buildEdit(document: SvgDocument): StructureEdit {
    const group = new Group(this.id);
    const ordered = this.selectTargets(document);
    const parent = this.commonParent(document, ordered);
    const siblings = parent === null ? document.children : parent.children;
    const insertion = this.insertionIndex(document, ordered, parent, siblings);
    const edit = new StructureEdit(document);
    const next = [...siblings];
    next.splice(insertion, 0, group);
    edit.replace(parent, next);
    for (const shape of ordered) {
      const previousParent = document.parentOf(shape.id);
      edit.replace(previousParent, edit.childrenOf(previousParent).filter(child => {
        return child !== shape;
      }));
    }
    edit.replace(group, ordered);
    return edit;
  }

  private selectTargets(document: SvgDocument): readonly Shape[] {
    if (document.find(this.id) !== undefined) {
      throw new Error("id already exists: " + this.id);
    }
    if (this.targets.length === 0) {
      throw new Error("group requires at least one target");
    }
    if (new Set(this.targets).size !== this.targets.length) {
      throw new Error("duplicate group target");
    }
    const selected = new Set(this.targets.map(id => {
      return document.get(id);
    }));
    for (const shape of selected) {
      for (let parent = document.parentOf(shape.id); parent !== null; parent = document.parentOf(parent.id)) {
        if (selected.has(parent)) {
          throw new Error("cannot group a container into its own descendant: " + parent.id);
        }
      }
    }
    return TreeValidator.forest(document.children).filter(shape => {
      return selected.has(shape);
    });
  }

  private commonParent(document: SvgDocument, ordered: readonly Shape[]): Group | null {
    const paths = ordered.map(shape => {
      return this.parentPath(document, shape);
    });
    return paths[0]!.find(candidate => {
      return paths.every(path => {
        return path.includes(candidate);
      });
    })!;
  }

  private insertionIndex(document: SvgDocument, ordered: readonly Shape[], parent: Group | null, siblings: readonly Shape[]): number {
    return Math.min(...ordered.map(shape => {
      let branch = shape;
      while (document.parentOf(branch.id) !== parent) {
        branch = document.parentOf(branch.id)!;
      }
      return siblings.indexOf(branch);
    }));
  }

  private parentPath(document: SvgDocument, shape: Shape): readonly (Group | null)[] {
    const path: (Group | null)[] = [];
    for (let parent = document.parentOf(shape.id); parent !== null; parent = document.parentOf(parent.id)) {
      path.push(parent);
    }
    path.push(null);
    return path;
  }
}
