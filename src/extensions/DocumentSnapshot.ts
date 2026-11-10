import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

// Immutable content projection. Parent membership and child order are part of the content.
export class DocumentSnapshot {
  private readonly nodes = new Map<string, string>();
  private readonly canvas: string;

  constructor(document: SvgDocument, textOf: (shape: Shape) => string | undefined) {
    const roots = document.children.map(shape => {
      return this.record(shape, null, textOf);
    });
    this.canvas = JSON.stringify([document.width, document.height, roots]);
  }

  same(other: DocumentSnapshot, id?: string): boolean {
    if (id === undefined) {
      return this.canvas === other.canvas;
    }
    const node = this.nodes.get(id);
    return node !== undefined && node === other.nodes.get(id);
  }

  private record(shape: Shape, parent: string | null, textOf: (shape: Shape) => string | undefined): unknown {
    const children = shape.children.map(child => {
      return this.record(child, shape.id, textOf);
    });
    const content = { id: shape.id, type: shape.type, parent,
      geometry: this.entries(shape.geometry), styles: this.entries(shape.styles), text: textOf(shape), children };
    this.nodes.set(shape.id, JSON.stringify(content));
    return content;
  }

  private entries(values: Readonly<Record<string, unknown>>): readonly unknown[] {
    return Object.keys(values).sort().map(key => {
      return [key, values[key]];
    });
  }
}
