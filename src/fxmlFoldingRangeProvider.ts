import * as vscode from 'vscode';
import { SaxesParser } from 'saxes';

interface OpenTagNode {
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
        const text = document.getText();

        this.collectImportBlockRanges(document, ranges);

        const parser = new SaxesParser({ xmlns: false, position: true });
        const stack: OpenTagNode[] = [];

        parser.on('opentag', (tag) => {
            const openTagEndLine = parser.line - 1;
            const openTagStart = this.findTagStart(document, openTagEndLine, parser.column - 1);

            if (openTagStart.line < openTagEndLine) {
                ranges.push(
                    new vscode.FoldingRange(
                        openTagStart.line,
                        openTagEndLine,
                        vscode.FoldingRangeKind.Region
                    )
                );
            }

            const isSelfClosing = typeof tag !== 'string' && tag.isSelfClosing;
            if (!isSelfClosing) {
                stack.push({ startLine: openTagStart.line });
            }
        });

        parser.on('closetag', () => {
            if (stack.length === 0) {
                return;
            }

            const node = stack.pop()!;
            const closeTagEndLine = parser.line - 1;
            if (node.startLine < closeTagEndLine) {
                ranges.push(
                    new vscode.FoldingRange(
                        node.startLine,
                        closeTagEndLine,
                        vscode.FoldingRangeKind.Region
                    )
                );
            }
        });

        parser.on('error', () => {
            // Ignore malformed XML and return best-effort ranges.
        });

        parser.write(text).close();

        return ranges;
    }

    private collectImportBlockRanges(
        document: vscode.TextDocument,
        ranges: vscode.FoldingRange[]
    ): void {
        const importLines: number[] = [];

        for (let line = 0; line < document.lineCount; line++) {
            const lineText = document.lineAt(line).text;
            if (/^\s*<\?import\b[\s\S]*\?>\s*$/.test(lineText)) {
                importLines.push(line);
            }
        }

        if (importLines.length === 0) {
            return;
        }

        let groupStart = importLines[0];
        let previous = importLines[0];

        for (let i = 1; i < importLines.length; i++) {
            const current = importLines[i];
            if (current !== previous + 1) {
                if (groupStart < previous) {
                    ranges.push(new vscode.FoldingRange(groupStart, previous, vscode.FoldingRangeKind.Imports));
                }
                groupStart = current;
            }
            previous = current;
        }

        if (groupStart < previous) {
            ranges.push(new vscode.FoldingRange(groupStart, previous, vscode.FoldingRangeKind.Imports));
        }
    }

    private findTagStart(
        document: vscode.TextDocument,
        line: number,
        column: number
    ): vscode.Position {
        let l = line;
        const startColumn = column;

        while (l >= 0) {
            const lineText = document.lineAt(l).text;
            if (lineText.length === 0) {
                l--;
                continue;
            }
            const start = l === line ? Math.min(startColumn, lineText.length - 1) : lineText.length - 1;

            for (let i = start; i >= 0; i--) {
                if (lineText[i] === '<') {
                    return new vscode.Position(l, i);
                }
            }
            l--;
        }

        return new vscode.Position(line, column);
    }
}
