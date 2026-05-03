import * as vscode from 'vscode';
import { CSS_GLOB, EXCLUDE_GLOB, FXML_GLOB } from '../core/constants';
import { processInBatches } from '../core/utils';

const CLASS_SCAN_BATCH_SIZE = 20;
const STYLE_CLASS_NAME_PATTERN = '[A-Za-z_][A-Za-z0-9_-]*';
const CSS_CLASS_SELECTOR_PATTERN = new RegExp(`(^|[^A-Za-z0-9_-])\\.(${STYLE_CLASS_NAME_PATTERN})`, 'gm');
const STYLE_CLASS_ATTRIBUTE_PATTERN = /\bstyleClass\s*=\s*(["'])([^"']*)\1/gm;
const STYLE_CLASS_TOKEN_PATTERN = new RegExp(STYLE_CLASS_NAME_PATTERN, 'g');
const WHITESPACE_PATTERN = /\s/;
const IGNORED_STYLE_CLASS_DIRECTORY_SEGMENTS = new Set([
    'bin',
    'build',
    'node_modules',
    'out',
    'target',
]);

export interface StyleClassMatch {
    readonly className: string;
    readonly range: vscode.Range;
}

export interface StyleClassCompletionContext {
    readonly prefix: string;
    readonly range: vscode.Range;
}

export function getStyleClassAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): StyleClassMatch | undefined {
    const lineText = document.lineAt(position.line).text;
    STYLE_CLASS_ATTRIBUTE_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = STYLE_CLASS_ATTRIBUTE_PATTERN.exec(lineText)) !== null) {
        const value = match[2];
        const valueStart = match.index + match[0].indexOf(match[1]) + match[1].length;
        const relativeOffset = position.character - valueStart;
        if (relativeOffset < 0 || relativeOffset > value.length) {
            continue;
        }

        const tokenRange = getStyleClassTokenRange(value, relativeOffset);
        if (!tokenRange) {
            return undefined;
        }

        return {
            className: value.slice(tokenRange.start, tokenRange.end),
            range: new vscode.Range(
                position.line,
                valueStart + tokenRange.start,
                position.line,
                valueStart + tokenRange.end
            ),
        };
    }

    return undefined;
}

export function getStyleClassCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position
): StyleClassCompletionContext | undefined {
    const lineText = document.lineAt(position.line).text;
    STYLE_CLASS_ATTRIBUTE_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = STYLE_CLASS_ATTRIBUTE_PATTERN.exec(lineText)) !== null) {
        const value = match[2];
        const valueStart = match.index + match[0].indexOf(match[1]) + match[1].length;
        const relativeOffset = position.character - valueStart;
        if (relativeOffset < 0 || relativeOffset > value.length) {
            continue;
        }

        const tokenRange = getStyleClassTokenRange(value, relativeOffset) ?? { start: relativeOffset, end: relativeOffset };
        return {
            prefix: value.slice(tokenRange.start, relativeOffset),
            range: new vscode.Range(
                position.line,
                valueStart + tokenRange.start,
                position.line,
                valueStart + tokenRange.end
            ),
        };
    }

    return undefined;
}

export function getCssClassAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): StyleClassMatch | undefined {
    const lineText = document.lineAt(position.line).text;
    CSS_CLASS_SELECTOR_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = CSS_CLASS_SELECTOR_PATTERN.exec(lineText)) !== null) {
        const className = match[2];
        const classStart = match.index + match[1].length + 1;
        const dotStart = classStart - 1;
        const classEnd = classStart + className.length;
        if (position.character < dotStart || position.character > classEnd) {
            continue;
        }

        return {
            className,
            range: new vscode.Range(position.line, classStart, position.line, classEnd),
        };
    }

    return undefined;
}

export async function findWorkspaceCssClassDefinitions(
    className: string,
    token: vscode.CancellationToken
): Promise<vscode.Location[]> {
    return findWorkspaceLocations(
        CSS_GLOB,
        document => collectCssClassDefinitions(document, className),
        token
    );
}

export async function findWorkspaceFxmlStyleClassReferences(
    className: string,
    token: vscode.CancellationToken
): Promise<vscode.Location[]> {
    return findWorkspaceLocations(
        FXML_GLOB,
        document => collectFxmlStyleClassReferences(document, className),
        token
    );
}

