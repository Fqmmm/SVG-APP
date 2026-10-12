import { XmlText } from "./XmlText.js";

// Check reference syntax before xmldom can pass through a bare ampersand.
// DOM construction and the rest of XML validation stay with the XML parser.
export class XmlReferences {
  static validate(xml: string): void {
    const referencePattern = /&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/y;
    let inMarkup = false;
    let quote: string | undefined;
    let index = 0;
    while (index < xml.length) {
      const character = xml[index]!;
      if (quote === undefined && !inMarkup) {
        if (xml.startsWith("<!--", index)) {
          index = this.afterSection(xml, index + 4, "-->");
          continue;
        }
        if (xml.startsWith("<![CDATA[", index)) {
          index = this.afterSection(xml, index + 9, "]]>");
          continue;
        }
        if (xml.startsWith("<?", index)) {
          index = this.afterSection(xml, index + 2, "?>");
          continue;
        }
      }
      if (character === "&") {
        referencePattern.lastIndex = index;
        const reference = referencePattern.exec(xml)?.[0];
        if (reference === undefined) throw new Error("invalid XML reference at offset " + index);
        this.validateCharacterReference(reference);
        index += reference.length;
        continue;
      }
      if (quote !== undefined) {
        if (character === quote) quote = undefined;
      } else if (inMarkup && (character === '"' || character === "'")) {
        quote = character;
      } else if (character === "<") {
        inMarkup = true;
      } else if (character === ">") {
        inMarkup = false;
      }
      index += 1;
    }
  }

  private static afterSection(xml: string, start: number, ending: string): number {
    const end = xml.indexOf(ending, start);
    if (end < 0) throw new Error("unterminated XML section");
    return end + ending.length;
  }

  private static validateCharacterReference(reference: string): void {
    if (!reference.startsWith("&#")) return;
    const hexadecimal = reference.startsWith("&#x");
    const code = Number.parseInt(reference.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) {
      throw new Error("invalid XML character reference");
    }
    XmlText.validate(String.fromCodePoint(code));
  }
}
