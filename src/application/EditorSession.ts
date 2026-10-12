import { SvgDocument } from "../domain/SvgDocument.js";
import { CommandHistory } from "./CommandHistory.js";
import type { EditCommand } from "./EditCommand.js";
import type { DocumentRepository } from "./DocumentRepository.js";
import type { DocumentReadResult } from "./DocumentReadResult.js";

export class EditorSession {
  private currentDocument: SvgDocument | undefined;
  private history: CommandHistory | undefined;
  private currentPath: string | undefined;

  constructor(private readonly repository?: DocumentRepository) {}

  get path(): string | undefined { return this.currentPath; }

  get document(): SvgDocument {
    if (this.currentDocument === undefined) throw new Error("no document. use 'init' or 'read' first");
    return this.currentDocument;
  }

  initialize(width = 800, height = 600): void {
    this.activate(new SvgDocument(width, height));
    this.currentPath = undefined;
  }

  read(path: string): DocumentReadResult {
    this.validatePath(path);
    const result = this.requireRepository().read(path);
    this.activate(result.document);
    this.currentPath = path;
    return result;
  }

  save(path?: string): void {
    const document = this.document;
    const target = path ?? this.currentPath;
    if (target === undefined) throw new Error("no file path. use 'save <file.svg>' first");
    this.validatePath(target);
    this.requireRepository().write(target, document);
    this.currentPath = target;
    this.establishBarrier();
  }

  resize(width: number, height: number): void {
    this.document.resize(width, height);
    this.establishBarrier();
  }

  execute(command: EditCommand): void { this.requireHistory().execute(command); }
  undo(): EditCommand { return this.requireHistory().undo(); }
  redo(): EditCommand { return this.requireHistory().redo(); }
  establishBarrier(): void { this.requireHistory().establishBarrier(); }

  private activate(document: SvgDocument): void {
    const history = new CommandHistory(document);
    history.establishBarrier();
    this.currentDocument = document;
    this.history = history;
  }

  private validatePath(path: string): void {
    if (path.trim() === "" || path.includes("\u0000")) throw new Error("invalid file path");
  }

  private requireRepository(): DocumentRepository {
    if (this.repository === undefined) throw new Error("document repository is not configured");
    return this.repository;
  }

  private requireHistory(): CommandHistory {
    if (this.history === undefined) throw new Error("no document. use 'init' or 'read' first");
    return this.history;
  }
}
