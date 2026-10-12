import { FileDocumentRepository } from "./infrastructure/FileDocumentRepository.js";
import { Repl } from "./cli/Repl.js";
import { CommandDispatcher } from "./cli/CommandDispatcher.js";
import { EditorSession } from "./application/EditorSession.js";

const session = new EditorSession(new FileDocumentRepository());
const dispatcher = new CommandDispatcher(session);
const repl = new Repl(process.stdin, process.stdout, dispatcher);
await repl.run();
