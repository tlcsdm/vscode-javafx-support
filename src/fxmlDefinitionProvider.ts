import * as vscode from 'vscode';

/**
 * Provides "Go to Definition" from FXML files to Java controller classes.
 * Supports:
 * - fx:controller="com.example.MyController" → opens the controller class
 * - fx:id="myButton" → jumps to @FXML annotated field in the controller
 * - onAction="#handleClick" → jumps to @FXML annotated method in the controller
 */
export class FxmlDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        const line = document.lineAt(position).text;

        // Check if clicking on fx:controller
        const controllerMatch = this.getAttributeValueAtPosition(line, position.character, /fx:controller\s*=\s*"([^"]+)"/g);
        if (controllerMatch) {
            return this.findControllerClass(controllerMatch);
        }

        // Check if clicking on onAction (or other event handlers)
        const eventHandlerMatch = this.getAttributeValueAtPosition(line, position.character, /on\w+\s*=\s*"#(\w+)"/g);
        if (eventHandlerMatch) {
            const controllerClassName = this.findControllerInDocument(document);
            if (controllerClassName) {
                return this.findMethodInController(controllerClassName, eventHandlerMatch);
            }
        }

        // Check if clicking on fx:id
        const fxIdMatch = this.getAttributeValueAtPosition(line, position.character, /fx:id\s*=\s*"(\w+)"/g);
        if (fxIdMatch) {
            const controllerClassName = this.findControllerInDocument(document);
            if (controllerClassName) {
                return this.findFieldInController(controllerClassName, fxIdMatch);
            }
        }

        return undefined;
    }

    /**
     * Get the attribute value at the cursor position
     */
    private getAttributeValueAtPosition(line: string, charPos: number, pattern: RegExp): string | undefined {
        let match;
        while ((match = pattern.exec(line)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (charPos >= start && charPos <= end) {
                return match[1];
            }
        }
        return undefined;
    }

    /**
     * Find the fx:controller value in the FXML document
     */
    private findControllerInDocument(document: vscode.TextDocument): string | undefined {
        const text = document.getText();
        const match = text.match(/fx:controller\s*=\s*"([^"]+)"/);
        return match ? match[1] : undefined;
    }

    /**
     * Find a Java controller class file by its fully qualified name
     */
    private async findControllerClass(className: string): Promise<vscode.Location | undefined> {
        const relativePath = className.replace(/\./g, '/') + '.java';
        const files = await vscode.workspace.findFiles(`**/${relativePath}`, '**/node_modules/**');

        if (files.length > 0) {
            const document = await vscode.workspace.openTextDocument(files[0]);
            // Find the class declaration line
            for (let i = 0; i < document.lineCount; i++) {
                const lineText = document.lineAt(i).text;
                const simpleClassName = className.split('.').pop() || className;
                if (lineText.includes(`class ${simpleClassName}`)) {
                    return new vscode.Location(files[0], new vscode.Position(i, lineText.indexOf(`class ${simpleClassName}`)));
                }
            }
            return new vscode.Location(files[0], new vscode.Position(0, 0));
        }

        return undefined;
    }

    /**
     * Find a method in the controller class (for event handlers)
     */
    private async findMethodInController(controllerClassName: string, methodName: string): Promise<vscode.Location | undefined> {
        const relativePath = controllerClassName.replace(/\./g, '/') + '.java';
        const files = await vscode.workspace.findFiles(`**/${relativePath}`, '**/node_modules/**');

        if (files.length > 0) {
            const document = await vscode.workspace.openTextDocument(files[0]);
            return this.findMemberInJavaFile(document, files[0], methodName, true);
        }

        return undefined;
    }

    /**
     * Find a field in the controller class (for fx:id)
     */
    private async findFieldInController(controllerClassName: string, fieldName: string): Promise<vscode.Location | undefined> {
        const relativePath = controllerClassName.replace(/\./g, '/') + '.java';
        const files = await vscode.workspace.findFiles(`**/${relativePath}`, '**/node_modules/**');

        if (files.length > 0) {
            const document = await vscode.workspace.openTextDocument(files[0]);
            return this.findMemberInJavaFile(document, files[0], fieldName, false);
        }

        return undefined;
    }

    /**
     * Find a member (field or method) in a Java file, preferring @FXML-annotated ones
     */
    private findMemberInJavaFile(
        document: vscode.TextDocument,
        uri: vscode.Uri,
        memberName: string,
        isMethod: boolean
    ): vscode.Location | undefined {
        let fxmlAnnotationLine = -1;
        let bestMatch: vscode.Location | undefined;

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;

            // Track @FXML annotation lines
            if (lineText.trim().startsWith('@FXML')) {
                fxmlAnnotationLine = i;
            }

            if (isMethod) {
                // Look for method declaration
                const methodPattern = new RegExp(`\\b${this.escapeRegex(memberName)}\\s*\\(`);
                const methodMatch = methodPattern.exec(lineText);
                if (methodMatch) {
                    const location = new vscode.Location(uri, new vscode.Position(i, methodMatch.index));
                    // Prefer @FXML-annotated method (annotation should be on preceding line)
                    if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine <= 2) {
                        return location;
                    }
                    if (!bestMatch) {
                        bestMatch = location;
                    }
                }
            } else {
                // Look for field declaration
                const fieldPattern = new RegExp(`\\b${this.escapeRegex(memberName)}\\s*[;=,)]`);
                const fieldMatch = fieldPattern.exec(lineText);
                if (fieldMatch) {
                    const location = new vscode.Location(uri, new vscode.Position(i, fieldMatch.index));
                    // Prefer @FXML-annotated field
                    if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine <= 2) {
                        return location;
                    }
                    if (!bestMatch) {
                        bestMatch = location;
                    }
                }
            }

            // Reset the annotation tracker if we've moved past
            if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine > 2) {
                fxmlAnnotationLine = -1;
            }
        }

        return bestMatch;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
