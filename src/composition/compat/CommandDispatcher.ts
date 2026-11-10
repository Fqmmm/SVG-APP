import { EditorSession } from "../../application/EditorSession.js";
import { createDefaultFramework } from "../createDefaultFramework.js";
import { RegisteredCommandDispatcher } from "../../cli/RegisteredCommandDispatcher.js";

// Compatibility entry point: default assembly is kept outside the dispatcher kernel.
export class CommandDispatcher extends RegisteredCommandDispatcher {
  constructor(session = new EditorSession()) {
    super(session, createDefaultFramework());
  }
}
