import * as assert from 'assert';
import * as vscode from 'vscode';
import { FxmlFoldingRangeProvider } from '../fxmlFoldingRangeProvider';

class MockTextDocument {
    private readonly lines: string[];

    constructor(private readonly content: string) {
        this.lines = content.split(/\r?\n/);
    }

    getText(): string {
        return this.content;
    }

    lineAt(line: number): vscode.TextLine {
        const text = this.lines[line] ?? '';
        return {
            lineNumber: line,
            text,
            range: new vscode.Range(line, 0, line, text.length),
            rangeIncludingLineBreak: new vscode.Range(line, 0, line, text.length),
            firstNonWhitespaceCharacterIndex: text.search(/\S|$/),
            isEmptyOrWhitespace: text.trim().length === 0,
        };
    }

    get lineCount(): number {
        return this.lines.length;
    }
}

function createMockTextDocument(content: string): vscode.TextDocument {
    return new MockTextDocument(content) as unknown as vscode.TextDocument;
}

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

    test('Should provide folding range for contiguous <?import?> block', () => {
        const document = createMockTextDocument(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<?import javafx.scene.layout.VBox?>\n` +
            `<?import javafx.scene.control.Button?>\n` +
            `<?import javafx.scene.control.Label?>\n` +
            `<VBox/>`
        );
        const provider = new FxmlFoldingRangeProvider();
        const ranges = provider.provideFoldingRanges(
            document,
            {} as vscode.FoldingContext,
            new vscode.CancellationTokenSource().token
        );

        const importRange = ranges.find(range =>
            range.start === 1
            && range.end === 3
            && range.kind === vscode.FoldingRangeKind.Imports
        );

        assert.ok(importRange, 'Expected an imports folding range from line 1 to 3.');
    });

    test('Should provide import folding for import-only snippet', () => {
        const document = createMockTextDocument(
            `<?import javafx.geometry.Insets?>\n` +
            `<?import javafx.scene.control.*?>\n` +
            `<?import javafx.scene.layout.*?>`
        );
        const provider = new FxmlFoldingRangeProvider();
        const ranges = provider.provideFoldingRanges(
            document,
            {} as vscode.FoldingContext,
            new vscode.CancellationTokenSource().token
        );

        const importRange = ranges.find(range =>
            range.start === 0
            && range.end === 2
            && range.kind === vscode.FoldingRangeKind.Imports
        );

        assert.ok(importRange, 'Expected an imports folding range from line 0 to 2.');
    });

    test('Should provide import folding after XML declaration and blank line', () => {
        const document = createMockTextDocument(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `\n` +
            `<?import javafx.geometry.Insets?>\n` +
            `<?import javafx.scene.control.*?>\n` +
            `<?import javafx.scene.layout.*?>\n` +
            `\n` +
            `<BorderPane xmlns="http://javafx.com/javafx/21"\n` +
            `            xmlns:fx="http://javafx.com/fxml/1">\n` +
            `</BorderPane>`
        );
        const provider = new FxmlFoldingRangeProvider();
        const ranges = provider.provideFoldingRanges(
            document,
            {} as vscode.FoldingContext,
            new vscode.CancellationTokenSource().token
        );

        const importRange = ranges.find(range =>
            range.start === 2
            && range.end === 4
            && range.kind === vscode.FoldingRangeKind.Imports
        );

        assert.ok(importRange, 'Expected an imports folding range from line 2 to 4.');
    });

    test('Should provide folding range for multi-line opening tag attributes', () => {
        const document = createMockTextDocument(
            `<VBox>\n` +
            `    <Button\n` +
            `        fx:id="myButton"\n` +
            `        text="Click Me"/>\n` +
            `</VBox>`
        );
        const provider = new FxmlFoldingRangeProvider();
        const ranges = provider.provideFoldingRanges(
            document,
            {} as vscode.FoldingContext,
            new vscode.CancellationTokenSource().token
        );

        const multilineAttributeRange = ranges.find(range =>
            range.start === 1
            && range.end === 3
            && range.kind === vscode.FoldingRangeKind.Region
        );

        assert.ok(multilineAttributeRange, 'Expected a region folding range from line 1 to 3.');
    });

    test('Should return folding ranges in ascending order', () => {
        const document = createMockTextDocument(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<?import javafx.scene.layout.VBox?>\n` +
            `<?import javafx.scene.control.Button?>\n` +
            `<VBox>\n` +
            `    <children>\n` +
            `        <Button text="ok"/>\n` +
            `    </children>\n` +
            `</VBox>`
        );
        const provider = new FxmlFoldingRangeProvider();
        const ranges = provider.provideFoldingRanges(
            document,
            {} as vscode.FoldingContext,
            new vscode.CancellationTokenSource().token
        );

        for (let i = 1; i < ranges.length; i++) {
            const previous = ranges[i - 1];
            const current = ranges[i];
            const isOrdered = previous.start < current.start
                || (previous.start === current.start && previous.end <= current.end);
            assert.ok(isOrdered, `Expected ordered ranges, but got ${previous.start}-${previous.end} before ${current.start}-${current.end}.`);
        }
    });
});
