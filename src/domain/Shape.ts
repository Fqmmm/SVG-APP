import type { Group } from "./Group.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";
import { AttributeValidator } from "./AttributeValidator.js";
import { ShapeState } from "./ShapeState.js";

export abstract class Shape {
  private styleValues: Record<string, string | number>;

  constructor(
    private readonly shapeId: string,
    styles: Readonly<Record<string, string | number>> = {},
  ) {
    AttributeValidator.id(shapeId);
    this.styleValues = {};
    for (const [attribute, value] of Object.entries(styles)) {
      this.setStyle(attribute, value);
    }
  }

  get id(): string {
    return this.shapeId;
  }

  abstract get type(): string;

  abstract get geometry(): Readonly<Record<string, number>>;

  get styles(): Readonly<Record<string, string | number>> {
    return Object.freeze({ ...this.styleValues });
  }

  get children(): readonly Shape[] {
    return Object.freeze([]);
  }

  asContainer(): Group | undefined {
    return undefined;
  }

  abstract accept<R>(visitor: ShapeVisitor<R>): R;

  move(dx: number, dy: number): void {
    AttributeValidator.finite(dx, "dx");
    AttributeValidator.finite(dy, "dy");
    this.changeAtomically(() => this.moveGeometry(dx, dy));
  }

  scale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error("scale factor must be positive");
    }
    this.changeAtomically(() => this.scaleGeometry(factor));
  }

  set(attribute: string, value: string | number): void {
    if (attribute === "fill" || attribute === "stroke" || attribute === "stroke-width") {
      this.setStyle(attribute, value);
      return;
    }
    this.setOwnAttribute(attribute, value);
  }

  captureState(): ShapeState {
    const styles = { ...this.styleValues };
    const restoreOwnState = this.captureOwnState();
    return new ShapeState(() => {
      this.styleValues = { ...styles };
      restoreOwnState();
    });
  }

  protected abstract moveGeometry(dx: number, dy: number): void;

  protected abstract scaleGeometry(factor: number): void;

  protected abstract setOwnAttribute(attribute: string, value: string | number): void;

  protected abstract captureOwnState(): () => void;

  private setStyle(attribute: string, value: string | number): void {
    if (attribute === "stroke-width") {
      const width = AttributeValidator.number(value, attribute);
      AttributeValidator.geometry({ "stroke-width": width }, ["stroke-width"]);
      this.styleValues[attribute] = width;
      return;
    }
    if (attribute !== "fill" && attribute !== "stroke") {
      throw new Error("unknown attribute: " + attribute);
    }
    this.styleValues[attribute] = AttributeValidator.text(value, attribute);
  }

  private changeAtomically(action: () => void): void {
    const previous = this.captureState();
    try {
      action();
    } catch (error) {
      previous.restore();
      throw error;
    }
  }
}
