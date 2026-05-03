import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { resetJavaClassCacheForTests } from '../java/javaControllerResolver';
import { resetWorkspaceSymbolProvidersForTests } from '../java/workspaceSymbolProvider';

export const FXML_CONTROLLER_DIAGNOSTICS_TEMP_PREFIX = 'fxml-controller-diagnostics-';
export const FXML_CONTROLLER_REFRESH_TEMP_PREFIX = 'fxml-controller-refresh-';
export const FXML_CONTROLLER_CACHE_TEMP_PREFIX = 'fxml-controller-cache-';
export const EXPECTED_JAVAFX_CSS_PROPERTY_COUNT = 188;

export function suiteWithResets(name: string, registerTests: () => void): void {
    suite(name, () => {
        vscode.window.showInformationMessage(`Start ${name} tests.`);

        setup(() => {
            resetJavaClassCacheForTests();
            resetWorkspaceSymbolProvidersForTests();
        });

        teardown(() => {
            resetJavaClassCacheForTests();
            resetWorkspaceSymbolProvidersForTests();
        });

        registerTests();
    });
}

export function createMockDocument(text: string, languageId: string, fileName: string): vscode.TextDocument {
    const lines = text.split(/\r?\n/);
    const contentUri = vscode.Uri.parse(`untitled:${fileName}`);
    const lineStartOffsets: number[] = [];
    let runningOffset = 0;
    for (const line of lines) {
        lineStartOffsets.push(runningOffset);
        runningOffset += line.length + 1;
    }

    const buildTextLine = (line: number): vscode.TextLine => {
        const safeLine = Math.max(0, Math.min(line, lines.length - 1));
        const lineText = lines[safeLine] ?? '';
        const start = new vscode.Position(safeLine, 0);
        const end = new vscode.Position(safeLine, lineText.length);

        return {
            lineNumber: safeLine,
            text: lineText,
            range: new vscode.Range(start, end),
            rangeIncludingLineBreak: new vscode.Range(start, new vscode.Position(safeLine, lineText.length + 1)),
            firstNonWhitespaceCharacterIndex: lineText.search(/\S|$/),
            isEmptyOrWhitespace: /^\s*$/.test(lineText),
        };
    };

    return {
        uri: contentUri,
        languageId,
        version: 1,
        lineCount: lines.length,
        getText: () => text,
        lineAt: (lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return buildTextLine(line);
        },
        positionAt: (offset: number) => {
            const normalizedOffset = Math.max(0, Math.min(offset, text.length));
            const before = text.slice(0, normalizedOffset);
            const parts = before.split(/\r?\n/);
            return new vscode.Position(parts.length - 1, parts[parts.length - 1].length);
        },
        offsetAt: (position: vscode.Position) => {
            const safeLine = Math.max(0, Math.min(position.line, lines.length - 1));
            const lineOffset = lineStartOffsets[safeLine] ?? 0;
            return lineOffset + Math.max(0, Math.min(position.character, lines[safeLine].length));
        },
    } as unknown as vscode.TextDocument;
}

export function createMockFxmlDocument(text: string): vscode.TextDocument {
    return createMockDocument(text, 'fxml', 'test.fxml');
}

export function createMockCssDocument(text: string): vscode.TextDocument {
    return createMockDocument(text, 'css', 'test.css');
}

// Normalize provider results so tests can assert items from either arrays or CompletionList objects.
export function getCompletionItems(
    completions: vscode.CompletionItem[] | vscode.CompletionList | null | undefined
): vscode.CompletionItem[] {
    assert.ok(completions);
    return Array.isArray(completions) ? completions : completions.items;
}

// Completion labels can be plain strings or CompletionItemLabel objects depending on the provider.
export function getCompletionLabel(item: vscode.CompletionItem): string {
    return typeof item.label === 'string' ? item.label : item.label.label;
}

export function createCancelledToken(): vscode.CancellationToken {
    const source = new vscode.CancellationTokenSource();
    source.cancel();
    return source.token;
}

export async function waitForDiagnostics(
    uri: vscode.Uri,
    predicate: (diagnostics: readonly vscode.Diagnostic[]) => boolean,
    timeoutMs = 5000
): Promise<readonly vscode.Diagnostic[]> {
    const deadline = Date.now() + timeoutMs;
    let diagnostics = vscode.languages.getDiagnostics(uri);

    while (!predicate(diagnostics)) {
        if (Date.now() >= deadline) {
            assert.fail(`Timed out waiting for diagnostics. Last diagnostics: ${diagnostics.map(diagnostic => diagnostic.message).join(', ')}`);
        }

        await new Promise(resolve => setTimeout(resolve, 25));
        diagnostics = vscode.languages.getDiagnostics(uri);
    }

    return diagnostics;
}

