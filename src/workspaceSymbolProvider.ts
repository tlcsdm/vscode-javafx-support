import * as path from 'path';
import * as vscode from 'vscode';
import { getFullyQualifiedClassName } from './javaControllerResolver';

const FXML_GLOB = '**/*.fxml';
const JAVA_GLOB = '**/*.java';
const EXCLUDE_GLOB = '**/node_modules/**';
const IGNORED_WORKSPACE_SYMBOL_DIRECTORY_SEGMENTS = new Set([
    'bin',
    'build',
    'node_modules',
    'out',
    'target',
]);
const MAX_ANNOTATION_LOOKAHEAD = 3;
// Capture group 1 is the element name, group 2 is the quote character, and
// capture group 3 is the fx:id value.
const FXML_FX_ID_PATTERN = /<([A-Za-z_][\w:.-]*)\b[^>]*\bfx:id\s*=\s*(["'])([^"']+)\2/gs;

type CachedWorkspaceSymbol = {
    normalizedName: string;
    symbol: vscode.SymbolInformation;
};

export class WorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider<vscode.SymbolInformation>, vscode.Disposable {
    private readonly fxmlSymbols = new Map<string, CachedWorkspaceSymbol[]>();
    private readonly javaSymbols = new Map<string, CachedWorkspaceSymbol[]>();
    private readonly disposable: vscode.Disposable;

    constructor() {
        const fxmlWatcher = vscode.workspace.createFileSystemWatcher(FXML_GLOB);
        const javaWatcher = vscode.workspace.createFileSystemWatcher(JAVA_GLOB);

        this.disposable = vscode.Disposable.from(
            fxmlWatcher,
            javaWatcher,
            fxmlWatcher.onDidCreate(uri => this.invalidateFxmlUri(uri)),
            fxmlWatcher.onDidChange(uri => this.invalidateFxmlUri(uri)),
            fxmlWatcher.onDidDelete(uri => this.invalidateFxmlUri(uri)),
            javaWatcher.onDidCreate(uri => this.invalidateJavaUri(uri)),
            javaWatcher.onDidChange(uri => this.invalidateJavaUri(uri)),
            javaWatcher.onDidDelete(uri => this.invalidateJavaUri(uri)),
            vscode.workspace.onDidChangeTextDocument(event => this.invalidateDocument(event.document)),
        );
    }

    dispose(): void {
        this.disposable.dispose();
        this.fxmlSymbols.clear();
        this.javaSymbols.clear();
    }

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

        await Promise.all([
            this.refreshFxmlSymbols(fxmlUris, token),
            this.refreshJavaSymbols(javaUris, token),
        ]);

        if (token.isCancellationRequested) {
            return [];
        }

        return [
            ...this.filterSymbols(this.fxmlSymbols, normalizedQuery),
            ...this.filterSymbols(this.javaSymbols, normalizedQuery),
        ];
    }

    private async refreshFxmlSymbols(
        uris: readonly vscode.Uri[],
        token: vscode.CancellationToken
    ): Promise<void> {
        await this.refreshSymbols(
            uris.filter(uri => !this.isIgnoredWorkspaceSymbolUri(uri)),
            this.fxmlSymbols,
            uri => this.readFxmlSymbols(uri),
            token
        );
    }

    private async refreshJavaSymbols(
        uris: readonly vscode.Uri[],
        token: vscode.CancellationToken
    ): Promise<void> {
        await this.refreshSymbols(
            uris.filter(uri => !this.isIgnoredWorkspaceSymbolUri(uri)),
            this.javaSymbols,
            uri => this.readJavaSymbols(uri),
            token
        );
    }

    private async refreshSymbols(
        uris: readonly vscode.Uri[],
        cache: Map<string, CachedWorkspaceSymbol[]>,
        collectSymbols: (uri: vscode.Uri) => Promise<CachedWorkspaceSymbol[]>,
        token: vscode.CancellationToken
    ): Promise<void> {
        const activeKeys = new Set(uris.map(uri => uri.toString()));

        for (const key of cache.keys()) {
            if (!activeKeys.has(key)) {
                cache.delete(key);
            }
        }

        for (const uri of uris) {
            if (token.isCancellationRequested) {
                return;
            }

            const key = uri.toString();
            if (cache.has(key)) {
                continue;
            }

            cache.set(key, await collectSymbols(uri));
        }
    }

    private async readFxmlSymbols(uri: vscode.Uri): Promise<CachedWorkspaceSymbol[]> {
        const document = await vscode.workspace.openTextDocument(uri);
        const text = document.getText();
        const symbols: CachedWorkspaceSymbol[] = [];
        FXML_FX_ID_PATTERN.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = FXML_FX_ID_PATTERN.exec(text)) !== null) {
            const fxId = match[3];
            const quotedValueOffset = match[0].indexOf(`${match[2]}${fxId}${match[2]}`);
            if (quotedValueOffset < 0) {
                continue;
            }

            const valueOffset = match.index + quotedValueOffset + match[2].length;
            const range = new vscode.Range(
                document.positionAt(valueOffset),
                document.positionAt(valueOffset + fxId.length)
            );

            symbols.push(this.toCachedSymbol(
                fxId,
                new vscode.SymbolInformation(
                    fxId,
                    vscode.SymbolKind.Variable,
                    match[1],
                    new vscode.Location(uri, range)
                )
            ));
        }

        return symbols;
    }

    private async readJavaSymbols(uri: vscode.Uri): Promise<CachedWorkspaceSymbol[]> {
        const document = await vscode.workspace.openTextDocument(uri);
        const containerName = (getFullyQualifiedClassName(document) ?? path.basename(uri.fsPath)) || 'Java';
        const symbols: CachedWorkspaceSymbol[] = [];

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (!lineText.includes('@FXML')) {
                continue;
            }

            const sameLineField = this.extractFieldDeclaration(lineText);
            if (sameLineField) {
                this.addJavaFieldSymbol(symbols, uri, containerName, i, sameLineField);
                continue;
            }

            for (let j = i + 1; j < document.lineCount && j <= i + MAX_ANNOTATION_LOOKAHEAD; j++) {
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
                    this.addJavaFieldSymbol(symbols, uri, containerName, j, fieldDeclaration);
                }
                break;
            }
        }

        return symbols;
    }

    private filterSymbols(
        cache: ReadonlyMap<string, readonly CachedWorkspaceSymbol[]>,
        query: string
    ): vscode.SymbolInformation[] {
        const matches: vscode.SymbolInformation[] = [];

        for (const symbols of cache.values()) {
            for (const entry of symbols) {
                if (entry.normalizedName.includes(query)) {
                    matches.push(entry.symbol);
                }
            }
        }

        return matches;
    }

    private addJavaFieldSymbol(
        symbols: CachedWorkspaceSymbol[],
        uri: vscode.Uri,
        containerName: string,
        lineNumber: number,
        fieldDeclaration: { name: string; startCharacter: number }
    ): void {
        const { name: fieldName, startCharacter } = fieldDeclaration;
        const range = new vscode.Range(
            new vscode.Position(lineNumber, startCharacter),
            new vscode.Position(lineNumber, startCharacter + fieldName.length)
        );

        symbols.push(this.toCachedSymbol(
            fieldName,
            new vscode.SymbolInformation(
                fieldName,
                vscode.SymbolKind.Field,
                containerName,
                new vscode.Location(uri, range)
            )
        ));
    }

    private toCachedSymbol(name: string, symbol: vscode.SymbolInformation): CachedWorkspaceSymbol {
        return {
            normalizedName: name.toLowerCase(),
            symbol,
        };
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

    private invalidateDocument(document: vscode.TextDocument): void {
        if (this.isFxmlDocument(document)) {
            this.invalidateFxmlUri(document.uri);
            return;
        }

        if (this.isJavaDocument(document)) {
            this.invalidateJavaUri(document.uri);
        }
    }

    private invalidateFxmlUri(uri: vscode.Uri): void {
        this.fxmlSymbols.delete(uri.toString());
    }

    private invalidateJavaUri(uri: vscode.Uri): void {
        this.javaSymbols.delete(uri.toString());
    }

    private isFxmlDocument(document: vscode.TextDocument): boolean {
        return document.uri.scheme === 'file' && document.fileName.endsWith('.fxml');
    }

    private isJavaDocument(document: vscode.TextDocument): boolean {
        return document.uri.scheme === 'file' && document.fileName.endsWith('.java');
    }

    private isIgnoredWorkspaceSymbolUri(uri: vscode.Uri): boolean {
        const normalizedPath = `${path.sep}${path.normalize(uri.fsPath).toLowerCase()}${path.sep}`;
        for (const segment of IGNORED_WORKSPACE_SYMBOL_DIRECTORY_SEGMENTS) {
            if (normalizedPath.includes(`${path.sep}${segment}${path.sep}`)) {
                return true;
            }
        }

        return false;
    }
}
