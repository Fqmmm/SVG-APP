import type { EditorSession } from "../application/session/EditorSession.js";

export interface Command {
  readonly name: string;
  readonly help: readonly string[];
  readonly requiresDocument: boolean;
  execute(args: readonly string[], session: EditorSession): string;
}
