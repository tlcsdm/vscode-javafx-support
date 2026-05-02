import * as vscode from 'vscode';
import { classExtends } from './javaControllerResolver';

const FXML_GLOB = '**/*.fxml';
const FXML_EXCLUDE_GLOB = '**/node_modules/**';

type CachedFxmlEntry = {
    controllerClassName: string;
    fieldIds: ReadonlySet<string>;
    methodNames: ReadonlySet<string>;
    uri: vscode.Uri;
};

class FxmlControllerCache implements vscode.Disposable {
    private readonly entries = new Map<string, CachedFxmlEntry>();
    private readonly controllers = new Map<string, Set<string>>();
    private readonly disposable: vscode.Disposable;
    private initialScanPromise: Promise<void> | undefined;

    constructor() {
        const watcher = vscode.workspace.createFileSystemWatcher(FXML_GLOB);
        const onCreate = watcher.onDidCreate(uri => {
            void this.refresh(uri);
        });
        const onChange = watcher.onDidChange(uri => {
            void this.refresh(uri);
        });
        const onDelete = watcher.onDidDelete(uri => {
            this.remove(uri);
        });
        const onOpen = vscode.workspace.onDidOpenTextDocument(document => {
            if (this.isFxmlDocument(document)) {
                void this.refresh(document.uri, document);
            }
        });
        const onSave = vscode.workspace.onDidSaveTextDocument(document => {
            if (this.isFxmlDocument(document)) {
                void this.refresh(document.uri, document);
            }
        });

        this.disposable = vscode.Disposable.from(watcher, onCreate, onChange, onDelete, onOpen, onSave);
    }

    dispose(): void {
        this.disposable.dispose();
        this.entries.clear();
        this.controllers.clear();
        this.initialScanPromise = undefined;
    }

    async getFxmlFilesForMember(
        controllerClassName: string,
        memberName: string,
        isMethod: boolean,
        token: vscode.CancellationToken
    ): Promise<vscode.Uri[]> {
        await this.ensureInitialized();

        if (token.isCancellationRequested) {
            return [];
        }

        const candidateEntries = new Map<string, CachedFxmlEntry>();
        this.addEntries(candidateEntries, controllerClassName, memberName, isMethod);

        for (const [cachedControllerClassName, filePaths] of this.controllers) {
            if (token.isCancellationRequested) {
                return [];
            }

            if (
                cachedControllerClassName !== controllerClassName
                && this.hasMatchingEntry(filePaths, memberName, isMethod)
                && await classExtends(cachedControllerClassName, controllerClassName, token)
            ) {
                this.addMatchingEntries(candidateEntries, filePaths, memberName, isMethod);
            }
        }

        return [...candidateEntries.values()].map(entry => entry.uri);
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialScanPromise) {
            this.initialScanPromise = this.populateInitialCache();
        }

