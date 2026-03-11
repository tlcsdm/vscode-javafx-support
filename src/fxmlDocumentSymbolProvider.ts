import * as vscode from 'vscode';

/** Parsed XML token types */
const TOKEN_PI = 'pi';
const TOKEN_OPEN = 'open';
const TOKEN_CLOSE = 'close';
const TOKEN_SELF_CLOSE = 'selfclose';

type TokenType = typeof TOKEN_PI | typeof TOKEN_OPEN | typeof TOKEN_CLOSE | typeof TOKEN_SELF_CLOSE;

interface XmlToken {
    type: TokenType;
    name: string;
    attributes: string;
    start: number;
    end: number;
}

/**
 * FXML Document Symbol Provider.
 * Parses FXML files and provides document symbols for the Outline view,
 * showing the XML element hierarchy similar to how XML extensions handle XML files.
 */
export class FxmlDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        try {
            return this.parseDocument(document);
        } catch (e) {
            console.error('[JavaFX] Error parsing FXML document symbols:', e);
            return [];
        }
    }

    private parseDocument(document: vscode.TextDocument): vscode.DocumentSymbol[] {
        const text = document.getText();
        if (!text || text.trim().length === 0) {
            return [];
        }

        const tokens = this.tokenize(text);
        const symbols: vscode.DocumentSymbol[] = [];
        const stack: { symbol: vscode.DocumentSymbol; tagName: string }[] = [];

        for (const token of tokens) {
            if (token.type === TOKEN_PI) {
                const name = this.getProcessingInstructionName(token.name);
                const detail = this.getProcessingInstructionDetail(token.name, token.attributes);
                const startPos = document.positionAt(token.start);
                const endPos = document.positionAt(token.end);
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
            } else if (token.type === TOKEN_CLOSE) {
                for (let i = stack.length - 1; i >= 0; i--) {
                    if (stack[i].tagName === token.name) {
                        const endPos = document.positionAt(token.end);
                        stack[i].symbol.range = new vscode.Range(
                            stack[i].symbol.range.start,
                            endPos
                        );
                        stack.splice(i);
                        break;
                    }
                }
            } else {
                // OpenTag or SelfCloseTag
                const detail = this.getElementDetail(token.attributes);
                const kind = this.getSymbolKind(token.name);

                const startPos = document.positionAt(token.start);
                const endPos = document.positionAt(token.end);
                const range = new vscode.Range(startPos, endPos);

                const symbol = new vscode.DocumentSymbol(
                    token.name,
                    detail,
                    kind,
                    range,
                    range
                );

                if (stack.length > 0) {
                    stack[stack.length - 1].symbol.children.push(symbol);
                } else {
                    symbols.push(symbol);
                }

                if (token.type === TOKEN_OPEN) {
                    stack.push({ symbol, tagName: token.name });
                }
            }
        }

        return symbols;
    }

    /**
     * Tokenize XML/FXML content into structured tokens.
     * Uses a character-by-character approach to properly handle quoted attributes.
     */
    private tokenize(text: string): XmlToken[] {
        const tokens: XmlToken[] = [];
        const len = text.length;
        let i = 0;

        while (i < len) {
            if (text[i] !== '<') {
                i++;
                continue;
            }

            const start = i;

            // Comment: <!-- ... -->
            if (text.startsWith('<!--', i)) {
                const end = text.indexOf('-->', i + 4);
                i = end >= 0 ? end + 3 : len;
                continue;
            }

            // CDATA: <![CDATA[ ... ]]>
            if (text.startsWith('<![CDATA[', i)) {
                const end = text.indexOf(']]>', i + 9);
                i = end >= 0 ? end + 3 : len;
                continue;
            }

            // Processing instruction: <? ... ?>
            if (i + 1 < len && text[i + 1] === '?') {
                const end = text.indexOf('?>', i + 2);
                if (end >= 0) {
                    const content = text.substring(i + 2, end).trim();
                    const spaceIdx = content.search(/\s/);
                    const name = spaceIdx >= 0 ? content.substring(0, spaceIdx) : content;
                    const attrs = spaceIdx >= 0 ? content.substring(spaceIdx) : '';
                    if (name) {
                        tokens.push({
                            type: TOKEN_PI,
                            name,
                            attributes: attrs,
                            start,
                            end: end + 2,
                        });
                    }
                    i = end + 2;
                } else {
                    i = len;
                }
                continue;
            }

            // Closing tag: </name>
            if (i + 1 < len && text[i + 1] === '/') {
                const end = text.indexOf('>', i + 2);
                if (end >= 0) {
                    const name = text.substring(i + 2, end).trim();
                    if (name) {
                        tokens.push({
                            type: TOKEN_CLOSE,
                            name,
                            attributes: '',
                            start,
                            end: end + 1,
                        });
                    }
                    i = end + 1;
                } else {
                    i = len;
                }
                continue;
            }

            // Opening or self-closing tag: <name ...> or <name ... />
            i++; // skip '<'
            // Read tag name
            const nameStart = i;
            while (i < len && !isWhitespace(text[i]) && text[i] !== '>' && text[i] !== '/') {
                i++;
            }
            const tagName = text.substring(nameStart, i);
            if (!tagName || !/^[\w:.-]+$/.test(tagName)) {
                // Not a valid tag name, skip
                continue;
            }

            // Read attributes (handling quoted values)
            const attrStart = i;
            let selfClosing = false;
            while (i < len) {
                const ch = text[i];
                if (ch === '"' || ch === "'") {
                    // Skip quoted attribute value
                    const quote = ch;
                    i++;
                    while (i < len && text[i] !== quote) {
                        i++;
                    }
                    if (i < len) {
                        i++; // skip closing quote
                    }
                } else if (ch === '>') {
                    i++; // skip '>'
                    break;
                } else if (ch === '/' && i + 1 < len && text[i + 1] === '>') {
                    selfClosing = true;
                    i += 2; // skip '/>'
                    break;
                } else {
                    i++;
                }
            }

            const attributes = text.substring(attrStart, selfClosing ? i - 2 : i - 1);
            tokens.push({
                type: selfClosing ? TOKEN_SELF_CLOSE : TOKEN_OPEN,
                name: tagName,
                attributes,
                start,
                end: i,
            });
        }

        return tokens;
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
     * Format the processing instruction name for display (e.g., "?xml", "?import")
     */
    private getProcessingInstructionName(piName: string): string {
        return `?${piName}`;
    }

    /**
     * Get detail from a processing instruction
     */
    private getProcessingInstructionDetail(piName: string, piContent: string): string {
        if (piName === 'import') {
            const importPath = piContent.trim();
            if (importPath) {
                return importPath;
            }
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

function isWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}
