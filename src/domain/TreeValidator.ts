import type { Shape } from "./Shape.js";

export class TreeValidator {
  static nodes(root: Shape): readonly Shape[] {
    return this.forest([root]);
  }

  static forest(
    roots: readonly Shape[],
    childrenOf: (shape: Shape) => readonly Shape[] = shape => shape.children,
  ): readonly Shape[] {
    const nodes: Shape[] = [];
    const references = new Set<Shape>();
    const ids = new Set<string>();
    for (const root of roots) this.collect(root, references, ids, nodes, childrenOf);
    return Object.freeze(nodes);
  }

  private static collect(
    shape: Shape,
    references: Set<Shape>,
    ids: Set<string>,
    nodes: Shape[],
    childrenOf: (shape: Shape) => readonly Shape[],
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
    for (const child of childrenOf(shape)) {
      this.collect(child, references, ids, nodes, childrenOf);
    }
  }
}
