import type { Shape } from "../domain/Shape.js";

export interface AttributeHandler {
  readonly name: string;
  handles(shape: Shape, attribute: string): boolean;
  apply(shape: Shape, attribute: string, value: string | number): void;
}
