import { AttributeValidator } from "./AttributeValidator.js";
import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";

export class Text extends Shape {
  private state: { x: number; y: number };
  private textContent: string;

  constructor(id: string, x: number, y: number, content: string) {
    super(id, {});
    this.state = { x, y };
    AttributeValidator.geometry(this.state, []);
    this.textContent = AttributeValidator.text(content, "text");
  }

  override get type(): string { return "text"; }

  override get geometry(): Readonly<{ x: number; y: number }> {
    return Object.freeze({ ...this.state });
  }

  get content(): string { return this.textContent; }

  override accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.visitText(this);
  }

  protected override moveGeometry(dx: number, dy: number): void {
    const next = { ...this.state, x: this.state.x + dx, y: this.state.y + dy };
    AttributeValidator.geometry(next, []);
    this.state = next;
  }

  protected override scaleGeometry(factor: number): void {
    const next = { x: this.state.x * factor, y: this.state.y * factor };
    AttributeValidator.geometry(next, []);
    this.state = next;
  }

  protected override setOwnAttribute(attribute: string, value: string | number): void {
    if (attribute === "text") {
      this.textContent = AttributeValidator.text(value, attribute);
      return;
    }
    this.state = AttributeValidator.updatedGeometry(this.state, attribute, value, []);
  }

  protected override captureOwnState(): () => void {
    const state = { ...this.state };
    const content = this.textContent;
    return () => {
      this.state = { ...state };
      this.textContent = content;
    };
  }
}
