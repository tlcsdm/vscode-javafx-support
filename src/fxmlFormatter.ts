import * as vscode from 'vscode';

type TagInfo = {
    name: string;
    isClosing: boolean;
    isSelfClosing: boolean;
};

/**
 * FXML Document Formatting Provider.
 * Provides XML formatting specifically designed for FXML files.
 */
export class FxmlFormattingEditProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {

    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        if (token.isCancellationRequested) {
            return [];
        }

        const range = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        return this.formatRange(document, range, options, token);
    }

    provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        if (token.isCancellationRequested) {
            return [];
        }

        return this.formatRange(document, range, options, token);
    }

    private formatRange(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        if (token.isCancellationRequested) {
            return [];
        }

        const text = document.getText(range);
        const formatted = this.formatXml(text, options, token);

        if (formatted === undefined) {
            return [];
        }

        if (formatted === text) {
            return [];
        }

        return [vscode.TextEdit.replace(range, formatted)];
    }

    /**
     * Format XML/FXML content with proper indentation
     */
    private formatXml(
        xml: string,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): string | undefined {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';

        // Normalize line endings
        const text = xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Preserve XML declaration and processing instructions at the top
        const lines: string[] = [];
        const parts = this.tokenize(text, token);
        if (parts === undefined) {
            return undefined;
        }

        let level = 0;

        for (const part of parts) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            const trimmed = part.trim();
            if (trimmed === '') {
                continue;
            }

            if (trimmed.startsWith('<?')) {
                // Processing instruction (<?xml ... ?>, <?import ... ?>)
                lines.push(trimmed);
            } else if (trimmed.startsWith('<!--')) {
                // Comment
                lines.push(indent.repeat(level) + trimmed);
            } else if (trimmed.startsWith('</')) {
                // Closing tag
                level = Math.max(0, level - 1);
                lines.push(indent.repeat(level) + trimmed);
            } else if (trimmed.endsWith('/>')) {
                // Self-closing tag
                lines.push(indent.repeat(level) + trimmed);
            } else if (trimmed.startsWith('<')) {
                // Opening tag
                lines.push(indent.repeat(level) + trimmed);
                // Only increase indent if it's an opening tag (not self-closing and not a processing instruction)
                if (!trimmed.endsWith('/>') && !trimmed.startsWith('<?')) {
                    level++;
                }
            } else {
                // Text content
                lines.push(indent.repeat(level) + trimmed);
            }
        }

        let result = lines.join('\n');

        // Ensure the file ends with a newline
        if (!result.endsWith('\n')) {
            result += '\n';
        }

        return result;
    }

    /**
     * Tokenize XML content into tags and text segments
     */
    private tokenize(xml: string, token: vscode.CancellationToken): string[] | undefined {
        const tokens: string[] = [];
        let current = '';
        let inTag = false;

        for (let i = 0; i < xml.length; i++) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            const char = xml[i];

            // Handle CDATA sections
            if (xml.substring(i, i + 9) === '<![CDATA[') {
                if (current.trim()) {
                    tokens.push(current);
                }
                const cdataEnd = xml.indexOf(']]>', i);
                if (cdataEnd >= 0) {
                    tokens.push(xml.substring(i, cdataEnd + 3));
                    i = cdataEnd + 2;
                    current = '';
                    continue;
                }
            }

            // Handle comments
            if (xml.substring(i, i + 4) === '<!--') {
                if (current.trim()) {
                    tokens.push(current);
                }
                const commentEnd = xml.indexOf('-->', i);
                if (commentEnd >= 0) {
                    tokens.push(xml.substring(i, commentEnd + 3));
                    i = commentEnd + 2;
                    current = '';
                    continue;
                }
            }

            if (char === '<') {
                if (current.trim()) {
                    tokens.push(current);
                }
                current = '<';
                inTag = true;
            } else if (char === '>' && inTag) {
                current += '>';
                tokens.push(current);
                current = '';
                inTag = false;
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            tokens.push(current);
        }

        return tokens;
    }
}

export class FxmlOnTypeFormattingEditProvider implements vscode.OnTypeFormattingEditProvider {

    provideOnTypeFormattingEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        ch: string,
        _options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        if (token.isCancellationRequested) {
            return [];
        }

        if (ch === '>') {
            return this.provideAutoCloseTagEdits(document, position, token);
        }

        if (ch === '/') {
            return this.provideClosingTagNameEdits(document, position, token);
        }

