import type { Shape } from "./Shape.js";

export class GroupTreeAccess {
  readonly #replaceAction: (children: readonly Shape[]) => void;
  readonly #releaseAction: () => void;

  constructor(
    replaceAction: (children: readonly Shape[]) => void,
    releaseAction: () => void,
  ) {
    this.#replaceAction = replaceAction;
    this.#releaseAction = releaseAction;
  }

  replaceChildren(children: readonly Shape[]): void {
    this.#replaceAction(children);
  }

  release(): void {
    this.#releaseAction();
  }
}
