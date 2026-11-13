import { Framework } from "../extensions/Framework.js";
import { registerBuiltinShapes } from "../plugins/builtin/shapes/index.js";
import { registerBuiltinCommands } from "../plugins/builtin/commands/index.js";

export function createDefaultFramework(): Framework {
  const framework = new Framework();
  registerBuiltinShapes(framework.shapes);
  registerBuiltinCommands(framework);
  return framework;
}
