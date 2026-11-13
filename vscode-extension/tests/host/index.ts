import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import * as vscode from "vscode";
import { SvgFileBadge } from "../../src/decoration/SvgFileBadge.js";
import { SvgOutlineParser } from "../../src/outline/SvgOutlineParser.js";
import { SvgDocumentSymbolProvider } from "../../src/vscode/SvgDocumentSymbolProvider.js";
import { SvgFileDecorationProvider } from "../../src/vscode/SvgFileDecorationProvider.js";
import { VsCodeFileProbe } from "../../src/vscode/VsCodeFileProbe.js";

export async function run(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "svg-tools-fixture-"));
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const tokenSource = new vscode.CancellationTokenSource();
  const decorations = new SvgFileDecorationProvider(new SvgFileBadge(new VsCodeFileProbe()));
  const symbols = new SvgDocumentSymbolProvider(new SvgOutlineParser());
  const file = join(directory, "sample.svg");
  const source = '<svg xmlns="http://www.w3.org/2000/svg">\r\n<!-- \u4e2d\u6587\ud83d\ude00 -->\r\n<g id="flow"><rect id="start"/><text>Start</text></g>\r\n</svg>';
  writeFileSync(file, source, "utf8");
  writeFileSync(join(directory, "notes.txt"), "ordinary text", "utf8");
  mkdirSync(join(directory, "folder.svg"));
  const uri = vscode.Uri.file(file);
  const document = await vscode.workspace.openTextDocument(uri);
  const outline = async (): Promise<vscode.DocumentSymbol[]> => {
    return await vscode.commands.executeCommand<vscode.DocumentSymbol[]>("vscode.executeDocumentSymbolProvider", uri) ?? [];
  };
  const replace = async (text: string): Promise<void> => {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
    assert.equal(await vscode.workspace.applyEdit(edit), true);
  };
  const checks: readonly [string, () => Promise<void>][] = [
    ["extension activates and registers its native document-symbol provider", async () => {
      const extension = vscode.extensions.getExtension("svg-app-lab.svg-app-tools");
      assert.ok(extension);
      await extension.activate();
      assert.equal(extension.isActive, true);
      const tree = await outline();
      assert.equal(tree[0]?.name, "svg");
      assert.deepEqual(tree[0]?.children[0]?.children.map(child => child.name), ["rect#start", "text"]);
    }],
    ["real file decorations distinguish SVG files, text files and SVG-named directories without changing bytes", async () => {
      const before = readFileSync(file);
      const result = await decorations.provideFileDecoration(uri, tokenSource.token);
      assert.equal(result?.badge, "[]");
      assert.equal(result?.propagate, false);
      for (const path of [join(directory, "notes.txt"), join(directory, "folder.svg"), join(directory, "missing.svg")]) {
        assert.equal(await decorations.provideFileDecoration(vscode.Uri.file(path), tokenSource.token), undefined);
      }
      assert.deepEqual(readFileSync(file), before);
    }],
    ["symbol ranges select the original tag with exact UTF-16 line and character positions", async () => {
      const rect = (await outline())[0]!.children[0]!.children[0]!;
      assert.equal(document.getText(rect.selectionRange), "rect");
      assert.equal(document.getText(rect.range), '<rect id="start"/>');
      assert.ok(rect.range.contains(rect.selectionRange));
      assert.equal(rect.selectionRange.start.line, 2);
      assert.equal(rect.selectionRange.start.character, '<g id="flow"><'.length);
    }],
    ["symbol navigation opens the text editor at the third source line", async () => {
      const associations = vscode.workspace.getConfiguration("workbench").get<Record<string, string>>("editorAssociations");
      assert.equal(associations?.["*.svg"], "default");
      const rect = (await outline())[0]!.children[0]!.children[0]!;
      await vscode.commands.executeCommand("vscode.open", uri, { selection: rect.selectionRange, preview: false });
      const editor = vscode.window.activeTextEditor;
      assert.equal(editor?.document.uri.toString(), uri.toString());
      assert.equal(editor?.selection.start.line, 2);
      assert.equal(editor?.document.getText(editor.selection), "rect");
    }],
    ["unsaved edits update the registered outline and do not change the saved source", async () => {
      await replace(source.replace('id="start"', 'id="edited"'));
      assert.equal((await outline())[0]?.children[0]?.children[0]?.name, "rect#edited");
      assert.equal(document.isDirty, true);
      assert.equal(readFileSync(file, "utf8"), source);
    }],
    ["incomplete XML clears the registered outline and a valid edit recovers", async () => {
      await replace("<svg><g>");
      assert.deepEqual(await outline(), []);
      await replace(source);
      assert.equal((await outline())[0]?.children[0]?.name, "g#flow");
    }],
    ["cancellation and unsupported URI schemes return no symbols or decorations", async () => {
      const cancelled = new vscode.CancellationTokenSource();
      cancelled.cancel();
      assert.deepEqual(symbols.provideDocumentSymbols(document, cancelled.token), []);
      assert.equal(await decorations.provideFileDecoration(uri, cancelled.token), undefined);
      assert.equal(await decorations.provideFileDecoration(vscode.Uri.parse("untitled:example.svg"), tokenSource.token), undefined);
      cancelled.dispose();
    }],
    ["file-change notifications identify only the requested resource", async () => {
      const changed: vscode.Uri[] = [];
      const subscription = decorations.onDidChangeFileDecorations(value => {
        changed.push(value);
      });
      decorations.refresh(uri);
      assert.deepEqual(changed.map(value => value.toString()), [uri.toString()]);
      subscription.dispose();
    }],
  ];
  try {
    for (const [name, check] of checks) {
      try {
        await check();
        results.push({ name, passed: true });
        console.log("PASS: " + name);
      } catch (error) {
        results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) });
        console.error("FAIL: " + name, error);
      }
    }
    const report = process.env["SVG_APP_TEST_REPORT"];
    if (report !== undefined) {
      writeFileSync(report, JSON.stringify({ vscode: vscode.version, node: process.version, results }, null, 2) + "\n", "utf8");
    }
    assert.equal(results.filter(result => !result.passed).length, 0, "extension-host checks failed");
  } finally {
    decorations.dispose();
    tokenSource.dispose();
    await replace(source);
    await document.save();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    const resolved = resolve(directory);
    assert.ok(resolved.startsWith(resolve(tmpdir()) + sep));
    rmSync(resolved, { recursive: true, force: true });
  }
}
