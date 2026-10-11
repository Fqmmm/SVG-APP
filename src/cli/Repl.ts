import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

export class Repl {
  constructor(
    private readonly input: Readable,
    private readonly output: Writable,
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
        const trimmed = line.trim();
        if (trimmed !== "" && !trimmed.startsWith("#")) {
          // Command dispatch will be connected in the CLI implementation stage.
          this.output.write("error: command handling is not available yet\n");
        }
        this.output.write("svg> ");
      }
    } finally {
      lines.close();
    }
  }
}
