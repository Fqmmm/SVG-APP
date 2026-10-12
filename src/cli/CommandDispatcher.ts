import { GroupCommand } from "../application/GroupCommand.js";
import { UngroupCommand } from "../application/UngroupCommand.js";
import { AddToCommand } from "../application/AddToCommand.js";
import { FrontCommand } from "../application/FrontCommand.js";
import { BackCommand } from "../application/BackCommand.js";
import { EditorSession } from "../application/EditorSession.js";
import { ShapeFactory } from "../application/ShapeFactory.js";
import { CreateCommand } from "../application/CreateCommand.js";
import { MoveCommand } from "../application/MoveCommand.js";
import { ScaleCommand } from "../application/ScaleCommand.js";
import { SetCommand } from "../application/SetCommand.js";
import { DeleteCommand } from "../application/DeleteCommand.js";
import type { EditCommand } from "../application/EditCommand.js";
import { AttributeValidator } from "../domain/AttributeValidator.js";
import type { Shape } from "../domain/Shape.js";
import { Tokenizer } from "./Tokenizer.js";
import { ShapeFormatter } from "./ShapeFormatter.js";
import { PositionFormatter } from "./PositionFormatter.js";
import { AttributeFormatter } from "./AttributeFormatter.js";
import { TreeFormatter } from "./TreeFormatter.js";

export class CommandDispatcher {
  private readonly tokenizer = new Tokenizer();
  private readonly factory = new ShapeFactory();
  private readonly shapes = new ShapeFormatter();
  private readonly positions = new PositionFormatter();
  private readonly trees = new TreeFormatter();
  private readonly feedback = new WeakMap<EditCommand, {
    executed: () => string;
    undone: () => string;
  }>();
  // The single command-name dispatch point; registration is deferred to the plugin phase.
  private readonly handlers = new Map<string, (args: readonly string[]) => string>([
    ["init", args => this.initialize(args)],
    ["create", args => this.create(args)],
    ["move", args => this.move(args)],
    ["scale", args => this.scale(args)],
    ["set", args => this.set(args)],
    ["delete", args => this.delete(args)],
    ["group", args => this.group(args)],
    ["ungroup", args => this.ungroup(args)],
    ["addto", args => this.addto(args)],
    ["front", args => this.front(args)],
    ["back", args => this.back(args)],
    ["tree", args => this.tree(args)],
    ["show", args => this.show(args)],
    ["help", args => this.help(args)],
    ["undo", args => this.undo(args)],
    ["redo", args => this.redo(args)],
  ]);

  constructor(private readonly session = new EditorSession()) {}

  dispatch(line: string): string {
    const [name, ...args] = this.tokenizer.tokenize(line);
    if (name === undefined) return "";
    const handler = this.handlers.get(name);
    if (handler === undefined) throw new Error("unknown command: " + name);
    // Document errors take precedence over argument errors for document commands.
    if (name !== "init" && name !== "help") void this.session.document;
    return handler(args);
  }

  private initialize(args: readonly string[]): string {
    this.requireCount(args, 0, 2, "init [w] [h]");
    const width = args[0] === undefined ? 800 : AttributeValidator.number(args[0], "width");
    const height = args[1] === undefined ? 600 : AttributeValidator.number(args[1], "height");
    this.session.initialize(width, height);
    return "canvas " + width + "x" + height + " created";
  }

  private create(args: readonly string[]): string {
    if (args.length < 2) throw new Error("usage: create <type> <id> [params] [in <containerId>]");
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
    return this.execute(command,
      () => this.label(shape) + " created" + suffix,
      () => this.label(shape) + " removed");
  }

  private move(args: readonly string[]): string {
    this.requireCount(args, 3, 3, "move <id> <dx> <dy>");
    const shape = this.session.document.get(args[0]!);
    const dx = AttributeValidator.number(args[1]!, "dx");
    const dy = AttributeValidator.number(args[2]!, "dy");
    return this.execute(new MoveCommand(shape.id, dx, dy),
      () => this.movement(shape, dx, dy, false),
      () => this.movement(shape, dx, dy, true));
  }

  private scale(args: readonly string[]): string {
    this.requireCount(args, 2, 2, "scale <id> <factor>");
    const shape = this.session.document.get(args[0]!);
    const factor = AttributeValidator.number(args[1]!, "factor");
    return this.execute(new ScaleCommand(shape.id, factor),
      () => this.label(shape) + " scaled by " + factor,
      () => this.label(shape) + " scale restored");
  }

