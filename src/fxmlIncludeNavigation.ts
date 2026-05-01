import * as path from 'path';
import * as vscode from 'vscode';

export function findIncludeSources(text: string): string[] {
    const sources: string[] = [];
    const pattern = /<\s*fx:include\b[^>]*\bsource\s*=\s*(?:"([^"]+)"|'([^']+)')/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        sources.push(match[1] ?? match[2]);
    }

    return sources;
}

export function findControllerInFxmlText(text: string): string | undefined {
    const match = text.match(/fx:controller\s*=\s*(?:"([^"]+)"|'([^']+)')/);
    return match ? (match[1] ?? match[2]) : undefined;
}

function resolveIncludeUri(baseUri: vscode.Uri, source: string): vscode.Uri {
    const normalizedSource = source.replace(/\\/g, '/');
    return vscode.Uri.file(path.resolve(path.dirname(baseUri.fsPath), normalizedSource));
}

function normalizeFsPath(fsPath: string): string {
    return path.normalize(fsPath);
}

export async function findMemberInFxmlWithIncludes(
    document: vscode.TextDocument,
    uri: vscode.Uri,
    memberName: string,
    isMethod: boolean,
    visited: Set<string> = new Set<string>()
): Promise<vscode.Location | undefined> {
    const currentKey = normalizeFsPath(uri.fsPath);
    if (visited.has(currentKey)) {
        return undefined;
    }
    visited.add(currentKey);

    const localLocation = isMethod
        ? findEventHandlerInFxml(document, uri, memberName)
        : findFxIdInFxml(document, uri, memberName);
    if (localLocation) {
        return localLocation;
    }

    const includeSources = findIncludeSources(document.getText());
    for (const source of includeSources) {
        const includeUri = resolveIncludeUri(uri, source);
        try {
            const includeDocument = await vscode.workspace.openTextDocument(includeUri);
            const includeLocation = await findMemberInFxmlWithIncludes(includeDocument, includeUri, memberName, isMethod, visited);
            if (includeLocation) {
                return includeLocation;
            }
        } catch {
            // Ignore invalid includes and continue searching other include chains
        }
    }

    return undefined;
}

export async function findControllerForFxmlDocument(document: vscode.TextDocument): Promise<string | undefined> {
    const localController = findControllerInFxmlText(document.getText());
    if (localController) {
        return localController;
    }

    const allFxmlUris = await vscode.workspace.findFiles('**/*.fxml', '**/node_modules/**');
    const targetPath = normalizeFsPath(document.uri.fsPath);
    const visitedParents = new Set<string>([targetPath]);
    return findControllerInIncludingParents(targetPath, allFxmlUris, visitedParents);
}

async function findControllerInIncludingParents(
    targetPath: string,
    allFxmlUris: vscode.Uri[],
    visitedParents: Set<string>
): Promise<string | undefined> {
    for (const uri of allFxmlUris) {
        const parentPath = normalizeFsPath(uri.fsPath);
        if (visitedParents.has(parentPath)) {
            continue;
        }

        let parentDocument: vscode.TextDocument;
        try {
            parentDocument = await vscode.workspace.openTextDocument(uri);
        } catch {
            continue;
        }

        const includesTarget = findIncludeSources(parentDocument.getText())
            .some((source) => normalizeFsPath(resolveIncludeUri(uri, source).fsPath) === targetPath);
        if (!includesTarget) {
            continue;
        }

        const controller = findControllerInFxmlText(parentDocument.getText());
        if (controller) {
            return controller;
        }

        visitedParents.add(parentPath);
        const controllerInParent = await findControllerInIncludingParents(parentPath, allFxmlUris, visitedParents);
        if (controllerInParent) {
            return controllerInParent;
        }
    }

    return undefined;
}

function findEventHandlerInFxml(
    document: vscode.TextDocument,
    uri: vscode.Uri,
    methodName: string
): vscode.Location | undefined {
    const pattern = new RegExp(`\\bon\\w+\\s*=\\s*(?:"#${escapeRegex(methodName)}"|'#${escapeRegex(methodName)}')`);

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        const match = pattern.exec(lineText);
        if (match) {
            const methodNameStart = match.index + match[0].indexOf('#') + 1;
            return new vscode.Location(uri, new vscode.Position(i, methodNameStart));
        }
    }

    return undefined;
}

function findFxIdInFxml(
    document: vscode.TextDocument,
    uri: vscode.Uri,
    fieldName: string
): vscode.Location | undefined {
    const pattern = new RegExp(`fx:id\\s*=\\s*(?:"${escapeRegex(fieldName)}"|'${escapeRegex(fieldName)}')`);

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        const match = pattern.exec(lineText);
        if (match) {
            return new vscode.Location(uri, new vscode.Position(i, match.index));
        }
    }

    return undefined;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
