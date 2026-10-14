import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";
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

  override get children(): readonly Shape[] {
    return Object.freeze([...this.#childNodes]);
  }

  override asContainer(): Group {
    return this;
  }

  override accept<R>(visitor: ShapeVisitor<R>): R {
    return visitor.visitGroup(this);
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
