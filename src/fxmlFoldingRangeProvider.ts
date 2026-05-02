import * as vscode from 'vscode';
import { SaxesParser } from 'saxes';

interface ElementRangeStart {
    startLine: number;
    isSelfClosing: boolean;
}

/**
 * Provides folding ranges for FXML files.
 */
export class FxmlFoldingRangeProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        token: vscode.CancellationToken
    ): vscode.FoldingRange[] {
        if (token.isCancellationRequested) {
            return [];
        }

        const ranges = this.collectImportRanges(document);
        const text = document.getText();
        const parser = new SaxesParser({ xmlns: false, position: true });
        const stack: ElementRangeStart[] = [];

        parser.on('opentag', (tag) => {
            if (token.isCancellationRequested) {
                return;
            }

            const line = parser.line - 1;
            const column = parser.column - 1;
            const tagStart = this.findTagStart(document, line, column);
            stack.push({
                startLine: tagStart.line,
                isSelfClosing: tag.isSelfClosing,
            });
        });

        parser.on('closetag', () => {
            if (token.isCancellationRequested || stack.length === 0) {
                return;
            }

            const node = stack.pop()!;
            const endLine = parser.line - 1;
            if (node.startLine < endLine) {
                const kind = node.isSelfClosing ? undefined : vscode.FoldingRangeKind.Region;
                ranges.push(new vscode.FoldingRange(node.startLine, endLine, kind));
            }
        });

        parser.on('error', () => {
            // Ignore malformed in-progress documents and return the ranges collected so far.
        });

        parser.write(text).close();

        if (token.isCancellationRequested) {
            return [];
        }

        return ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    }

    private collectImportRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
        const ranges: vscode.FoldingRange[] = [];
        let blockStart: number | undefined;
        let blockEnd: number | undefined;

        const closeBlock = () => {
            if (blockStart !== undefined && blockEnd !== undefined && blockStart < blockEnd) {
                ranges.push(new vscode.FoldingRange(blockStart, blockEnd, vscode.FoldingRangeKind.Imports));
            }
            blockStart = undefined;
            blockEnd = undefined;
        };

        for (let line = 0; line < document.lineCount; line++) {
            const lineText = document.lineAt(line).text;
            if (this.isImportProcessingInstruction(lineText)) {
                blockStart ??= line;
                blockEnd = line;
            } else {
                closeBlock();
            }
        }

        closeBlock();
        return ranges;
    }

    private isImportProcessingInstruction(lineText: string): boolean {
        const normalizedLineText = lineText
            .replace(/&(?:amp;)?lt;/g, '<')
            .replace(/&(?:amp;)?gt;/g, '>');
        return /^\s*<\?import\b.*\?>\s*$/.test(normalizedLineText);
    }

    private findTagStart(
        document: vscode.TextDocument,
        line: number,
        column: number
    ): vscode.Position {
        let currentLine = line;
        const startColumn = column;

        while (currentLine >= 0) {
            const lineText = document.lineAt(currentLine).text;
            if (lineText.length === 0) {
                currentLine--;
                continue;
            }
            const start = currentLine === line ? Math.min(startColumn, lineText.length - 1) : lineText.length - 1;

            for (let i = start; i >= 0; i--) {
                if (lineText[i] === '<') {
                    return new vscode.Position(currentLine, i);
                }
            }
            currentLine--;
        }

        return new vscode.Position(line, column);
    }
}
