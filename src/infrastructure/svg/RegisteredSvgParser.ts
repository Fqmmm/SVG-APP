import { DOMParser, onWarningStopParsing } from "@xmldom/xmldom";
import type { Element, Node } from "@xmldom/xmldom";
import type { Shape } from "../../domain/Shape.js";
import { SvgInputValidator } from "./SvgInputValidator.js";
import { SvgShapeReader } from "./SvgShapeReader.js";
import type { RegisteredShapeFactory } from "../../application/shapes/RegisteredShapeFactory.js";
import type { DocumentReadResult } from "../../application/documents/DocumentReadResult.js";
import { AttributeValidator } from "../../domain/AttributeValidator.js";
import { SvgDocument } from "../../domain/SvgDocument.js";
import { XmlText } from "../xml/XmlText.js";
import { XmlReferences } from "../xml/XmlReferences.js";

export class RegisteredSvgParser {
  private readonly shapes: SvgShapeReader;
  private readonly inputs = new SvgInputValidator();
  private readonly namespace = "http://www.w3.org/2000/svg";

  constructor(private readonly factory: RegisteredShapeFactory) {
    this.shapes = new SvgShapeReader(factory);
  }

  parse(xml: string): DocumentReadResult {
    try {
      const root = this.parseRoot(xml);
      const document = this.createDocument(root);
      const warnings: string[] = [];
      const ids = this.assignIds(root, warnings);
      for (const child of this.childElements(root)) {
        document.add(this.readShape(child, ids, warnings));
      }
      return { document, warnings: Object.freeze(warnings) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error("invalid SVG: " + message);
    }
  }

  private parseRoot(xml: string): Element {
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
    return root;
  }

  private createDocument(root: Element): SvgDocument {
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
    return new SvgDocument(width, height);
  }

  private assignIds(root: Element, warnings: string[]): ReadonlyMap<Element, string> {
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
    const ids = new Map<Element, string>();
    const counters = new Map<string, number>();
    for (const element of elements) {
      let id = element.getAttribute("id");
      const type = element.localName!;
      if (id === null) {
        let index = counters.get(type) ?? 1;
        while (used.has(type + index)) {
          index += 1;
        }
        id = type + index;
        counters.set(type, index + 1);
        used.add(id);
        warnings.push("warning: assigned id " + id + " to unnamed <" + type + ">");
      }
      ids.set(element, id);
    }
    return ids;
  }

  private readShape(element: Element, ids: ReadonlyMap<Element, string>, warnings: string[]): Shape {
    const id = ids.get(element)!;
    const attributes = this.attributes(element);
    attributes.delete("id");
    const metadata = new Map<string, string>();
    if (attributes.has("data-kind")) {
      metadata.set("data-kind", attributes.get("data-kind")!);
      attributes.delete("data-kind");
    }
    const provider = this.factory.forSvg(element.localName!, metadata.get("data-kind"));
    const content = this.directText(element);
    const input = { id, attributes, metadata, content };
    const initial = provider.fromSvg === undefined ? this.shapes.read(provider.name, id, attributes, content) : undefined;
    const parentWarnings = provider.validateSvg?.(input) ?? [];
    this.inputs.parent(provider, input, parentWarnings);
    const childWarnings: string[] = [];
    const elements = this.childElements(element);
    if (initial !== undefined && initial.asContainer() === undefined && elements.length > 0) {
      throw new Error("unsupported child element in " + element.localName);
    }
    const children = elements.map(child => this.readShape(child, ids, childWarnings));
    const shape = this.factory.validate(provider.name, id,
      provider.fromSvg === undefined ? initial! : provider.fromSvg({ ...input, children }));
    if (shape.asContainer() === undefined && children.length > 0) {
      throw new Error("unsupported child element in " + element.localName);
    }
    if (shape.children.length !== children.length || children.some((child, index) => child !== shape.children[index])) {
      throw new Error("invalid shape provider children: " + provider.name);
    }
    this.inputs.result(provider, shape, input);
    warnings.push(...parentWarnings, ...childWarnings);
    return shape;
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