        await this.initialScanPromise;
    }

    private async populateInitialCache(): Promise<void> {
        const uris = await vscode.workspace.findFiles(FXML_GLOB, FXML_EXCLUDE_GLOB);
        await Promise.all(uris.map(uri => this.refresh(uri)));
    }

    private async refresh(uri: vscode.Uri, document?: vscode.TextDocument): Promise<void> {
        if (this.isIgnored(uri)) {
            this.remove(uri);
            return;
        }

        try {
            const currentDocument = document ?? await vscode.workspace.openTextDocument(uri);
            const controllerClassName = getControllerClassName(currentDocument.getText());

            if (!controllerClassName) {
                this.remove(uri);
                return;
            }

            const members = getFxmlMembers(currentDocument.getText());
            this.update({
                controllerClassName,
                fieldIds: members.fieldIds,
                methodNames: members.methodNames,
                uri
            });
        } catch {
            this.remove(uri);
        }
    }

    private update(entry: CachedFxmlEntry): void {
        this.remove(entry.uri);

        const filePath = entry.uri.fsPath;
        this.entries.set(filePath, entry);

        const filePaths = this.controllers.get(entry.controllerClassName);
        if (filePaths) {
            filePaths.add(filePath);
            return;
        }

        this.controllers.set(entry.controllerClassName, new Set([filePath]));
    }

    private remove(uri: vscode.Uri): void {
        const filePath = uri.fsPath;
        const existingEntry = this.entries.get(filePath);
        if (!existingEntry) {
            return;
        }

        this.entries.delete(filePath);
        const filePaths = this.controllers.get(existingEntry.controllerClassName);
        filePaths?.delete(filePath);
        if (filePaths?.size === 0) {
            this.controllers.delete(existingEntry.controllerClassName);
        }
    }

    private addEntries(
        candidateEntries: Map<string, CachedFxmlEntry>,
        controllerClassName: string,
        memberName: string,
        isMethod: boolean
    ): void {
        const controllerFilePaths = this.controllers.get(controllerClassName);
        if (!controllerFilePaths) {
            return;
        }

        this.addMatchingEntries(candidateEntries, controllerFilePaths, memberName, isMethod);
    }

    private addMatchingEntries(
        candidateEntries: Map<string, CachedFxmlEntry>,
        filePaths: Iterable<string>,
        memberName: string,
        isMethod: boolean
    ): void {
        for (const filePath of filePaths) {
            const entry = this.entries.get(filePath);
            if (!entry || !this.hasMember(entry, memberName, isMethod)) {
                continue;
            }

            candidateEntries.set(filePath, entry);
        }
    }

    private hasMember(entry: CachedFxmlEntry, memberName: string, isMethod: boolean): boolean {
        return isMethod ? entry.methodNames.has(memberName) : entry.fieldIds.has(memberName);
    }

    private hasMatchingEntry(
        filePaths: Iterable<string>,
        memberName: string,
        isMethod: boolean
    ): boolean {
        for (const filePath of filePaths) {
            const entry = this.entries.get(filePath);
            if (entry && this.hasMember(entry, memberName, isMethod)) {
                return true;
            }
        }

        return false;
    }

    private isFxmlDocument(document: vscode.TextDocument): boolean {
        return document.uri.scheme === 'file' && document.fileName.endsWith('.fxml');
    }

    private isIgnored(uri: vscode.Uri): boolean {
        return uri.fsPath.includes('/node_modules/') || uri.fsPath.includes('\\node_modules\\');
    }
}

let sharedCache: FxmlControllerCache | undefined;

function getSharedCache(): FxmlControllerCache {
    if (!sharedCache) {
        sharedCache = new FxmlControllerCache();
    }

    return sharedCache;
}

export function getControllerClassName(text: string): string | undefined {
    const match = text.match(/fx:controller\s*=\s*"([^"]+)"/);
    return match ? match[1] : undefined;
}

export function registerFxmlControllerCache(): vscode.Disposable {
    return getSharedCache();
}

export async function getFxmlFilesForMember(
    controllerClassName: string,
    memberName: string,
    isMethod: boolean,
    token: vscode.CancellationToken
): Promise<vscode.Uri[]> {
    return getSharedCache().getFxmlFilesForMember(controllerClassName, memberName, isMethod, token);
}

export function resetFxmlControllerCacheForTests(): void {
    sharedCache?.dispose();
    sharedCache = undefined;
}

function getFxmlMembers(text: string): { fieldIds: ReadonlySet<string>; methodNames: ReadonlySet<string> } {
    const fieldIds = new Set<string>();
    const methodNames = new Set<string>();

    for (const match of text.matchAll(/\bfx:id\s*=\s*"([^"]+)"/g)) {
        fieldIds.add(match[1]);
    }

    for (const match of text.matchAll(/\bon[A-Z][\w.-]*\s*=\s*"#([^"]+)"/g)) {
        methodNames.add(match[1]);
    }

    return { fieldIds, methodNames };
}
