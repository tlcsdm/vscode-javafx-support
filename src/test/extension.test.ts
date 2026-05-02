import * as assert from 'assert';
import * as vscode from 'vscode';
import { ControllerDefinitionProvider } from '../controllerDefinitionProvider';
import { FxmlCodeLensProvider } from '../fxmlCodeLensProvider';
import { FxmlDefinitionProvider } from '../fxmlDefinitionProvider';
import { FxmlDocumentSymbolProvider } from '../fxmlDocumentSymbolProvider';
import { FxmlFormattingEditProvider, FxmlOnTypeFormattingEditProvider } from '../fxmlFormatter';
import { FxmlLinkedEditingRangeProvider } from '../fxmlLinkedEditingRangeProvider';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('unknowIfGuestInDream.tlcsdm-javafx-support'));
    });

    test('Should activate extension', async () => {
        const extension = vscode.extensions.getExtension('unknowIfGuestInDream.tlcsdm-javafx-support');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive);
        }
    });

    test('Should register Open in Scene Builder command', () => {
        return vscode.commands.getCommands(true).then(commands => {
            assert.ok(commands.includes('tlcsdm.javafxSupport.openInSceneBuilder'));
        });
    });

    test('Should enable linked editing by default for FXML files', () => {
        const editorConfig = vscode.workspace.getConfiguration('editor', { languageId: 'fxml' });

        assert.strictEqual(editorConfig.get('linkedEditing'), true);
    });

    test('Should provide semantic SymbolKind values for FXML outline', () => {
        const provider = new FxmlDocumentSymbolProvider();
        const document = createMockFxmlDocument([
            '<VBox xmlns:fx="http://javafx.com/fxml/1">',
            '  <Button text="Submit"/>',
            '  <Label fx:id="nameLabel" text="Name"/>',
            '  <fx:define>',
            '    <String fx:id="userName" fx:value="test"/>',
            '  </fx:define>',
            '  <CustomContainer fx:id="customRoot"/>',
            '  <children/>',
            '</VBox>',
        ].join('\n'));

        const symbols = provider.provideDocumentSymbols(document, new vscode.CancellationTokenSource().token);

        assert.strictEqual(symbols.length, 1);
        assert.strictEqual(symbols[0].kind, vscode.SymbolKind.Module);

        const button = symbols[0].children.find(child => child.name === 'Button');
        assert.ok(button);
        assert.strictEqual(button!.kind, vscode.SymbolKind.Class);

        const label = symbols[0].children.find(child => child.name === 'Label');
        assert.ok(label);
        assert.strictEqual(label!.kind, vscode.SymbolKind.Class);

        const fxDefine = symbols[0].children.find(child => child.name === 'fx:define');
        assert.ok(fxDefine);
        assert.strictEqual(fxDefine!.kind, vscode.SymbolKind.Namespace);

        const definedString = fxDefine!.children.find(child => child.name === 'String');
        assert.ok(definedString);
        assert.strictEqual(definedString!.kind, vscode.SymbolKind.Variable);

        const customContainer = symbols[0].children.find(child => child.name === 'CustomContainer');
        assert.ok(customContainer);
        assert.strictEqual(customContainer!.kind, vscode.SymbolKind.Class);

        const children = symbols[0].children.find(child => child.name === 'children');
        assert.ok(children);
        assert.strictEqual(children!.kind, vscode.SymbolKind.Field);
    });

    test('Providers should return early when cancellation is already requested', async () => {
        const cancelledToken = createCancelledToken();
        const document = createThrowingTextDocument();
        const position = new vscode.Position(0, 0);
        const range = new vscode.Range(position, position);
        const options: vscode.FormattingOptions = { insertSpaces: true, tabSize: 2 };

        const codeLenses = await new FxmlCodeLensProvider().provideCodeLenses(document, cancelledToken);
        assert.deepStrictEqual(codeLenses, []);

        const controllerDefinition = await new ControllerDefinitionProvider().provideDefinition(document, position, cancelledToken);
        assert.strictEqual(controllerDefinition, undefined);

        const fxmlDefinition = await new FxmlDefinitionProvider().provideDefinition(document, position, cancelledToken);
        assert.strictEqual(fxmlDefinition, undefined);

        const symbols = new FxmlDocumentSymbolProvider().provideDocumentSymbols(document, cancelledToken);
        assert.deepStrictEqual(symbols, []);

        const formatter = new FxmlFormattingEditProvider();
        assert.deepStrictEqual(formatter.provideDocumentFormattingEdits(document, options, cancelledToken), []);
        assert.deepStrictEqual(formatter.provideDocumentRangeFormattingEdits(document, range, options, cancelledToken), []);
        const onTypeFormatter = new FxmlOnTypeFormattingEditProvider();
        assert.deepStrictEqual(
            onTypeFormatter.provideOnTypeFormattingEdits(document, position, '>', options, cancelledToken),
            []
        );
        assert.deepStrictEqual(
            onTypeFormatter.provideOnTypeFormattingEdits(document, position, '/', options, cancelledToken),
            []
        );

        const result = new FxmlLinkedEditingRangeProvider().provideLinkedEditingRanges(document, position, cancelledToken);
        assert.strictEqual(result, undefined);
    });

    test('Should insert a matching closing tag when typing > after an opening FXML tag', () => {
        const provider = new FxmlOnTypeFormattingEditProvider();
        const document = createMockFxmlDocument('<VBox><Label>');
        const options: vscode.FormattingOptions = { insertSpaces: true, tabSize: 2 };

        const edits = provider.provideOnTypeFormattingEdits(
            document,
            document.positionAt(document.getText().length),
            '>',
            options,
            new vscode.CancellationTokenSource().token
        );

        assert.strictEqual(applyEdits(document, edits), '<VBox><Label></Label>');
    });

    test('Should not insert a duplicate closing tag when one already follows the cursor', () => {
        const provider = new FxmlOnTypeFormattingEditProvider();
        const document = createMockFxmlDocument('<VBox><Label></Label></VBox>');
        const options: vscode.FormattingOptions = { insertSpaces: true, tabSize: 2 };

        const edits = provider.provideOnTypeFormattingEdits(
            document,
            new vscode.Position(0, '<VBox><Label>'.length),
            '>',
            options,
            new vscode.CancellationTokenSource().token
        );

        assert.deepStrictEqual(edits, []);
    });

    test('Should complete the nearest closing tag name when typing / in an end tag', () => {
        const provider = new FxmlOnTypeFormattingEditProvider();
        const document = createMockFxmlDocument([
            '<VBox>',
            '  <Label>',
            '  </',
            '</VBox>',
        ].join('\n'));
        const options: vscode.FormattingOptions = { insertSpaces: true, tabSize: 2 };

        const edits = provider.provideOnTypeFormattingEdits(
            document,
            new vscode.Position(2, 4),
            '/',
            options,
            new vscode.CancellationTokenSource().token
        );

        assert.strictEqual(
            applyEdits(document, edits),
            [
                '<VBox>',
                '  <Label>',
                '  </Label>',
                '</VBox>',
            ].join('\n')
        );
    });

    test('Should provide linked editing ranges for matching FXML tag names', () => {
        const provider = new FxmlLinkedEditingRangeProvider();
        const document = createMockFxmlDocument([
            '<VBox xmlns:fx="http://javafx.com/fxml/1">',
            '  <user>',
            '    <Label text="Name"/>',
            '  </user>',
            '</VBox>',
        ].join('\n'));

        const ranges = provider.provideLinkedEditingRanges(
            document,
            new vscode.Position(1, 4),
            new vscode.CancellationTokenSource().token
        );

        assert.ok(ranges);
        assert.strictEqual(ranges!.ranges.length, 2);
        assert.strictEqual(getRangeText(document, ranges!.ranges[0]), 'user');
        assert.strictEqual(getRangeText(document, ranges!.ranges[1]), 'user');
        assert.strictEqual(ranges!.wordPattern?.source, '[:A-Za-z_](?:[\\w.:]|-)*');
    });

    test('Should provide linked editing ranges for FXML property tags such as bottom', () => {
        const provider = new FxmlLinkedEditingRangeProvider();
        const document = createMockFxmlDocument([
            '<BorderPane>',
            '  <bottom>',
            '  </bottom>',
            '</BorderPane>',
        ].join('\n'));

        const ranges = provider.provideLinkedEditingRanges(
            document,
            new vscode.Position(1, 4),
            new vscode.CancellationTokenSource().token
        );

        assert.ok(ranges);
        assert.strictEqual(ranges!.ranges.length, 2);
        assert.strictEqual(getRangeText(document, ranges!.ranges[0]), 'bottom');
        assert.strictEqual(getRangeText(document, ranges!.ranges[1]), 'bottom');
    });

    test('Should provide linked editing ranges at the end of nested FXML tag names', () => {
        const provider = new FxmlLinkedEditingRangeProvider();
        const document = createMockFxmlDocument([
            '<BorderPane>',
            '  <top>',
            '    <VBox fx:id="vboxTop" spacing="5">',
            '      <HBox spacing="8" alignment="CENTER_LEFT">',
            '        <Label text="%figma.url"/>',
            '      </HBox>',
            '    </VBox>',
            '  </top>',
            '</BorderPane>',
        ].join('\n'));

        const ranges = provider.provideLinkedEditingRanges(
            document,
            new vscode.Position(3, 11),
            new vscode.CancellationTokenSource().token
        );

        assert.ok(ranges);
        assert.strictEqual(ranges!.ranges.length, 2);
        assert.strictEqual(getRangeText(document, ranges!.ranges[0]), 'HBox');
        assert.strictEqual(getRangeText(document, ranges!.ranges[1]), 'HBox');
    });

    test('Should match the nearest nested closing tag for linked editing', () => {
        const provider = new FxmlLinkedEditingRangeProvider();
        const document = createMockFxmlDocument([
            '<root>',
            '  <item>',
            '    <item>',
            '    </item>',
            '  </item>',
            '</root>',
        ].join('\n'));

        const ranges = provider.provideLinkedEditingRanges(
            document,
            new vscode.Position(2, 6),
            new vscode.CancellationTokenSource().token
        );

        assert.ok(ranges);
        assert.strictEqual(ranges!.ranges[0].start.line, 2);
        assert.strictEqual(ranges!.ranges[1].start.line, 3);
        assert.strictEqual(getRangeText(document, ranges!.ranges[0]), 'item');
        assert.strictEqual(getRangeText(document, ranges!.ranges[1]), 'item');
    });

    test('Should ignore self-closing tags and non-tag positions for linked editing', () => {
        const provider = new FxmlLinkedEditingRangeProvider();
        const document = createMockFxmlDocument([
            '<VBox>',
            '  <Label text="Name"/>',
            '</VBox>',
        ].join('\n'));
        const token = new vscode.CancellationTokenSource().token;

        assert.strictEqual(
            provider.provideLinkedEditingRanges(document, new vscode.Position(1, 4), token),
            undefined
        );
        assert.strictEqual(
            provider.provideLinkedEditingRanges(document, new vscode.Position(1, 15), token),
            undefined
        );
    });
});

