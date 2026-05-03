import * as vscode from 'vscode';
import { findJavaClass } from './javaControllerResolver';
import { escapeRegex, findControllerInDocument, getFieldDeclarationMatch, getMethodDeclarationMatch } from './utils';

const MISSING_FX_ID_FIELD_CODE = 'missing-fx-id-field';
const MISSING_EVENT_HANDLER_CODE = 'missing-event-handler';
const QUICK_FIX_KIND = vscode.CodeActionKind.QuickFix;
const MEMBER_INDENT = '    ';
type ControllerMemberKind = 'field' | 'method';

export class FxmlCodeActionProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [QUICK_FIX_KIND];

    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[]> {
        if (token.isCancellationRequested || (context.only && !context.only.contains(QUICK_FIX_KIND))) {
            return [];
        }

        const diagnostics = context.diagnostics.filter(diagnostic => {
            const code = getDiagnosticCode(diagnostic);
            return (code === MISSING_FX_ID_FIELD_CODE || code === MISSING_EVENT_HANDLER_CODE)
                && !!diagnostic.range.intersection(range);
        });
        if (diagnostics.length === 0) {
            return [];
        }

        const controllerClassName = findControllerInDocument(document);
        if (!controllerClassName) {
            return [];
        }

        const classInfo = await findJavaClass(controllerClassName, token);
        if (!classInfo || token.isCancellationRequested) {
            return [];
        }

        const actions: vscode.CodeAction[] = [];
        for (const diagnostic of diagnostics) {
            const action = this.createQuickFix(document, diagnostic, classInfo.document, classInfo.uri);
            if (action) {
                actions.push(action);
            }
        }

        return actions;
    }

    private createQuickFix(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        controllerDocument: vscode.TextDocument,
        controllerUri: vscode.Uri
    ): vscode.CodeAction | undefined {
        const code = getDiagnosticCode(diagnostic);
        if (code === MISSING_FX_ID_FIELD_CODE) {
            return this.createMissingFieldQuickFix(document, diagnostic, controllerDocument, controllerUri);
        }

        if (code === MISSING_EVENT_HANDLER_CODE) {
            return this.createMissingHandlerQuickFix(document, diagnostic, controllerDocument, controllerUri);
        }

        return undefined;
    }

    private createMissingFieldQuickFix(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        controllerDocument: vscode.TextDocument,
        controllerUri: vscode.Uri
    ): vscode.CodeAction | undefined {
        const fieldName = document.getText(diagnostic.range).trim();
        if (!fieldName || hasControllerField(controllerDocument, fieldName)) {
            return undefined;
        }

        const fieldType = resolveFieldType(document, diagnostic.range.start);
        if (!fieldType) {
            return undefined;
        }

        const updatedSource = updateControllerSource(
            controllerDocument,
            [
                '@FXML',
                `private ${fieldType.simpleName} ${fieldName};`,
            ],
            [
                'javafx.fxml.FXML',
                fieldType.importName,
            ],
            'field'
        );
        if (!updatedSource) {
            return undefined;
        }

        const action = new vscode.CodeAction(
            vscode.l10n.t("Generate '@FXML private {0} {1};' in controller", fieldType.simpleName, fieldName),
            QUICK_FIX_KIND
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        action.edit = createReplaceDocumentEdit(controllerDocument, controllerUri, updatedSource);
        return action;
    }

    private createMissingHandlerQuickFix(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        controllerDocument: vscode.TextDocument,
        controllerUri: vscode.Uri
    ): vscode.CodeAction | undefined {
        const methodName = document.getText(diagnostic.range).trim();
        if (!methodName || hasControllerMethod(controllerDocument, methodName)) {
            return undefined;
        }

        if (getEventAttributeNameAtRange(document, diagnostic.range) !== 'onAction') {
            return undefined;
        }

        const updatedSource = updateControllerSource(
            controllerDocument,
            [
                '@FXML',
                `private void ${methodName}(ActionEvent event) {`,
                '}',
            ],
            [
                'javafx.event.ActionEvent',
                'javafx.fxml.FXML',
            ],
            'method'
        );
        if (!updatedSource) {
            return undefined;
        }

        const action = new vscode.CodeAction(
            vscode.l10n.t("Generate '@FXML private void {0}(ActionEvent event) {{}}' in controller", methodName),
            QUICK_FIX_KIND
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        action.edit = createReplaceDocumentEdit(controllerDocument, controllerUri, updatedSource);
        return action;
    }
}

function getDiagnosticCode(diagnostic: vscode.Diagnostic): string | undefined {
    if (typeof diagnostic.code === 'string') {
        return diagnostic.code;
    }

    if (typeof diagnostic.code === 'number') {
        return String(diagnostic.code);
    }

    return diagnostic.code ? String(diagnostic.code.value) : undefined;
}

function resolveFieldType(
    document: vscode.TextDocument,
    position: vscode.Position
): { simpleName: string; importName?: string } | undefined {
    const tagName = findTagNameAtOffset(document.getText(), document.offsetAt(position));
    if (!tagName) {
        return undefined;
    }

    const unqualifiedTagName = tagName.split('.').pop() ?? tagName;
    const simpleName = unqualifiedTagName.split(':').pop() ?? unqualifiedTagName;
    if (!/^[A-Z]\w*$/.test(simpleName)) {
        return undefined;
    }

    const importName = resolveFxmlImport(document.getText(), tagName, simpleName);
    return { simpleName, importName };
}

function findTagNameAtOffset(text: string, offset: number): string | undefined {
    const start = text.lastIndexOf('<', offset);
    if (start < 0 || start < text.lastIndexOf('>', offset)) {
        return undefined;
    }

    const end = text.indexOf('>', offset);
    const tagText = end >= 0 ? text.slice(start, end) : text.slice(start);
    const match = /^<\s*([A-Za-z_][\w:.-]*)/.exec(tagText);
    return match?.[1];
}

function resolveFxmlImport(text: string, tagName: string, simpleName: string): string | undefined {
    if (tagName.includes('.') && !tagName.includes(':')) {
        return tagName;
    }

    const explicitImport = new RegExp(`<\\?import\\s+([\\w.]+\\.${escapeRegex(simpleName)})\\s*\\?>`).exec(text);
    if (explicitImport) {
        return explicitImport[1];
    }

    const wildcardImport = new RegExp(`<\\?import\\s+([\\w.]+)\\.\\*\\s*\\?>`).exec(text);
    return wildcardImport ? `${wildcardImport[1]}.${simpleName}` : undefined;
}

function getEventAttributeNameAtRange(document: vscode.TextDocument, range: vscode.Range): string | undefined {
    const text = document.getText();
    const offset = document.offsetAt(range.start);
    const length = document.offsetAt(range.end) - offset;
    const pattern = /\b(on\w+)\s*=\s*(["'])#([^"']+)\2/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const valueOffset = match.index + match[0].indexOf(match[3]);
        if (valueOffset === offset && match[3].length === length) {
            return match[1];
        }
    }

    return undefined;
}

function hasControllerField(document: vscode.TextDocument, fieldName: string): boolean {
    for (let index = 0; index < document.lineCount; index++) {
        if (getFieldDeclarationMatch(document.lineAt(index).text, fieldName)) {
            return true;
        }
    }

    return false;
}

function hasControllerMethod(document: vscode.TextDocument, methodName: string): boolean {
    for (let index = 0; index < document.lineCount; index++) {
        if (getMethodDeclarationMatch(document.lineAt(index).text, methodName)) {
            return true;
        }
    }

    return false;
}

function updateControllerSource(
    document: vscode.TextDocument,
    memberLines: readonly string[],
    importsToAdd: ReadonlyArray<string | undefined>,
    memberKind: ControllerMemberKind
): string | undefined {
    const source = document.getText();
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const lines = source.split(/\r?\n/);

    addImports(lines, importsToAdd);

    const classClosingLine = findClassClosingLine(lines);
    if (classClosingLine < 0) {
        return undefined;
    }

    const classDeclarationLine = findClassDeclarationLine(lines, classClosingLine);
    const insertLine = memberKind === 'field'
        ? findFieldInsertLine(lines, classDeclarationLine, classClosingLine)
        : classClosingLine;
    const hasExistingMembers = lines.slice(classDeclarationLine + 1, insertLine).some(line => line.trim() !== '');
    const shouldInsertLeadingBlankLine = memberKind === 'method' && hasExistingMembers;
    const memberIndent = `${getIndentation(lines[classClosingLine])}${MEMBER_INDENT}`;
    const formattedMemberLines = memberLines.map(line => line ? `${memberIndent}${line}` : '');
    lines.splice(insertLine, 0, ...(shouldInsertLeadingBlankLine ? [''] : []), ...formattedMemberLines);
    return lines.join(eol);
}

function addImports(lines: string[], importsToAdd: ReadonlyArray<string | undefined>): void {
    const imports = Array.from(new Set(importsToAdd.filter((importName): importName is string => !!importName)));
    if (imports.length === 0) {
        return;
    }

    const existingImports = new Set(
        lines
            .map(line => /^\s*import\s+([\w.]+)\s*;\s*$/.exec(line)?.[1])
            .filter((importName): importName is string => !!importName)
    );
    const controllerPackage = lines
        .map(line => /^\s*package\s+([\w.]+)\s*;\s*$/.exec(line)?.[1])
        .find((packageName): packageName is string => !!packageName);
    const newImports = imports
        .filter(importName => !existingImports.has(importName))
        .filter(importName => !importName.startsWith('java.lang.'))
        .filter(importName => !controllerPackage || !importName.startsWith(`${controllerPackage}.`))
        .sort();
    if (newImports.length === 0) {
        return;
    }

    const importLines = newImports.map(importName => `import ${importName};`);
    const lastImportLine = findLastLineIndex(lines, line => /^\s*import\s+[\w.]+\s*;\s*$/.test(line));
    if (lastImportLine >= 0) {
        lines.splice(lastImportLine + 1, 0, ...importLines);
        return;
    }

    const packageLine = findLastLineIndex(lines, line => /^\s*package\s+[\w.]+\s*;\s*$/.test(line));
    const insertAt = packageLine >= 0 ? packageLine + 1 : 0;
    const removeBlankLine = lines[insertAt]?.trim() === '' ? 1 : 0;
    lines.splice(insertAt, removeBlankLine, '', ...importLines, '');
}

function createReplaceDocumentEdit(
    document: vscode.TextDocument,
    uri: vscode.Uri,
    updatedSource: string
): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length)), updatedSource);
    return edit;
}

