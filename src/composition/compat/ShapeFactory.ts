import { createDefaultFramework } from "../createDefaultFramework.js";
import { RegisteredShapeFactory } from "../../application/RegisteredShapeFactory.js";

// Default-assembly facade retained for existing callers.
export class ShapeFactory extends RegisteredShapeFactory {
  constructor() {
    super(createDefaultFramework().shapes);
  }
}