function createMockFxmlDocument(text: string): vscode.TextDocument {
    const lines = text.split(/\r?\n/);
    const contentUri = vscode.Uri.parse('untitled:test.fxml');
    const lineStartOffsets: number[] = [];
    let runningOffset = 0;
    for (const line of lines) {
        lineStartOffsets.push(runningOffset);
        runningOffset += line.length + 1;
    }

    const buildTextLine = (line: number): vscode.TextLine => {
        const safeLine = Math.max(0, Math.min(line, lines.length - 1));
        const lineText = lines[safeLine] ?? '';
        const start = new vscode.Position(safeLine, 0);
        const end = new vscode.Position(safeLine, lineText.length);

        return {
            lineNumber: safeLine,
            text: lineText,
            range: new vscode.Range(start, end),
            rangeIncludingLineBreak: new vscode.Range(start, new vscode.Position(safeLine, lineText.length + 1)),
            firstNonWhitespaceCharacterIndex: lineText.search(/\S|$/),
            isEmptyOrWhitespace: /^\s*$/.test(lineText),
        };
    };

    return {
        uri: contentUri,
        languageId: 'fxml',
        version: 1,
        lineCount: lines.length,
        getText: () => text,
        lineAt: (lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return buildTextLine(line);
        },
        positionAt: (offset: number) => {
            const normalizedOffset = Math.max(0, Math.min(offset, text.length));
            const before = text.slice(0, normalizedOffset);
            const parts = before.split(/\r?\n/);
            return new vscode.Position(parts.length - 1, parts[parts.length - 1].length);
        },
        offsetAt: (position: vscode.Position) => {
            const safeLine = Math.max(0, Math.min(position.line, lines.length - 1));
            const lineOffset = lineStartOffsets[safeLine] ?? 0;
            return lineOffset + Math.max(0, Math.min(position.character, lines[safeLine].length));
        },
    } as unknown as vscode.TextDocument;
}

function createCancelledToken(): vscode.CancellationToken {
    const source = new vscode.CancellationTokenSource();
    source.cancel();
    return source.token;
}

function getRangeText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText();
    return text.slice(document.offsetAt(range.start), document.offsetAt(range.end));
}

function applyEdits(document: vscode.TextDocument, edits: readonly vscode.TextEdit[]): string {
    const text = document.getText();

    return [...edits]
        .sort((left, right) => document.offsetAt(right.range.start) - document.offsetAt(left.range.start))
        .reduce((currentText, edit) => {
            const start = document.offsetAt(edit.range.start);
            const end = document.offsetAt(edit.range.end);
            return currentText.slice(0, start) + edit.newText + currentText.slice(end);
        }, text);
}

function createThrowingTextDocument(): vscode.TextDocument {
    return new Proxy({}, {
        get() {
            throw new Error('document should not be accessed after cancellation');
        },
    }) as vscode.TextDocument;
}
