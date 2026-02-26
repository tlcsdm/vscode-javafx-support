import * as vscode from 'vscode';

/**
 * Provides "Go to Definition" from Java controller classes to FXML files.
 * Supports Ctrl+click on @FXML annotated fields and methods to navigate
 * to the corresponding element in the FXML file.
 */
export class ControllerDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        // Check if the current line or preceding line has @FXML annotation
        const currentLine = document.lineAt(position).text;
        const memberName = this.getMemberNameAtPosition(currentLine, position.character);

        if (!memberName) {
            return undefined;
        }

        if (!this.isFxmlAnnotated(document, position.line)) {
            return undefined;
        }

        // Determine if this is a method or field
        const isMethod = this.isMethodDeclaration(currentLine, memberName);

        // Find the FXML files that reference this controller
        const controllerClassName = this.getFullyQualifiedClassName(document);
        if (!controllerClassName) {
            return undefined;
        }

        return this.findInFxmlFiles(controllerClassName, memberName, isMethod);
    }

    /**
     * Get the member name (field or method) at the cursor position
     */
    private getMemberNameAtPosition(line: string, charPos: number): string | undefined {
        // Match a word at the cursor position
        const wordPattern = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
        let match;
        while ((match = wordPattern.exec(line)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (charPos >= start && charPos < end) {
                // Skip Java keywords and type names
                const javaKeywords = new Set([
                    'public', 'private', 'protected', 'static', 'final', 'void',
                    'class', 'interface', 'extends', 'implements', 'import',
                    'package', 'return', 'new', 'this', 'super', 'if', 'else',
                    'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
                    'try', 'catch', 'finally', 'throw', 'throws', 'synchronized',
                    'abstract', 'native', 'transient', 'volatile', 'strictfp',
                    'FXML', 'Override'
                ]);
                if (javaKeywords.has(match[0])) {
                    return undefined;
                }
                return match[0];
            }
        }
        return undefined;
    }

    /**
     * Check if the given line (or preceding lines) have @FXML annotation
     */
    private isFxmlAnnotated(document: vscode.TextDocument, lineNumber: number): boolean {
        // Check current line for @FXML
        const currentLine = document.lineAt(lineNumber).text;
        if (currentLine.includes('@FXML')) {
            return true;
        }

        // Check up to 2 preceding lines for @FXML annotation
        for (let i = 1; i <= 2 && lineNumber - i >= 0; i++) {
            const prevLine = document.lineAt(lineNumber - i).text;
            if (prevLine.trim().startsWith('@FXML')) {
                return true;
            }
            // Stop if we hit a non-annotation, non-empty line
            if (prevLine.trim() !== '' && !prevLine.trim().startsWith('@')) {
                break;
            }
        }

        return false;
    }

    /**
     * Check if the line contains a method declaration with the given name
     */
    private isMethodDeclaration(line: string, name: string): boolean {
        const pattern = new RegExp(`\\b${this.escapeRegex(name)}\\s*\\(`);
        return pattern.test(line);
    }

    /**
     * Get the fully qualified class name from the Java source file
     */
    private getFullyQualifiedClassName(document: vscode.TextDocument): string | undefined {
        const text = document.getText();

        // Extract package name
        const packageMatch = text.match(/package\s+([\w.]+)\s*;/);
        const packageName = packageMatch ? packageMatch[1] : '';

        // Extract class name
        const classMatch = text.match(/class\s+(\w+)/);
        if (!classMatch) {
            return undefined;
        }

        return packageName ? `${packageName}.${classMatch[1]}` : classMatch[1];
    }

    /**
     * Find the member reference in FXML files that use this controller
     */
    private async findInFxmlFiles(
        controllerClassName: string,
        memberName: string,
        isMethod: boolean
    ): Promise<vscode.Location | undefined> {
        const fxmlFiles = await vscode.workspace.findFiles('**/*.fxml', '**/node_modules/**');

        for (const fxmlUri of fxmlFiles) {
            const document = await vscode.workspace.openTextDocument(fxmlUri);
            const text = document.getText();

            // Check if this FXML uses the specified controller
            if (!text.includes(`fx:controller="${controllerClassName}"`)) {
                continue;
            }

            // Search for the member in the FXML
            if (isMethod) {
                // Look for event handler references like onAction="#methodName"
                const location = this.findEventHandlerInFxml(document, fxmlUri, memberName);
                if (location) {
                    return location;
                }
            } else {
                // Look for fx:id="fieldName"
                const location = this.findFxIdInFxml(document, fxmlUri, memberName);
                if (location) {
                    return location;
                }
            }
        }

        return undefined;
    }

    /**
     * Find an event handler reference in an FXML file
     */
    private findEventHandlerInFxml(
        document: vscode.TextDocument,
        uri: vscode.Uri,
        methodName: string
    ): vscode.Location | undefined {
        const pattern = new RegExp(`="#${this.escapeRegex(methodName)}"`);

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            const match = pattern.exec(lineText);
            if (match) {
                // Position at the method name (after ="#)
                return new vscode.Location(uri, new vscode.Position(i, match.index + 2));
            }
        }

        return undefined;
    }

    /**
     * Find an fx:id reference in an FXML file
     */
    private findFxIdInFxml(
        document: vscode.TextDocument,
        uri: vscode.Uri,
        fieldName: string
    ): vscode.Location | undefined {
        const pattern = new RegExp(`fx:id="${this.escapeRegex(fieldName)}"`);

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            const match = pattern.exec(lineText);
            if (match) {
                return new vscode.Location(uri, new vscode.Position(i, match.index));
            }
        }

        return undefined;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
