import * as vscode from 'vscode';
import { clearJavaClassCache, findJavaClass, getSuperclassName, type JavaClassInfo } from '../java/javaControllerResolver';
import { getFieldDeclarationMatch, getMethodDeclarationMatch } from '../core/utils';

const FXML_LANGUAGE_IDS = ['fxml'];
const DIAGNOSTIC_SOURCE = 'tlcsdm-javafx-support';
const MAX_FXML_ANNOTATION_DISTANCE = 2;
const VALIDATION_DEBOUNCE_MS = 300;

interface AttributeOccurrence {
    value: string;
    range: vscode.Range;
}

type ControllerFieldState = 'annotated' | 'unannotated' | 'missing';

export class FxmlDiagnosticProvider implements vscode.Disposable {
    private readonly collection = vscode.languages.createDiagnosticCollection('javafx-support');
    private readonly disposables: vscode.Disposable[];
    private readonly pendingValidations = new Map<string, vscode.CancellationTokenSource>();
    private readonly debouncedValidations = new Map<string, NodeJS.Timeout>();

    constructor() {
        this.disposables = [
            this.collection,
            vscode.workspace.onDidOpenTextDocument(document => {
                void this.validateDocumentNow(document);
            }),
            vscode.workspace.onDidChangeTextDocument(event => {
                this.scheduleValidation(event.document);
            }),
            vscode.workspace.onDidSaveTextDocument(document => {
                if (this.shouldRefreshOpenFxmlDocuments(document)) {
                    clearJavaClassCache();
                    this.refreshOpenFxmlDocuments();
                    return;
                }

                void this.validateDocumentNow(document);
            }),
            vscode.workspace.onDidCloseTextDocument(document => {
                this.clearDebouncedValidation(document.uri);
                this.cancelPendingValidation(document.uri);
                this.collection.delete(document.uri);
            }),
        ];

        this.refreshOpenFxmlDocuments();
    }

