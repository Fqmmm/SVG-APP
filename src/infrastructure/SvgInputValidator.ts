import type { Shape } from "../domain/Shape.js";
import { AttributeValidator } from "../domain/AttributeValidator.js";
import type { ShapeProvider, SvgElementInput } from "../extensions/ShapeProvider.js";
import { elementText, usesElementText } from "../extensions/ShapeText.js";

export class SvgInputValidator {
  parent(provider: ShapeProvider, input: SvgElementInput, warnings: readonly string[]): void {
    if (!usesElementText(provider) && input.content.trim() !== "") {
      throw new Error("unexpected text in shape: " + input.id);
    }
    const kind = input.metadata.get("data-kind");
    if (kind !== undefined && kind !== provider.svg?.kind && warnings.length === 0) {
      throw new Error("unsupported data-kind: " + kind);
    }
  }

  result(provider: ShapeProvider, shape: Shape, input: SvgElementInput): void {
    this.attributes(shape, input);
    const content = elementText(provider, shape);
    if (content !== undefined && content !== input.content) {
      throw new Error("SVG input not preserved: " + input.id + "/text");
    }
  }

  private attributes(shape: Shape, input: SvgElementInput): void {
    const geometry = shape.geometry;
    const styles = shape.styles;
    for (const [name, raw] of input.attributes) {
      const geometric = Object.hasOwn(geometry, name);
      const actual = geometric ? geometry[name] : Object.hasOwn(styles, name) ? styles[name] : undefined;
      const expected = typeof actual === "number"
        ? AttributeValidator.number(geometric ? raw.trim().replace(/px$/u, "") : raw, name) : raw;
      if (actual !== expected) {
        throw new Error("SVG input not preserved: " + input.id + "/" + name);
      }
    }
  }
}