        return [];
    }

    private provideAutoCloseTagEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const text = document.getText();
        const offset = document.offsetAt(position);
        const tag = this.findTagEndingAt(text, offset - 1, token);
        if (!tag || tag.isClosing || tag.isSelfClosing) {
            return [];
        }

        const after = text.slice(offset);
        if (after.match(new RegExp(`^\\s*</${this.escapeRegExp(tag.name)}\\s*>`))) {
            return [];
        }

        return [vscode.TextEdit.insert(position, `</${tag.name}>`)];
    }

    private provideClosingTagNameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const text = document.getText();
        const offset = document.offsetAt(position);
        if (offset < 2 || text.slice(offset - 2, offset) !== '</') {
            return [];
        }

        const tagName = this.findInnermostUnclosedTagName(text.slice(0, offset - 2), token);
        if (!tagName) {
            return [];
        }

        const after = text.slice(offset);
        if (after.startsWith(`${tagName}>`)) {
            return [];
        }

        return [vscode.TextEdit.insert(position, `${tagName}>`)];
    }

    private findTagEndingAt(
        text: string,
        endOffset: number,
        token: vscode.CancellationToken
    ): TagInfo | undefined {
        for (let start = endOffset; start >= 0; start--) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            if (text[start] !== '<') {
                continue;
            }

            const tagEnd = this.findTagEnd(text, start, token);
            if (tagEnd !== endOffset) {
                continue;
            }

            const tag = this.parseTag(text.slice(start, tagEnd + 1));
            if (tag) {
                return tag;
            }
        }

        return undefined;
    }

    private findInnermostUnclosedTagName(
        text: string,
        token: vscode.CancellationToken
    ): string | undefined {
        const stack: string[] = [];

        for (let index = 0; index < text.length; index++) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            if (text[index] !== '<') {
                continue;
            }

            if (text.startsWith('<!--', index)) {
                const commentEnd = text.indexOf('-->', index + 4);
                if (commentEnd < 0) {
                    return stack[stack.length - 1];
                }
                index = commentEnd + 2;
                continue;
            }

            if (text.startsWith('<![CDATA[', index)) {
                const cdataEnd = text.indexOf(']]>', index + 9);
                if (cdataEnd < 0) {
                    return stack[stack.length - 1];
                }
                index = cdataEnd + 2;
                continue;
            }

            if (text.startsWith('<?', index)) {
                const instructionEnd = text.indexOf('?>', index + 2);
                if (instructionEnd < 0) {
                    return stack[stack.length - 1];
                }
                index = instructionEnd + 1;
                continue;
            }

            if (text.startsWith('<!', index)) {
                const declarationEnd = this.findTagEnd(text, index, token);
                if (declarationEnd < 0) {
                    return stack[stack.length - 1];
                }
                index = declarationEnd;
                continue;
            }

            const tagEnd = this.findTagEnd(text, index, token);
            if (tagEnd < 0) {
                return stack[stack.length - 1];
            }

            const tag = this.parseTag(text.slice(index, tagEnd + 1));
            if (tag) {
                if (tag.isClosing) {
                    if (stack[stack.length - 1] === tag.name) {
                        stack.pop();
                    } else {
                        const stackIndex = stack.lastIndexOf(tag.name);
                        if (stackIndex >= 0) {
                            stack.splice(stackIndex, 1);
                        }
                    }
                } else if (!tag.isSelfClosing) {
                    stack.push(tag.name);
                }
            }

            index = tagEnd;
        }

        return stack[stack.length - 1];
    }

    private findTagEnd(
        text: string,
        startOffset: number,
        token: vscode.CancellationToken
    ): number {
        let quote: '"' | '\'' | undefined;

        for (let index = startOffset + 1; index < text.length; index++) {
            if (token.isCancellationRequested) {
                return -1;
            }

            const char = text[index];
            if (quote) {
                if (char === quote) {
                    quote = undefined;
                }
                continue;
            }

            if (char === '"' || char === '\'') {
                quote = char;
                continue;
            }

            if (char === '>') {
                return index;
            }
        }

        return -1;
    }

    private parseTag(fragment: string): TagInfo | undefined {
        if (
            fragment.startsWith('<!--')
            || fragment.startsWith('<?')
            || fragment.startsWith('<!')
        ) {
            return undefined;
        }

        // Capture groups: 1 = optional leading slash for closing tags,
        // 2 = tag name, 3 = optional trailing slash for self-closing tags.
        const match = /^<\s*(\/?)\s*([:A-Za-z_][\w.:-]*)(?:[\s\S]*?)(\/?)\s*>$/.exec(fragment);
        if (!match) {
            return undefined;
        }

        return {
            name: match[2],
            isClosing: match[1] === '/',
            isSelfClosing: match[3] === '/',
        };
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
