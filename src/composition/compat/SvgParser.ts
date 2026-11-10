import { ShapeFactory } from "./ShapeFactory.js";
import { RegisteredSvgParser } from "../../infrastructure/RegisteredSvgParser.js";

export class SvgParser extends RegisteredSvgParser {
  constructor() {
    super(new ShapeFactory());
  }
}
