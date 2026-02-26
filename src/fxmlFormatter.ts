import * as vscode from 'vscode';

/**
 * FXML Document Formatting Provider.
 * Provides XML formatting specifically designed for FXML files.
 */
export class FxmlFormattingEditProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {

    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const range = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        return this.formatRange(document, range, options);
    }

    provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        return this.formatRange(document, range, options);
    }

    private formatRange(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
        const text = document.getText(range);
        const formatted = this.formatXml(text, options);

        if (formatted === text) {
            return [];
        }

        return [vscode.TextEdit.replace(range, formatted)];
    }

    /**
     * Format XML/FXML content with proper indentation
     */
    private formatXml(xml: string, options: vscode.FormattingOptions): string {
        const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';

        // Normalize line endings
        const text = xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Preserve XML declaration and processing instructions at the top
        const lines: string[] = [];
        const parts = this.tokenize(text);

        let level = 0;

        for (const part of parts) {
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
    private tokenize(xml: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inTag = false;

        for (let i = 0; i < xml.length; i++) {
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
