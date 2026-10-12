import { AttributeValidator } from "./AttributeValidator.js";
import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";

export class Circle extends Shape {
  private state: { cx: number; cy: number; r: number };

  constructor(id: string, cx: number, cy: number, r: number, fill?: string) {
    super(id, fill === undefined ? {} : { fill });
    this.state = { cx, cy, r };
    AttributeValidator.geometry(this.state, ["r"]);
  }

  override get type(): string {
    return "circle";
  }

  override get geometry(): Readonly<{ cx: number; cy: number; r: number }> {
    return Object.freeze({ ...this.state });
  }

  override accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.visitCircle(this);
  }

  protected override moveGeometry(dx: number, dy: number): void {
    const next = { ...this.state, cx: this.state.cx + dx, cy: this.state.cy + dy };
    AttributeValidator.geometry(next, ["r"]);
    this.state = next;
  }

  protected override scaleGeometry(factor: number): void {
    const next = { cx: this.state.cx * factor, cy: this.state.cy * factor, r: this.state.r * factor };
    AttributeValidator.geometry(next, ["r"]);
    this.state = next;
  }

  protected override setOwnAttribute(attribute: string, value: string | number): void {
    this.state = AttributeValidator.updatedGeometry(this.state, attribute, value, ["r"]);
  }

  protected override captureOwnState(): () => void {
    const state = { ...this.state };
    return () => {
      this.state = { ...state };
    };
  }
}
