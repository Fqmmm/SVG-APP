import { AttributeValidator } from "./AttributeValidator.js";
import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";

export class Line extends Shape {
  private state: { x1: number; y1: number; x2: number; y2: number };

  constructor(id: string, x1: number, y1: number, x2: number, y2: number, stroke?: string) {
    super(id, stroke === undefined ? {} : { stroke });
    this.state = { x1, y1, x2, y2 };
    AttributeValidator.geometry(this.state, []);
  }

  override get type(): string {
    return "line";
  }

  override get geometry(): Readonly<{ x1: number; y1: number; x2: number; y2: number }> {
    return Object.freeze({ ...this.state });
  }

  override accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.visitLine(this);
  }

  protected override moveGeometry(dx: number, dy: number): void {
    const next = { ...this.state, x1: this.state.x1 + dx, y1: this.state.y1 + dy, x2: this.state.x2 + dx, y2: this.state.y2 + dy };
    AttributeValidator.geometry(next, []);
    this.state = next;
  }

  protected override scaleGeometry(factor: number): void {
    const next = { x1: this.state.x1 * factor, y1: this.state.y1 * factor, x2: this.state.x2 * factor, y2: this.state.y2 * factor };
    AttributeValidator.geometry(next, []);
    this.state = next;
  }

  protected override setOwnAttribute(attribute: string, value: string | number): void {
    this.state = AttributeValidator.updatedGeometry(this.state, attribute, value, []);
  }

  protected override captureOwnState(): () => void {
    const state = { ...this.state };
    return () => {
      this.state = { ...state };
    };
  }
}
