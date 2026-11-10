import type { Framework } from "../../extensions/index.js";
import { BoxProvider } from "./BoxProvider.js";
import { BoxAttributes } from "./BoxAttributes.js";
import { BoxTypeDecorator } from "./BoxTypeDecorator.js";

class BoxPlugin {
  activate(context: Framework): void {
    context.shapes.register(new BoxProvider());
    context.attributes.register(new BoxAttributes());
    context.decorators.register(new BoxTypeDecorator());
  }
}

export default new BoxPlugin();