function findClassClosingLine(lines: readonly string[]): number {
    for (let index = lines.length - 1; index >= 0; index--) {
        if (lines[index].trim() === '}') {
            return index;
        }
    }

    return -1;
}

function findClassDeclarationLine(lines: readonly string[], beforeLine: number): number {
    for (let index = beforeLine - 1; index >= 0; index--) {
        if (/\bclass\b/.test(lines[index])) {
            return index;
        }
    }

    return 0;
}

function findFieldInsertLine(lines: readonly string[], classDeclarationLine: number, classClosingLine: number): number {
    for (let index = classDeclarationLine + 1; index < classClosingLine; index++) {
        if (!isMethodDeclarationLine(lines[index])) {
            continue;
        }

        let methodStartLine = index;
        while (methodStartLine > classDeclarationLine + 1 && lines[methodStartLine - 1].trim().startsWith('@')) {
            methodStartLine--;
        }
        while (methodStartLine > classDeclarationLine + 1 && lines[methodStartLine - 1].trim() === '') {
            methodStartLine--;
        }
        return methodStartLine;
    }

    return classClosingLine;
}

function isMethodDeclarationLine(line: string): boolean {
    const methodName = /(\w+)\s*\(/.exec(line)?.[1];
    return !!methodName && !!getMethodDeclarationMatch(line, methodName);
}

function findLastLineIndex(lines: readonly string[], predicate: (line: string) => boolean): number {
    for (let index = lines.length - 1; index >= 0; index--) {
        if (predicate(lines[index])) {
            return index;
        }
    }

    return -1;
}

function getIndentation(line: string): string {
    return /^\s*/.exec(line)?.[0] ?? '';
}
