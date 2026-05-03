import * as vscode from 'vscode';

export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getMethodDeclarationMatch(line: string, methodName: string): RegExpExecArray | undefined {
    const methodPattern = new RegExp(`\\b${escapeRegex(methodName)}\\s*\\(`);
    const methodMatch = methodPattern.exec(line);
    if (!methodMatch) {
        return undefined;
    }

    const prefix = line.slice(0, methodMatch.index).trimEnd();
    if (!isValidMemberDeclarationPrefix(prefix)) {
        return undefined;
    }

    const lastPrefixChar = prefix.trimEnd().at(-1);
    return isValidMethodPrefixTerminator(lastPrefixChar)
        ? methodMatch
        : undefined;
}

export function getFieldDeclarationMatch(line: string, fieldName: string): RegExpExecArray | undefined {
    const fieldPattern = new RegExp(`\\b${escapeRegex(fieldName)}\\b\\s*(?=[;=,)])`);
    const fieldMatch = fieldPattern.exec(line);
    if (!fieldMatch) {
        return undefined;
    }

    const prefix = line.slice(0, fieldMatch.index).trim();
    return isValidMemberDeclarationPrefix(prefix) ? fieldMatch : undefined;
}

export function isValidMemberDeclarationPrefix(prefix: string): boolean {
    if (!prefix || prefix.endsWith('.') || /[(){};]/.test(prefix)) {
        return false;
    }

    return !/\b(?:if|for|while|switch|catch|new|return|throw)\b/.test(prefix);
}

export function isValidMethodPrefixTerminator(character: string | undefined): boolean {
    return !!character && (/\w/.test(character) || character === '>' || character === ']');
}

export function findControllerInDocument(document: vscode.TextDocument): string | undefined {
    const match = document.getText().match(/fx:controller\s*=\s*"([^"]+)"/);
    return match ? match[1] : undefined;
}

export function isFxmlDocument(document: vscode.TextDocument): boolean {
    return document.uri.scheme === 'file' && document.fileName.endsWith('.fxml');
}

export function isJavaDocument(document: vscode.TextDocument): boolean {
    return document.uri.scheme === 'file' && document.fileName.endsWith('.java');
}

export async function processInBatches<T>(
    items: readonly T[],
    batchSize: number,
    fn: (item: T) => Promise<void>
): Promise<void> {
    for (let index = 0; index < items.length; index += batchSize) {
        await Promise.all(items.slice(index, index + batchSize).map(item => fn(item)));
    }
}
