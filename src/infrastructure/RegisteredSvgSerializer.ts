import type { SvgDocument } from "../domain/SvgDocument.js";
import type { Shape } from "../domain/Shape.js";
import type { RegisteredShapeFactory } from "../application/RegisteredShapeFactory.js";
import { elementText } from "../extensions/ShapeText.js";
import { XmlText } from "./XmlText.js";

export class RegisteredSvgSerializer {
  constructor(private readonly factory: RegisteredShapeFactory) {
  }

  serialize(document: SvgDocument): string {
    const width = document.width, height = document.height;
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height
      + '" viewBox="0 0 ' + width + ' ' + height + '">\n'
      + document.children.map(shape => this.element(shape)).join("")
      + '</svg>\n';
  }

  private element(shape: Shape): string {
    const provider = this.factory.provider(shape.type);
    const content = elementText(provider, shape);
    const tag = provider.svg?.tag ?? shape.type;
    const opening = '<' + tag + this.attributes(shape);
    if (shape.asContainer() !== undefined) {
      return opening + '>\n' + shape.children.map(child => this.element(child)).join("") + '</' + tag + '>\n';
    }
    if (content !== undefined) {
      return opening + '>' + XmlText.text(content) + '</' + tag + '>\n';
    }
    return opening + '/>\n';
  }

  private attributes(shape: Shape): string {
    const kind = this.factory.provider(shape.type).svg?.kind;
    const values = { id: shape.id, ...shape.geometry, ...shape.styles, ...(kind === undefined ? {} : { "data-kind": kind }) };
    return Object.entries(values).map(([name, value]) => {
      return ' ' + name + '="' + XmlText.attribute(String(value)) + '"';
    }).join("");
  }
}
