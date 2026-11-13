import { ShapeFormatter } from "./ShapeFormatter.js";
import { RegisteredTreeFormatter } from "../../cli/RegisteredTreeFormatter.js";

export class TreeFormatter extends RegisteredTreeFormatter {
  constructor(shapes = new ShapeFormatter()) {
    super(shapes);
  }
}
