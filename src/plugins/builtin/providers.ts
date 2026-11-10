import { ShapeDefinition, Group } from "../../extensions/index.js";
import type { Shape, ShapeProvider, ShapePresentation, SvgElementInput, SvgShapeInput } from "../../extensions/index.js";
import { Rect } from "./shapes/Rect.js";
import { Circle } from "./shapes/Circle.js";
import { Ellipse } from "./shapes/Ellipse.js";
import { Line } from "./shapes/Line.js";
import { Text } from "./shapes/Text.js";

abstract class BuiltinProvider implements ShapeProvider {
  abstract readonly name: string;
  abstract readonly definition: ShapeDefinition;
  abstract readonly help: string;

  validateSvg(input: SvgElementInput): readonly string[] {
    const kind = input.metadata.get("data-kind");
    if (kind !== undefined) {
      throw new Error("unsupported data-kind: " + kind);
    }
    return [];
  }
}

export class RectProvider extends BuiltinProvider {
  readonly name = "rect";
  readonly help = "  rect <id> <x> <y> <w> <h> [fill]";
  readonly definition = new ShapeDefinition({ geometry: ["x", "y", "width", "height"], style: "fill" }, (id, input) => {
    const { x, y, width, height } = input.geometry;
    return new Rect(id, x!, y!, width!, height!);
  });

  present(shape: Shape): ShapePresentation {
    const { x, y, width, height } = shape.geometry;
    return { summary: "x=" + x + " y=" + y + " w=" + width + " h=" + height, position: "(" + x + "," + y + ")" };
  }
}

export class CircleProvider extends BuiltinProvider {
  readonly name = "circle";
  readonly help = "  circle <id> <cx> <cy> <r> [fill]";
  readonly definition = new ShapeDefinition({ geometry: ["cx", "cy", "r"], style: "fill" }, (id, input) => {
    const { cx, cy, r } = input.geometry;
    return new Circle(id, cx!, cy!, r!);
  });

  present(shape: Shape): ShapePresentation {
    const { cx, cy, r } = shape.geometry;
    return { summary: "cx=" + cx + " cy=" + cy + " r=" + r, position: "(" + cx + "," + cy + ")" };
  }
}

export class EllipseProvider extends BuiltinProvider {
  readonly name = "ellipse";
  readonly help = "  ellipse <id> <cx> <cy> <rx> <ry> [fill]";
  readonly definition = new ShapeDefinition({ geometry: ["cx", "cy", "rx", "ry"], style: "fill",
    missingGeometry: new Map([["rx", "ry"], ["ry", "rx"]]) }, (id, input) => {
    const { cx, cy, rx, ry } = input.geometry;
    return new Ellipse(id, cx!, cy!, rx!, ry!);
  });

  present(shape: Shape): ShapePresentation {
    const { cx, cy, rx, ry } = shape.geometry;
    return { summary: "cx=" + cx + " cy=" + cy + " rx=" + rx + " ry=" + ry, position: "(" + cx + "," + cy + ")" };
  }
}

export class LineProvider extends BuiltinProvider {
  readonly name = "line";
  readonly help = "  line <id> <x1> <y1> <x2> <y2> [stroke]";
  readonly definition = new ShapeDefinition({ geometry: ["x1", "y1", "x2", "y2"], style: "stroke" }, (id, input) => {
    const { x1, y1, x2, y2 } = input.geometry;
    return new Line(id, x1!, y1!, x2!, y2!);
  });

  present(shape: Shape): ShapePresentation {
    const { x1, y1, x2, y2 } = shape.geometry;
    const position = "(" + x1 + "," + y1 + ") -> (" + x2 + "," + y2 + ")";
    return { summary: position, position };
  }
}

export class TextProvider extends BuiltinProvider {
  readonly name = "text";
  readonly help = '  text <id> <x> <y> "content"';
  readonly definition = new ShapeDefinition({ geometry: ["x", "y"], hasText: true }, (id, input) => {
    return new Text(id, input.geometry["x"]!, input.geometry["y"]!, input.content!);
  });

  text(shape: Shape): string {
    if (!(shape instanceof Text)) {
      throw new Error("invalid text shape: " + shape.id);
    }
    return shape.content;
  }

  present(shape: Shape): ShapePresentation {
    const { x, y } = shape.geometry;
    const position = "(" + x + "," + y + ")";
    const content = this.text(shape);
    return { summary: position + " " + JSON.stringify(content), position, attributes: { text: content } };
  }
}

export class GroupProvider extends BuiltinProvider {
  readonly name = "g";
  readonly help = "  g <id>";
  readonly definition = new ShapeDefinition({ geometry: [] }, id => {
    return new Group(id);
  });

  present(_shape: Shape): ShapePresentation {
    return { summary: "" };
  }

  fromSvg(input: SvgShapeInput): Group {
    if (input.content.trim() !== "") {
      throw new Error("unexpected text in shape: " + input.id);
    }
    const group = new Group(input.id, input.children);
    for (const [attribute, value] of input.attributes) {
      group.set(attribute, value);
    }
    return group;
  }

  override validateSvg(input: SvgElementInput): readonly string[] {
    this.fromSvg({ ...input, children: [] });
    const kind = input.metadata.get("data-kind");
    if (kind === "box") {
      return ["warning: treating box " + input.id + " as an ordinary group"];
    }
    return super.validateSvg(input);
  }
}
