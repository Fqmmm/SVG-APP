import { ShapeDefinition, Rect, Text, Group } from "../../extensions/index.js";
import type { Shape, ShapeProvider, ShapePresentation, ShapeEditFeedback, SvgShapeInput, SvgElementInput } from "../../extensions/index.js";
import { Box } from "./Box.js";
import { BoxId } from "./BoxId.js";

export class BoxProvider implements ShapeProvider {
  readonly name = "box";
  readonly help = '  box <id> <x> <y> <w> <h> "title"';
  readonly svg = { tag: "g", kind: "box", text: "children" } as const;
  readonly definition = new ShapeDefinition({ geometry: ["x", "y", "width", "height"], hasText: true }, (id, input) => {
    const { x, y, width, height } = input.geometry;
    const ids = new BoxId(id);
    return new Box(id, [
      new Rect(ids.frame, x!, y!, width!, height!, "#4a90d9"),
      new Text(ids.label, x! + 20, y! + height! / 2 + 5, input.content!),
    ]);
  });

  validateSvg(input: SvgElementInput): readonly string[] {
    if (input.content.trim() !== "") {
      throw new Error("unexpected text in shape: " + input.id);
    }
    const group = new Group(input.id);
    for (const [attribute, value] of input.attributes) {
      group.set(attribute, value);
    }
    return [];
  }

  fromSvg(input: SvgShapeInput): Box {
    this.validateSvg(input);
    const box = new Box(input.id, input.children);
    for (const [attribute, value] of input.attributes) {
      box.set(attribute, value);
    }
    return box;
  }

  present(shape: Shape): ShapePresentation {
    const box = this.requireBox(shape);
    const fill = box.frame.styles["fill"];
    return { treeLabel: "g#" + box.id, summary: "", attributes: {
      ...(fill === undefined ? {} : { fill }), label: box.label.content,
    } };
  }

  describeEdit(change: ShapeEditFeedback): string | undefined {
    const box = this.requireBox(change.shape);
    if (change.operation === "create" && change.phase === "applied") {
      return "box#" + box.id + " created (g#" + box.id + " + rect#" + box.frame.id + " + text#" + box.label.id + ")";
    }
    if (change.operation === "set" && change.attribute === "fill") {
      return "box#" + box.id + (change.phase === "undone" ? " fill restored to " : " fill propagated to ") + box.frame.id;
    }
    if (change.operation === "set" && change.attribute === "label") {
      return "box#" + box.id + " label " + (change.phase === "undone" ? "restored: " : "updated: ") + JSON.stringify(box.label.content);
    }
    return undefined;
  }

  private requireBox(shape: Shape): Box {
    if (!(shape instanceof Box)) {
      throw new Error("invalid box shape: " + shape.id);
    }
    return shape;
  }
}
