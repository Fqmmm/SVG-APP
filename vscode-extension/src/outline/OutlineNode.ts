export interface OutlineNode {
  readonly name: string;
  readonly span: { readonly start: number; readonly end: number };
  readonly selection: { readonly start: number; readonly end: number };
  readonly children: readonly OutlineNode[];
}
