import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import type { ShapeViews } from "../extensions/ShapeViews.js";
import { ExtensionRegistry } from "../extensions/ExtensionRegistry.js";
import type { TreeDecorator } from "../extensions/TreeDecorator.js";

export class RegisteredTreeFormatter {
  constructor(
    private readonly shapes: ShapeViews,
    private readonly decorators = new ExtensionRegistry<TreeDecorator>("decorators"),
  ) {
  }

  document(document: SvgDocument): string {
    const lines = ["svg (" + document.width + "x" + document.height + ")" + this.labels(document)];
    this.appendChildren(document.children, "", lines, document);
    return lines.join("\n");
  }

  subtree(shape: Shape, document?: SvgDocument): string {
    const lines = [this.shapes.summary(shape) + this.labels(document, shape)];
    this.appendChildren(shape.children, "", lines, document);
    return lines.join("\n");
  }

  private appendChildren(children: readonly Shape[], prefix: string, lines: string[], document?: SvgDocument): void {
    for (const [index, child] of children.entries()) {
      const last = index === children.length - 1;
      lines.push(prefix + (last ? "└── " : "├── ") + this.shapes.summary(child) + this.labels(document, child));
      this.appendChildren(child.children, prefix + (last ? "    " : "│   "), lines, document);
    }
  }

  private labels(document: SvgDocument | undefined, shape?: Shape): string {
    if (document === undefined) {
      return "";
    }
    const labels = this.decorators.all().map(decorator => {
      const label = decorator.decorate({ document, shape });
      if (label !== undefined && /[\r\n]/u.test(label)) {
        throw new Error("tree decorator must return a single line: " + decorator.name);
      }
      return label;
    }).filter(label => label !== undefined && label !== "");
    return labels.length === 0 ? "" : " " + labels.join(" ");
  }
}
