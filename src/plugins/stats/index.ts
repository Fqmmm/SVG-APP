import type { Framework } from "../../extensions/index.js";
import { StatsCommand } from "./StatsCommand.js";

class StatsPlugin {
  activate(context: Framework): void {
    context.commands.register(new StatsCommand());
  }
}

export default new StatsPlugin();
