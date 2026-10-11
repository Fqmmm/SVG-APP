import { AttributeValidator } from "./AttributeValidator.js";
import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";

export class Ellipse extends Shape {
  private state: { cx: number; cy: number; rx: number; ry: number };

  constructor(id: string, cx: number, cy: number, rx: number, ry: number, fill?: string) {
    super(id, fill === undefined ? {} : { fill });
    this.state = { cx, cy, rx, ry };
    AttributeValidator.geometry(this.state, ["rx","ry"]);
  }

  override get type(): string { return "ellipse"; }

  override get geometry(): Readonly<{ cx: number; cy: number; rx: number; ry: number }> {
    return Object.freeze({ ...this.state });
  }

  override accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.visitEllipse(this);
  }

  protected override moveGeometry(dx: number, dy: number): void {
    const next = { ...this.state, cx: this.state.cx + dx, cy: this.state.cy + dy };
    AttributeValidator.geometry(next, ["rx","ry"]);
    this.state = next;
  }

  protected override scaleGeometry(factor: number): void {
    const next = { cx: this.state.cx * factor, cy: this.state.cy * factor, rx: this.state.rx * factor, ry: this.state.ry * factor };
    AttributeValidator.geometry(next, ["rx","ry"]);
    this.state = next;
  }

  protected override setOwnAttribute(attribute: string, value: string | number): void {
    this.state = AttributeValidator.updatedGeometry(this.state, attribute, value, ["rx","ry"]);
  }

  protected override captureOwnState(): () => void {
    const state = { ...this.state };
    return () => {
      this.state = { ...state };
    };
  }
}