  private set(args: readonly string[]): string {
    this.requireCount(args, 3, 3, "set <id> <attr> <value>");
    const shape = this.session.document.get(args[0]!);
    const attribute = args[1]!;
    const formatter = new AttributeFormatter(attribute);
    const updated = (): string => this.label(shape) + " updated: " + attribute + "=" + formatter.format(shape);
    return this.execute(new SetCommand(shape.id, attribute, args[2]!), updated, updated);
  }

  private delete(args: readonly string[]): string {
    this.requireCount(args, 1, 1, "delete <id>");
    const shape = this.session.document.get(args[0]!);
    const parent = this.session.document.parentOf(shape.id);
    const destination = parent === null ? "svg" : this.label(parent);
    return this.execute(new DeleteCommand(shape.id),
      () => this.label(shape) + " deleted",
      () => this.label(shape) + " restored into " + destination);
  }

  private group(args: readonly string[]): string {
    this.requireCount(args, 2, Number.MAX_SAFE_INTEGER, "group <gid> <id1> [id2] ...");
    const id = args[0]!;
    const label = "g#" + id;
    return this.execute(new GroupCommand(id, args.slice(1)),
      () => label + " created with " + (args.length - 1) + " children",
      () => label + " grouping undone");
  }

  private ungroup(args: readonly string[]): string {
    this.requireCount(args, 1, 1, "ungroup <gid>");
    const shape = this.session.document.get(args[0]!);
    return this.execute(new UngroupCommand(shape.id),
      () => this.label(shape) + " ungrouped",
      () => this.label(shape) + " restored");
  }

  private addto(args: readonly string[]): string {
    this.requireCount(args, 2, 2, "addto <gid> <id>");
    const shape = this.session.document.get(args[1]!);
    const previous = this.session.document.parentOf(shape.id);
    const source = previous === null ? "svg" : this.label(previous);
    return this.execute(new AddToCommand(args[0]!, shape.id),
      () => this.label(shape) + " moved into " + this.label(this.session.document.get(args[0]!)),
      () => this.label(shape) + " restored into " + source);
  }

  private front(args: readonly string[]): string {
    this.requireCount(args, 1, 1, "front <id>");
    const shape = this.session.document.get(args[0]!);
    return this.execute(new FrontCommand(shape.id),
      () => this.label(shape) + " brought to front",
      () => this.label(shape) + " order restored");
  }

  private back(args: readonly string[]): string {
    this.requireCount(args, 1, 1, "back <id>");
    const shape = this.session.document.get(args[0]!);
    return this.execute(new BackCommand(shape.id),
      () => this.label(shape) + " sent to back",
      () => this.label(shape) + " order restored");
  }

  private tree(args: readonly string[]): string {
    this.requireCount(args, 0, 1, "tree [id]");
    const document = this.session.document;
    return args[0] === undefined ? this.trees.document(document) : this.trees.subtree(document.get(args[0]));
  }

  private show(args: readonly string[]): string {
    this.requireCount(args, 1, 1, "show <id>");
    const document = this.session.document;
    return this.shapes.show(document.get(args[0]!), document.parentOf(args[0]!));
  }

  private undo(args: readonly string[]): string {
    this.requireCount(args, 0, 0, "undo");
    const command = this.session.undo();
    return this.feedback.get(command)?.undone() ?? "edit undone";
  }

  private redo(args: readonly string[]): string {
    this.requireCount(args, 0, 0, "redo");
    const command = this.session.redo();
    return this.feedback.get(command)?.executed() ?? "edit redone";
  }

  private execute(command: EditCommand, executed: () => string, undone: () => string): string {
    this.session.execute(command);
    this.feedback.set(command, { executed, undone });
    return executed();
  }

  private movement(shape: Shape, dx: number, dy: number, undone: boolean): string {
    const position = this.positions.format(shape);
    if (position !== undefined) {
      return this.label(shape) + (undone ? " moved back to " : " moved to ") + position;
    }
    return this.label(shape) + (undone ? " moved back by (" : " moved by (")
      + (undone ? -dx : dx) + "," + (undone ? -dy : dy) + ")";
  }

  private label(shape: Shape): string { return shape.type + "#" + shape.id; }

  private requireCount(args: readonly string[], minimum: number, maximum: number, usage: string): void {
    if (args.length < minimum || args.length > maximum) throw new Error("usage: " + usage);
  }

  private help(args: readonly string[]): string {
    this.requireCount(args, 0, 0, "help");
    return [
      "init [w] [h]",
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
