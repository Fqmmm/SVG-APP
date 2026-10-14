// Captures attributes and geometry, not document membership or child ordering.
export class ShapeState {
  constructor(private readonly restoreAction: () => void) {
    Object.freeze(this);
  }

  restore(): void {
    this.restoreAction();
  }
}
