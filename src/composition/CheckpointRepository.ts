import type { DocumentRepository } from "../application/DocumentRepository.js";
import type { DocumentReadResult } from "../application/DocumentReadResult.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import type { ShapeViews } from "../extensions/ShapeViews.js";
import type { TreeDecorator } from "../extensions/TreeDecorator.js";
import type { ExtensionRegistry } from "../extensions/ExtensionRegistry.js";
import type { DocumentSnapshot } from "../extensions/DocumentSnapshot.js";

export class CheckpointRepository implements DocumentRepository {
  constructor(
    private readonly source: DocumentRepository,
    private readonly views: ShapeViews,
    private readonly decorators: ExtensionRegistry<TreeDecorator>,
    private readonly report: (message: string) => void = console.error,
  ) {
  }

  read(path: string): DocumentReadResult {
    const result = this.source.read(path);
    const observers = this.listeners();
    const snapshot = observers.length === 0 ? undefined : this.views.snapshot(result.document);
    this.publish(result.document, snapshot, observers);
    return result;
  }

  write(path: string, document: SvgDocument): void {
    const observers = this.listeners();
    const snapshot = observers.length === 0 ? undefined : this.views.snapshot(document);
    this.source.write(path, document);
    this.publish(document, snapshot, observers);
  }

  private listeners(): readonly TreeDecorator[] {
    return this.decorators.all().filter(decorator => {
      return decorator.checkpoint !== undefined;
    });
  }

  private publish(document: SvgDocument, snapshot: DocumentSnapshot | undefined, observers: readonly TreeDecorator[]): void {
    if (snapshot === undefined) {
      return;
    }
    for (const decorator of observers) {
      try {
        decorator.checkpoint?.(document, snapshot);
      } catch {
        this.reportFailure(decorator.name);
      }
    }
  }

  private reportFailure(name: string): void {
    try {
      this.report("error: checkpoint failed: " + name);
    } catch {
      // Neither an observer nor its diagnostic sink may invalidate completed I/O.
    }
  }
}
