import type { Framework } from "../../extensions/index.js";
import { ModifiedStarDecorator } from "./ModifiedStarDecorator.js";

class ModifiedStarPlugin {
  activate(context: Framework): void {
    context.decorators.register(new ModifiedStarDecorator());
  }
}

export default new ModifiedStarPlugin();
