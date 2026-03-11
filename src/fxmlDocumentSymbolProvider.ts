import * as vscode from 'vscode';

/**
 * Provides document symbols (outline) for FXML files.
 * Parses the XML structure of FXML and creates a hierarchical symbol tree,
 * enabling VS Code's Outline view and breadcrumb navigation.
 */
export class FxmlDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
        const text = document.getText();
        const symbols: vscode.DocumentSymbol[] = [];
        const stack: { symbol: vscode.DocumentSymbol; tagName: string }[] = [];

        // Regex to match XML tags, comments, CDATA, and processing instructions
        const tagRegex = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?([^\s>/]+)([^>]*?)(\/?)>/g;
        let match: RegExpExecArray | null;

        while ((match = tagRegex.exec(text)) !== null) {
            const fullMatch = match[0];

            // Skip comments, CDATA, and processing instructions
            if (fullMatch.startsWith('<!--') || fullMatch.startsWith('<![CDATA[') || fullMatch.startsWith('<?')) {
                continue;
            }

            const isClosingTag = fullMatch.startsWith('</');
            const tagName = match[1];
            const attributes = match[2] || '';
            const isSelfClosing = match[3] === '/' || fullMatch.endsWith('/>');

            if (!tagName) {
                continue;
            }

            if (isClosingTag) {
                // Close the matching open tag
                for (let i = stack.length - 1; i >= 0; i--) {
                    if (stack[i].tagName === tagName) {
                        const entry = stack.splice(i, 1)[0];
                        // Update the range to include the closing tag
                        const endPos = document.positionAt(match.index + fullMatch.length);
                        entry.symbol.range = new vscode.Range(entry.symbol.range.start, endPos);
                        break;
                    }
                }
                continue;
            }

            // Opening or self-closing tag
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + fullMatch.length);

            const detail = this.extractDetail(attributes);
            const symbolName = this.getSymbolName(tagName, attributes);
            const symbolKind = this.getSymbolKind(tagName);

            const symbol = new vscode.DocumentSymbol(
                symbolName,
                detail,
                symbolKind,
                new vscode.Range(startPos, endPos),
                new vscode.Range(startPos, endPos)
            );

            // Add to parent or root
            if (stack.length > 0) {
                stack[stack.length - 1].symbol.children.push(symbol);
            } else {
                symbols.push(symbol);
            }

            // Push onto stack if not self-closing
            if (!isSelfClosing) {
                stack.push({ symbol, tagName });
            }
        }

        return symbols;
    }

    /**
     * Create a display name for the symbol.
     * If the element has an fx:id, append it to the tag name.
     */
    private getSymbolName(tagName: string, attributes: string): string {
        const fxIdMatch = attributes.match(/fx:id\s*=\s*["']([^"']*)["']/);
        if (fxIdMatch) {
            return `${tagName} #${fxIdMatch[1]}`;
        }
        return tagName;
    }

    /**
     * Extract detail text from attributes (fx:controller, text, etc.)
     */
    private extractDetail(attributes: string): string {
        const controllerMatch = attributes.match(/fx:controller\s*=\s*["']([^"']*)["']/);
        if (controllerMatch) {
            return controllerMatch[1];
        }
        const textMatch = attributes.match(/\btext\s*=\s*["']([^"']*)["']/);
        if (textMatch) {
            return `text="${textMatch[1]}"`;
        }
        return '';
    }

    /**
     * Determine an appropriate SymbolKind for the FXML element.
     */
    private getSymbolKind(tagName: string): vscode.SymbolKind {
        // Import statements (processing instructions handled separately, but import tags)
        if (tagName === 'fx:include' || tagName.startsWith('fx:')) {
            return vscode.SymbolKind.Module;
        }
        // Common container/layout types
        if (/^(AnchorPane|BorderPane|FlowPane|GridPane|HBox|VBox|StackPane|TilePane|ScrollPane|SplitPane|TabPane|Pane|Group|Scene)$/.test(tagName)) {
            return vscode.SymbolKind.Namespace;
        }
        // Control elements
        if (/^(Button|Label|TextField|TextArea|ComboBox|CheckBox|RadioButton|ToggleButton|Slider|ProgressBar|ListView|TableView|TreeView|MenuBar|Menu|MenuItem|Tab|ToolBar|DatePicker|ColorPicker|ChoiceBox|Spinner|Hyperlink|PasswordField|ScrollBar)$/.test(tagName)) {
            return vscode.SymbolKind.Field;
        }
        // Column-related
        if (/^(TableColumn|TreeTableColumn|ColumnConstraints|RowConstraints)$/.test(tagName)) {
            return vscode.SymbolKind.Property;
        }
        // Property elements (lowercase first letter typically indicates a property in FXML)
        if (/^[a-z]/.test(tagName)) {
            return vscode.SymbolKind.Property;
        }
        // Default: treat as a class (PascalCase = JavaFX class)
        return vscode.SymbolKind.Class;
    }
}
