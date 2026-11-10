import type { Shape } from "../domain/Shape.js";
import type { Group } from "../domain/Group.js";
import type { RegisteredShapeFactory } from "../application/RegisteredShapeFactory.js";
import type { ShapeEditFeedback, ShapePresentation } from "./ShapeProvider.js";

export class ShapeViews {
  constructor(private readonly factory: RegisteredShapeFactory) {
  }

  static label(shape: Shape): string {
    return shape.type + "#" + shape.id;
  }

  present(shape: Shape): ShapePresentation {
    const provider = this.factory.provider(shape.type);
    const result = provider.present?.(shape) ?? {};
    if (Object.hasOwn(result, "content")) {
      throw new Error("invalid shape presentation: " + shape.type + " (use text accessor)");
    }
    return result;
  }

  summary(shape: Shape): string {
    const details = [this.details(shape), this.styles(shape)].filter(value => value !== "").join(" ");
    return (this.present(shape).treeLabel ?? ShapeViews.label(shape)) + (details === "" ? "" : "  " + details);
  }

  show(shape: Shape, parent: Group | null): string {
    const lines = [ShapeViews.label(shape) + "  parent=" + (parent === null ? "svg" : ShapeViews.label(parent))];
    for (const detail of [this.details(shape), this.styles(shape)]) {
      if (detail !== "") {
        lines.push("  " + detail);
      }
    }
    return lines.join("\n");
  }

  describeEdit(change: ShapeEditFeedback, fallback: string): string {
    return this.factory.provider(change.shape.type).describeEdit?.(change) ?? fallback;
  }

  position(shape: Shape): string | undefined {
    return this.present(shape).position;
  }

  attribute(shape: Shape, attribute: string): string {
    const attributes = { ...shape.geometry, ...shape.styles, ...this.present(shape).attributes };
    const value = Object.hasOwn(attributes, attribute) ? attributes[attribute] : undefined;
    if (value === undefined) {
      return "(unset)";
    }
    return typeof value === "string" ? JSON.stringify(value) : String(value);
  }

  private details(shape: Shape): string {
    return this.present(shape).summary ?? Object.entries(shape.geometry).map(([key, value]) => {
      return key + "=" + value;
    }).join(" ");
  }

  private styles(shape: Shape): string {
    return Object.entries(shape.styles).map(([key, value]) => {
      const displayed = typeof value === "string" && (value === "" || /\s|"/u.test(value)) ? JSON.stringify(value) : String(value);
      return key + "=" + displayed;
    }).join(" ");
  }
}
