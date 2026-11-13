import { Shape } from "./Shape.js";
import { TreeValidator } from "./TreeValidator.js";
import { acquireTreeAccess } from "./TreeAccess.js";
import { GroupTreeAccess } from "./GroupTreeAccess.js";

export class Group extends Shape {
  #childNodes: Shape[];
  #accessClaim: symbol | undefined;

  constructor(id: string, children: readonly Shape[] = []) {
    super(id);
    this.#childNodes = [...children];
    TreeValidator.nodes(this);
  }

  override get type(): string {
    return "g";
  }

  override get geometry(): Readonly<Record<string, number>> {
    return Object.freeze({});
  }

  get canUngroup(): boolean {
    return true;
  }

  // Overrides must be pure and depend only on the supplied children and the shape ID.
  // Validation also runs during base construction and before document mutations.
  validateChildren(_children: readonly Shape[]): void {
  }

  assertUngroupable(): void {
    if (!this.canUngroup) {
      throw new Error("cannot ungroup " + this.type + ": " + this.id);
    }
  }

  override get children(): readonly Shape[] {
    return Object.freeze([...this.#childNodes]);
  }

  override asContainer(): Group {
    return this;
  }

  // Only one owner can hold structural access; importing the symbol cannot steal it.
  [acquireTreeAccess](): GroupTreeAccess {
    if (this.#accessClaim !== undefined) {
      throw new Error("group tree access already claimed: " + this.id);
    }
    const claim = Symbol();
    this.#accessClaim = claim;
    const checkClaim = (): void => {
      if (this.#accessClaim !== claim) {
        throw new Error("tree access revoked: " + this.id);
      }
    };
    const access = new GroupTreeAccess(
      children => {
        checkClaim();
        this.#childNodes = [...children];
      },
      () => {
        checkClaim();
        this.#accessClaim = undefined;
      },
    );
    Object.freeze(access);
    return access;
  }

  protected override moveGeometry(dx: number, dy: number): void {
    for (const child of this.#childNodes) child.move(dx, dy);
  }

  protected override scaleGeometry(factor: number): void {
    for (const child of this.#childNodes) child.scale(factor);
  }

  protected override setOwnAttribute(attribute: string, _value: string | number): void {
    throw new Error("unknown attribute: " + attribute);
  }

  protected override captureOwnState(): () => void {
    const states = this.#childNodes.map(child => child.captureState());
    return () => {
      for (const state of states) state.restore();
    };
  }
}
