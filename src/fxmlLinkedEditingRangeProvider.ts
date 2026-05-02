import * as vscode from 'vscode';

const LINKED_TAG_NAME_PATTERN = /[:A-Za-z_](?:[\w.:]|-)*/;

interface ParsedTag {
    readonly name: string;
    readonly nameStart: number;
    readonly nameEnd: number;
    readonly isClosing: boolean;
    readonly isSelfClosing: boolean;
    matchingTag?: ParsedTag;
}

/**
 * Provides linked editing ranges for matching FXML start/end tag names.
 */
export class FxmlLinkedEditingRangeProvider implements vscode.LinkedEditingRangeProvider {

    provideLinkedEditingRanges(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.LinkedEditingRanges | undefined {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const tags = this.parseTags(document.getText(), token);
        if (!tags) {
            return undefined;
        }

        const offset = document.offsetAt(position);
        const currentTag = tags.find(tag => offset >= tag.nameStart && offset < tag.nameEnd);
        if (!currentTag?.matchingTag) {
            return undefined;
        }

        const openingTag = currentTag.isClosing ? currentTag.matchingTag : currentTag;
        const closingTag = currentTag.isClosing ? currentTag : currentTag.matchingTag;

        return new vscode.LinkedEditingRanges(
            [
                new vscode.Range(
                    document.positionAt(openingTag.nameStart),
                    document.positionAt(openingTag.nameEnd)
                ),
                new vscode.Range(
                    document.positionAt(closingTag.nameStart),
                    document.positionAt(closingTag.nameEnd)
                ),
            ],
            LINKED_TAG_NAME_PATTERN
        );
    }

    private parseTags(text: string, token: vscode.CancellationToken): ParsedTag[] | undefined {
        const tags: ParsedTag[] = [];
        const openTags: ParsedTag[] = [];
        let offset = 0;

        while (offset < text.length) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            const nextTagStart = text.indexOf('<', offset);
            if (nextTagStart === -1) {
                break;
            }

            const { end, tag } = this.parseTagAt(text, nextTagStart);
            if (tag) {
                tags.push(tag);

                if (!tag.isSelfClosing) {
                    if (tag.isClosing) {
                        for (let index = openTags.length - 1; index >= 0; index--) {
                            const openTag = openTags[index];
                            if (openTag.name === tag.name) {
                                openTag.matchingTag = tag;
                                tag.matchingTag = openTag;
                                openTags.splice(index, 1);
                                break;
                            }
                        }
                    } else {
                        openTags.push(tag);
                    }
                }
            }

            offset = end;
        }

        return tags;
    }

    private parseTagAt(text: string, start: number): { end: number; tag?: ParsedTag } {
        if (text.startsWith('<!--', start)) {
            return { end: this.findSequenceEnd(text, start + 4, '-->') };
        }

        if (text.startsWith('<![CDATA[', start)) {
            return { end: this.findSequenceEnd(text, start + 9, ']]>') };
        }

        if (text.startsWith('<?', start)) {
            return { end: this.findSequenceEnd(text, start + 2, '?>') };
        }

        if (text.startsWith('<!', start)) {
            return { end: this.findTagEnd(text, start + 2) };
        }

        let cursor = start + 1;
        let isClosing = false;

        if (text[cursor] === '/') {
            isClosing = true;
            cursor++;
        }

        if (!this.isTagNameStart(text[cursor] ?? '')) {
            return { end: start + 1 };
        }

        const nameStart = cursor;
        cursor++;

        while (cursor < text.length && this.isTagNameChar(text[cursor])) {
            cursor++;
        }

        const tagEnd = this.findTagEnd(text, cursor);
        if (tagEnd <= start) {
            return { end: text.length };
        }

        let trailing = tagEnd - 1;
        while (trailing > cursor && /\s/.test(text[trailing])) {
            trailing--;
        }

        return {
            end: tagEnd,
            tag: {
                name: text.slice(nameStart, cursor),
                nameStart,
                nameEnd: cursor,
                isClosing,
                isSelfClosing: !isClosing && text[trailing] === '/',
            },
        };
    }

    private findSequenceEnd(text: string, searchStart: number, terminator: string): number {
        const terminatorStart = text.indexOf(terminator, searchStart);
        return terminatorStart === -1 ? text.length : terminatorStart + terminator.length;
    }

    private findTagEnd(text: string, searchStart: number): number {
        let quote: '"' | '\'' | undefined;

        for (let index = searchStart; index < text.length; index++) {
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
                return index + 1;
            }
        }

        return text.length;
    }

    private isTagNameStart(char: string): boolean {
        return /[:A-Za-z_]/.test(char);
    }

    private isTagNameChar(char: string): boolean {
        return /[\w.:]/.test(char) || char === '-';
    }
}
