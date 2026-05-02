import * as vscode from 'vscode';

export interface JavaClassInfo {
    document: vscode.TextDocument;
    uri: vscode.Uri;
}

export async function findJavaClass(className: string, token: vscode.CancellationToken): Promise<JavaClassInfo | undefined> {
    if (token.isCancellationRequested) {
        return undefined;
    }

    const files = className.includes('.')
        ? await vscode.workspace.findFiles(`**/${className.replace(/\./g, '/')}.java`, '**/node_modules/**')
        : await vscode.workspace.findFiles(`**/${className}.java`, '**/node_modules/**');

    if (token.isCancellationRequested || files.length === 0) {
        return undefined;
    }

    const document = await vscode.workspace.openTextDocument(files[0]);
    if (token.isCancellationRequested) {
        return undefined;
    }

    return { document, uri: files[0] };
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

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
