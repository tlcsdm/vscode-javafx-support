import * as vscode from 'vscode';
import { getFullyQualifiedClassName } from './javaControllerResolver';

const FXML_GLOB = '**/*.fxml';
const JAVA_GLOB = '**/*.java';
const EXCLUDE_GLOB = '**/node_modules/**';

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
            const pattern = /<([A-Za-z_][\w:.-]*)\b[^>]*\bfx:id\s*=\s*(["'])([^"']+)\2/gs;

            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                if (token.isCancellationRequested) {
                    return [];
                }

                const fxId = match[3];
                if (!this.matchesQuery(fxId, query)) {
                    continue;
                }

                const valueOffset = match.index + match[0].lastIndexOf(fxId);
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
            const containerName = getFullyQualifiedClassName(document) ?? uri.path.split('/').pop() ?? 'Java';

            for (let i = 0; i < document.lineCount; i++) {
                if (token.isCancellationRequested) {
                    return [];
                }

                const lineText = document.lineAt(i).text;
                if (!lineText.includes('@FXML')) {
                    continue;
                }

                const sameLineField = this.extractFieldName(lineText);
                if (sameLineField) {
                    this.addJavaFieldSymbol(symbols, document, uri, containerName, i, sameLineField, query);
                    continue;
                }

                for (let j = i + 1; j < document.lineCount && j <= i + 3; j++) {
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

                    const fieldName = this.extractFieldName(candidateLine);
                    if (fieldName) {
                        this.addJavaFieldSymbol(symbols, document, uri, containerName, j, fieldName, query);
                    }
                    break;
                }
            }
        }

        return symbols;
    }

    private addJavaFieldSymbol(
        symbols: vscode.SymbolInformation[],
        document: vscode.TextDocument,
        uri: vscode.Uri,
        containerName: string,
        lineNumber: number,
        fieldName: string,
        query: string
    ): void {
        if (!this.matchesQuery(fieldName, query)) {
            return;
        }

        const lineText = document.lineAt(lineNumber).text;
        const startCharacter = lineText.lastIndexOf(fieldName);
        if (startCharacter < 0) {
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

    private extractFieldName(line: string): string | undefined {
        const declaration = line.split('//', 1)[0];
        if (declaration.includes('(')) {
            return undefined;
        }

        const terminatorIndex = declaration.search(/[;=,]/);
        if (terminatorIndex < 0) {
            return undefined;
        }

        let fieldName: string | undefined;
        for (const match of declaration.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
            if (match.index !== undefined && match.index < terminatorIndex) {
                fieldName = match[0];
            }
        }

        return fieldName;
    }

    private matchesQuery(name: string, query: string): boolean {
        return name.toLowerCase().includes(query);
    }
}
