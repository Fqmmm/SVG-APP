import { FileType, Uri, workspace } from "vscode";
import type { FileProbe } from "../decoration/FileProbe.js";

export class VsCodeFileProbe implements FileProbe {
  async isFile(path: string): Promise<boolean> {
    const stat = await workspace.fs.stat(Uri.file(path));
    return (stat.type & FileType.File) !== 0;
  }
}
