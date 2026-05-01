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
            '  <children/>',
            '</VBox>',
        ].join('\n'));

        const symbols = provider.provideDocumentSymbols(document, new vscode.CancellationTokenSource().token);

        assert.strictEqual(symbols.length, 1);
        assert.strictEqual(symbols[0].kind, vscode.SymbolKind.Module);

        const button = symbols[0].children.find(child => child.name === 'Button');
        assert.ok(button);
        assert.strictEqual(button!.kind, vscode.SymbolKind.Object);

        const label = symbols[0].children.find(child => child.name === 'Label');
        assert.ok(label);
        assert.strictEqual(label!.kind, vscode.SymbolKind.Variable);

        const fxDefine = symbols[0].children.find(child => child.name === 'fx:define');
        assert.ok(fxDefine);
        assert.strictEqual(fxDefine!.kind, vscode.SymbolKind.Namespace);

        const children = symbols[0].children.find(child => child.name === 'children');
        assert.ok(children);
        assert.strictEqual(children!.kind, vscode.SymbolKind.Field);
    });
});

function createMockFxmlDocument(text: string): vscode.TextDocument {
    const lines = text.split(/\r?\n/);

    return {
        getText: () => text,
        lineAt: (line: number) => ({ text: lines[line] ?? '' }),
    } as unknown as vscode.TextDocument;
}
