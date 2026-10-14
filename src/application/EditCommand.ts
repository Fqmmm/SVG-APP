import type { SvgDocument } from "../domain/SvgDocument.js";

export abstract class EditCommand {
  private owner: SvgDocument | undefined;
  private applied = false;

  execute(document: SvgDocument): void {
    this.checkDocument(document);
    if (this.applied) {
      throw new Error("command already executed");
    }
    this.executeEdit(document);
    this.owner = document;
    this.applied = true;
  }

  undo(document: SvgDocument): void {
    this.checkDocument(document);
    if (!this.applied) {
      throw new Error("command not executed");
    }
    this.undoEdit(document);
    this.applied = false;
  }

  protected abstract executeEdit(document: SvgDocument): void;

  protected abstract undoEdit(document: SvgDocument): void;

  private checkDocument(document: SvgDocument): void {
    if (this.owner !== undefined && this.owner !== document) {
      throw new Error("command belongs to a different document");
    }
  }
}
