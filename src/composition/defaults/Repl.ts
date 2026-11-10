import type { Readable, Writable } from "node:stream";
import { CommandDispatcher } from "./CommandDispatcher.js";
import { RegisteredRepl } from "../../cli/RegisteredRepl.js";

export class Repl extends RegisteredRepl {
  constructor(input: Readable, output: Writable, dispatcher = new CommandDispatcher()) {
    super(input, output, dispatcher);
  }
}
