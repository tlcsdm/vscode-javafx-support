import * as vscode from 'vscode';
import { SaxesParser } from 'saxes';

const BUILTIN_LAYOUT_TAGS = new Set([
    'anchorpane',
    'borderpane',
    'flowpane',
    'gridpane',
    'hbox',
    'pane',
    'stackpane',
    'tilepane',
    'vbox',
]);

const NAMESPACE_TAGS = new Set([
    'fx:define',
    'fx:include',
]);

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
 * becomes a symbol whose name is the tag name with optional `fx:id` and
 * `text` attribute details controlled by configuration settings.
 */
export class FxmlDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        const text = document.getText();
        const parser = new SaxesParser({ xmlns: false, position: true });

        const config = vscode.workspace.getConfiguration('tlcsdm.javafxSupport');
        const showFxId = config.get<boolean>('outline.showFxId', true);
        const showText = config.get<boolean>('outline.showText', true);

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
            const attrs = typeof tag !== 'string' ? tag.attributes : {};

            // Build detail string from fx:id and text attributes
            const detailParts: string[] = [];
            if (showFxId && attrs['fx:id']) {
                detailParts.push(`fx:id="${attrs['fx:id']}"`);
            }
            if (showText && attrs['text']) {
                detailParts.push(`text="${attrs['text']}"`);
            }
            const detail = detailParts.join(' ');

            // Temporary range – the end will be updated when we see the
            // corresponding close tag.
            const startPos = tagStartPos;
            const selectionRange = new vscode.Range(startPos, new vscode.Position(line, column));
            const range = new vscode.Range(startPos, new vscode.Position(line, column));

            const symbol = new vscode.DocumentSymbol(
                name,
                detail,
                this.getSymbolKind(name, attrs, stack[stack.length - 1]?.symbol.name),
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
        const startColumn = column;

        while (l >= 0) {
            const lineText = document.lineAt(l).text;
            if (lineText.length === 0) {
                l--;
                continue;
            }
            const start = l === line ? Math.min(startColumn, lineText.length - 1) : lineText.length - 1;

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

    private getSymbolKind(
        name: string,
        attrs: Record<string, unknown>,
        parentName?: string
    ): vscode.SymbolKind {
        const normalizedName = name.toLowerCase();
        if (NAMESPACE_TAGS.has(normalizedName)) {
            return vscode.SymbolKind.Namespace;
        }

        if (BUILTIN_LAYOUT_TAGS.has(normalizedName)) {
            return vscode.SymbolKind.Module;
        }

        const hasFxId = typeof attrs['fx:id'] === 'string' && attrs['fx:id'].length > 0;
        if (hasFxId && parentName?.toLowerCase() === 'fx:define') {
            return vscode.SymbolKind.Variable;
        }

        if (/^[A-Z]/.test(name)) {
            return vscode.SymbolKind.Object;
        }

        if (hasFxId) {
            return vscode.SymbolKind.Variable;
        }

        return vscode.SymbolKind.Field;
    }
}
