import type { FileProbe } from "./FileProbe.js";

export class SvgFileBadge {
  constructor(private readonly files: FileProbe) {
  }

  async forPath(path: string): Promise<string | undefined> {
    if (!path.toLowerCase().endsWith(".svg")) {
      return undefined;
    }
    try {
      return await this.files.isFile(path) ? "[]" : undefined;
    } catch {
      return undefined;
    }
  }
}
