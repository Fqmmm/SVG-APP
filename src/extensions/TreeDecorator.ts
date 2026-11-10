import type { DocumentSnapshot } from "./DocumentSnapshot.js";
import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export interface TreeNodeContext {
  readonly document: SvgDocument;
  readonly snapshot?: DocumentSnapshot;
  readonly shape: Shape | undefined;
}

export interface TreeDecorator {
  readonly name: string;
  // Optional lifecycle hook: only update instance-owned state; do not mutate the document.
  // The host reports thrown errors and continues notifying other observers after successful I/O.
  checkpoint?(document: SvgDocument, snapshot: DocumentSnapshot): void;
  decorate(context: TreeNodeContext): string | undefined;
}
