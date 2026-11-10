export class ExtensionRegistry<T extends { readonly name: string }> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly category: string) {
  }

  register(extension: T): void {
    if (extension.name.trim() === "") {
      throw new Error("invalid registration name: " + this.category);
    }
    if (this.entries.has(extension.name)) {
      throw new Error("duplicate registration: " + this.category + "/" + extension.name);
    }
    this.entries.set(extension.name, extension);
  }

  get(name: string): T {
    const entry = this.entries.get(name);
    if (entry === undefined) {
      throw new Error("unknown " + this.category + ": " + name);
    }
    return entry;
  }

  find(name: string): T | undefined {
    return this.entries.get(name);
  }

  all(): readonly T[] {
    return Object.freeze([...this.entries.values()]);
  }
}
