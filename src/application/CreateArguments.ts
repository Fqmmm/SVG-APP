import { AttributeValidator } from "../domain/AttributeValidator.js";

export class CreateArguments {
  constructor(
    type: string,
    private readonly values: readonly string[],
    minimum: number,
    maximum = minimum,
  ) {
    // Required text may be "in"; an additional trailing "in" starts an incomplete suffix.
    if (values.at(-1) === "in" && values.length > minimum) {
      throw new Error("missing container id after in");
    }
    if (values.length < minimum || values.length > maximum) {
      throw new Error("invalid argument count for " + type + ": expected "
        + minimum + (minimum === maximum ? "" : ".." + maximum) + ", got " + values.length);
    }
  }

  number(index: number, name: string): number {
    return AttributeValidator.number(this.values[index]!, name);
  }

  text(index: number): string {
    return this.values[index]!;
  }

  optional(index: number): string | undefined {
    return this.values[index];
  }
}
