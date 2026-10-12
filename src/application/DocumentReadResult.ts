import type { SvgDocument } from "../domain/SvgDocument.js";

export interface DocumentReadResult {
  readonly document: SvgDocument;
  readonly warnings: readonly string[];
}
