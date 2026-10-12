export class XmlText {
  static validate(value: string): void {
    for (const character of value) {
      const code = character.codePointAt(0)!;
      if (code !== 9 && code !== 10 && code !== 13
        && !(code >= 0x20 && code <= 0xd7ff)
        && !(code >= 0xe000 && code <= 0xfffd)
        && !(code >= 0x10000 && code <= 0x10ffff)) {
        throw new Error("invalid XML character: U+" + code.toString(16).toUpperCase());
      }
    }
  }

  static text(value: string): string {
    this.validate(value);
    return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;")
      .replace(/>/gu, "&gt;").replace(/\r/gu, "&#13;");
  }

  static attribute(value: string): string {
    return this.text(value).replace(/"/gu, "&quot;").replace(/\t/gu, "&#9;").replace(/\n/gu, "&#10;");
  }
}
