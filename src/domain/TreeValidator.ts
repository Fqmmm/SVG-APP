import type { Shape } from "./Shape.js";

export class TreeValidator {
  static nodes(root: Shape): readonly Shape[] {
    const nodes: Shape[] = [];
    this.collect(root, new Set(), new Set(), nodes);
    return Object.freeze(nodes);
  }

  private static collect(
    shape: Shape,
    references: Set<Shape>,
    ids: Set<string>,
    nodes: Shape[],
  ): void {
    if (references.has(shape)) {
      throw new Error("shape occurs more than once: " + shape.id);
    }
    if (ids.has(shape.id)) {
      throw new Error("id already exists: " + shape.id);
    }
    references.add(shape);
    ids.add(shape.id);
    nodes.push(shape);
    for (const child of shape.children) {
      this.collect(child, references, ids, nodes);
    }
  }
}
