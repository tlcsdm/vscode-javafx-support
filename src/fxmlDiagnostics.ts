import * as vscode from 'vscode';
import { findJavaClass } from './javaControllerResolver';

const FXML_LANGUAGE_IDS = ['fxml'];
const DIAGNOSTIC_SOURCE = 'tlcsdm-javafx-support';

interface AttributeOccurrence {
    value: string;
    range: vscode.Range;
}

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
                if (this.isJavaDocument(document)) {
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

    private isJavaDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'java' || document.fileName.endsWith('.java');
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
    if (controller && !token.isCancellationRequested) {
        const controllerClass = controller.value.trim();
        if (controllerClass.length > 0) {
            const controllerInfo = await findJavaClass(controllerClass, token);
            if (!controllerInfo && !token.isCancellationRequested) {
                diagnostics.push(createDiagnostic(
                    controller.range,
                    `Controller class '${controllerClass}' could not be found.`,
                    vscode.DiagnosticSeverity.Error,
                    'missing-controller'
                ));
            }
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
                `Duplicate fx:id '${fxId}'.`,
                vscode.DiagnosticSeverity.Error,
                'duplicate-fx-id'
            );
            diagnostic.relatedInformation = occurrences
                .filter((_, relatedIndex) => relatedIndex !== index)
                .map(relatedOccurrence => new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, relatedOccurrence.range),
                    `Another '${fxId}' is declared here.`
                ));
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics.sort((left, right) => {
        const lineDifference = left.range.start.line - right.range.start.line;
        if (lineDifference !== 0) {
            return lineDifference;
        }

        return left.range.start.character - right.range.start.character;
    });
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