export async function getWorkspaceCssClassNames(
    token: vscode.CancellationToken
): Promise<readonly string[]> {
    const classNames = new Set<string>();
    const uris = (await vscode.workspace.findFiles(CSS_GLOB, EXCLUDE_GLOB))
        .filter(uri => !isIgnoredStyleClassUri(uri));

    await processInBatches(uris, CLASS_SCAN_BATCH_SIZE, async uri => {
        if (token.isCancellationRequested) {
            return;
        }

        const document = await vscode.workspace.openTextDocument(uri);
        for (const className of collectCssClassNames(document)) {
            if (token.isCancellationRequested) {
                return;
            }

            classNames.add(className);
        }
    });

    return Array.from(classNames).sort((left, right) => left.localeCompare(right));
}

function getStyleClassTokenRange(
    value: string,
    relativeOffset: number
): { start: number; end: number } | undefined {
    let start = relativeOffset;
    while (start > 0 && !WHITESPACE_PATTERN.test(value[start - 1])) {
        start--;
    }

    let end = relativeOffset;
    while (end < value.length && !WHITESPACE_PATTERN.test(value[end])) {
        end++;
    }

    return start === end ? undefined : { start, end };
}

function collectCssClassDefinitions(
    document: vscode.TextDocument,
    className?: string
): vscode.Location[] {
    const text = document.getText();
    const locations: vscode.Location[] = [];
    CSS_CLASS_SELECTOR_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = CSS_CLASS_SELECTOR_PATTERN.exec(text)) !== null) {
        if (className && match[2] !== className) {
            continue;
        }

        const startOffset = match.index + match[1].length + 1;
        const endOffset = startOffset + match[2].length;
        locations.push(new vscode.Location(
            document.uri,
            new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset))
        ));
    }

    return locations;
}

function collectCssClassNames(document: vscode.TextDocument): string[] {
    const text = document.getText();
    const classNames = new Set<string>();
    CSS_CLASS_SELECTOR_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = CSS_CLASS_SELECTOR_PATTERN.exec(text)) !== null) {
        classNames.add(match[2]);
    }

    return Array.from(classNames);
}

function collectFxmlStyleClassReferences(
    document: vscode.TextDocument,
    className: string
): vscode.Location[] {
    const text = document.getText();
    const locations: vscode.Location[] = [];
    STYLE_CLASS_ATTRIBUTE_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = STYLE_CLASS_ATTRIBUTE_PATTERN.exec(text)) !== null) {
        const value = match[2];
        const valueStartOffset = match.index + match[0].indexOf(match[1]) + match[1].length;
        STYLE_CLASS_TOKEN_PATTERN.lastIndex = 0;

        let classMatch: RegExpExecArray | null;
        while ((classMatch = STYLE_CLASS_TOKEN_PATTERN.exec(value)) !== null) {
            if (classMatch[0] !== className) {
                continue;
            }

            const startOffset = valueStartOffset + classMatch.index;
            const endOffset = startOffset + classMatch[0].length;
            locations.push(new vscode.Location(
                document.uri,
                new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset))
            ));
        }
    }

    return locations;
}

async function findWorkspaceLocations(
    glob: string,
    collectLocations: (document: vscode.TextDocument) => vscode.Location[],
    token: vscode.CancellationToken
): Promise<vscode.Location[]> {
    if (token.isCancellationRequested) {
        return [];
    }

    const uris = (await vscode.workspace.findFiles(glob, EXCLUDE_GLOB))
        .filter(uri => !isIgnoredStyleClassUri(uri));
    const locations: vscode.Location[] = [];

    await processInBatches(uris, CLASS_SCAN_BATCH_SIZE, async uri => {
        if (token.isCancellationRequested) {
            return;
        }

        const document = await vscode.workspace.openTextDocument(uri);
        locations.push(...collectLocations(document));
    });

    return token.isCancellationRequested ? [] : locations;
}

function isIgnoredStyleClassUri(uri: vscode.Uri): boolean {
    if (uri.scheme !== 'file') {
        return true;
    }

    const segments = uri.fsPath.split(/[\\/]+/);
    return segments.some(segment => IGNORED_STYLE_CLASS_DIRECTORY_SEGMENTS.has(segment));
}
