import * as assert from 'assert';
import * as vscode from 'vscode';
import { FxmlDocumentSymbolProvider } from '../fxmlDocumentSymbolProvider';

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
