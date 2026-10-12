import type { SvgDocument } from "../domain/SvgDocument.js";
import type { Shape } from "../domain/Shape.js";
import type { ShapeVisitor } from "../domain/ShapeVisitor.js";
import type { Rect } from "../domain/Rect.js";
import type { Circle } from "../domain/Circle.js";
import type { Ellipse } from "../domain/Ellipse.js";
import type { Line } from "../domain/Line.js";
import type { Text } from "../domain/Text.js";
import type { Group } from "../domain/Group.js";
import { XmlText } from "./XmlText.js";

export class SvgSerializer implements ShapeVisitor<string> {
  serialize(document: SvgDocument): string {
    const width = document.width, height = document.height;
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height
      + '" viewBox="0 0 ' + width + ' ' + height + '">\n'
      + document.children.map(shape => shape.accept(this)).join("")
      + '</svg>\n';
  }

  visitRect(shape: Rect): string {
    return this.emptyElement(shape);
  }

  visitCircle(shape: Circle): string {
    return this.emptyElement(shape);
  }

  visitEllipse(shape: Ellipse): string {
    return this.emptyElement(shape);
  }

  visitLine(shape: Line): string {
    return this.emptyElement(shape);
  }

  visitText(shape: Text): string {
    return '<text' + this.attributes(shape) + '>' + XmlText.text(shape.content) + '</text>\n';
  }

  visitGroup(shape: Group): string {
    return '<g' + this.attributes(shape) + '>\n'
      + shape.children.map(child => child.accept(this)).join("") + '</g>\n';
  }

  private emptyElement(shape: Shape): string {
    return '<' + shape.type + this.attributes(shape) + '/>\n';
  }

  private attributes(shape: Shape): string {
    const values = { id: shape.id, ...shape.geometry, ...shape.styles };
    return Object.entries(values).map(([name, value]) =>
      ' ' + name + '="' + XmlText.attribute(String(value)) + '"').join("");
  }
}
