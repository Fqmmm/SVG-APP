import type { Shape } from "../domain/Shape.js";
import { Rect } from "../domain/Rect.js";
import { Circle } from "../domain/Circle.js";
import { Ellipse } from "../domain/Ellipse.js";
import { Line } from "../domain/Line.js";
import { Text } from "../domain/Text.js";
import { Group } from "../domain/Group.js";
import { CreateArguments } from "./CreateArguments.js";
import { ShapeDefinition } from "./ShapeDefinition.js";

export class ShapeFactory {
  // The single shape-name dispatch point for CLI and SVG; registration comes with plugins.
  private readonly definitions = new Map<string, ShapeDefinition>([
    ["rect", new ShapeDefinition(["x", "y", "width", "height"], (id, values) => {
      const args = new CreateArguments("rect", values, 4, 5);
      return new Rect(id, args.number(0, "x"), args.number(1, "y"),
        args.number(2, "width"), args.number(3, "height"), args.optional(4));
    })],
    ["circle", new ShapeDefinition(["cx", "cy", "r"], (id, values) => {
      const args = new CreateArguments("circle", values, 3, 4);
      return new Circle(id, args.number(0, "cx"), args.number(1, "cy"), args.number(2, "r"), args.optional(3));
    })],
    ["ellipse", new ShapeDefinition(["cx", "cy", "rx", "ry"], (id, values) => {
      const args = new CreateArguments("ellipse", values, 4, 5);
      return new Ellipse(id, args.number(0, "cx"), args.number(1, "cy"),
        args.number(2, "rx"), args.number(3, "ry"), args.optional(4));
    }, false, new Map([["rx", "ry"], ["ry", "rx"]]))],
    ["line", new ShapeDefinition(["x1", "y1", "x2", "y2"], (id, values) => {
      const args = new CreateArguments("line", values, 4, 5);
      return new Line(id, args.number(0, "x1"), args.number(1, "y1"),
        args.number(2, "x2"), args.number(3, "y2"), args.optional(4));
    })],
    ["text", new ShapeDefinition(["x", "y"], (id, values) => {
      const args = new CreateArguments("text", values, 3);
      return new Text(id, args.number(0, "x"), args.number(1, "y"), args.text(2));
    }, true)],
    ["g", new ShapeDefinition([], (id, values) => {
      new CreateArguments("g", values, 0);
      return new Group(id);
    })],
  ]);

  create(type: string, id: string, parameters: readonly string[]): Shape {
    return this.definition(type).create(id, parameters);
  }

  createFromAttributes(type: string, id: string, attributes: ReadonlyMap<string, string>, content: string): Shape {
    return this.definition(type).fromAttributes(id, attributes, content);
  }

  private definition(type: string): ShapeDefinition {
    const definition = this.definitions.get(type);
    if (definition === undefined) throw new Error("unknown shape type: " + type + " (is the plugin loaded?)");
    return definition;
  }
}
