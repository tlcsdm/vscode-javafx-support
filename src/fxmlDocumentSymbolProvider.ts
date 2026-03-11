import * as vscode from 'vscode';

/**
 * FXML Document Symbol Provider.
 * Provides document symbols (outline) for FXML files by parsing XML structure.
 */
export class FxmlDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        const text = document.getText();
        const symbols: vscode.DocumentSymbol[] = [];
        const stack: vscode.DocumentSymbol[] = [];

        // Regex to match XML tags: opening, closing, self-closing
        // Skips comments (<!--...-->) and CDATA (<![CDATA[...]]>) sections
        const tagRegex = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([\w.:-]+)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
        let match: RegExpExecArray | null;

        while ((match = tagRegex.exec(text)) !== null) {
            // Skip comments and CDATA sections (they match but have no capture groups)
            if (!match[2]) {
                continue;
            }

            const isClosing = match[1] === '/';
            const tagName = match[2];
            const attributes = match[3] || '';
            const isSelfClosing = match[4] === '/';
            const tagStart = match.index;
            const tagEnd = tagStart + match[0].length;

            if (isClosing) {
                // Closing tag: pop the most recently opened matching tag
                if (stack.length > 0 && stack[stack.length - 1].name === tagName) {
                    const entry = stack.pop()!;
                    entry.range = new vscode.Range(
                        entry.range.start,
                        document.positionAt(tagEnd)
                    );
                }
            } else {
                const startPos = document.positionAt(tagStart);
                const endPos = document.positionAt(tagEnd);

                // Build detail string from key attributes
                const detail = this.extractDetail(attributes);
                const symbolName = tagName;

                const symbol = new vscode.DocumentSymbol(
                    symbolName,
                    detail,
                    this.getSymbolKind(tagName),
                    new vscode.Range(startPos, endPos), // Full range (updated on closing tag)
                    new vscode.Range(startPos, endPos)  // Selection range (the opening tag)
                );

                if (isSelfClosing) {
                    // Self-closing tag: add directly
                    if (stack.length > 0) {
                        stack[stack.length - 1].children.push(symbol);
                    } else {
                        symbols.push(symbol);
                    }
                } else {
                    // Opening tag: push to stack
                    if (stack.length > 0) {
                        stack[stack.length - 1].children.push(symbol);
                    } else {
                        symbols.push(symbol);
                    }
                    stack.push(symbol);
                }
            }
        }

        return symbols;
    }

    /**
     * Extract a meaningful detail string from XML attributes.
     * Prioritizes fx:id, id, fx:controller, and text attributes.
     */
    private extractDetail(attributes: string): string {
        const details: string[] = [];
        const attrRegex = /([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let attrMatch: RegExpExecArray | null;

        while ((attrMatch = attrRegex.exec(attributes)) !== null) {
            const name = attrMatch[1];
            const value = attrMatch[2] ?? attrMatch[3];

            if (name === 'fx:id' || name === 'id') {
                details.unshift(`${name}="${value}"`);
            } else if (name === 'fx:controller' || name === 'text' || name === 'styleClass') {
                details.push(`${name}="${value}"`);
            }
        }

        return details.join(' ');
    }

    /**
     * Determine the appropriate SymbolKind for a given XML tag name.
     */
    private getSymbolKind(tagName: string): vscode.SymbolKind {
        // Processing instructions
        if (tagName.startsWith('?')) {
            return vscode.SymbolKind.Key;
        }

        // Lowercase tags are typically properties in FXML (e.g., <children>, <items>, <columns>)
        if (/^[a-z]/.test(tagName)) {
            return vscode.SymbolKind.Property;
        }

        // Uppercase tags are typically class instantiations (e.g., <Button>, <VBox>, <Label>)
        return vscode.SymbolKind.Object;
    }
}
