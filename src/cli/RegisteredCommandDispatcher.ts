import type { EditorSession } from "../application/EditorSession.js";
import type { Framework } from "../extensions/Framework.js";
import { Tokenizer } from "./Tokenizer.js";

export class RegisteredCommandDispatcher {
  private readonly tokenizer = new Tokenizer();

  constructor(private readonly session: EditorSession, private readonly framework: Framework) {
  }

  dispatch(line: string): string {
    const [name, ...args] = this.tokenizer.tokenize(line);
    if (name === undefined) {
      return "";
    }
    const command = this.framework.commands.find(name);
    if (command === undefined) {
      throw new Error("unknown command: " + name);
    }
    if (command.requiresDocument) {
      void this.session.document;
    }
    return command.execute(args, this.session);
  }
}
