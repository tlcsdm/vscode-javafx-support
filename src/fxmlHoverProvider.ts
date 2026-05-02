import * as vscode from 'vscode';
import { findJavaClass, getSuperclassName } from './javaControllerResolver';

const JAVAFX_HOVER_SUMMARIES: Readonly<Record<string, string>> = {
    accordion: 'A control that shows one expanded pane from a group of titled panes.',
    anchorpane: 'AnchorPane allows the edges of child nodes to be anchored to an offset from the anchor pane edges.',
    borderpane: 'A layout pane with top, bottom, left, right, and center positions.',
    button: 'A push button control that can be pressed by the user.',
    checkbox: 'A tri-state selection control that can be checked, unchecked, or indeterminate.',
    choicebox: 'A control that lets users choose one item from a small set of choices.',
    combobox: 'A single-selection list with an optional editable text field.',
    datepicker: 'A control that lets the user enter or select a date value.',
    flowpane: 'A layout pane that wraps child nodes at its boundary.',
    gridpane: 'A layout pane that places child nodes in a flexible grid of rows and columns.',
    group: 'A container that applies transforms and effects to a collection of child nodes.',
    hbox: 'A layout pane that lays out its children in a single horizontal row.',
    hyperlink: 'A button-like control that visually resembles a web hyperlink.',
    imageview: 'A node used for painting images loaded with the Image class.',
    label: 'A non-editable text control for displaying text or graphics.',
    listview: 'A control that displays a horizontal or vertical list of items.',
    menubar: 'A control that displays menus for application commands and actions.',
    menuitem: 'An item that can be selected from a menu.',
    pane: 'A simple layout pane with no default layout behavior beyond resizing managed children.',
    passwordfield: 'A text input control that masks the characters typed by the user.',
    progressbar: 'A control that shows progress as a horizontal bar.',
    progressindicator: 'A circular control used to show determinate or indeterminate progress.',
    radiobutton: 'A specialized toggle button intended to work with a ToggleGroup.',
    region: 'The base class for all JavaFX layout containers and controls that can be styled and resized.',
    scrollpane: 'A container that provides scrollbars for its content when needed.',
    separator: 'A horizontal or vertical line used to separate groups of controls.',
    splitpane: 'A control that lays out items side by side with draggable dividers.',
    stackpane: 'A layout pane that stacks its children on top of each other.',
    tab: 'Represents a selectable page within a TabPane.',
    tabpane: 'A control that lets users switch between multiple tabs.',
    tablecolumn: 'Defines a column inside a TableView.',
    tableview: 'A control that visualizes rows and columns of tabular data.',
    text: 'A shape for displaying text.',
    textarea: 'A multi-line text input control.',
    textfield: 'A single-line text input control.',
    tilepane: 'A layout pane that places children in uniformly sized tiles.',
    titledpane: 'A pane with a title that can be expanded or collapsed.',
    toolbar: 'A control that lays out commonly used actions in a row or column.',
    treeview: 'A control that displays hierarchical data as an expandable tree.',
    vbox: 'A layout pane that lays out its children in a single vertical column.',
};

const JAVA_MEMBER_MODIFIERS = '(?:public|protected|private|static|final|abstract|synchronized|native|strictfp|default)';
const JAVA_FIELD_MODIFIERS = '(?:public|protected|private|static|final|transient|volatile)';
const JAVA_TYPE_PATTERN = '[\\w.$<>\\[\\],?\\s]+';
const JAVA_METHOD_TYPE_PREFIX = `(?:<[^>]+>\\s*)?${JAVA_TYPE_PATTERN}`;

interface HoverTarget {
    kind: 'tag' | 'field' | 'method';
    name: string;
    range: vscode.Range;
}

interface JavaMemberHoverInfo {
    declaration: string;
    declaringClassName: string;
}

