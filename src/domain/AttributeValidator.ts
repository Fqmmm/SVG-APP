export class AttributeValidator {
  static id(value: string): void {
    if (typeof value !== "string" || value === "" || /\s/u.test(value)) {
      throw new Error("invalid id: " + value);
    }
  }

  static finite(value: number, attribute: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("invalid number: " + attribute);
    }
    return value;
  }

  static number(value: string | number, attribute: string): number {
    if (typeof value === "string") {
      const text = value.trim();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text)) {
        throw new Error("invalid number: " + attribute);
      }
      return this.finite(Number(text), attribute);
    }
    return this.finite(value, attribute);
  }

  static text(value: string | number, attribute: string): string {
    if (typeof value !== "string") {
      throw new Error(attribute + " must be text");
    }
    return value;
  }

  static geometry(values: Readonly<Record<string, number>>, dimensions: readonly string[]): void {
    for (const [attribute, value] of Object.entries(values)) {
      this.finite(value, attribute);
      if (dimensions.includes(attribute) && value < 0) {
        throw new Error(attribute + " must be non-negative");
      }
    }
  }

  static updatedGeometry<T extends Record<string, number>>(
    current: T,
    attribute: string,
    value: string | number,
    dimensions: readonly string[],
  ): T {
    if (!Object.hasOwn(current, attribute)) {
      throw new Error("unknown attribute: " + attribute);
    }
    const next = { ...current, [attribute]: this.number(value, attribute) };
    this.geometry(next, dimensions);
    return next;
  }
}
