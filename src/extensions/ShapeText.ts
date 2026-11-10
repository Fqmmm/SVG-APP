import type { Shape } from "../domain/Shape.js";
import type { ShapeProvider } from "./ShapeProvider.js";

export function usesElementText(provider: ShapeProvider): boolean {
  return provider.definition.schema.hasText === true && provider.svg?.text !== "children";
}

export function validateShapeText(provider: ShapeProvider, shape: Shape): void {
  const container = shape.asContainer() !== undefined;
  if (usesElementText(provider) && container) {
    throw new Error("unsupported SVG text for container: " + provider.name);
  }
  if (provider.svg?.text === "children" && !container) {
    throw new Error("SVG child text requires a container: " + provider.name);
  }
}

export function elementText(provider: ShapeProvider, shape: Shape): string | undefined {
  validateShapeText(provider, shape);
  if (!usesElementText(provider)) {
    return undefined;
  }
  const value = provider.text?.(shape);
  if (typeof value !== "string") {
    throw new Error("invalid shape text: " + provider.name);
  }
  return value;
}
