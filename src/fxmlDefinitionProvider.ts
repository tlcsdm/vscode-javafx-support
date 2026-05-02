import * as vscode from 'vscode';
import { findJavaClass, getSuperclassName } from './javaControllerResolver';

// Matches quoted FXML attribute values that resolve resources relative to the current document,
// for example image="@images/logo.png" or stylesheets="@styles/main.css".
const resourceAttributePattern = /\b[\w:.-]+\s*=\s*(["'])(@[^"']+)\1/g;

/**
 * Provides "Go to Definition" from FXML files to Java controller classes.
 * Supports:
 * - fx:controller="com.example.MyController" → opens the controller class
 * - fx:id="myButton" → jumps to @FXML annotated field in the controller
 * - onAction="#handleClick" → jumps to @FXML annotated method in the controller
 * - fx:include source="Child.fxml" → opens the included FXML file
 * - image="@image.png" / stylesheets="@style.css" → opens the referenced resource file
 */
export class FxmlDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const line = document.lineAt(position).text;

        const includeSourceMatch = this.getFxIncludeSourceAtPosition(line, position.character);
        if (includeSourceMatch) {
            return this.findIncludedFxml(document, includeSourceMatch, token);
        }

        const resourceReferenceMatch = this.getResourceReferenceAtPosition(line, position.character);
        if (resourceReferenceMatch) {
            return this.findRelativeResource(document, resourceReferenceMatch, token);
        }

        // Check if clicking on fx:controller
        const controllerMatch = this.getAttributeValueAtPosition(line, position.character, /fx:controller\s*=\s*"([^"]+)"/g);
        if (controllerMatch) {
            return this.findControllerClass(controllerMatch, token);
        }

        // Check if clicking on onAction (or other event handlers)
        const eventHandlerMatch = this.getAttributeValueAtPosition(line, position.character, /on\w+\s*=\s*"#(\w+)"/g);
        if (eventHandlerMatch) {
            const controllerClassName = this.findControllerInDocument(document);
            if (controllerClassName) {
                return this.findMethodInController(controllerClassName, eventHandlerMatch, token);
            }
        }

        // Check if clicking on fx:id
        const fxIdMatch = this.getAttributeValueAtPosition(line, position.character, /fx:id\s*=\s*"(\w+)"/g);
        if (fxIdMatch) {
            const controllerClassName = this.findControllerInDocument(document);
            if (controllerClassName) {
                return this.findFieldInController(controllerClassName, fxIdMatch, token);
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

    private getFxIncludeSourceAtPosition(line: string, charPos: number): string | undefined {
        const pattern = /<fx:include\b[^>]*\bsource\s*=\s*(["'])(.*?)\1/g;
        let match;
        while ((match = pattern.exec(line)) !== null) {
            const sourceAttributeStart = match[0].search(/\bsource\s*=/);
            const start = match.index + sourceAttributeStart;
            const end = match.index + match[0].length;
            if (sourceAttributeStart >= 0 && charPos >= start && charPos <= end) {
                return match[2];
            }
        }
        return undefined;
    }

    private getResourceReferenceAtPosition(line: string, charPos: number): string | undefined {
        const pattern = new RegExp(resourceAttributePattern);
        let match;
        while ((match = pattern.exec(line)) !== null) {
            const valueStart = match.index + match[0].indexOf(match[2]);
            const valueEnd = valueStart + match[2].length;
            if (charPos >= valueStart && charPos <= valueEnd) {
                return match[2].startsWith('@@') ? undefined : match[2].slice(1);
            }
        }
        return undefined;
    }

    private async findIncludedFxml(
        document: vscode.TextDocument,
        source: string,
        token: vscode.CancellationToken
    ): Promise<vscode.Location | undefined> {
        if (token.isCancellationRequested || document.uri.scheme !== 'file') {
            return undefined;
        }

        const includeUri = vscode.Uri.joinPath(document.uri, '..', source);
        try {
            await vscode.workspace.fs.stat(includeUri);
        } catch {
            return undefined;
        }

        if (token.isCancellationRequested) {
            return undefined;
        }

        return new vscode.Location(includeUri, new vscode.Position(0, 0));
    }

    private async findRelativeResource(
        document: vscode.TextDocument,
        source: string,
        token: vscode.CancellationToken
    ): Promise<vscode.Location | undefined> {
        if (token.isCancellationRequested || document.uri.scheme !== 'file') {
            return undefined;
        }

        const resourceUri = vscode.Uri.joinPath(document.uri, '..', source);
        try {
            await vscode.workspace.fs.stat(resourceUri);
        } catch {
            return undefined;
        }

        if (token.isCancellationRequested) {
            return undefined;
        }

        return new vscode.Location(resourceUri, new vscode.Position(0, 0));
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
    private async findControllerClass(className: string, token: vscode.CancellationToken): Promise<vscode.Location | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const classInfo = await findJavaClass(className, token);

        if (classInfo) {
            // Find the class declaration line
            for (let i = 0; i < classInfo.document.lineCount; i++) {
                if (token.isCancellationRequested) {
                    return undefined;
                }

                const lineText = classInfo.document.lineAt(i).text;
                const simpleClassName = className.split('.').pop() || className;
                if (lineText.includes(`class ${simpleClassName}`)) {
                    return new vscode.Location(classInfo.uri, new vscode.Position(i, lineText.indexOf(`class ${simpleClassName}`)));
                }
            }
            return new vscode.Location(classInfo.uri, new vscode.Position(0, 0));
        }

        return undefined;
    }

    /**
     * Find a method in the controller class (for event handlers)
     */
    private async findMethodInController(
        controllerClassName: string,
        methodName: string,
        token: vscode.CancellationToken
    ): Promise<vscode.Location | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        return this.findMemberInControllerHierarchy(controllerClassName, methodName, true, token);
    }

    /**
     * Find a field in the controller class (for fx:id)
     */
    private async findFieldInController(
        controllerClassName: string,
        fieldName: string,
        token: vscode.CancellationToken
    ): Promise<vscode.Location | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        return this.findMemberInControllerHierarchy(controllerClassName, fieldName, false, token);
    }

    private async findMemberInControllerHierarchy(
        controllerClassName: string,
        memberName: string,
        isMethod: boolean,
        token: vscode.CancellationToken,
        visited = new Set<string>()
    ): Promise<vscode.Location | undefined> {
        if (token.isCancellationRequested || visited.has(controllerClassName)) {
            return undefined;
        }

        visited.add(controllerClassName);

        const classInfo = await findJavaClass(controllerClassName, token);
        if (!classInfo) {
            return undefined;
        }

        const location = this.findMemberInJavaFile(classInfo.document, classInfo.uri, memberName, isMethod, token);
        if (location || token.isCancellationRequested) {
            return location;
        }

        const superClassName = getSuperclassName(classInfo.document);
        if (!superClassName) {
            return undefined;
        }

        return this.findMemberInControllerHierarchy(superClassName, memberName, isMethod, token, visited);
    }

    /**
     * Find a member (field or method) in a Java file, preferring @FXML-annotated ones
     */
    private findMemberInJavaFile(
        document: vscode.TextDocument,
        uri: vscode.Uri,
        memberName: string,
        isMethod: boolean,
        token: vscode.CancellationToken
    ): vscode.Location | undefined {
        let fxmlAnnotationLine = -1;
        let bestMatch: vscode.Location | undefined;

        for (let i = 0; i < document.lineCount; i++) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            const lineText = document.lineAt(i).text;

            // Track @FXML annotation lines
            if (lineText.trim().startsWith('@FXML')) {
                fxmlAnnotationLine = i;
            }

            if (isMethod) {
                const methodMatch = this.getMethodDeclarationMatch(lineText, memberName);
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
                const fieldMatch = this.getFieldDeclarationMatch(lineText, memberName);
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

    private getMethodDeclarationMatch(line: string, methodName: string): RegExpExecArray | undefined {
        const methodPattern = new RegExp(`\\b${this.escapeRegex(methodName)}\\s*\\(`);
        const methodMatch = methodPattern.exec(line);
        if (!methodMatch) {
            return undefined;
        }

        const prefix = line.slice(0, methodMatch.index).trimEnd();
        if (!this.isValidMemberDeclarationPrefix(prefix)) {
            return undefined;
        }

        const lastPrefixChar = prefix.trimEnd().at(-1);
        return lastPrefixChar && (/\w/.test(lastPrefixChar) || lastPrefixChar === '>' || lastPrefixChar === ']')
            ? methodMatch
            : undefined;
    }

    private getFieldDeclarationMatch(line: string, fieldName: string): RegExpExecArray | undefined {
        const fieldPattern = new RegExp(`\\b${this.escapeRegex(fieldName)}\\b\\s*(?=[;=,)])`);
        const fieldMatch = fieldPattern.exec(line);
        if (!fieldMatch) {
            return undefined;
        }

        const prefix = line.slice(0, fieldMatch.index).trim();
        if (!this.isValidMemberDeclarationPrefix(prefix)) {
            return undefined;
        }

        return fieldMatch;
    }

    private isValidMemberDeclarationPrefix(prefix: string): boolean {
        if (!prefix || prefix.endsWith('.') || /[(){};]/.test(prefix)) {
            return false;
        }

        return !/\b(?:if|for|while|switch|catch|new|return|throw)\b/.test(prefix);
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
