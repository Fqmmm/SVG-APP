import type { EditorSession } from "../../extensions/index.js";
import { GroupCommand } from "../../extensions/index.js";
import { UngroupCommand } from "../../extensions/index.js";
import { AddToCommand } from "../../extensions/index.js";
import { FrontCommand } from "../../extensions/index.js";
import { BackCommand } from "../../extensions/index.js";
import { EditFeedback } from "../../extensions/index.js";
import { ShapeViews as ShapeFormatter } from "../../extensions/index.js";
import { CommandArguments } from "../../extensions/index.js";

export class StructureCommands {
  constructor(private readonly session: EditorSession, private readonly feedback: EditFeedback) {
  }

  group(args: readonly string[]): string {
    CommandArguments.requireCount(args, 2, Number.MAX_SAFE_INTEGER, "group <gid> <id1> [id2] ...");
    const id = args[0]!;
    const label = "g#" + id;
    return this.feedback.execute(new GroupCommand(id, args.slice(1)),
      () => {
        return label + " created with " + (args.length - 1) + " children";
      },
      () => {
        return label + " grouping undone";
      });
  }

  ungroup(args: readonly string[]): string {
    CommandArguments.requireCount(args, 1, 1, "ungroup <gid>");
    const shape = this.session.document.get(args[0]!);
    return this.feedback.execute(new UngroupCommand(shape.id),
      () => {
        return ShapeFormatter.label(shape) + " ungrouped";
      },
      () => {
        return ShapeFormatter.label(shape) + " restored";
      });
  }

  addto(args: readonly string[]): string {
    CommandArguments.requireCount(args, 2, 2, "addto <gid> <id>");
    const shape = this.session.document.get(args[1]!);
    const previous = this.session.document.parentOf(shape.id);
    const source = previous === null ? "svg" : ShapeFormatter.label(previous);
    return this.feedback.execute(new AddToCommand(args[0]!, shape.id),
      () => {
        return ShapeFormatter.label(shape) + " moved into " + ShapeFormatter.label(this.session.document.get(args[0]!));
      },
      () => {
        return ShapeFormatter.label(shape) + " restored into " + source;
      });
  }

  front(args: readonly string[]): string {
    CommandArguments.requireCount(args, 1, 1, "front <id>");
    const shape = this.session.document.get(args[0]!);
    return this.feedback.execute(new FrontCommand(shape.id),
      () => {
        return ShapeFormatter.label(shape) + " brought to front";
      },
      () => {
        return ShapeFormatter.label(shape) + " order restored";
      });
  }

  back(args: readonly string[]): string {
    CommandArguments.requireCount(args, 1, 1, "back <id>");
    const shape = this.session.document.get(args[0]!);
    return this.feedback.execute(new BackCommand(shape.id),
      () => {
        return ShapeFormatter.label(shape) + " sent to back";
      },
      () => {
        return ShapeFormatter.label(shape) + " order restored";
      });
  }
}
