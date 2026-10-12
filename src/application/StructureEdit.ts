import type { Group } from "../domain/Group.js";
import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { TreeValidator } from "../domain/TreeValidator.js";

export class StructureEdit {
  private readonly beforeRoots: readonly Shape[];
  private afterRoots: readonly Shape[];
  private readonly before = new Map<Group, readonly Shape[]>();
  private readonly after = new Map<Group, readonly Shape[]>();

  constructor(private readonly document: SvgDocument) {
    this.beforeRoots = document.children;
    this.afterRoots = this.beforeRoots;
  }

  childrenOf(parent: Group | null): readonly Shape[] {
    return parent === null ? this.afterRoots : this.after.get(parent) ?? parent.children;
  }

  replace(parent: Group | null, children: readonly Shape[]): void {
    const copy = Object.freeze([...children]);
    if (parent === null) {
      this.afterRoots = copy;
    } else {
      if (!this.before.has(parent)) this.before.set(parent, parent.children);
      this.after.set(parent, copy);
    }
  }

  move(shape: Shape, parent: Group | null, index?: number): void {
    if (parent !== null && TreeValidator.nodes(shape).includes(parent)) {
      throw new Error("cannot move a container into itself or its descendant: " + shape.id);
    }
    const oldParent = this.document.parentOf(shape.id);
    const remaining = this.childrenOf(oldParent).filter(child => child !== shape);
    const destination = oldParent === parent ? [...remaining] : [...this.childrenOf(parent)];
    const position = index ?? destination.length;
    if (!Number.isInteger(position) || position < 0 || position > destination.length) {
      throw new Error("invalid child index: " + position);
    }
    destination.splice(position, 0, shape);
    if (oldParent !== parent) this.replace(oldParent, remaining);
    this.replace(parent, destination);
  }

  execute(): void {
    this.checkStructure(this.beforeRoots, this.before);
    this.document.replaceStructure(this.afterRoots, this.after);
  }

  undo(): void {
    this.checkStructure(this.afterRoots, this.after);
    this.document.replaceStructure(this.beforeRoots, this.before);
  }

  private checkStructure(roots: readonly Shape[], changes: ReadonlyMap<Group, readonly Shape[]>): void {
    if (!this.sameChildren(this.document.children, roots)) {
      throw new Error("structure changed outside command history");
    }
    for (const [group, children] of changes) {
      if (!this.sameChildren(group.children, children)) {
        throw new Error("structure changed outside command history: " + group.id);
      }
    }
  }

  private sameChildren(actual: readonly Shape[], expected: readonly Shape[]): boolean {
    return actual.length === expected.length && actual.every((shape, index) => shape === expected[index]);
  }
}
