export const categories = ["shapes", "commands", "decorators", "attributes"] as const;
export type Category = typeof categories[number];
export type Contributions = Readonly<Record<Category, readonly string[]>>;

export interface PluginManifest {
  readonly name: string;
  readonly contributes: Contributions;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function pluginManifest(value: unknown): PluginManifest {
  if (!isRecord(value) || typeof value["name"] !== "string" || value["name"].trim() === "") {
    throw new Error("invalid plugin manifest");
  }
  const source = Object.hasOwn(value, "contributes") ? value["contributes"] : {};
  if (!isRecord(source) || Object.keys(source).some(key => !categories.some(category => category === key))) {
    throw new Error("invalid plugin manifest");
  }
  const lists = categories.map(category => {
    const names = Object.hasOwn(source, category) ? source[category] : [];
    if (!Array.isArray(names) || names.some(name => typeof name !== "string" || name.trim() === "") || new Set(names).size !== names.length) {
      throw new Error("invalid plugin manifest");
    }
    return [category, Object.freeze([...names].sort())];
  });
  return { name: value["name"], contributes: Object.fromEntries(lists) as Contributions };
}
