import * as vscode from 'vscode';
import { SaxesParser } from 'saxes';

interface SymbolNode {
    symbol: vscode.DocumentSymbol;
    children: SymbolNode[];
    openTagEnd?: vscode.Position;
}

/**
 * Provides document symbols (Outline view) for FXML files.
 *
 * Parses the FXML document using a SAX stream parser (`saxes`) and builds a
 * hierarchical tree of `vscode.DocumentSymbol` objects. Each XML element
 * becomes a symbol whose name is the tag name (with an `fx:id` detail when
 * present).
 */
export class FxmlDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        const text = document.getText();
        const parser = new SaxesParser({ xmlns: false, position: true });

        const roots: SymbolNode[] = [];
        const stack: SymbolNode[] = [];

        parser.on("opentag", (tag) => {
            // saxes positions are 1-based; VS Code positions are 0-based.
            const line = parser.line - 1;
            const column = parser.column - 1;

            // The parser position points just past the '>' of the open tag.
            // Walk backwards to find the '<' that starts this tag so we can
            // build an accurate selectionRange for the open tag.
            const tagStartPos = this.findTagStart(document, line, column);

            const name = typeof tag === 'string' ? tag : tag.name;
            const fxId = (typeof tag !== 'string' && tag.attributes['fx:id']) ?
                String(tag.attributes['fx:id']) : undefined;

            const displayName = fxId ? `${name}#${fxId}` : name;
            const detail = fxId ? `fx:id="${fxId}"` : '';

            // Temporary range – the end will be updated when we see the
            // corresponding close tag.
            const startPos = tagStartPos;
            const selectionRange = new vscode.Range(startPos, new vscode.Position(line, column));
            const range = new vscode.Range(startPos, new vscode.Position(line, column));

            const symbol = new vscode.DocumentSymbol(
                displayName,
                detail,
                vscode.SymbolKind.Object,
                range,
                selectionRange
            );

            const node: SymbolNode = {
                symbol,
                children: [],
                openTagEnd: new vscode.Position(line, column),
            };

            if (stack.length > 0) {
                stack[stack.length - 1].children.push(node);
            } else {
                roots.push(node);
            }

            stack.push(node);
        });

        parser.on("closetag", () => {
            const line = parser.line - 1;
            const column = parser.column - 1;

            if (stack.length === 0) {
                return;
            }

            const node = stack.pop()!;

            // Update the full range to span from the open-tag start through
            // the close-tag end.
            const endPos = new vscode.Position(line, column);
            node.symbol.range = new vscode.Range(node.symbol.range.start, endPos);

            // Attach children
            node.symbol.children = node.children.map(c => c.symbol);
        });

        // Ignore errors in malformed documents – we still return whatever
        // symbols we managed to parse.
        parser.on("error", () => {
            // no-op
        });

        parser.write(text).close();

        return roots.map(r => r.symbol);
    }

    /**
     * Walk backwards from the parser's current position to locate the '<'
     * character that opens the current tag.
     */
    private findTagStart(
        document: vscode.TextDocument,
        line: number,
        column: number
    ): vscode.Position {
        let l = line;
        const c = column;

        while (l >= 0) {
            const lineText = document.lineAt(l).text;
            const start = l === line ? Math.min(c, lineText.length - 1) : lineText.length - 1;

            for (let i = start; i >= 0; i--) {
                if (lineText[i] === '<') {
                    return new vscode.Position(l, i);
                }
            }
            l--;
        }

        // Fallback – should not happen in well-formed XML.
        return new vscode.Position(line, column);
    }
}
