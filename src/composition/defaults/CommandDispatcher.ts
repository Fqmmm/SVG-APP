import { EditorSession } from "../../application/session/EditorSession.js";
import { createDefaultFramework } from "../createDefaultFramework.js";
import { RegisteredCommandDispatcher } from "../../cli/RegisteredCommandDispatcher.js";

// Default assembly stays outside the registry-based dispatcher.
export class CommandDispatcher extends RegisteredCommandDispatcher {
  constructor(session = new EditorSession()) {
    super(session, createDefaultFramework());
  }
}
