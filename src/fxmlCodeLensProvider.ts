import * as vscode from 'vscode';

/**
 * Provides CodeLens for @FXML annotated fields and methods in Java controller classes.
 * Each CodeLens provides a clickable "Go to FXML" link that navigates to the
 * corresponding element in the associated FXML file.
 */
export class FxmlCodeLensProvider implements vscode.CodeLensProvider {
    async provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
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
            const lineText = document.lineAt(i).text;

            if (lineText.trim().startsWith('@FXML')) {
                // Find the next non-annotation, non-empty line (the actual member declaration)
                let memberLine = -1;
                for (let j = i + 1; j < document.lineCount && j <= i + 3; j++) {
                    const nextLine = document.lineAt(j).text.trim();
                    if (nextLine !== '' && !nextLine.startsWith('@')) {
                        memberLine = j;
                        break;
                    }
                }

                if (memberLine >= 0) {
                    const memberLineText = document.lineAt(memberLine).text;
                    const memberName = this.extractMemberName(memberLineText);
                    const isMethod = memberName ? this.isMethodDeclaration(memberLineText, memberName) : false;

                    if (memberName) {
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
    const fxmlFiles = await vscode.workspace.findFiles('**/*.fxml', '**/node_modules/**');

    for (const fxmlUri of fxmlFiles) {
        const document = await vscode.workspace.openTextDocument(fxmlUri);
        const text = document.getText();

        if (!text.includes(`fx:controller="${controllerClassName}"`)) {
            continue;
        }

        let targetLine = -1;
        let targetChar = 0;

        if (isMethod) {
            const pattern = new RegExp(`=\\s*"#${escapeRegex(memberName)}"`);
            for (let i = 0; i < document.lineCount; i++) {
                const match = pattern.exec(document.lineAt(i).text);
                if (match) {
                    targetLine = i;
                    targetChar = match.index + 2;
                    break;
                }
            }
        } else {
            const pattern = new RegExp(`fx:id="${escapeRegex(memberName)}"`);
            for (let i = 0; i < document.lineCount; i++) {
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
            await vscode.window.showTextDocument(document, {
                selection: new vscode.Range(position, position),
                preserveFocus: false
            });
            return;
        }
    }

    vscode.window.showInformationMessage(`No FXML reference found for '${memberName}'.`);
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
