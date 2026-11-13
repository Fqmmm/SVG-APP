import { createDefaultFramework } from "../createDefaultFramework.js";
import { RegisteredShapeFactory } from "../../application/shapes/RegisteredShapeFactory.js";

// Convenience entry point with the built-in shape registry already configured.
export class ShapeFactory extends RegisteredShapeFactory {
  constructor() {
    super(createDefaultFramework().shapes);
  }
}
