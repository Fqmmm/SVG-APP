export class CommandArguments {
  static requireCount(args: readonly string[], minimum: number, maximum: number, usage: string): void {
    if (args.length < minimum || args.length > maximum) {
      throw new Error("usage: " + usage);
    }
  }
}
