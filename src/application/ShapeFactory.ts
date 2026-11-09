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
  // Phase 1 retains the single, fixed shape-name lookup for CLI and SVG.
  private readonly definitions = new Map<string, ShapeDefinition>([
    ["rect", new ShapeDefinition({ geometry: ["x", "y", "width", "height"], style: "fill" }, (id, input) => {
      const { x, y, width, height } = input.geometry;
      return new Rect(id, x!, y!, width!, height!);
    })],
    ["circle", new ShapeDefinition({ geometry: ["cx", "cy", "r"], style: "fill" }, (id, input) => {
      const { cx, cy, r } = input.geometry;
      return new Circle(id, cx!, cy!, r!);
    })],
    ["ellipse", new ShapeDefinition({
      geometry: ["cx", "cy", "rx", "ry"], style: "fill", missingGeometry: new Map([["rx", "ry"], ["ry", "rx"]]),
    }, (id, input) => {
      const { cx, cy, rx, ry } = input.geometry;
      return new Ellipse(id, cx!, cy!, rx!, ry!);
    })],
    ["line", new ShapeDefinition({ geometry: ["x1", "y1", "x2", "y2"], style: "stroke" }, (id, input) => {
      const { x1, y1, x2, y2 } = input.geometry;
      return new Line(id, x1!, y1!, x2!, y2!);
    })],
    ["text", new ShapeDefinition({ geometry: ["x", "y"], hasText: true }, (id, input) => {
      return new Text(id, input.geometry["x"]!, input.geometry["y"]!, input.content!);
    })],
    ["g", new ShapeDefinition({ geometry: [] }, id => {
      return new Group(id);
    })],
  ]);

  create(type: string, id: string, parameters: readonly string[]): Shape {
    const definition = this.definition(type);
    const schema = definition.schema;
    const minimum = schema.geometry.length + (schema.hasText === true ? 1 : 0);
    const args = new CreateArguments(type, parameters, minimum, minimum + (schema.style === undefined ? 0 : 1));
    const geometry = Object.fromEntries(schema.geometry.map((name, index) => {
      return [name, args.number(index, name)];
    }));
    const content = schema.hasText === true ? args.text(schema.geometry.length) : undefined;
    const style = schema.style === undefined ? undefined : args.optional(schema.geometry.length);
    return definition.create(id, {
      geometry,
      ...(content === undefined ? {} : { content }),
      ...(style === undefined ? {} : { style }),
    });
  }

  definition(type: string): ShapeDefinition {
    const definition = this.definitions.get(type);
    if (definition === undefined) {
      throw new Error("unknown shape type: " + type + " (is the plugin loaded?)");
    }
    return definition;
  }
}
