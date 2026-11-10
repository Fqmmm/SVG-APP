export class BoxId {
  constructor(private readonly value: string) {
  }

  get frame(): string {
    return this.value + "-rect";
  }

  get label(): string {
    return this.value + "-label";
  }
}
