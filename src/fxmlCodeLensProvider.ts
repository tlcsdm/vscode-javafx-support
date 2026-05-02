import * as vscode from 'vscode';
import { classExtends } from './javaControllerResolver';

/**
 * Provides CodeLens for @FXML annotated fields and methods in Java controller classes.
 * Each CodeLens provides a clickable "Go to FXML" link that navigates to the
 * corresponding element in the associated FXML file.
 */
export class FxmlCodeLensProvider implements vscode.CodeLensProvider {
    async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        if (token.isCancellationRequested) {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();

        // Only process Java files that import javafx.fxml.FXML
        if (!text.includes('javafx.fxml.FXML')) {
            return codeLenses;
        }

        const controllerClassName = this.getFullyQualifiedClassName(document);
        if (!controllerClassName) {
            return codeLenses;
        }

        for (let i = 0; i < document.lineCount; i++) {
            if (token.isCancellationRequested) {
                return [];
            }

            const lineText = document.lineAt(i).text;

            if (lineText.trim().startsWith('@FXML')) {
                // Try to extract member name from the current line first
                // (handles case where @FXML is on the same line as the declaration)
                let memberName = this.extractMemberName(lineText);
                let memberLineText = lineText;

                if (!memberName) {
                    // Find the next non-annotation, non-empty line (the actual member declaration)
                    for (let j = i + 1; j < document.lineCount && j <= i + 3; j++) {
                        if (token.isCancellationRequested) {
                            return [];
                        }

                        const nextLine = document.lineAt(j).text.trim();
                        if (nextLine !== '' && !nextLine.startsWith('@')) {
                            memberLineText = document.lineAt(j).text;
                            memberName = this.extractMemberName(memberLineText);
                            break;
                        }
                    }
                }

                if (memberName) {
                    const isMethod = this.isMethodDeclaration(memberLineText, memberName);
                    const range = new vscode.Range(i, 0, i, lineText.length);
                    const codeLens = new vscode.CodeLens(range, {
                        title: '$(link-external) Go to FXML',
                        command: 'tlcsdm.javafxSupport.goToFxml',
                        arguments: [controllerClassName, memberName, isMethod]
                    });
                    codeLenses.push(codeLens);
                }
            }
        }

        return codeLenses;
    }

    /**
     * Extract member name from a Java field or method declaration line.
     */
    private extractMemberName(line: string): string | undefined {
        // Match method declaration: e.g., "private void handleClick(ActionEvent event)"
        const methodMatch = line.match(/\b(\w+)\s*\(/);
        if (methodMatch) {
            const javaKeywords = new Set([
                'if', 'for', 'while', 'switch', 'catch', 'new', 'return', 'class', 'interface'
            ]);
            if (!javaKeywords.has(methodMatch[1])) {
                return methodMatch[1];
            }
        }

        // Match field declaration: e.g., "private Button myButton;"
        const fieldMatch = line.match(/\b(\w+)\s*[;=,)]/);
        if (fieldMatch) {
            const javaKeywords = new Set([
                'public', 'private', 'protected', 'static', 'final', 'void',
                'class', 'interface', 'extends', 'implements', 'import',
                'package', 'return', 'new'
            ]);
            if (!javaKeywords.has(fieldMatch[1])) {
                return fieldMatch[1];
            }
        }

        return undefined;
    }

    /**
     * Check if the line contains a method declaration with the given name
     */
    private isMethodDeclaration(line: string, name: string): boolean {
        const pattern = new RegExp(`\\b${escapeRegex(name)}\\s*\\(`);
        return pattern.test(line);
    }

    /**
     * Get the fully qualified class name from the Java source file
     */
    private getFullyQualifiedClassName(document: vscode.TextDocument): string | undefined {
        const text = document.getText();

        const packageMatch = text.match(/package\s+([\w.]+)\s*;/);
        const packageName = packageMatch ? packageMatch[1] : '';

        const classMatch = text.match(/class\s+(\w+)/);
        if (!classMatch) {
            return undefined;
        }

        return packageName ? `${packageName}.${classMatch[1]}` : classMatch[1];
    }

}

/**
 * Navigate to a member in the FXML file that uses the given controller.
 */
export async function goToFxmlCommand(
    controllerClassName: string,
    memberName: string,
    isMethod: boolean
): Promise<void> {
    const tokenSource = new vscode.CancellationTokenSource();
    try {
        const location = await findFxmlMemberLocation(controllerClassName, memberName, isMethod, tokenSource.token);
        if (location) {
            await vscode.window.showTextDocument(location.uri, {
                selection: location.range,
                preserveFocus: false
            });
            return;
        }
    } finally {
        tokenSource.dispose();
    }

    vscode.window.showInformationMessage(`No FXML reference found for '${memberName}'.`);
}

export async function findFxmlMemberLocation(
    controllerClassName: string,
    memberName: string,
    isMethod: boolean,
    token: vscode.CancellationToken
): Promise<vscode.Location | undefined> {
    const fxmlFiles = await vscode.workspace.findFiles('**/*.fxml', '**/node_modules/**');

    for (const fxmlUri of fxmlFiles) {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const document = await vscode.workspace.openTextDocument(fxmlUri);
        const text = document.getText();
        const controllerInFxml = getControllerClassName(text);

        if (!controllerInFxml || (
            controllerInFxml !== controllerClassName
            && !await classExtends(controllerInFxml, controllerClassName, token)
        )) {
            continue;
        }

        let targetLine = -1;
        let targetChar = 0;

        if (isMethod) {
            const pattern = new RegExp(`=\\s*"#(${escapeRegex(memberName)})"`);
            for (let i = 0; i < document.lineCount; i++) {
                if (token.isCancellationRequested) {
                    return undefined;
                }

                const match = pattern.exec(document.lineAt(i).text);
                if (match) {
                    targetLine = i;
                    targetChar = match.index + match[0].indexOf(match[1]);
                    break;
                }
            }
        } else {
            const pattern = new RegExp(`fx:id="${escapeRegex(memberName)}"`);
            for (let i = 0; i < document.lineCount; i++) {
                if (token.isCancellationRequested) {
                    return undefined;
                }

                const match = pattern.exec(document.lineAt(i).text);
                if (match) {
                    targetLine = i;
                    targetChar = match.index;
                    break;
                }
            }
        }

        if (targetLine >= 0) {
            const position = new vscode.Position(targetLine, targetChar);
            return new vscode.Location(fxmlUri, new vscode.Range(position, position));
        }
    }

    return undefined;
}

function getControllerClassName(text: string): string | undefined {
    const match = text.match(/fx:controller\s*=\s*"([^"]+)"/);
    return match ? match[1] : undefined;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
