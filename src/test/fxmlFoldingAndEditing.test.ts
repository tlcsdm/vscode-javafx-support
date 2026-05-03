import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { FxmlFoldingRangeProvider } from '../fxml/fxmlFoldingRangeProvider';
import { FxmlLinkedEditingRangeProvider } from '../fxml/fxmlLinkedEditingRangeProvider';
import { suiteWithResets, createMockFxmlDocument, getRangeText } from './shared';

suiteWithResets('FXML Folding and Linked Editing', () => {
    test('Should fold consecutive FXML import processing instructions as imports', () => {
        const provider = new FxmlFoldingRangeProvider();
        const document = createMockFxmlDocument([
            '<?xml version="1.0" encoding="UTF-8"?>',
            '',
            '<?import javafx.geometry.Insets?>',
            '<?import javafx.scene.control.*?>',
            '<?import javafx.scene.layout.*?>',
            '',
            '<VBox/>',
        ].join('\n'));

        const ranges = provider.provideFoldingRanges(
            document,
            {},
            new vscode.CancellationTokenSource().token
        );

        const importRange = ranges.find(range => range.kind === vscode.FoldingRangeKind.Imports);
        assert.ok(importRange);
        assert.strictEqual(importRange!.start, 2);
        assert.strictEqual(importRange!.end, 4);
    });

    test('Should fold FXML import processing instructions around declarations and comments', () => {
        const provider = new FxmlFoldingRangeProvider();
        const token = new vscode.CancellationTokenSource().token;
        const documents = [
            {
                text: [
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    '<?import javafx.scene.layout.HBox?>',
                    '<?import javafx.scene.control.Label?>',
                    '<?import javafx.scene.control.Button?>',
                    '<HBox spacing="10" alignment="CENTER_LEFT"',
                    '      xmlns:fx="http://javafx.com/fxml">',
                    '    <Label text="My Application" />',
                    '    <Button text="Login" />',
                    '    <Button text="Settings" />',
                    '</HBox>',
                ].join('\n'),
                start: 1,
                end: 3,
            },
            {
                text: [
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    '',
                    '<?import javafx.scene.layout.FlowPane?>',
                    '<?import javafx.scene.media.MediaView?>',
                    '<!--',
                    '  ~ Copyright',
                    '  -->',
                    '<FlowPane fx:id="rootFlowPane" xmlns="http://javafx.com/javafx"/>',
                ].join('\n'),
                start: 2,
                end: 3,
            },
            {
                text: [
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    '',
                    '<!--',
                    '  ~ Copyright',
                    '  -->',
                    '<?import javafx.geometry.Insets?>',
                    '<?import javafx.scene.control.Button?>',
                    '<?import javafx.scene.control.CheckBox?>',
                    '<?import javafx.scene.control.Label?>',
                    '<?import javafx.scene.layout.AnchorPane?>',
                    '<AnchorPane xmlns="http://javafx.com/javafx/8.0.171"/>',
                ].join('\n'),
                start: 5,
                end: 9,
            },
        ];

        for (const { text, start, end } of documents) {
            const ranges = provider.provideFoldingRanges(
                createMockFxmlDocument(text),
                {},
                token
            );

            assert.ok(
                ranges.some(range =>
                    range.kind === vscode.FoldingRangeKind.Imports &&
                    range.start === start &&
                    range.end === end
                )
            );
        }
    });

    test('Should provide import folding ranges for untitled FXML documents', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'fxml',
            content: [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<?import javafx.scene.layout.HBox?>',
                '<?import javafx.scene.control.Label?>',
                '<?import javafx.scene.control.Button?>',
                '<HBox spacing="10" alignment="CENTER_LEFT"',
                '      xmlns:fx="http://javafx.com/fxml">',
                '    <Label text="My Application" />',
                '</HBox>',
            ].join('\n'),
        });

        const ranges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
            'vscode.executeFoldingRangeProvider',
            document.uri
        );

        assert.ok(ranges.some(range =>
            range.kind === vscode.FoldingRangeKind.Imports &&
            range.start === 1 &&
            range.end === 3
        ));
    });

    test('Should provide import folding ranges for FXML files opened as XML', async () => {
        const extension = vscode.extensions.getExtension('unknowIfGuestInDream.tlcsdm-javafx-support');
        await extension?.activate();

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xml-fxml-folding-'));
        try {
            const fxmlPath = path.join(tempDir, 'Sample.fxml');
            await fs.writeFile(fxmlPath, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<?import javafx.scene.layout.HBox?>',
                '<?import javafx.scene.control.Label?>',
                '<?import javafx.scene.control.Button?>',
                '<HBox spacing="10" alignment="CENTER_LEFT"',
                '      xmlns:fx="http://javafx.com/fxml">',
                '    <Label text="My Application" />',
                '</HBox>',
            ].join('\n'));

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));
            const xmlDocument = await vscode.languages.setTextDocumentLanguage(document, 'xml');
            const ranges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
                'vscode.executeFoldingRangeProvider',
                xmlDocument.uri
            );

            assert.ok(ranges.some(range =>
                range.kind === vscode.FoldingRangeKind.Imports &&
                range.start === 1 &&
                range.end === 3
            ));
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should fold nested elements and multiline FXML tags', () => {
        const provider = new FxmlFoldingRangeProvider();
        const document = createMockFxmlDocument([
            '<BorderPane>',
            '  <top>',
            '    <ToolBar>',
            '      <Button',
            '        text="Run"',
            '        fx:id="runButton"',
            '      />',
            '    </ToolBar>',
            '  </top>',
            '</BorderPane>',
        ].join('\n'));

        const ranges = provider.provideFoldingRanges(
            document,
            {},
            new vscode.CancellationTokenSource().token
        );

        assert.ok(ranges.some(range => range.start === 0 && range.end === 9));
        assert.ok(ranges.some(range => range.start === 1 && range.end === 8));
        assert.ok(ranges.some(range => range.start === 2 && range.end === 7));
        assert.ok(ranges.some(range => range.start === 3 && range.end === 6));
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
