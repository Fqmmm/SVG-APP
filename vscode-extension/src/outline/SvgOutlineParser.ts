import { parse } from "@xml-tools/parser";
import type { DocumentCstNode, ElementCstNode } from "@xml-tools/parser";
import type { OutlineNode } from "./OutlineNode.js";
import type { OutlineParser } from "./OutlineParser.js";

export class SvgOutlineParser implements OutlineParser {
  parse(source: string): readonly OutlineNode[] {
    try {
      const result = parse(source);
      if (result.lexErrors.length !== 0 || result.parseErrors.length !== 0) {
        return [];
      }
      const document = result.cst as DocumentCstNode;
      const roots = document.children.element ?? [];
      if (roots.length !== 1 || roots[0]!.children.Name[0]!.image.split(":").at(-1) !== "svg") {
        return [];
      }
      return Object.freeze(roots.map(root => {
        return this.element(root);
      }));
    } catch {
      // An unfinished editor buffer has no outline until it becomes parseable again.
      return [];
    }
  }

  private element(node: ElementCstNode): OutlineNode {
    const fields = node.children;
    const name = fields.Name[0]!;
    const endName = fields.END_NAME?.[0];
    if (endName !== undefined && endName.image !== name.image) {
      throw new Error("mismatched XML closing tag");
    }
    const last = fields.SLASH_CLOSE?.[0] ?? fields.END?.[0];
    if (last === undefined || last.endOffset === undefined || name.endOffset === undefined) {
      throw new Error("incomplete XML element");
    }
    const id = fields.attribute?.find(attribute => {
      return attribute.children.Name[0]?.image === "id";
    })?.children.STRING[0]?.image;
    const content = fields.content?.[0]?.children.element ?? [];
    return Object.freeze({
      name: name.image + (id === undefined || id.length === 2 ? "" : "#" + this.decode(id.slice(1, -1))),
      span: Object.freeze({ start: fields.OPEN[0]!.startOffset, end: last.endOffset + 1 }),
      selection: Object.freeze({ start: name.startOffset, end: name.endOffset + 1 }),
      children: Object.freeze(content.map(child => {
        return this.element(child);
      })),
    });
  }

  private decode(value: string): string {
    const entities = new Map([["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"]]);
    return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/gu, (_match: string, entity: string) => {
      if (entity.startsWith("#")) {
        const hexadecimal = entity.startsWith("#x");
        return String.fromCodePoint(Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
      }
      return entities.get(entity)!;
    });
  }
}
