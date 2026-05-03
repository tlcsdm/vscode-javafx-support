import * as vscode from 'vscode';
import { EXCLUDE_GLOB, JAVA_GLOB } from '../core/constants';
import { escapeRegex } from '../core/utils';

export interface JavaClassInfo {
    document: vscode.TextDocument;
    uri: vscode.Uri;
}

const javaClassUriCache = new Map<string, vscode.Uri | null>();

export async function findJavaClass(className: string, token: vscode.CancellationToken): Promise<JavaClassInfo | undefined> {
    if (token.isCancellationRequested) {
        return undefined;
    }

    // undefined = not searched yet; null = searched and known missing.
    const cachedUri = javaClassUriCache.get(className);
    if (cachedUri === null) {
        return undefined;
    }

    if (cachedUri) {
        return openJavaClassDocument(cachedUri, token);
    }

    const files = className.includes('.')
        ? await vscode.workspace.findFiles(`**/${className.replace(/\./g, '/')}.java`, EXCLUDE_GLOB)
        : await vscode.workspace.findFiles(`**/${className}.java`, EXCLUDE_GLOB);

    if (token.isCancellationRequested || files.length === 0) {
        if (!token.isCancellationRequested) {
            javaClassUriCache.set(className, null);
        }
        return undefined;
    }

    javaClassUriCache.set(className, files[0]);
    return openJavaClassDocument(files[0], token);
}

export function registerJavaClassCache(): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(JAVA_GLOB);
    return vscode.Disposable.from(
        watcher,
        watcher.onDidCreate(() => clearNegativeJavaClassCacheEntries()),
        watcher.onDidDelete(uri => clearJavaClassCacheUri(uri))
    );
}

export function resetJavaClassCacheForTests(): void {
    clearJavaClassCache();
}

export function clearJavaClassCache(): void {
    javaClassUriCache.clear();
}

async function openJavaClassDocument(uri: vscode.Uri, token: vscode.CancellationToken): Promise<JavaClassInfo | undefined> {
    let document: vscode.TextDocument;
    try {
        document = await vscode.workspace.openTextDocument(uri);
    } catch {
        clearJavaClassCacheUri(uri);
        return undefined;
    }

    if (token.isCancellationRequested) {
        return undefined;
    }

    return { document, uri };
}

function clearNegativeJavaClassCacheEntries(): void {
    for (const [className, uri] of javaClassUriCache) {
        if (uri === null) {
            javaClassUriCache.delete(className);
        }
    }
}

function clearJavaClassCacheUri(deletedUri: vscode.Uri): void {
    const deletedKey = deletedUri.toString();
    for (const [className, uri] of javaClassUriCache) {
        if (uri?.toString() === deletedKey) {
            javaClassUriCache.delete(className);
        }
    }
}

export function getFullyQualifiedClassName(document: vscode.TextDocument): string | undefined {
    const text = document.getText();
    const packageName = getPackageName(text);
    const classMatch = text.match(/\bclass\s+(\w+)/);
    if (!classMatch) {
        return undefined;
    }

    return packageName ? `${packageName}.${classMatch[1]}` : classMatch[1];
}

export function getSuperclassName(document: vscode.TextDocument): string | undefined {
    const text = document.getText();
    const superClassMatch = text.match(/\bclass\s+\w+(?:\s+[^{}]*)?\s+extends\s+([\w.]+)/);
    if (!superClassMatch) {
        return undefined;
    }

    return resolveClassName(text, superClassMatch[1]);
}

export async function classExtends(
    className: string,
    targetSuperClassName: string,
    token: vscode.CancellationToken,
    visited = new Set<string>()
): Promise<boolean> {
    if (token.isCancellationRequested || visited.has(className)) {
        return false;
    }

    visited.add(className);

    const classInfo = await findJavaClass(className, token);
    if (!classInfo) {
        return false;
    }

    const superClassName = getSuperclassName(classInfo.document);
    if (!superClassName) {
        return false;
    }

    if (superClassName === targetSuperClassName) {
        return true;
    }

    return classExtends(superClassName, targetSuperClassName, token, visited);
}

function resolveClassName(text: string, className: string): string {
    if (className.includes('.')) {
        return className;
    }

    const explicitImportMatch = new RegExp(`\\bimport\\s+([\\w.]+\\.${escapeRegex(className)})\\s*;`).exec(text);
    if (explicitImportMatch) {
        return explicitImportMatch[1];
    }

    const packageName = getPackageName(text);
    return packageName ? `${packageName}.${className}` : className;
}

function getPackageName(text: string): string {
    const packageMatch = text.match(/\bpackage\s+([\w.]+)\s*;/);
    return packageMatch ? packageMatch[1] : '';
}
