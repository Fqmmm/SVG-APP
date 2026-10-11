import { AttributeValidator } from "./AttributeValidator.js";
import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";

export class Rect extends Shape {
  private state: { x: number; y: number; width: number; height: number };

  constructor(id: string, x: number, y: number, width: number, height: number, fill?: string) {
    super(id, fill === undefined ? {} : { fill });
    this.state = { x, y, width, height };
    AttributeValidator.geometry(this.state, ["width","height"]);
  }

  override get type(): string { return "rect"; }

  override get geometry(): Readonly<{ x: number; y: number; width: number; height: number }> {
    return Object.freeze({ ...this.state });
  }

  override accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.visitRect(this);
  }

  protected override moveGeometry(dx: number, dy: number): void {
    const next = { ...this.state, x: this.state.x + dx, y: this.state.y + dy };
    AttributeValidator.geometry(next, ["width","height"]);
    this.state = next;
  }

  protected override scaleGeometry(factor: number): void {
    const next = { x: this.state.x * factor, y: this.state.y * factor, width: this.state.width * factor, height: this.state.height * factor };
    AttributeValidator.geometry(next, ["width","height"]);
    this.state = next;
  }

  protected override setOwnAttribute(attribute: string, value: string | number): void {
    this.state = AttributeValidator.updatedGeometry(this.state, attribute, value, ["width","height"]);
  }

  protected override captureOwnState(): () => void {
    const state = { ...this.state };
    return () => {
      this.state = { ...state };
    };
  }
}
