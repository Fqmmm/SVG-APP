import type { EditorSession } from "../../../extensions/index.js";
import type { ShapeViews } from "../../../extensions/index.js";
import type { RegisteredTreeFormatter } from "../../../extensions/index.js";
import { CommandArguments } from "../../../extensions/index.js";

export class QueryCommands {
  constructor(
    private readonly session: EditorSession,
    private readonly shapes: ShapeViews,
    private readonly trees: RegisteredTreeFormatter,
  ) {
  }

  tree(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 1, "tree [id]");
    const document = this.session.document;
    return args[0] === undefined ? this.trees.document(document) : this.trees.subtree(document.get(args[0]), document);
  }

  show(args: readonly string[]): string {
    CommandArguments.requireCount(args, 1, 1, "show <id>");
    const document = this.session.document;
    return this.shapes.show(document.get(args[0]!), document.parentOf(args[0]!));
  }

}
