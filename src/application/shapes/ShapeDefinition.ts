import type { Shape } from "../../domain/Shape.js";
import type { ShapeInput } from "./ShapeInput.js";
import type { ShapeSchema } from "./ShapeSchema.js";

export class ShapeDefinition {
  readonly schema: ShapeSchema;

  constructor(schema: ShapeSchema, private readonly creator: (id: string, input: ShapeInput) => Shape) {
    this.schema = Object.freeze({
      ...schema,
      geometry: Object.freeze([...schema.geometry]),
      ...(schema.missingGeometry === undefined ? {} : { missingGeometry: new Map(schema.missingGeometry) }),
    });
  }

  create(id: string, input: ShapeInput): Shape {
    const shape = this.creator(id, input);
    if (input.style !== undefined && this.schema.style !== undefined) {
      shape.set(this.schema.style, input.style);
    }
    return shape;
  }
}
