import type { SvgDocument } from "../domain/SvgDocument.js";
import type { EditCommand } from "./EditCommand.js";

export class CommandHistory {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private readonly recorded = new WeakSet<EditCommand>();
  private blockedByIo = false;

  constructor(private readonly document: SvgDocument) {
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  execute(command: EditCommand): void {
    if (this.recorded.has(command)) {
      throw new Error("command already recorded");
    }
    command.execute(this.document);
    this.undoStack.push(command);
    this.recorded.add(command);
    this.redoStack.length = 0;
    this.blockedByIo = false;
  }

  undo(): EditCommand {
    this.checkBarrier();
    const command = this.undoStack.at(-1);
    if (command === undefined) {
      throw new Error("nothing to undo");
    }
    command.undo(this.document);
    this.undoStack.pop();
    this.redoStack.push(command);
    return command;
  }

  redo(): EditCommand {
    this.checkBarrier();
    const command = this.redoStack.at(-1);
    if (command === undefined) {
      throw new Error("nothing to redo");
    }
    command.execute(this.document);
    this.redoStack.pop();
    this.undoStack.push(command);
    return command;
  }

  establishBarrier(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.blockedByIo = true;
  }

  private checkBarrier(): void {
    if (this.blockedByIo) {
      throw new Error("undo not allowed after io command");
    }
  }
}
