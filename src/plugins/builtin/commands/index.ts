import type { Command as CliCommand } from "../../../extensions/index.js";
import type { Framework } from "../../../extensions/index.js";
import type { EditorSession } from "../../../extensions/index.js";
import { DocumentCommands } from "./DocumentCommands.js";
import { ShapeCommands } from "./ShapeCommands.js";
import { StructureCommands } from "./StructureCommands.js";
import { QueryCommands } from "./QueryCommands.js";
import { EditFeedback } from "../../../extensions/index.js";
import { RegisteredShapeFactory } from "../../../extensions/index.js";
import { ShapeViews } from "../../../extensions/index.js";
import { AttributeRouter } from "../../../extensions/index.js";
import { RegisteredTreeFormatter } from "../../../extensions/index.js";
import { CommandArguments } from "../../../extensions/index.js";

type Handlers = ReturnType<typeof createHandlers>;
interface CommandBinding {
  readonly name: string;
  readonly usage: string;
  readonly requiresDocument: boolean;
  readonly run: (handlers: Handlers, args: readonly string[]) => string;
}

export function registerBuiltinCommands(framework: Framework): void {
  const handlers = sessionHandlers(framework);
  for (const command of commands) {
    framework.commands.register(new BoundCommand(command, framework, handlers));
  }
  framework.commands.register(new HelpCommand(framework));
}

class BoundCommand implements CliCommand {
  constructor(
    private readonly binding: CommandBinding,
    private readonly framework: Framework,
    private readonly handlers: (session: EditorSession) => Handlers,
  ) {
  }

  get name(): string {
    return this.binding.name;
  }

  get requiresDocument(): boolean {
    return this.binding.requiresDocument;
  }

  get help(): readonly string[] {
    return this.name === "create"
      ? [this.binding.usage, ...this.framework.shapes.all().map(provider => provider.help)] : [this.binding.usage];
  }

  execute(args: readonly string[], session: EditorSession): string {
    return this.binding.run(this.handlers(session), args);
  }
}

class HelpCommand implements CliCommand {
  readonly name = "help";
  readonly help = ["help"];
  readonly requiresDocument = false;

  constructor(private readonly framework: Framework) {
  }

  execute(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 0, "help");
    return this.framework.commands.all().flatMap(command => command.help).join("\n");
  }
}

function sessionHandlers(framework: Framework): (session: EditorSession) => Handlers {
  const sessions = new WeakMap<EditorSession, Handlers>();
  return session => {
    let result = sessions.get(session);
    if (result === undefined) {
      result = createHandlers(session, framework);
      sessions.set(session, result);
    }
    return result;
  };
}

function createHandlers(session: EditorSession, framework: Framework) {
  const feedback = new EditFeedback(session);
  const factory = new RegisteredShapeFactory(framework.shapes);
  const views = new ShapeViews(factory);
  return {
    feedback,
    documents: new DocumentCommands(session),
    shapes: new ShapeCommands(session, feedback, { factory, views, attributes: new AttributeRouter(framework.attributes) }),
    structure: new StructureCommands(session, feedback),
    queries: new QueryCommands(session, views, new RegisteredTreeFormatter(views, framework.decorators)),
  };
}

const commands: readonly CommandBinding[] = [
  { name: "init", usage: "init [w] [h]", requiresDocument: false,
    run(handlers, args) {
      return handlers.documents.initialize(args);
    } },
  { name: "read", usage: "read <file.svg>", requiresDocument: false,
    run(handlers, args) {
      return handlers.documents.read(args);
    } },
  { name: "save", usage: "save [file.svg]", requiresDocument: true,
    run(handlers, args) {
      return handlers.documents.save(args);
    } },
  { name: "canvas", usage: "canvas [w] [h]", requiresDocument: true,
    run(handlers, args) {
      return handlers.documents.canvas(args);
    } },
  { name: "create", usage: "create <type> <id> [params] [in <containerId>]", requiresDocument: true,
    run(handlers, args) {
      return handlers.shapes.create(args);
    } },
  { name: "move", usage: "move <id> <dx> <dy>", requiresDocument: true,
    run(handlers, args) {
      return handlers.shapes.move(args);
    } },
  { name: "scale", usage: "scale <id> <factor>", requiresDocument: true,
    run(handlers, args) {
      return handlers.shapes.scale(args);
    } },
  { name: "set", usage: "set <id> <attr> <value>", requiresDocument: true,
    run(handlers, args) {
      return handlers.shapes.set(args);
    } },
  { name: "delete", usage: "delete <id>", requiresDocument: true,
    run(handlers, args) {
      return handlers.shapes.delete(args);
    } },
  { name: "group", usage: "group <gid> <id1> [id2] ...", requiresDocument: true,
    run(handlers, args) {
      return handlers.structure.group(args);
    } },
  { name: "ungroup", usage: "ungroup <gid>", requiresDocument: true,
    run(handlers, args) {
      return handlers.structure.ungroup(args);
    } },
  { name: "addto", usage: "addto <gid> <id>", requiresDocument: true,
    run(handlers, args) {
      return handlers.structure.addto(args);
    } },
  { name: "front", usage: "front <id>", requiresDocument: true,
    run(handlers, args) {
      return handlers.structure.front(args);
    } },
  { name: "back", usage: "back <id>", requiresDocument: true,
    run(handlers, args) {
      return handlers.structure.back(args);
    } },
  { name: "tree", usage: "tree [id]", requiresDocument: true,
    run(handlers, args) {
      return handlers.queries.tree(args);
    } },
  { name: "show", usage: "show <id>", requiresDocument: true,
    run(handlers, args) {
      return handlers.queries.show(args);
    } },
  { name: "undo", usage: "undo", requiresDocument: true,
    run(handlers, args) {
      return handlers.feedback.undo(args);
    } },
  { name: "redo", usage: "redo", requiresDocument: true,
    run(handlers, args) {
      return handlers.feedback.redo(args);
    } },
];
