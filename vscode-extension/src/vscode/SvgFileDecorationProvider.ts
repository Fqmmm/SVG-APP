import { EventEmitter, FileDecoration } from "vscode";
import type { CancellationToken, FileDecorationProvider, Uri } from "vscode";
import type { SvgFileBadge } from "../decoration/SvgFileBadge.js";

export class SvgFileDecorationProvider implements FileDecorationProvider {
  private readonly changes = new EventEmitter<Uri>();
  readonly onDidChangeFileDecorations = this.changes.event;

  constructor(private readonly badges: SvgFileBadge) {
  }

  async provideFileDecoration(uri: Uri, token: CancellationToken): Promise<FileDecoration | undefined> {
    if (uri.scheme !== "file" || token.isCancellationRequested) {
      return undefined;
    }
    const badge = await this.badges.forPath(uri.fsPath);
    if (badge === undefined || token.isCancellationRequested) {
      return undefined;
    }
    const decoration = new FileDecoration(badge, "SVG file");
    decoration.propagate = false;
    return decoration;
  }

  refresh(uri: Uri): void {
    this.changes.fire(uri);
  }

  dispose(): void {
    this.changes.dispose();
  }
}
