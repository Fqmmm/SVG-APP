import { DocumentSymbol, Range, SymbolKind } from "vscode";
import type { CancellationToken, DocumentSymbolProvider, TextDocument } from "vscode";
import type { OutlineNode } from "../outline/OutlineNode.js";
import type { OutlineParser } from "../outline/OutlineParser.js";

export class SvgDocumentSymbolProvider implements DocumentSymbolProvider {
  constructor(private readonly parser: OutlineParser) {
  }

  provideDocumentSymbols(document: TextDocument, token: CancellationToken): DocumentSymbol[] {
    if (token.isCancellationRequested) {
      return [];
    }
    const nodes = this.parser.parse(document.getText());
    if (token.isCancellationRequested) {
      return [];
    }
    return nodes.map(node => {
      return this.symbol(document, node);
    });
  }

  private symbol(document: TextDocument, node: OutlineNode): DocumentSymbol {
    const range = new Range(document.positionAt(node.span.start), document.positionAt(node.span.end));
    const selection = new Range(document.positionAt(node.selection.start), document.positionAt(node.selection.end));
    const symbol = new DocumentSymbol(node.name, "", SymbolKind.Object, range, selection);
    symbol.children = node.children.map(child => {
      return this.symbol(document, child);
    });
    return symbol;
  }
}
