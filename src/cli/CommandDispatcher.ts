import { EditorSession } from "../application/EditorSession.js";
import { Tokenizer } from "./Tokenizer.js";
import { EditFeedback } from "./EditFeedback.js";
import { DocumentCommands } from "./DocumentCommands.js";
import { ShapeCommands } from "./ShapeCommands.js";
import { StructureCommands } from "./StructureCommands.js";
import { QueryCommands } from "./QueryCommands.js";

export class CommandDispatcher {
  private readonly tokenizer = new Tokenizer();
  private readonly handlers: ReadonlyMap<string, (args: readonly string[]) => string>;

  constructor(private readonly session = new EditorSession()) {
    const feedback = new EditFeedback(session);
    const documents = new DocumentCommands(session);
    const shapes = new ShapeCommands(session, feedback);
    const structure = new StructureCommands(session, feedback);
    const queries = new QueryCommands(session);
    // Phase 1 keeps one fixed command-name dispatch point.
    this.handlers = new Map([
      ["init", args => {
        return documents.initialize(args);
      }],
      ["read", args => {
        return documents.read(args);
      }],
      ["save", args => {
        return documents.save(args);
      }],
      ["canvas", args => {
        return documents.canvas(args);
      }],
      ["create", args => {
        return shapes.create(args);
      }],
      ["move", args => {
        return shapes.move(args);
      }],
      ["scale", args => {
        return shapes.scale(args);
      }],
      ["set", args => {
        return shapes.set(args);
      }],
      ["delete", args => {
        return shapes.delete(args);
      }],
      ["group", args => {
        return structure.group(args);
      }],
      ["ungroup", args => {
        return structure.ungroup(args);
      }],
      ["addto", args => {
        return structure.addto(args);
      }],
      ["front", args => {
        return structure.front(args);
      }],
      ["back", args => {
        return structure.back(args);
      }],
      ["tree", args => {
        return queries.tree(args);
      }],
      ["show", args => {
        return queries.show(args);
      }],
      ["help", args => {
        return queries.help(args);
      }],
      ["undo", args => {
        return feedback.undo(args);
      }],
      ["redo", args => {
        return feedback.redo(args);
      }],
    ]);
  }

  dispatch(line: string): string {
    const [name, ...args] = this.tokenizer.tokenize(line);
    if (name === undefined) {
      return "";
    }
    const handler = this.handlers.get(name);
    if (handler === undefined) {
      throw new Error("unknown command: " + name);
    }
    // Document errors take precedence over argument errors for document commands.
    if (name !== "init" && name !== "read" && name !== "help") {
      void this.session.document;
    }
    return handler(args);
  }
}
