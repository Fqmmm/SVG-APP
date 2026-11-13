import type { TreeDecorator, TreeNodeContext, SvgDocument, DocumentSnapshot } from "../../extensions/index.js";

export class ModifiedStarDecorator implements TreeDecorator {
  readonly name = "modified-star";
  private readonly saved = new WeakMap<SvgDocument, DocumentSnapshot>();

  checkpoint(document: SvgDocument, snapshot: DocumentSnapshot): void {
    this.saved.set(document, snapshot);
  }

  decorate(context: TreeNodeContext): string | undefined {
    const baseline = this.saved.get(context.document);
    if (baseline === undefined) {
      return "*";
    }
    if (context.snapshot === undefined) {
      throw new Error("modified-star requires document snapshots");
    }
    return context.snapshot.same(baseline, context.shape?.id) ? undefined : "*";
  }
}
