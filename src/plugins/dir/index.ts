import type { Framework } from "../../extensions/index.js";
import { DirCommand } from "./DirCommand.js";
import { NodeDirectoryAccess } from "./NodeDirectoryAccess.js";

class DirPlugin {
  activate(context: Framework): void {
    context.commands.register(new DirCommand(new NodeDirectoryAccess()));
  }
}

export default new DirPlugin();
