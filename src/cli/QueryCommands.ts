import type { EditorSession } from "../application/EditorSession.js";
import { ShapeFormatter } from "./ShapeFormatter.js";
import { TreeFormatter } from "./TreeFormatter.js";
import { CommandArguments } from "./CommandArguments.js";

export class QueryCommands {
  private readonly shapes = new ShapeFormatter();
  private readonly trees = new TreeFormatter();

  constructor(private readonly session: EditorSession) {
  }

  tree(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 1, "tree [id]");
    const document = this.session.document;
    return args[0] === undefined ? this.trees.document(document) : this.trees.subtree(document.get(args[0]));
  }

  show(args: readonly string[]): string {
    CommandArguments.requireCount(args, 1, 1, "show <id>");
    const document = this.session.document;
    return this.shapes.show(document.get(args[0]!), document.parentOf(args[0]!));
  }

  help(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 0, "help");
    return [
      "init [w] [h]",
      "read <file.svg>",
      "save [file.svg]",
      "canvas [w] [h]",
      "create <type> <id> [params] [in <containerId>]",
      "  rect <id> <x> <y> <w> <h> [fill]",
      "  circle <id> <cx> <cy> <r> [fill]",
      "  ellipse <id> <cx> <cy> <rx> <ry> [fill]",
      "  line <id> <x1> <y1> <x2> <y2> [stroke]",
      '  text <id> <x> <y> "content"',
      "  g <id>",
      "move <id> <dx> <dy>",
      "scale <id> <factor>",
      "set <id> <attr> <value>",
      "delete <id>",
      "group <gid> <id1> [id2] ...",
      "ungroup <gid>",
      "addto <gid> <id>",
      "front <id>",
      "back <id>",
      "tree [id]",
      "show <id>",
      "undo",
      "redo",
      "help",
    ].join("\n");
  }
}
