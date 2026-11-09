export interface ShapeInput {
  readonly geometry: Readonly<Record<string, number>>;
  readonly content?: string;
  readonly style?: string;
}
