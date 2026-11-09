import type { EditCommand } from "../application/EditCommand.js";
import type { EditorSession } from "../application/EditorSession.js";
import { CommandArguments } from "./CommandArguments.js";

export class EditFeedback {
  private readonly feedback = new WeakMap<EditCommand, {
    executed: () => string;
    undone: () => string;
  }>();

  constructor(private readonly session: EditorSession) {
  }

  execute(command: EditCommand, executed: () => string, undone: () => string): string {
    this.session.execute(command);
    this.feedback.set(command, { executed, undone });
    return executed();
  }

  undo(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 0, "undo");
    const command = this.session.undo();
    return this.feedback.get(command)?.undone() ?? "edit undone";
  }

  redo(args: readonly string[]): string {
    CommandArguments.requireCount(args, 0, 0, "redo");
    const command = this.session.redo();
    return this.feedback.get(command)?.executed() ?? "edit redone";
  }
}
