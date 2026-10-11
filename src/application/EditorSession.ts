import { SvgDocument } from "../domain/SvgDocument.js";
import { CommandHistory } from "./CommandHistory.js";
import type { EditCommand } from "./EditCommand.js";

export class EditorSession {
  private currentDocument: SvgDocument | undefined;
  private history: CommandHistory | undefined;

  get document(): SvgDocument {
    if (this.currentDocument === undefined) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    return this.currentDocument;
  }

  initialize(width = 800, height = 600): void {
    // Construct and validate before replacing the active document or history.
    const document = new SvgDocument(width, height);
    const history = new CommandHistory(document);
    history.establishBarrier();
    this.currentDocument = document;
    this.history = history;
  }

  execute(command: EditCommand): void {
    this.requireHistory().execute(command);
  }

  undo(): EditCommand { return this.requireHistory().undo(); }
  redo(): EditCommand { return this.requireHistory().redo(); }

  establishBarrier(): void {
    this.requireHistory().establishBarrier();
  }

  private requireHistory(): CommandHistory {
    if (this.history === undefined) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    return this.history;
  }
}
