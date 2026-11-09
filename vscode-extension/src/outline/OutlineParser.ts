import type { OutlineNode } from "./OutlineNode.js";

export interface OutlineParser {
  parse(source: string): readonly OutlineNode[];
}
