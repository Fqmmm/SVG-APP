import type { SvgDocument } from "../domain/SvgDocument.js";
import type { DocumentReadResult } from "./DocumentReadResult.js";

export interface DocumentRepository {
  read(path: string): DocumentReadResult;

  write(path: string, document: SvgDocument): void;
}