export async function waitForCondition(
    predicate: () => Promise<boolean>,
    timeoutMs = 5000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (!await predicate()) {
        if (Date.now() >= deadline) {
            assert.fail('Timed out waiting for condition.');
        }

        await new Promise(resolve => setTimeout(resolve, 25));
    }
}

export async function withMockFindFiles(
    files: string[],
    run: () => Promise<void>,
    onFindFiles?: (pattern: string) => void
): Promise<void> {
    const workspace = vscode.workspace as unknown as { findFiles: typeof vscode.workspace.findFiles };
    const originalFindFiles = workspace.findFiles;
    workspace.findFiles = async (include: vscode.GlobPattern) => {
        const pattern = typeof include === 'string' ? include : include.pattern;
        onFindFiles?.(pattern);
        return files
            .filter(file => matchesMockGlob(file, pattern))
            .map(file => vscode.Uri.file(file));
    };
    resetJavaClassCacheForTests();
    resetWorkspaceSymbolProvidersForTests();

    try {
        await run();
    } finally {
        resetWorkspaceSymbolProvidersForTests();
        resetJavaClassCacheForTests();
        workspace.findFiles = originalFindFiles;
    }
}

export async function withMockOpenTextDocument(
    run: () => Promise<void>,
    onOpenTextDocument?: (uri: vscode.Uri) => void
): Promise<void> {
    const workspace = vscode.workspace as unknown as { openTextDocument: typeof vscode.workspace.openTextDocument };
    const originalOpenTextDocument = workspace.openTextDocument;
    const mockedOpenTextDocument = ((
        uriOrFileName: vscode.Uri | string,
        options?: { encoding?: string; language?: string }
    ) => {
        const uri = uriOrFileName instanceof vscode.Uri ? uriOrFileName : vscode.Uri.file(uriOrFileName);
        onOpenTextDocument?.(uri);
        return uriOrFileName instanceof vscode.Uri
            ? originalOpenTextDocument(uriOrFileName)
            : originalOpenTextDocument(uriOrFileName, options);
    }) as typeof vscode.workspace.openTextDocument;
    workspace.openTextDocument = mockedOpenTextDocument;

    try {
        await run();
    } finally {
        workspace.openTextDocument = originalOpenTextDocument;
    }
}

export async function withMockJavafxSupportConfiguration(
    values: Record<string, unknown>,
    run: () => Promise<void>
): Promise<void> {
    const workspace = vscode.workspace as unknown as { getConfiguration: typeof vscode.workspace.getConfiguration };
    const originalGetConfiguration = workspace.getConfiguration;
    const mockedGetConfiguration: typeof vscode.workspace.getConfiguration = (section?: string, scope?: vscode.ConfigurationScope | null) => {
        const configuration = originalGetConfiguration(section, scope);
        if (section !== 'tlcsdm.javafxSupport') {
            return configuration;
        }

        return {
            ...configuration,
            get: <T>(key: string, defaultValue?: T) => {
                if (Object.prototype.hasOwnProperty.call(values, key)) {
                    return values[key] as T;
                }

                const configuredValue = configuration.get<T>(key);
                return configuredValue === undefined ? defaultValue as T : configuredValue;
            },
        } as vscode.WorkspaceConfiguration;
    };
    workspace.getConfiguration = mockedGetConfiguration;

    try {
        await run();
    } finally {
        workspace.getConfiguration = originalGetConfiguration;
    }
}

export function assertFsPathEqual(actual: string, expected: string): void {
    assert.strictEqual(normalizeFsPath(actual), normalizeFsPath(expected));
}

export function normalizeFsPath(filePath: string): string {
    const normalized = path.normalize(filePath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function toGlobPath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

export function matchesMockGlob(filePath: string, pattern: string): boolean {
    const escapedPattern = escapeRegex(pattern)
        .replace(/\\\*\\\*/g, '.*')
        .replace(/\\\*/g, '[^/]*');

    return new RegExp(`^${escapedPattern}$`).test(toGlobPath(filePath));
}

export function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getRangeText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText();
    return text.slice(document.offsetAt(range.start), document.offsetAt(range.end));
}

export function getHoverText(hover: vscode.Hover): string {
    return hover.contents
        .map(content => decodeHoverMarkdown(typeof content === 'string' ? content : content.value))
        .join('\n');
}

export function createThrowingTextDocument(): vscode.TextDocument {
    return new Proxy({}, {
        get() {
            throw new Error('document should not be accessed after cancellation');
        },
    }) as vscode.TextDocument;
}

export function decodeHoverMarkdown(value: string): string {
    // MarkdownString.appendText encodes spaces as &nbsp; in the serialized value.
    return value.replace(/&nbsp;/g, ' ');
}
