import * as vscode from 'vscode';

interface ElementNode {
    name: string;
    startLine: number;
}

/**
 * Provides folding ranges for FXML files.
 *
 * Adds ranges for:
 * - contiguous `<?import ...?>` processing-instruction blocks
 * - multi-line opening tags (commonly used for multi-line attributes)
 * - XML element bodies
 */
export class FxmlFoldingRangeProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        _token: vscode.CancellationToken
    ): vscode.FoldingRange[] {
        const ranges: vscode.FoldingRange[] = [];

        this.collectImportBlockRanges(document, ranges);
        this.collectElementRanges(document, ranges);

        return ranges;
    }

    private collectImportBlockRanges(
        document: vscode.TextDocument,
        ranges: vscode.FoldingRange[]
    ): void {
        let groupStart: number | undefined;
        let previousImportLine: number | undefined;

        for (let line = 0; line < document.lineCount; line++) {
            const lineText = document.lineAt(line).text;
            if (/^\s*<\?import\s+[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\.\*)*\s*\?>\s*$/.test(lineText)) {
                groupStart ??= line;
                previousImportLine = line;
                continue;
            }

            this.pushImportRange(groupStart, previousImportLine, ranges);
            groupStart = undefined;
            previousImportLine = undefined;
        }

        this.pushImportRange(groupStart, previousImportLine, ranges);
    }

    private pushImportRange(
        groupStart: number | undefined,
        previousImportLine: number | undefined,
        ranges: vscode.FoldingRange[]
    ): void {
        if (groupStart !== undefined && previousImportLine !== undefined && groupStart < previousImportLine) {
            ranges.push(new vscode.FoldingRange(groupStart, previousImportLine, vscode.FoldingRangeKind.Imports));
        }
    }

    private collectElementRanges(
        document: vscode.TextDocument,
        ranges: vscode.FoldingRange[]
    ): void {
        const text = document.getText();
        const lineStarts = this.getLineStarts(text);
        const stack: ElementNode[] = [];

        let offset = 0;
        while (offset < text.length) {
            const tagStart = text.indexOf('<', offset);
            if (tagStart === -1) {
                return;
            }

            if (text.startsWith('<!--', tagStart)) {
                offset = this.skipUntil(text, tagStart + 4, '-->');
                continue;
            }

            if (text.startsWith('<![CDATA[', tagStart)) {
                offset = this.skipUntil(text, tagStart + 9, ']]>');
                continue;
            }

            if (text.startsWith('<?', tagStart)) {
                offset = this.skipUntil(text, tagStart + 2, '?>');
                continue;
            }

            if (text.startsWith('<!', tagStart)) {
                const declarationEnd = this.findTagEnd(text, tagStart + 2);
                if (declarationEnd === -1) {
                    return;
                }
                offset = declarationEnd + 1;
                continue;
            }

            const isClosingTag = text[tagStart + 1] === '/';
            const tagNameStart = tagStart + (isClosingTag ? 2 : 1);
            const tagNameEnd = this.readTagNameEnd(text, tagNameStart);
            if (tagNameEnd === tagNameStart) {
                offset = tagStart + 1;
                continue;
            }

            const tagName = text.slice(tagNameStart, tagNameEnd);
            const tagEnd = this.findTagEnd(text, tagNameEnd);
            if (tagEnd === -1) {
                return;
            }

            const startLine = this.offsetToLine(tagStart, lineStarts);
            const endLine = this.offsetToLine(tagEnd, lineStarts);
            const isSelfClosingTag = this.isSelfClosingTag(text, tagEnd);

            offset = tagEnd + 1;

            if (!tagName) {
                continue;
            }

            if (isClosingTag) {
                this.closeElement(tagName, endLine, stack, ranges);
                continue;
            }

            if (startLine < endLine) {
                ranges.push(new vscode.FoldingRange(startLine, endLine, vscode.FoldingRangeKind.Region));
            }

            if (!isSelfClosingTag) {
                stack.push({ name: tagName, startLine });
            }
        }
    }

    private closeElement(
        tagName: string,
        endLine: number,
        stack: ElementNode[],
        ranges: vscode.FoldingRange[]
    ): void {
        for (let i = stack.length - 1; i >= 0; i--) {
            const node = stack[i];
            if (node.name !== tagName) {
                continue;
            }

            stack.length = i;
            if (node.startLine < endLine) {
                ranges.push(new vscode.FoldingRange(node.startLine, endLine, vscode.FoldingRangeKind.Region));
            }
            return;
        }
    }

    private skipUntil(text: string, startOffset: number, marker: string): number {
        const endOffset = text.indexOf(marker, startOffset);
        return endOffset === -1 ? text.length : endOffset + marker.length;
    }

    private readTagNameEnd(text: string, startOffset: number): number {
        if (!/[A-Za-z_]/.test(text[startOffset])) {
            return startOffset;
        }

        let offset = startOffset;
        while (offset < text.length && /[\w:.-]/.test(text[offset])) {
            offset++;
        }
        return offset;
    }

    private findTagEnd(text: string, startOffset: number): number {
        let quote: string | undefined;

        for (let offset = startOffset; offset < text.length; offset++) {
            const char = text[offset];
            if (quote) {
                if (char === quote) {
                    quote = undefined;
                }
                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }

            if (char === '>') {
                return offset;
            }
        }

        return -1;
    }

    private isSelfClosingTag(text: string, tagEnd: number): boolean {
        let offset = tagEnd - 1;
        while (offset >= 0 && /\s/.test(text[offset])) {
            offset--;
        }
        return text[offset] === '/';
    }

    private getLineStarts(text: string): number[] {
        const lineStarts = [0];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
                lineStarts.push(i + 1);
            }
        }
        return lineStarts;
    }

    private offsetToLine(offset: number, lineStarts: readonly number[]): number {
        if (offset <= 0) {
            return 0;
        }

        let low = 0;
        let high = lineStarts.length - 1;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            const lineStart = lineStarts[middle];
            const nextLineStart = lineStarts[middle + 1] ?? Number.POSITIVE_INFINITY;

            if (offset < lineStart) {
                high = middle - 1;
            } else if (offset >= nextLineStart) {
                low = middle + 1;
            } else {
                return middle;
            }
        }

        return lineStarts.length - 1;
    }
}
