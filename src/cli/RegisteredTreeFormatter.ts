import type { DocumentSnapshot } from "../extensions/DocumentSnapshot.js";
import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import type { ShapeViews } from "../extensions/ShapeViews.js";
import { ExtensionRegistry } from "../extensions/ExtensionRegistry.js";
import type { TreeNodeContext, TreeDecorator } from "../extensions/TreeDecorator.js";

type RenderContext = TreeNodeContext & { readonly snapshot: DocumentSnapshot };

export class RegisteredTreeFormatter {
  constructor(
    private readonly shapes: ShapeViews,
    private readonly decorators = new ExtensionRegistry<TreeDecorator>("decorators"),
  ) {
  }

  document(document: SvgDocument): string {
    const context = this.context(document);
    const lines = ["svg (" + document.width + "x" + document.height + ")" + this.labels(context)];
    this.appendChildren(document.children, "", lines, context);
    return lines.join("\n");
  }

  subtree(shape: Shape, document?: SvgDocument): string {
    const context = document === undefined ? undefined : this.context(document, shape);
    const lines = [this.shapes.summary(shape) + this.labels(context, shape)];
    this.appendChildren(shape.children, "", lines, context);
    return lines.join("\n");
  }

  private context(document: SvgDocument, shape?: Shape): RenderContext {
    const views = this.shapes;
    let snapshot: DocumentSnapshot | undefined;
    return { document, shape,
      get snapshot() {
        snapshot ??= views.snapshot(document);
        return snapshot;
      },
    };
  }

  private appendChildren(children: readonly Shape[], prefix: string, lines: string[], context?: RenderContext): void {
    for (const [index, child] of children.entries()) {
      const last = index === children.length - 1;
      lines.push(prefix + (last ? "└── " : "├── ") + this.shapes.summary(child) + this.labels(context, child));
      this.appendChildren(child.children, prefix + (last ? "    " : "│   "), lines, context);
    }
  }

  private labels(context: RenderContext | undefined, shape?: Shape): string {
    if (context === undefined) {
      return "";
    }
    const labels = this.decorators.all().map(decorator => {
      const label = decorator.decorate({ document: context.document, shape,
        get snapshot() {
          return context.snapshot;
        },
      });
      if (label !== undefined && /[\r\n]/u.test(label)) {
        throw new Error("tree decorator must return a single line: " + decorator.name);
      }
      return label;
    }).filter(label => label !== undefined && label !== "");
    return labels.length === 0 ? "" : " " + labels.join(" ");
  }
}
