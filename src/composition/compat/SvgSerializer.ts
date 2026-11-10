import { ShapeFactory } from "./ShapeFactory.js";
import { RegisteredSvgSerializer } from "../../infrastructure/RegisteredSvgSerializer.js";

export class SvgSerializer extends RegisteredSvgSerializer {
  constructor() {
    super(new ShapeFactory());
  }
}
