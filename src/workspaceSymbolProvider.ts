import * as path from 'path';
import * as vscode from 'vscode';
import { getFullyQualifiedClassName } from './javaControllerResolver';

const FXML_GLOB = '**/*.fxml';
const JAVA_GLOB = '**/*.java';
const EXCLUDE_GLOB = '**/node_modules/**';
const MAX_ANNOTATION_LOOKAHEAD = 3;
// Capture group 1 is the element name, group 2 is the quote character, and
// capture group 3 is the fx:id value.
const FXML_FX_ID_PATTERN = /<([A-Za-z_][\w:.-]*)\b[^>]*\bfx:id\s*=\s*(["'])([^"']+)\2/gs;

export class WorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider<vscode.SymbolInformation> {
    async provideWorkspaceSymbols(
        query: string,
        token: vscode.CancellationToken
    ): Promise<vscode.SymbolInformation[]> {
        const normalizedQuery = query.trim().toLowerCase();
        if (token.isCancellationRequested || normalizedQuery.length === 0) {
            return [];
        }

        const [fxmlUris, javaUris] = await Promise.all([
            vscode.workspace.findFiles(FXML_GLOB, EXCLUDE_GLOB),
            vscode.workspace.findFiles(JAVA_GLOB, EXCLUDE_GLOB),
        ]);

        if (token.isCancellationRequested) {
            return [];
        }

        const [fxmlSymbols, javaSymbols] = await Promise.all([
            this.collectFxmlSymbols(fxmlUris, normalizedQuery, token),
            this.collectJavaSymbols(javaUris, normalizedQuery, token),
        ]);

        return [...fxmlSymbols, ...javaSymbols];
    }

    private async collectFxmlSymbols(
        uris: readonly vscode.Uri[],
        query: string,
        token: vscode.CancellationToken
    ): Promise<vscode.SymbolInformation[]> {
        const symbols: vscode.SymbolInformation[] = [];

        for (const uri of uris) {
            if (token.isCancellationRequested) {
                return [];
            }

            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            FXML_FX_ID_PATTERN.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = FXML_FX_ID_PATTERN.exec(text)) !== null) {
                if (token.isCancellationRequested) {
                    return [];
                }

                const fxId = match[3];
                if (!this.matchesQuery(fxId, query)) {
                    continue;
                }

                const quotedValueOffset = match[0].indexOf(`${match[2]}${fxId}${match[2]}`);
                if (quotedValueOffset < 0) {
                    continue;
                }

                const valueOffset = match.index + quotedValueOffset + match[2].length;
                const range = new vscode.Range(
                    document.positionAt(valueOffset),
                    document.positionAt(valueOffset + fxId.length)
                );

                symbols.push(new vscode.SymbolInformation(
                    fxId,
                    vscode.SymbolKind.Variable,
                    match[1],
                    new vscode.Location(uri, range)
                ));
            }
        }

        return symbols;
    }

    private async collectJavaSymbols(
        uris: readonly vscode.Uri[],
        query: string,
        token: vscode.CancellationToken
    ): Promise<vscode.SymbolInformation[]> {
        const symbols: vscode.SymbolInformation[] = [];

        for (const uri of uris) {
            if (token.isCancellationRequested) {
                return [];
            }

            const document = await vscode.workspace.openTextDocument(uri);
            const containerName = (getFullyQualifiedClassName(document) ?? path.basename(uri.fsPath)) || 'Java';

            for (let i = 0; i < document.lineCount; i++) {
                if (token.isCancellationRequested) {
                    return [];
                }

                const lineText = document.lineAt(i).text;
                if (!lineText.includes('@FXML')) {
                    continue;
                }

                const sameLineField = this.extractFieldDeclaration(lineText);
                if (sameLineField) {
                    this.addJavaFieldSymbol(symbols, uri, containerName, i, sameLineField, query);
                    continue;
                }

                for (let j = i + 1; j < document.lineCount && j <= i + MAX_ANNOTATION_LOOKAHEAD; j++) {
                    if (token.isCancellationRequested) {
                        return [];
                    }

                    const candidateLine = document.lineAt(j).text;
                    const trimmedCandidateLine = candidateLine.trim();
                    if (trimmedCandidateLine === '') {
                        continue;
                    }
                    if (trimmedCandidateLine.startsWith('@')) {
                        continue;
                    }

                    const fieldDeclaration = this.extractFieldDeclaration(candidateLine);
                    if (fieldDeclaration) {
                        this.addJavaFieldSymbol(symbols, uri, containerName, j, fieldDeclaration, query);
                    }
                    break;
                }
            }
        }

        return symbols;
    }

    private addJavaFieldSymbol(
        symbols: vscode.SymbolInformation[],
        uri: vscode.Uri,
        containerName: string,
        lineNumber: number,
        fieldDeclaration: { name: string; startCharacter: number },
        query: string
    ): void {
        const { name: fieldName, startCharacter } = fieldDeclaration;
        if (!this.matchesQuery(fieldName, query)) {
            return;
        }

        const range = new vscode.Range(
            new vscode.Position(lineNumber, startCharacter),
            new vscode.Position(lineNumber, startCharacter + fieldName.length)
        );

        symbols.push(new vscode.SymbolInformation(
            fieldName,
            vscode.SymbolKind.Field,
            containerName,
            new vscode.Location(uri, range)
        ));
    }

    private extractFieldDeclaration(line: string): { name: string; startCharacter: number } | undefined {
        const terminatorIndex = line.search(/[;=]/);
        if (terminatorIndex < 0) {
            return undefined;
        }

        const declarationPrefix = line.slice(0, terminatorIndex);
        const fieldMatch = /([A-Za-z_$][\w$]*)\s*$/.exec(declarationPrefix);
        if (!fieldMatch || fieldMatch.index === undefined) {
            return undefined;
        }

        return {
            name: fieldMatch[1],
            startCharacter: fieldMatch.index,
        };
    }

    private matchesQuery(name: string, query: string): boolean {
        return name.toLowerCase().includes(query);
    }
}