    dispose(): void {
        for (const timeout of this.debouncedValidations.values()) {
            clearTimeout(timeout);
        }
        this.debouncedValidations.clear();

        for (const tokenSource of this.pendingValidations.values()) {
            tokenSource.cancel();
            tokenSource.dispose();
        }
        this.pendingValidations.clear();

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    private validateDocumentNow(document: vscode.TextDocument): Promise<void> {
        this.clearDebouncedValidation(document.uri);
        return this.validateDocument(document);
    }

    private scheduleValidation(document: vscode.TextDocument): void {
        this.clearDebouncedValidation(document.uri);
        const key = document.uri.toString();
        const timeout = setTimeout(() => {
            this.debouncedValidations.delete(key);
            void this.validateDocument(document);
        }, VALIDATION_DEBOUNCE_MS);
        this.debouncedValidations.set(key, timeout);
    }

    private async validateDocument(document: vscode.TextDocument): Promise<void> {
        if (!this.shouldValidate(document)) {
            this.cancelPendingValidation(document.uri);
            this.collection.delete(document.uri);
            return;
        }

        this.cancelPendingValidation(document.uri);

        const tokenSource = new vscode.CancellationTokenSource();
        const documentKey = document.uri.toString();
        this.pendingValidations.set(documentKey, tokenSource);

        try {
            const diagnostics = await collectFxmlDiagnostics(document, tokenSource.token);
            if (tokenSource.token.isCancellationRequested || this.pendingValidations.get(documentKey) !== tokenSource) {
                return;
            }

            this.collection.set(document.uri, diagnostics);
        } finally {
            if (this.pendingValidations.get(documentKey) === tokenSource) {
                this.pendingValidations.delete(documentKey);
            }
            tokenSource.dispose();
        }
    }

    private refreshOpenFxmlDocuments(): void {
        for (const document of vscode.workspace.textDocuments) {
            if (this.shouldValidate(document)) {
                void this.validateDocumentNow(document);
            }
        }
    }

    private shouldValidate(document: vscode.TextDocument): boolean {
        return FXML_LANGUAGE_IDS.includes(document.languageId) || document.fileName.endsWith('.fxml');
    }

    private shouldRefreshOpenFxmlDocuments(document: vscode.TextDocument): boolean {
        return document.languageId === 'java'
            || document.fileName.endsWith('.java')
            || document.fileName.endsWith('.properties');
    }

    private cancelPendingValidation(uri: vscode.Uri): void {
        const key = uri.toString();
        const tokenSource = this.pendingValidations.get(key);
        if (!tokenSource) {
            return;
        }

        tokenSource.cancel();
        tokenSource.dispose();
        this.pendingValidations.delete(key);
    }

    private clearDebouncedValidation(uri: vscode.Uri): void {
        const key = uri.toString();
        const timeout = this.debouncedValidations.get(key);
        if (!timeout) {
            return;
        }

        clearTimeout(timeout);
        this.debouncedValidations.delete(key);
    }
}

export async function collectFxmlDiagnostics(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
): Promise<vscode.Diagnostic[]> {
    if (token.isCancellationRequested) {
        return [];
    }

    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    const controller = findAttributeOccurrences(document, text, /fx:controller\s*=\s*(["'])([^"']+)\1/g)[0];
    const controllerClass = controller?.value.trim();
    let controllerInfo: JavaClassInfo | undefined;
    const classInfoCache = new Map<string, Promise<JavaClassInfo | undefined>>();
    const getClassInfo = async (className: string): Promise<JavaClassInfo | undefined> => {
        const cached = classInfoCache.get(className);
        if (cached) {
            return cached;
        }

        const lookup = findJavaClass(className, token);
        classInfoCache.set(className, lookup);
        return lookup;
    };

    if (controller && controllerClass && !token.isCancellationRequested) {
        controllerInfo = await getClassInfo(controllerClass);
        if (!controllerInfo && !token.isCancellationRequested) {
            diagnostics.push(createDiagnostic(
                controller.range,
                vscode.l10n.t("Controller class '{0}' could not be found.", controllerClass),
                vscode.DiagnosticSeverity.Error,
                'missing-controller'
            ));
        }
    }

    if (token.isCancellationRequested) {
        return [];
    }

    const fxIdOccurrences = findAttributeOccurrences(document, text, /\bfx:id\s*=\s*(["'])([^"']+)\1/g);
    const occurrencesById = new Map<string, AttributeOccurrence[]>();
    for (const occurrence of fxIdOccurrences) {
        const entries = occurrencesById.get(occurrence.value) ?? [];
        entries.push(occurrence);
        occurrencesById.set(occurrence.value, entries);
    }

    for (const [fxId, occurrences] of occurrencesById) {
        if (occurrences.length < 2) {
            continue;
        }

        for (let index = 0; index < occurrences.length; index++) {
            const occurrence = occurrences[index];
            const diagnostic = createDiagnostic(
                occurrence.range,
                vscode.l10n.t("Duplicate fx:id '{0}'.", fxId),
                vscode.DiagnosticSeverity.Error,
                'duplicate-fx-id'
            );
            diagnostic.relatedInformation = occurrences
                .filter((_, relatedIndex) => relatedIndex !== index)
                .map(relatedOccurrence => new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, relatedOccurrence.range),
                    vscode.l10n.t("Another '{0}' is declared here.", fxId)
                ));
            diagnostics.push(diagnostic);
        }
    }

    if (controllerClass && controllerInfo && !token.isCancellationRequested) {
        const controllerFieldStateCache = new Map<string, Promise<ControllerFieldState>>();
        const controllerMethodStateCache = new Map<string, Promise<boolean>>();

        for (const [fxId, occurrences] of occurrencesById) {
            const cachedState = controllerFieldStateCache.get(fxId) ?? findControllerFieldState(controllerClass, fxId, getClassInfo, token);
            controllerFieldStateCache.set(fxId, cachedState);
            const fieldState = await cachedState;
            if (token.isCancellationRequested || fieldState === 'annotated') {
                continue;
            }

            diagnostics.push(createDiagnostic(
                occurrences[0].range,
                fieldState === 'unannotated'
                    ? vscode.l10n.t("Controller field '{0}' exists but is not annotated with @FXML.", fxId)
                    : vscode.l10n.t("Controller field '{0}' for fx:id could not be found.", fxId),
                vscode.DiagnosticSeverity.Warning,
                fieldState === 'unannotated' ? 'non-fxml-fx-id-field' : 'missing-fx-id-field'
            ));
        }

        const eventHandlerOccurrences = findAttributeOccurrences(document, text, /\bon\w+\s*=\s*(["'])#([^"']+)\1/g);
        for (const occurrence of eventHandlerOccurrences) {
            const cachedState = controllerMethodStateCache.get(occurrence.value) ?? findControllerMethod(controllerClass, occurrence.value, getClassInfo, token);
            controllerMethodStateCache.set(occurrence.value, cachedState);
            const methodExists = await cachedState;
            if (token.isCancellationRequested || methodExists) {
                continue;
            }

            diagnostics.push(createDiagnostic(
                occurrence.range,
                vscode.l10n.t("Event handler '{0}' could not be found in the controller.", occurrence.value),
                vscode.DiagnosticSeverity.Error,
                'missing-event-handler'
            ));
        }
    }

    return sortDiagnostics(diagnostics);
}

function findAttributeOccurrences(
    document: vscode.TextDocument,
    text: string,
    pattern: RegExp
): AttributeOccurrence[] {
    const occurrences: AttributeOccurrence[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const value = match[2];
        const valueOffset = match.index + match[0].indexOf(value);
        occurrences.push({
            value,
            range: new vscode.Range(
                document.positionAt(valueOffset),
                document.positionAt(valueOffset + value.length)
            ),
        });
    }

    return occurrences;
}

function createDiagnostic(
    range: vscode.Range,
    message: string,
    severity: vscode.DiagnosticSeverity,
    code: string
): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.code = code;
    diagnostic.source = DIAGNOSTIC_SOURCE;
    return diagnostic;
}

function sortDiagnostics(diagnostics: vscode.Diagnostic[]): vscode.Diagnostic[] {
    return diagnostics.sort((left, right) => {
        const lineDifference = left.range.start.line - right.range.start.line;
        if (lineDifference !== 0) {
            return lineDifference;
        }

        return left.range.start.character - right.range.start.character;
    });
}

async function findControllerFieldState(
    controllerClassName: string,
    fieldName: string,
    getClassInfo: (className: string) => Promise<JavaClassInfo | undefined>,
    token: vscode.CancellationToken,
    visited = new Set<string>()
): Promise<ControllerFieldState> {
    if (token.isCancellationRequested || visited.has(controllerClassName)) {
        return 'missing';
    }

    visited.add(controllerClassName);

    const classInfo = await getClassInfo(controllerClassName);
    if (!classInfo || token.isCancellationRequested) {
        return 'missing';
    }

    const fieldState = findFieldStateInJavaFile(classInfo.document, fieldName, token);
    if (fieldState) {
        return fieldState;
    }

    const superClassName = getSuperclassName(classInfo.document);
    if (!superClassName) {
        return 'missing';
    }

    return findControllerFieldState(superClassName, fieldName, getClassInfo, token, visited);
}

async function findControllerMethod(
    controllerClassName: string,
    methodName: string,
    getClassInfo: (className: string) => Promise<JavaClassInfo | undefined>,
    token: vscode.CancellationToken,
    visited = new Set<string>()
): Promise<boolean> {
    if (token.isCancellationRequested || visited.has(controllerClassName)) {
        return false;
    }

    visited.add(controllerClassName);

    const classInfo = await getClassInfo(controllerClassName);
    if (!classInfo || token.isCancellationRequested) {
        return false;
    }

    if (findMethodInJavaFile(classInfo.document, methodName, token)) {
        return true;
    }

    const superClassName = getSuperclassName(classInfo.document);
    return superClassName
        ? findControllerMethod(superClassName, methodName, getClassInfo, token, visited)
        : false;
}

function findFieldStateInJavaFile(
    document: vscode.TextDocument,
    fieldName: string,
    token: vscode.CancellationToken
): ControllerFieldState | undefined {
    let fxmlAnnotationLine = -1;
    let sawUnannotatedField = false;

    for (let index = 0; index < document.lineCount; index++) {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const lineText = document.lineAt(index).text;
        if (lineText.trim().startsWith('@FXML')) {
            fxmlAnnotationLine = index;
        }

        const fieldMatch = getFieldDeclarationMatch(lineText, fieldName);
        if (fieldMatch) {
            if (fxmlAnnotationLine >= 0 && index - fxmlAnnotationLine <= MAX_FXML_ANNOTATION_DISTANCE) {
                return 'annotated';
            }

            sawUnannotatedField = true;
        }

        if (fxmlAnnotationLine >= 0 && index - fxmlAnnotationLine > MAX_FXML_ANNOTATION_DISTANCE) {
            fxmlAnnotationLine = -1;
        }
    }

    return sawUnannotatedField ? 'unannotated' : undefined;
}

function findMethodInJavaFile(
    document: vscode.TextDocument,
    methodName: string,
    token: vscode.CancellationToken
): boolean {
    for (let index = 0; index < document.lineCount; index++) {
        if (token.isCancellationRequested) {
            return false;
        }

        if (getMethodDeclarationMatch(document.lineAt(index).text, methodName)) {
            return true;
        }
    }

    return false;
}
