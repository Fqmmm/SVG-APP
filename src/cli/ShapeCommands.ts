import type { EditorSession } from "../application/EditorSession.js";
import { ShapeFactory } from "../application/ShapeFactory.js";
import { CreateCommand } from "../application/CreateCommand.js";
import { MoveCommand } from "../application/MoveCommand.js";
import { ScaleCommand } from "../application/ScaleCommand.js";
import { SetCommand } from "../application/SetCommand.js";
import { DeleteCommand } from "../application/DeleteCommand.js";
import { AttributeValidator } from "../domain/AttributeValidator.js";
import type { Shape } from "../domain/Shape.js";
import { EditFeedback } from "./EditFeedback.js";
import { ShapeFormatter } from "./ShapeFormatter.js";
import { PositionFormatter } from "./PositionFormatter.js";
import { AttributeFormatter } from "./AttributeFormatter.js";
import { CommandArguments } from "./CommandArguments.js";

export class ShapeCommands {
  private readonly factory = new ShapeFactory();
  private readonly positions = new PositionFormatter();

  constructor(private readonly session: EditorSession, private readonly feedback: EditFeedback) {
  }

  create(args: readonly string[]): string {
    if (args.length < 2) {
      throw new Error("usage: create <type> <id> [params] [in <containerId>]");
    }
    const [type, id] = args;
    const parameters = args.slice(2);
    let parentId: string | undefined;
    if (parameters.length >= 2 && parameters.at(-2) === "in") {
      parentId = parameters.at(-1)!;
      parameters.splice(-2);
    }
    const shape = this.factory.create(type!, id!, parameters);
    const parent = parentId === undefined ? null : this.session.document.find(parentId)?.asContainer();
    // Let SvgDocument provide the prescribed missing/leaf-container errors.
    const command = new CreateCommand(shape, parentId);
    const suffix = parent === null || parent === undefined ? "" : " in " + parent.type + "#" + parent.id;
    return this.feedback.execute(command,
      () => {
        return ShapeFormatter.label(shape) + " created" + suffix;
      },
      () => {
        return ShapeFormatter.label(shape) + " removed";
      });
  }

  move(args: readonly string[]): string {
    CommandArguments.requireCount(args, 3, 3, "move <id> <dx> <dy>");
    const shape = this.session.document.get(args[0]!);
    const dx = AttributeValidator.number(args[1]!, "dx");
    const dy = AttributeValidator.number(args[2]!, "dy");
    return this.feedback.execute(new MoveCommand(shape.id, dx, dy),
      () => {
        return this.movement(shape, dx, dy, false);
      },
      () => {
        return this.movement(shape, dx, dy, true);
      });
  }

  scale(args: readonly string[]): string {
    CommandArguments.requireCount(args, 2, 2, "scale <id> <factor>");
    const shape = this.session.document.get(args[0]!);
    const factor = AttributeValidator.number(args[1]!, "factor");
    return this.feedback.execute(new ScaleCommand(shape.id, factor),
      () => {
        return ShapeFormatter.label(shape) + " scaled by " + factor;
      },
      () => {
        return ShapeFormatter.label(shape) + " scale restored";
      });
  }

  set(args: readonly string[]): string {
    CommandArguments.requireCount(args, 3, 3, "set <id> <attr> <value>");
    const shape = this.session.document.get(args[0]!);
    const attribute = args[1]!;
    const formatter = new AttributeFormatter(attribute);
    const updated = (): string => {
      return ShapeFormatter.label(shape) + " updated: " + attribute + "=" + formatter.format(shape);
    };
    return this.feedback.execute(new SetCommand(shape.id, attribute, args[2]!), updated, updated);
  }

  delete(args: readonly string[]): string {
    CommandArguments.requireCount(args, 1, 1, "delete <id>");
    const shape = this.session.document.get(args[0]!);
    const parent = this.session.document.parentOf(shape.id);
    const destination = parent === null ? "svg" : ShapeFormatter.label(parent);
    return this.feedback.execute(new DeleteCommand(shape.id),
      () => {
        return ShapeFormatter.label(shape) + " deleted";
      },
      () => {
        return ShapeFormatter.label(shape) + " restored into " + destination;
      });
  }

  private movement(shape: Shape, dx: number, dy: number, undone: boolean): string {
    const position = this.positions.format(shape);
    if (position !== undefined) {
      return ShapeFormatter.label(shape) + (undone ? " moved back to " : " moved to ") + position;
    }
    return ShapeFormatter.label(shape) + (undone ? " moved back by (" : " moved by (")
      + (undone ? -dx : dx) + "," + (undone ? -dy : dy) + ")";
  }
}
