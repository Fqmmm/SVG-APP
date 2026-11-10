import { TreeValidator } from "../../extensions/index.js";
import { AttributeValidator } from "../../extensions/index.js";
import type { EditorSession } from "../../extensions/index.js";
import { CommandArguments } from "../../extensions/index.js";

export class DocumentCommands {
  constructor(private readonly session: EditorSession) {
  }

  initialize(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 2, "init [w] [h]");
    const width = args[0] === undefined ? 800 : AttributeValidator.number(args[0], "width");
    const height = args[1] === undefined ? 600 : AttributeValidator.number(args[1], "height");
    this.session.initialize(width, height);
    return "canvas " + width + "x" + height + " created";
  }

  read(args: readonly string[]): string {
    CommandArguments.requireCount(args, 1, 1, "read <file.svg>");
    const result = this.session.read(args[0]!);
    return [...result.warnings, "read " + args[0] + " (" + this.elementCount() + " elements)"].join("\n");
  }

  save(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 1, "save [file.svg]");
    this.session.save(args[0]);
    return "saved to " + this.session.path + " (" + this.elementCount() + " elements)";
  }

  canvas(args: readonly string[]): string {
    if (args.length !== 0 && args.length !== 2) {
      throw new Error("usage: canvas [w] [h]");
    }
    if (args.length === 2) {
      this.session.resize(AttributeValidator.number(args[0]!, "width"), AttributeValidator.number(args[1]!, "height"));
    }
    return "canvas " + this.session.document.width + "x" + this.session.document.height;
  }

  private elementCount(): number {
    return TreeValidator.forest(this.session.document.children).length;
  }
}
