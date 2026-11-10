import { createEditor } from "./composition/createEditor.js";
import { RegisteredRepl } from "./cli/RegisteredRepl.js";

const editor = createEditor();
const repl = new RegisteredRepl(process.stdin, process.stdout, editor.dispatcher);
await repl.run();
