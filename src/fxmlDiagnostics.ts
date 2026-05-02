import * as vscode from 'vscode';
import { findJavaClass, getSuperclassName, type JavaClassInfo } from './javaControllerResolver';

const FXML_LANGUAGE_IDS = ['fxml'];
const DIAGNOSTIC_SOURCE = 'tlcsdm-javafx-support';
const MAX_FXML_ANNOTATION_DISTANCE = 2;

interface AttributeOccurrence {
    value: string;
    range: vscode.Range;
}

type ControllerFieldState = 'annotated' | 'unannotated' | 'missing';

export class FxmlDiagnosticProvider implements vscode.Disposable {
    private readonly collection = vscode.languages.createDiagnosticCollection('javafx-support');
    private readonly disposables: vscode.Disposable[];
    private readonly pendingValidations = new Map<string, vscode.CancellationTokenSource>();

    constructor() {
        this.disposables = [
            this.collection,
            vscode.workspace.onDidOpenTextDocument(document => {
                void this.validateDocument(document);
            }),
            vscode.workspace.onDidChangeTextDocument(event => {
                void this.validateDocument(event.document);
            }),
            vscode.workspace.onDidSaveTextDocument(document => {
                if (this.shouldRefreshOpenFxmlDocuments(document)) {
                    this.refreshOpenFxmlDocuments();
                    return;
                }

                void this.validateDocument(document);
            }),
            vscode.workspace.onDidCloseTextDocument(document => {
                this.cancelPendingValidation(document.uri);
                this.collection.delete(document.uri);
            }),
        ];

        this.refreshOpenFxmlDocuments();
    }

