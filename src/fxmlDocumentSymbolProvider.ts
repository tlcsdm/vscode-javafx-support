import * as vscode from 'vscode';

/**
 * FXML Document Symbol Provider.
 * Parses FXML files and provides document symbols for the Outline view,
 * showing the XML element hierarchy similar to how XML extensions handle XML files.
 */
export class FxmlDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        const text = document.getText();
        const symbols: vscode.DocumentSymbol[] = [];
        const stack: { symbol: vscode.DocumentSymbol; tagName: string }[] = [];

        const tagPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\s\S]*?)?)(\/?)\s*>/g;

        let match: RegExpExecArray | null;
        while ((match = tagPattern.exec(text)) !== null) {
            const fullMatch = match[0];
            const offset = match.index;

            // Skip comments and CDATA sections
            if (fullMatch.startsWith('<!--') || fullMatch.startsWith('<![CDATA[')) {
                continue;
            }

            // Processing instruction (<?xml ...?>, <?import ...?>)
            if (fullMatch.startsWith('<?')) {
                const name = this.getProcessingInstructionName(fullMatch);
                const detail = this.getProcessingInstructionDetail(fullMatch);
                const startPos = document.positionAt(offset);
                const endPos = document.positionAt(offset + fullMatch.length);
                const range = new vscode.Range(startPos, endPos);
                const symbol = new vscode.DocumentSymbol(
                    name,
                    detail,
                    vscode.SymbolKind.Property,
                    range,
                    range
                );
                if (stack.length > 0) {
                    stack[stack.length - 1].symbol.children.push(symbol);
                } else {
                    symbols.push(symbol);
                }
                continue;
            }

            // Closing tag
            if (match[1] !== undefined) {
                const closingTag = match[1];
                // Find the matching opening tag on the stack
                for (let i = stack.length - 1; i >= 0; i--) {
                    if (stack[i].tagName === closingTag) {
                        const endPos = document.positionAt(offset + fullMatch.length);
                        // Update the range to encompass both opening and closing tags
                        stack[i].symbol.range = new vscode.Range(
                            stack[i].symbol.range.start,
                            endPos
                        );
                        stack.splice(i);
                        break;
                    }
                }
                continue;
            }

            // Opening or self-closing tag
            if (match[2] !== undefined) {
                const tagName = match[2];
                const attributes = match[3] || '';
                const selfClosing = match[4] === '/';

                const detail = this.getElementDetail(attributes);
                const kind = this.getSymbolKind(tagName);

                const startPos = document.positionAt(offset);
                const endPos = document.positionAt(offset + fullMatch.length);
                const range = new vscode.Range(startPos, endPos);
                const selectionRange = new vscode.Range(startPos, endPos);

                const symbol = new vscode.DocumentSymbol(
                    tagName,
                    detail,
                    kind,
                    range,
                    selectionRange
                );

                if (stack.length > 0) {
                    stack[stack.length - 1].symbol.children.push(symbol);
                } else {
                    symbols.push(symbol);
                }

                if (!selfClosing) {
                    stack.push({ symbol, tagName });
                }
            }
        }

        return symbols;
    }

    /**
     * Extract a meaningful detail string from element attributes.
     * Shows fx:id, id, or fx:controller if present.
     */
    private getElementDetail(attributes: string): string {
        const details: string[] = [];

        const fxIdMatch = attributes.match(/fx:id\s*=\s*"([^"]*)"/);
        if (fxIdMatch) {
            details.push(`fx:id="${fxIdMatch[1]}"`);
        }

        const idMatch = attributes.match(/(?:^|\s)id\s*=\s*"([^"]*)"/);
        if (idMatch && !fxIdMatch) {
            details.push(`id="${idMatch[1]}"`);
        }

        const controllerMatch = attributes.match(/fx:controller\s*=\s*"([^"]*)"/);
        if (controllerMatch) {
            details.push(`fx:controller="${controllerMatch[1]}"`);
        }

        return details.join(' ');
    }

    /**
     * Get the name from a processing instruction (e.g., "?xml" from <?xml ...?>)
     */
    private getProcessingInstructionName(pi: string): string {
        const match = pi.match(/<\?\s*([\w.-]+)/);
        return match ? `?${match[1]}` : '?';
    }

    /**
     * Get detail from a processing instruction
     */
    private getProcessingInstructionDetail(pi: string): string {
        // For <?import ...?>, show the import path
        const importMatch = pi.match(/<\?\s*import\s+([\w.*]+)\s*\?>/);
        if (importMatch) {
            return importMatch[1];
        }
        return '';
    }

    /**
     * Determine the appropriate SymbolKind for a given FXML tag name.
     */
    private getSymbolKind(tagName: string): vscode.SymbolKind {
        // FX-specific elements
        if (tagName.startsWith('fx:')) {
            return vscode.SymbolKind.Key;
        }

        // Common JavaFX layout containers
        const containers = new Set([
            'AnchorPane', 'BorderPane', 'FlowPane', 'GridPane', 'HBox', 'VBox',
            'StackPane', 'TilePane', 'Pane', 'ScrollPane', 'SplitPane',
            'TabPane', 'TitledPane', 'Accordion', 'DialogPane',
        ]);
        if (containers.has(tagName)) {
            return vscode.SymbolKind.Module;
        }

        // Property elements (start with lowercase)
        if (tagName.charAt(0) === tagName.charAt(0).toLowerCase() || tagName.includes('.')) {
            return vscode.SymbolKind.Property;
        }

        // Default: treat as a class/object (JavaFX control)
        return vscode.SymbolKind.Object;
    }
}
