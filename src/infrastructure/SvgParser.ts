import { DOMParser, onWarningStopParsing } from "@xmldom/xmldom";
import type { Element, Node } from "@xmldom/xmldom";
import { ShapeFactory } from "../application/ShapeFactory.js";
import type { DocumentReadResult } from "../application/DocumentReadResult.js";
import { AttributeValidator } from "../domain/AttributeValidator.js";
import { SvgDocument } from "../domain/SvgDocument.js";
import { XmlText } from "./XmlText.js";
import { XmlReferences } from "./XmlReferences.js";

export class SvgParser {
  private readonly factory = new ShapeFactory();
  private readonly namespace = "http://www.w3.org/2000/svg";

  parse(xml: string): DocumentReadResult {
    try {
      XmlText.validate(xml);
      XmlReferences.validate(xml);
      const dom = new DOMParser({ onError: onWarningStopParsing }).parseFromString(xml, "application/xml");
      for (let node = dom.firstChild; node !== null; node = node.nextSibling) {
        if (node.nodeType === 10) {
          throw new Error("unsupported DOCTYPE");
        }
        if (node.nodeType === 7) {
          this.processingInstruction(node);
        }
      }
      const root = dom.documentElement;
      if (root === null || root.localName !== "svg") {
        throw new Error("expected svg root");
      }
      this.validateNamespace(root);
      const attributes = this.attributes(root);
      for (const name of attributes.keys()) {
        if (!["width", "height", "viewBox"].includes(name)) {
          throw new Error("unsupported svg attribute: " + name);
        }
      }
      const box = attributes.get("viewBox")?.trim().split(/[\s,]+/u).map(value => AttributeValidator.number(value, "viewBox"));
      if (box !== undefined && (box.length !== 4 || box[0] !== 0 || box[1] !== 0)) {
        throw new Error("unsupported viewBox: expected 0 0 width height");
      }
      const width = this.length(attributes.get("width"), box?.[2] ?? 800, "width");
      const height = this.length(attributes.get("height"), box?.[3] ?? 600, "height");
      if (box !== undefined && (box[2] !== width || box[3] !== height)) {
        throw new Error("unsupported viewBox: dimensions must match canvas");
      }
      const document = new SvgDocument(width, height);
      const elements: Element[] = [];
      this.collect(root, elements);
      const used = new Set<string>();
      for (const element of elements) {
        this.validateNamespace(element);
        if (element.hasAttribute("id")) {
          const id = element.getAttribute("id")!;
          AttributeValidator.id(id);
          if (used.has(id)) {
            throw new Error("id already exists: " + id);
          }
          used.add(id);
        }
      }
      const warnings: string[] = [];
      const ids = new Map<Element, string>();
      const counters = new Map<string, number>();
      for (const element of elements) {
        let id = element.getAttribute("id");
        const type = element.localName!;
        if (id === null) {
          let index = counters.get(type) ?? 1;
          while (used.has(type + index)) index += 1;
          id = type + index;
          counters.set(type, index + 1);
          used.add(id);
          warnings.push("warning: assigned id " + id + " to unnamed <" + type + ">");
        }
        ids.set(element, id);
      }
      this.appendChildren(root, document, ids, warnings);
      return { document, warnings: Object.freeze(warnings) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error("invalid SVG: " + message);
    }
  }

  private appendChildren(
    parent: Element, document: SvgDocument, ids: ReadonlyMap<Element, string>,
    warnings: string[], parentId?: string,
  ): void {
    for (const child of this.childElements(parent)) {
      const id = ids.get(child)!;
      const attributes = this.attributes(child);
      attributes.delete("id");
      const kind = attributes.get("data-kind");
      attributes.delete("data-kind");
      const content = this.directText(child);
      const shape = this.factory.createFromAttributes(child.localName!, id, attributes, content);
      if (kind !== undefined) {
        if (shape.asContainer() === undefined || kind !== "box") {
          throw new Error("unsupported data-kind: " + kind);
        }
        warnings.push("warning: treating box " + id + " as an ordinary group");
      }
      const children = this.childElements(child);
      if (shape.asContainer() === undefined && children.length !== 0) {
        throw new Error("unsupported child element in " + child.localName);
      }
      document.add(shape, parentId);
      this.appendChildren(child, document, ids, warnings, shape.id);
    }
  }

  private collect(parent: Element, result: Element[]): void {
    for (const child of this.childElements(parent)) {
      result.push(child);
      this.collect(child, result);
    }
  }

  private childElements(parent: Element): Element[] {
    const result: Element[] = [];
    for (let node = parent.firstChild; node !== null; node = node.nextSibling) {
      if (node.nodeType === 1) {
        result.push(node as Element);
      }
      else if (node.nodeType === 7) {
        this.processingInstruction(node);
      }
      else if (![3, 4, 8].includes(node.nodeType)) {
        throw new Error("unsupported XML node");
      }
    }
    if (parent.localName === "svg" && this.directText(parent).trim() !== "") {
      throw new Error("unexpected text in svg");
    }
    return result;
  }

  private directText(parent: Element): string {
    let text = "";
    for (let node = parent.firstChild; node !== null; node = node.nextSibling) {
      if (node.nodeType === 3 || node.nodeType === 4) {
        text += node.nodeValue ?? "";
      }
    }
    XmlText.validate(text);
    return text;
  }

  private attributes(element: Element): Map<string, string> {
    const attributes = new Map<string, string>();
    for (let index = 0; index < element.attributes.length; index += 1) {
      const attribute = element.attributes.item(index)!;
      if (attribute.namespaceURI === "http://www.w3.org/2000/xmlns/") {
        continue;
      }
      if (attribute.namespaceURI !== null) {
        throw new Error("unsupported attribute namespace: " + attribute.name);
      }
      XmlText.validate(attribute.value);
      attributes.set(attribute.name, attribute.value);
    }
    return attributes;
  }

  private validateNamespace(element: Element): void {
    if (element.namespaceURI !== this.namespace) {
      throw new Error("unsupported SVG namespace: " + element.namespaceURI);
    }
  }

  private length(value: string | undefined, fallback: number, name: string): number {
    return value === undefined ? fallback : AttributeValidator.number(value.trim().replace(/px$/u, ""), name);
  }

  private processingInstruction(node: Node): void {
    if (node.nodeName !== "xml") {
      throw new Error("unsupported processing instruction: " + node.nodeName);
    }
    const encoding = /encoding\s*=\s*["']([^"']+)["']/iu.exec(node.nodeValue ?? "")?.[1];
    if (encoding !== undefined && encoding.toUpperCase() !== "UTF-8") {
      throw new Error("unsupported XML encoding: " + encoding);
    }
  }
}
