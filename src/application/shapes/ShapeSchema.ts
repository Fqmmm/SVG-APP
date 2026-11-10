export interface ShapeSchema {
  readonly geometry: readonly string[];
  readonly style?: "fill" | "stroke";
  readonly hasText?: boolean;
  readonly missingGeometry?: ReadonlyMap<string, string>;
}
