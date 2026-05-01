import * as vscode from 'vscode';

interface ElementNode {
    name: string;
    startLine: number;
}

// Skips XML constructs that cannot contain element folds, then captures real XML/FXML tags.
const fxmlTagPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<\/?([A-Za-z_][\w:.-]*)(?:\s[\s\S]*?)?>/g;

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
            if (/^\s*<\?import\b.*\?>\s*$/.test(lineText)) {
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

        for (const match of text.matchAll(fxmlTagPattern)) {
            const tagText = match[0];
            const tagName = match[1];
            if (!tagName) {
                continue;
            }

            const startLine = this.offsetToLine(match.index, lineStarts);
            const endLine = this.offsetToLine(match.index + tagText.length - 1, lineStarts);
            const isClosingTag = tagText.startsWith('</');
            const isSelfClosingTag = /\/\s*>$/.test(tagText);

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
        const node = stack.pop();
        if (!node || node.name !== tagName) {
            return;
        }

        if (node.startLine < endLine) {
            ranges.push(new vscode.FoldingRange(node.startLine, endLine, vscode.FoldingRangeKind.Region));
        }
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
