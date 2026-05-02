import * as vscode from 'vscode';
import { findJavaClass, getSuperclassName } from './javaControllerResolver';
import { escapeRegex, findControllerInDocument, getFieldDeclarationMatch, getMethodDeclarationMatch } from './utils';

interface HoverTarget {
    kind: 'controller' | 'field' | 'method';
    name: string;
    range: vscode.Range;
}

interface JavaMemberHoverInfo {
    documentation: string;
    declaringClassName: string;
}

/**
 * Provides hover information for controller-bound FXML attributes.
 */
export class FxmlHoverProvider implements vscode.HoverProvider {
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const config = vscode.workspace.getConfiguration('tlcsdm.javafxSupport');
        if (!config.get<boolean>('hover.enabled', false)) {
            return undefined;
        }

        const delayMs = Math.max(0, config.get<number>('hover.delay', 300));
        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        if (token.isCancellationRequested) {
            return undefined;
        }

        const line = document.lineAt(position).text;
        const target = this.getControllerTarget(document, position, line)
            ?? this.getEventHandlerTarget(document, position, line)
            ?? this.getFxIdTarget(document, position, line);
        if (!target) {
            return undefined;
        }

        if (target.kind === 'controller') {
            return this.createControllerClassHover(target, token);
        }

        return this.createControllerMemberHover(document, target, token);
    }

    private getControllerTarget(
        document: vscode.TextDocument,
        position: vscode.Position,
        line: string
    ): HoverTarget | undefined {
        return this.getAttributeTarget(document, position, line, /\bfx:controller\s*=\s*(["'])([\w.$]+)\1/g, 'controller');
    }

    private getFxIdTarget(
        document: vscode.TextDocument,
        position: vscode.Position,
        line: string
    ): HoverTarget | undefined {
        return this.getAttributeTarget(document, position, line, /\bfx:id\s*=\s*(["'])([\w$]+)\1/g, 'field');
    }

    private getEventHandlerTarget(
        document: vscode.TextDocument,
        position: vscode.Position,
        line: string
    ): HoverTarget | undefined {
        const target = this.getAttributeTarget(document, position, line, /\bon\w+\s*=\s*(["'])(#[\w$]+)\1/g, 'method');
        if (!target) {
            return undefined;
        }

        return {
            ...target,
            name: target.name.startsWith('#') ? target.name.slice(1) : target.name,
        };
    }

    private getAttributeTarget(
        document: vscode.TextDocument,
        position: vscode.Position,
        line: string,
        pattern: RegExp,
        kind: 'controller' | 'field' | 'method'
    ): HoverTarget | undefined {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(line)) !== null) {
            const value = match[2];
            const valueStart = match.index + match[0].indexOf(value);
            const valueEnd = valueStart + value.length;
            if (position.character >= valueStart && position.character <= valueEnd) {
                return {
                    kind,
                    name: value,
                    range: new vscode.Range(
                        new vscode.Position(position.line, valueStart),
                        new vscode.Position(position.line, valueEnd)
                    ),
                };
            }
        }

        return undefined;
    }

    private async createControllerClassHover(
        target: HoverTarget,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const classInfo = await findJavaClass(target.name, token);
        if (!classInfo || token.isCancellationRequested) {
            return undefined;
        }

        const documentation = this.findClassDocumentation(classInfo.document, this.getSimpleClassName(target.name));
        if (!documentation) {
            return undefined;
        }

        const markdown = new vscode.MarkdownString();
        markdown.appendText(documentation);
        return new vscode.Hover(markdown, target.range);
    }

    private async createControllerMemberHover(
        document: vscode.TextDocument,
        target: HoverTarget,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const controllerClassName = findControllerInDocument(document);
        if (!controllerClassName) {
            return undefined;
        }

        const memberInfo = await this.findMemberInControllerHierarchy(
            controllerClassName,
            target.name,
            target.kind === 'method',
            token
        );
        if (!memberInfo || token.isCancellationRequested) {
            return undefined;
        }

        const markdown = new vscode.MarkdownString();
        markdown.appendText(memberInfo.documentation);
        if (memberInfo.declaringClassName !== this.getSimpleClassName(controllerClassName)) {
            markdown.appendMarkdown(`\n\nDeclared in \`${this.escapeMarkdown(memberInfo.declaringClassName)}\`.`);
        }

        return new vscode.Hover(markdown, target.range);
    }

    private async findMemberInControllerHierarchy(
        controllerClassName: string,
        memberName: string,
        isMethod: boolean,
        token: vscode.CancellationToken,
        visited = new Set<string>()
    ): Promise<JavaMemberHoverInfo | undefined> {
        if (token.isCancellationRequested || visited.has(controllerClassName)) {
            return undefined;
        }

        visited.add(controllerClassName);

        const classInfo = await findJavaClass(controllerClassName, token);
        if (!classInfo || token.isCancellationRequested) {
            return undefined;
        }

        const memberInfo = this.findMemberInJavaFile(
            classInfo.document,
            memberName,
            isMethod,
            this.getSimpleClassName(controllerClassName),
            token
        );
        if (memberInfo || token.isCancellationRequested) {
            return memberInfo;
        }

        const superClassName = getSuperclassName(classInfo.document);
        if (!superClassName) {
            return undefined;
        }

        return this.findMemberInControllerHierarchy(superClassName, memberName, isMethod, token, visited);
    }

    private findMemberInJavaFile(
        document: vscode.TextDocument,
        memberName: string,
        isMethod: boolean,
        declaringClassName: string,
        token: vscode.CancellationToken
    ): JavaMemberHoverInfo | undefined {
        let fxmlAnnotationLine = -1;
        let bestMatch: JavaMemberHoverInfo | undefined;

        for (let i = 0; i < document.lineCount; i++) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            const lineText = document.lineAt(i).text;
            if (lineText.trim().startsWith('@FXML') || lineText.includes('@FXML ')) {
                fxmlAnnotationLine = i;
            }

            const declarationMatch = isMethod
                ? getMethodDeclarationMatch(lineText, memberName)
                : getFieldDeclarationMatch(lineText, memberName);
            if (!declarationMatch) {
                if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine > 2) {
                    fxmlAnnotationLine = -1;
                }
                continue;
            }

            const documentation = this.findDocumentationAbove(document, i);
            const memberInfo = documentation
                ? { documentation, declaringClassName }
                : undefined;

            if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine <= 2) {
                return memberInfo ?? bestMatch;
            }

            if (memberInfo && !bestMatch) {
                bestMatch = memberInfo;
            }

            if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine > 2) {
                fxmlAnnotationLine = -1;
            }
        }

        return bestMatch;
    }

    private findClassDocumentation(document: vscode.TextDocument, className: string): string | undefined {
        const classPattern = new RegExp(`\\b(?:class|interface|enum|record)\\s+${escapeRegex(className)}\\b`);

        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (classPattern.test(lineText)) {
                return this.findDocumentationAbove(document, i);
            }
        }

        return undefined;
    }

    private findDocumentationAbove(document: vscode.TextDocument, declarationLine: number): string | undefined {
        let lineNumber = declarationLine - 1;
        while (lineNumber >= 0) {
            const trimmed = document.lineAt(lineNumber).text.trim();
            if (trimmed === '') {
                return undefined;
            }

            if (trimmed.startsWith('@')) {
                lineNumber--;
                continue;
            }

            if (trimmed.endsWith('*/')) {
                return this.extractBlockComment(document, lineNumber);
            }

            if (trimmed.startsWith('//')) {
                return this.extractLineComment(document, lineNumber);
            }

            return undefined;
        }

        return undefined;
    }

    private extractBlockComment(document: vscode.TextDocument, endLine: number): string | undefined {
        const lines: string[] = [];
        let startLine = endLine;

        for (; startLine >= 0; startLine--) {
            lines.unshift(document.lineAt(startLine).text.trim());
            if (document.lineAt(startLine).text.trim().startsWith('/*')) {
                break;
            }
        }

        if (startLine < 0) {
            return undefined;
        }

        const cleaned = lines
            .map(line => line
                .replace(/^\/\*\*?/, '')
                .replace(/\*\/$/, '')
                .replace(/^\s*\*+\s*/, '')
                .trim()
            )
            .filter(line => line.length > 0)
            .join('\n')
            .trim();

        return cleaned || undefined;
    }

    private extractLineComment(document: vscode.TextDocument, endLine: number): string | undefined {
        const lines: string[] = [];
        let startLine = endLine;

        for (; startLine >= 0; startLine--) {
            const trimmed = document.lineAt(startLine).text.trim();
            if (!trimmed.startsWith('//')) {
                break;
            }

            lines.unshift(trimmed.replace(/^\/\/\s?/, '').trim());
        }

        const cleaned = lines
            .filter(line => line.length > 0)
            .join('\n')
            .trim();

        return cleaned || undefined;
    }

    private getSimpleClassName(className: string): string {
        return className.split('.').pop() || className;
    }

    private escapeMarkdown(value: string): string {
        return value.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
    }

}
