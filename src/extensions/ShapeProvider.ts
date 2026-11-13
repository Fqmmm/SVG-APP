import type { ShapeDefinition } from "../application/shapes/ShapeDefinition.js";
import type { Shape } from "../domain/Shape.js";

export interface ShapePresentation {
  readonly summary?: string;
  readonly treeLabel?: string;
  readonly position?: string;
  readonly attributes?: Readonly<Record<string, string | number>>;
}

export interface SvgElementInput {
  readonly id: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly metadata: ReadonlyMap<string, string>;
  readonly content: string;
}

export interface SvgShapeInput extends SvgElementInput {
  readonly children: readonly Shape[];
}

export interface ShapeEditFeedback {
  readonly shape: Shape;
  readonly operation: "create" | "set";
  readonly phase: "applied" | "undone";
  readonly attribute?: string;
}

export interface ShapeProvider {
  readonly name: string;
  readonly definition: ShapeDefinition;
  readonly help: string;
  readonly svg?: { readonly tag: string; readonly kind?: string; readonly text?: "children" };
  fromSvg?(input: SvgShapeInput): Shape;
  validateSvg?(input: SvgElementInput): readonly string[];
  text?(shape: Shape): string;
  present?(shape: Shape): ShapePresentation;
  describeEdit?(change: ShapeEditFeedback): string | undefined;
}
