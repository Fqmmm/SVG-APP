import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { CommandDispatcher } from "./CommandDispatcher.js";

export class Repl {
  constructor(
    private readonly input: Readable,
    private readonly output: Writable,
    private readonly dispatcher = new CommandDispatcher(),
  ) {}

  async run(): Promise<void> {
    const lines = createInterface({
      input: this.input,
      crlfDelay: Infinity,
      terminal: false,
    });

    try {
      this.output.write("svg-editor 0.1\nsvg> ");
      for await (const line of lines) {
        try {
          const response = this.dispatcher.dispatch(line);
          if (response !== "") this.output.write(response + "\n");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.output.write("error: " + message.replace(/[\r\n]/gu, " ") + "\n");
        }
        this.output.write("svg> ");
      }
    } finally {
      lines.close();
    }
  }
}
