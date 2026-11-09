import { languages, window, workspace } from "vscode";
import type { ExtensionContext } from "vscode";
import { SvgFileBadge } from "./decoration/SvgFileBadge.js";
import { SvgOutlineParser } from "./outline/SvgOutlineParser.js";
import { SvgDocumentSymbolProvider } from "./vscode/SvgDocumentSymbolProvider.js";
import { SvgFileDecorationProvider } from "./vscode/SvgFileDecorationProvider.js";
import { VsCodeFileProbe } from "./vscode/VsCodeFileProbe.js";

export function activate(context: ExtensionContext): void {
  const decorations = new SvgFileDecorationProvider(new SvgFileBadge(new VsCodeFileProbe()));
  const symbols = new SvgDocumentSymbolProvider(new SvgOutlineParser());
  const watcher = workspace.createFileSystemWatcher("**/*.{svg,SVG}");
  context.subscriptions.push(
    decorations,
    watcher,
    watcher.onDidCreate(uri => {
      decorations.refresh(uri);
    }),
    watcher.onDidDelete(uri => {
      decorations.refresh(uri);
    }),
    window.registerFileDecorationProvider(decorations),
    languages.registerDocumentSymbolProvider({ scheme: "file", pattern: "**/*.{svg,SVG}" }, symbols),
  );
}
