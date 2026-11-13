import { Shape, ShapeDefinition, AttributeValidator } from "../../../src/extensions/index.js";
import type { Framework } from "../../../src/extensions/index.js";

export class Tile extends Shape {
  private state: { x: number; y: number; width: number; height: number };

  constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id);
    this.state = { x, y, width, height };
    AttributeValidator.geometry(this.state, ["width", "height"]);
  }

  override get type(): string {
    return "tile";
  }

  override get geometry(): Readonly<Record<string, number>> {
    return Object.freeze({ ...this.state });
  }

  protected override moveGeometry(dx: number, dy: number): void {
    this.state = { ...this.state, x: this.state.x + dx, y: this.state.y + dy };
    AttributeValidator.geometry(this.state, ["width", "height"]);
  }

  protected override scaleGeometry(factor: number): void {
    this.state = { x: this.state.x * factor, y: this.state.y * factor,
      width: this.state.width * factor, height: this.state.height * factor };
    AttributeValidator.geometry(this.state, ["width", "height"]);
  }

  protected override setOwnAttribute(attribute: string, value: string | number): void {
    this.state = AttributeValidator.updatedGeometry(this.state, attribute, value, ["width", "height"]);
  }

  protected override captureOwnState(): () => void {
    const previous = { ...this.state };
    return () => {
      this.state = { ...previous };
    };
  }
}

export function registerTile(framework: Framework): void {
  framework.shapes.register({
    name: "tile", help: "  tile <id> <x> <y> <w> <h>",
    definition: new ShapeDefinition({ geometry: ["x", "y", "width", "height"] }, (id, input) => {
      const g = input.geometry;
      return new Tile(id, g["x"]!, g["y"]!, g["width"]!, g["height"]!);
    }),
    present(shape) {
      return { summary: "tile-width=" + shape.geometry["width"] };
    },
  });
}
