import { CommandArguments, TreeValidator } from "../../extensions/index.js";
import type { Command, EditorSession, Shape } from "../../extensions/index.js";

export class StatsCommand implements Command {
  readonly name = "stats";
  readonly help = ["stats"];
  readonly requiresDocument = true;

  execute(args: readonly string[], session: EditorSession): string {
    CommandArguments.requireCount(args, 0, 0, "stats");
    return new ShapeStatistics(session.document.children).format();
  }
}

class ShapeStatistics {
  private readonly counts = new Map<string, number>();
  private containers = 0;

  constructor(roots: readonly Shape[]) {
    for (const shape of TreeValidator.forest(roots)) {
      this.count(shape);
    }
  }

  format(): string {
    const types = [...this.counts].map(([type, count]) => type + ": " + count);
    const total = [...this.counts.values()].reduce((sum, count) => sum + count, 0);
    return [...types, "(total " + total + ", containers " + this.containers + ")"].join("  ");
  }

  private count(shape: Shape): void {
    if (shape.asContainer() !== undefined) {
      this.containers += 1;
      return;
    }
    this.counts.set(shape.type, (this.counts.get(shape.type) ?? 0) + 1);
  }
}
