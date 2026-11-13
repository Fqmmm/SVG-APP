import { Group, Rect, Text } from "../../extensions/index.js";
import type { Shape } from "../../extensions/index.js";
import { BoxId } from "./BoxId.js";

export class Box extends Group {
  override get type(): string {
    return "box";
  }

  override get canUngroup(): boolean {
    return false;
  }

  get frame(): Rect {
    return this.children.find(child => child.id === new BoxId(this.id).frame) as Rect;
  }

  get label(): Text {
    return this.children.find(child => child.id === new BoxId(this.id).label) as Text;
  }

  override validateChildren(children: readonly Shape[]): void {
    const ids = new BoxId(this.id);
    const frame = children.find(child => child.id === ids.frame);
    const label = children.find(child => child.id === ids.label);
    if (!(frame instanceof Rect) || !(label instanceof Text)) {
      throw new Error("missing or invalid required box component: " + this.id);
    }
  }

  override assertUngroupable(): void {
    throw new Error("cannot ungroup composite shape: " + this.id);
  }

  setFill(value: string | number): void {
    this.frame.set("fill", value);
  }

  setLabel(value: string | number): void {
    this.label.set("text", value);
  }
}
