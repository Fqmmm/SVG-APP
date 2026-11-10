import { Framework } from "../extensions/Framework.js";
import { registerBuiltinShapes } from "../plugins/builtin/shapes.js";
import { registerBuiltinCommands } from "../plugins/builtin/commands.js";

export function createDefaultFramework(): Framework {
  const framework = new Framework();
  registerBuiltinShapes(framework.shapes);
  registerBuiltinCommands(framework);
  return framework;
}