/**
 * Provides hover information for JavaFX FXML elements and controller bindings.
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
        const target = this.findHoverTarget(document, position, line);
        if (!target) {
            return undefined;
        }

        switch (target.kind) {
            case 'tag':
                return this.createJavafxTagHover(target.name, target.range);
            case 'field':
            case 'method':
                return this.createControllerMemberHover(document, target, token);
            default:
                return undefined;
        }
    }

    private findHoverTarget(
        document: vscode.TextDocument,
        position: vscode.Position,
        line: string
    ): HoverTarget | undefined {
        return this.getEventHandlerTarget(document, position, line)
            ?? this.getFxIdTarget(document, position, line)
            ?? this.getTagTarget(document, position, line);
    }

    private getTagTarget(
        document: vscode.TextDocument,
        position: vscode.Position,
        line: string
    ): HoverTarget | undefined {
        const pattern = /<\/?\s*([\w.:-]+)/g;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(line)) !== null) {
            const name = match[1];
            const nameStart = match.index + match[0].lastIndexOf(name);
            const nameEnd = nameStart + name.length;
            if (position.character >= nameStart && position.character <= nameEnd) {
                return {
                    kind: 'tag',
                    name,
                    range: new vscode.Range(
                        new vscode.Position(position.line, nameStart),
                        new vscode.Position(position.line, nameEnd)
                    ),
                };
            }
        }

        return undefined;
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
        kind: 'field' | 'method'
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

    private createJavafxTagHover(tagName: string, range: vscode.Range): vscode.Hover | undefined {
        const summary = JAVAFX_HOVER_SUMMARIES[this.normalizeJavafxTagName(tagName)];
        if (!summary) {
            return undefined;
        }

        const markdown = new vscode.MarkdownString();
        markdown.appendMarkdown(`**${this.escapeMarkdown(tagName)}**\n\n${summary}`);
        return new vscode.Hover(markdown, range);
    }

    private async createControllerMemberHover(
        document: vscode.TextDocument,
        target: HoverTarget,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const controllerClassName = this.findControllerInDocument(document);
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
        markdown.appendCodeblock(memberInfo.declaration, 'java');
        if (memberInfo.declaringClassName !== this.getSimpleClassName(controllerClassName)) {
            markdown.appendMarkdown(`\n\nDeclared in \`${this.escapeMarkdown(memberInfo.declaringClassName)}\`.`);
        }

        return new vscode.Hover(markdown, target.range);
    }

    private findControllerInDocument(document: vscode.TextDocument): string | undefined {
        const match = document.getText().match(/fx:controller\s*=\s*"([^"]+)"/);
        return match ? match[1] : undefined;
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

            const declaration = isMethod
                ? this.getMethodDeclaration(lineText, memberName)
                : this.getFieldDeclaration(lineText, memberName);
            if (!declaration) {
                if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine > 2) {
                    fxmlAnnotationLine = -1;
                }
                continue;
            }

            const memberInfo = { declaration, declaringClassName };
            if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine <= 2) {
                return memberInfo;
            }

            bestMatch ??= memberInfo;

            if (fxmlAnnotationLine >= 0 && i - fxmlAnnotationLine > 2) {
                fxmlAnnotationLine = -1;
            }
        }

        return bestMatch;
    }

    private getMethodDeclaration(line: string, methodName: string): string | undefined {
        const methodMatch = this.getMethodDeclarationMatch(line, methodName);
        if (!methodMatch) {
            return undefined;
        }

        const declaration = this.stripLeadingAnnotations(line)
            .replace(/\s*\{.*$/, '')
            .replace(/\s*;$/, '')
            .trim();

        const signaturePattern = new RegExp([
            '^(?:',
            `${JAVA_MEMBER_MODIFIERS}\\s+`,
            ')*(?<signature>',
            `${JAVA_METHOD_TYPE_PREFIX}\\s+`,
            `${this.escapeRegex(methodName)}\\s*\\([^)]*\\)`,
            '(?:\\s*throws\\s+[\\w.$,\\s]+)?',
            ')$',
        ].join(''));
        const signatureMatch = signaturePattern.exec(declaration);
        return signatureMatch?.groups?.signature?.trim() ?? declaration;
    }

    private getFieldDeclaration(line: string, fieldName: string): string | undefined {
        const fieldMatch = this.getFieldDeclarationMatch(line, fieldName);
        if (!fieldMatch) {
            return undefined;
        }

        const declaration = this.stripLeadingAnnotations(line)
            .replace(/\s*=.*$/, '')
            .replace(/\s*;$/, '')
            .trim();

        const fieldPattern = new RegExp([
            '^(?:',
            `${JAVA_FIELD_MODIFIERS}\\s+`,
            ')*(?<type>',
            `${JAVA_TYPE_PATTERN}?`,
            ')\\s+',
            `${this.escapeRegex(fieldName)}$`,
        ].join(''));
        const declarationMatch = fieldPattern.exec(declaration);
        return declarationMatch?.groups?.type
            ? `${declarationMatch.groups.type.trim()} ${fieldName}`
            : declaration;
    }

    private getMethodDeclarationMatch(line: string, methodName: string): RegExpExecArray | undefined {
        const methodPattern = new RegExp(`\\b${this.escapeRegex(methodName)}\\s*\\(`);
        const methodMatch = methodPattern.exec(line);
        if (!methodMatch) {
            return undefined;
        }

        const prefix = line.slice(0, methodMatch.index).trimEnd();
        if (!this.isValidMemberDeclarationPrefix(prefix)) {
            return undefined;
        }

        const lastPrefixChar = prefix.trimEnd().at(-1);
        return lastPrefixChar && (/\w/.test(lastPrefixChar) || lastPrefixChar === '>' || lastPrefixChar === ']')
            ? methodMatch
            : undefined;
    }

    private getFieldDeclarationMatch(line: string, fieldName: string): RegExpExecArray | undefined {
        const fieldPattern = new RegExp(`\\b${this.escapeRegex(fieldName)}\\b\\s*(?=[;=,)])`);
        const fieldMatch = fieldPattern.exec(line);
        if (!fieldMatch) {
            return undefined;
        }

        const prefix = line.slice(0, fieldMatch.index).trim();
        if (!this.isValidMemberDeclarationPrefix(prefix)) {
            return undefined;
        }

        return fieldMatch;
    }

    private isValidMemberDeclarationPrefix(prefix: string): boolean {
        if (!prefix || prefix.endsWith('.') || /[(){};]/.test(prefix)) {
            return false;
        }

        return !/\b(?:if|for|while|switch|catch|new|return|throw)\b/.test(prefix);
    }

    private stripLeadingAnnotations(line: string): string {
        return line.trim().replace(/^(?:@[\w.]+(?:\([^)]*\))?\s+)*/, '');
    }

    private normalizeJavafxTagName(tagName: string): string {
        return tagName.split('.').pop()?.toLowerCase() ?? tagName.toLowerCase();
    }

    private getSimpleClassName(className: string): string {
        return className.split('.').pop() || className;
    }

    private escapeMarkdown(value: string): string {
        return value.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