    dispose(): void {
        for (const tokenSource of this.pendingValidations.values()) {
            tokenSource.cancel();
            tokenSource.dispose();
        }
        this.pendingValidations.clear();

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
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
                void this.validateDocument(document);
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
        const resourceBundleKeysPromise = collectResourceBundleKeys(controllerClass, getClassInfo, token);

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
                fieldState === 'unannotated' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error,
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

        const resourceBundleKeys = await resourceBundleKeysPromise;
        if (token.isCancellationRequested || !resourceBundleKeys) {
            return sortDiagnostics(diagnostics);
        }

        const resourceKeyOccurrences = findAttributeOccurrences(document, text, /\b[\w:.-]+\s*=\s*(["'])%(?!%)([^"']+)\1/g);
        for (const occurrence of resourceKeyOccurrences) {
            if (resourceBundleKeys.has(occurrence.value)) {
                continue;
            }

            diagnostics.push(createDiagnostic(
                occurrence.range,
                vscode.l10n.t("Resource bundle key '{0}' could not be found.", occurrence.value),
                vscode.DiagnosticSeverity.Warning,
                'missing-resource-bundle-key'
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

async function collectResourceBundleKeys(
    controllerClassName: string,
    getClassInfo: (className: string) => Promise<JavaClassInfo | undefined>,
    token: vscode.CancellationToken
): Promise<Set<string> | undefined> {
    const bundleNames = await collectResourceBundleBaseNames(controllerClassName, getClassInfo, token);
    if (token.isCancellationRequested || bundleNames.size === 0) {
        return undefined;
    }

    const keys = new Set<string>();
    let sawPropertiesFile = false;
    for (const bundleName of bundleNames) {
        const bundlePath = bundleName.replace(/\./g, '/');
        const bundleFiles = await vscode.workspace.findFiles(`**/${bundlePath}.properties`, '**/node_modules/**');
        for (const bundleFile of bundleFiles) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            sawPropertiesFile = true;
            const bundleDocument = await vscode.workspace.openTextDocument(bundleFile);
            for (const key of parsePropertiesKeys(bundleDocument.getText())) {
                keys.add(key);
            }
        }
    }

    return sawPropertiesFile ? keys : undefined;
}

async function collectResourceBundleBaseNames(
    controllerClassName: string,
    getClassInfo: (className: string) => Promise<JavaClassInfo | undefined>,
    token: vscode.CancellationToken,
    visited = new Set<string>()
): Promise<Set<string>> {
    const bundleNames = new Set<string>();
    if (token.isCancellationRequested || visited.has(controllerClassName)) {
        return bundleNames;
    }

    visited.add(controllerClassName);

    const classInfo = await getClassInfo(controllerClassName);
    if (!classInfo || token.isCancellationRequested) {
        return bundleNames;
    }

    for (const bundleName of extractResourceBundleBaseNames(classInfo.document.getText())) {
        bundleNames.add(bundleName);
    }

    const superClassName = getSuperclassName(classInfo.document);
    if (!superClassName) {
        return bundleNames;
    }

    for (const bundleName of await collectResourceBundleBaseNames(superClassName, getClassInfo, token, visited)) {
        bundleNames.add(bundleName);
    }

    return bundleNames;
}

function extractResourceBundleBaseNames(text: string): string[] {
    const stringConstants = new Map<string, string>();
    for (const match of text.matchAll(/\b(?:public|protected|private)?\s*(?:(?:static|final)\s+)*String\s+(\w+)\s*=\s*"([^"]+)"/g)) {
        stringConstants.set(match[1], match[2]);
    }

    const bundleNames = new Set<string>();
    for (const match of text.matchAll(/\bResourceBundle\s*\.\s*getBundle\s*\(\s*("([^"]+)"|(\w+))/g)) {
        const literalName = match[2];
        const constantName = match[3];
        const resolvedBundleName = literalName || (constantName ? stringConstants.get(constantName) : undefined);
        if (resolvedBundleName) {
            bundleNames.add(resolvedBundleName);
        }
    }

    return [...bundleNames];
}

function parsePropertiesKeys(text: string): Set<string> {
    const keys = new Set<string>();
    const logicalLines = mergeContinuationLines(text);

    for (const line of logicalLines) {
        const trimmed = line.trimStart();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
            continue;
        }

        const key = readPropertyKey(trimmed);
        if (key) {
            keys.add(key);
        }
    }

    return keys;
}

function mergeContinuationLines(text: string): string[] {
    const logicalLines: string[] = [];
    const physicalLines = text.split(/\r?\n/);
    let currentLine = '';

    for (const line of physicalLines) {
        const continuedLine = currentLine + line;
        if (endsWithOddNumberOfBackslashes(continuedLine)) {
            currentLine = continuedLine.slice(0, -1);
            continue;
        }

        logicalLines.push(continuedLine);
        currentLine = '';
    }

    if (currentLine) {
        logicalLines.push(currentLine);
    }

    return logicalLines;
}

function endsWithOddNumberOfBackslashes(text: string): boolean {
    let trailingBackslashes = 0;
    for (let index = text.length - 1; index >= 0 && text[index] === '\\'; index--) {
        trailingBackslashes++;
    }

    return trailingBackslashes % 2 === 1;
}

function readPropertyKey(line: string): string | undefined {
    let key = '';
    let escaping = false;

    for (const character of line) {
        if (isPropertyKeyDelimiter(character, escaping)) {
            break;
        }

        if (escaping) {
            key += character;
            escaping = false;
            continue;
        }

        if (character === '\\') {
            escaping = true;
            continue;
        }

        key += character;
    }

    return key || undefined;
}

function isPropertyKeyDelimiter(character: string, escaping: boolean): boolean {
    return !escaping && (character === '=' || character === ':' || /\s/.test(character));
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

function getMethodDeclarationMatch(line: string, methodName: string): RegExpExecArray | undefined {
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
    return lastPrefixChar && (/\w/.test(lastPrefixChar) || lastPrefixChar === '>' || lastPrefixChar === ']')
        ? methodMatch
        : undefined;
}

function getFieldDeclarationMatch(line: string, fieldName: string): RegExpExecArray | undefined {
    const fieldPattern = new RegExp(`\\b${escapeRegex(fieldName)}\\b\\s*(?=[;=,)])`);
    const fieldMatch = fieldPattern.exec(line);
    if (!fieldMatch) {
        return undefined;
    }

    const prefix = line.slice(0, fieldMatch.index).trim();
    return isValidMemberDeclarationPrefix(prefix) ? fieldMatch : undefined;
}

function isValidMemberDeclarationPrefix(prefix: string): boolean {
    if (!prefix || prefix.endsWith('.') || /[(){};]/.test(prefix)) {
        return false;
    }

    return !/\b(?:if|for|while|switch|catch|new|return|throw)\b/.test(prefix);
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
