import { Repl } from "./cli/Repl.js";

const repl = new Repl(process.stdin, process.stdout);
await repl.run();
