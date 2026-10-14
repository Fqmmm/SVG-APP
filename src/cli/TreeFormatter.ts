import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { ShapeFormatter } from "./ShapeFormatter.js";

export class TreeFormatter {
  constructor(private readonly shapes = new ShapeFormatter()) {
  }

  document(document: SvgDocument): string {
    const lines = ["svg (" + document.width + "x" + document.height + ")"];
    this.appendChildren(document.children, "", lines);
    return lines.join("\n");
  }

  subtree(shape: Shape): string {
    const lines = [this.shapes.summary(shape)];
    this.appendChildren(shape.children, "", lines);
    return lines.join("\n");
  }

  private appendChildren(children: readonly Shape[], prefix: string, lines: string[]): void {
    for (const [index, child] of children.entries()) {
      const last = index === children.length - 1;
      lines.push(prefix + (last ? "└── " : "├── ") + this.shapes.summary(child));
      this.appendChildren(child.children, prefix + (last ? "    " : "│   "), lines);
    }
  }
}
