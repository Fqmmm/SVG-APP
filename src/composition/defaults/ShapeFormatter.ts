import { ShapeFactory } from "./ShapeFactory.js";
import { ShapeViews } from "../../extensions/ShapeViews.js";

export class ShapeFormatter extends ShapeViews {
  constructor() {
    super(new ShapeFactory());
  }
}
