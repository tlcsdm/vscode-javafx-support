import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { JAVA_FX_CSS_PROPERTY_DEFINITIONS } from '../css/javafxCssData';
import { JavafxCssCompletionProvider, JavafxCssHoverProvider } from '../css/javafxCssProvider';
import { FxmlHoverProvider } from '../fxml/fxmlHoverProvider';
import { suiteWithResets, EXPECTED_JAVAFX_CSS_PROPERTY_COUNT, createMockFxmlDocument, createMockCssDocument, getCompletionItems, getCompletionLabel, withMockFindFiles, withMockJavafxSupportConfiguration, getRangeText, getHoverText } from './shared';

suiteWithResets('FXML Hover and JavaFX CSS', () => {
    test('Should only provide controller comment hovers when enabled', async () => {
        const provider = new FxmlHoverProvider();
        const document = createMockFxmlDocument('<VBox><Label text="Name"/></VBox>');

        await withMockJavafxSupportConfiguration({
            'hover.enabled': true,
            'hover.delay': 0,
        }, async () => {
            const hover = await provider.provideHover(
                document,
                new vscode.Position(0, 2),
                new vscode.CancellationTokenSource().token
            );

            assert.strictEqual(hover, undefined);
        });
    });

    test('Should provide controller, field, and event handler hovers including inherited members', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-hover-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const fxmlDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(fxmlDir, { recursive: true });

            const baseController = path.join(javaDir, 'BaseController.java');
            const mainController = path.join(javaDir, 'MainController.java');
            const mainFxml = path.join(fxmlDir, 'Main.fxml');

            await fs.writeFile(baseController, [
                'package com.example;',
                '',
                'import javafx.event.ActionEvent;',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                '',
                'public class BaseController {',
                '    /**',
                '     * Comment for the shared button field.',
                '     */',
                '    @FXML',
                '    protected Button sharedButton;',
                '',
                '    /**',
                '     * Comment for the click handler method.',
                '     */',
                '    @FXML',
                '    protected void handleClick(ActionEvent event) {',
                '    }',
                '}',
            ].join('\n'));
            await fs.writeFile(mainController, [
                'package com.example;',
                '',
                '/**',
                ' * Comment for the main controller class.',
                ' */',
                'public class MainController extends BaseController {',
                '}',
            ].join('\n'));
            await fs.writeFile(mainFxml, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="sharedButton" onAction="#handleClick" text="Save" />',
                '</VBox>',
            ].join('\n'));

            await withMockFindFiles([baseController, mainController, mainFxml], async () => {
                await withMockJavafxSupportConfiguration({
                    'hover.enabled': true,
                    'hover.delay': 0,
                }, async () => {
                    const provider = new FxmlHoverProvider();
                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(mainFxml));
                    const controllerLine = document.lineAt(1).text;
                    const line = document.lineAt(2).text;

                    const controllerHover = await provider.provideHover(
                        document,
                        new vscode.Position(1, controllerLine.indexOf('com.example.MainController')),
                        new vscode.CancellationTokenSource().token
                    );
                    assert.ok(controllerHover);
                    assert.match(getHoverText(controllerHover), /Comment for the main controller class\./);

                    const fieldHover = await provider.provideHover(
                        document,
                        new vscode.Position(2, line.indexOf('sharedButton')),
                        new vscode.CancellationTokenSource().token
                    );
                    assert.ok(fieldHover);
                    assert.match(getHoverText(fieldHover), /Comment for the shared button field\./);
                    assert.match(getHoverText(fieldHover), /Declared in `BaseController`\./);

                    const methodHover = await provider.provideHover(
                        document,
                        new vscode.Position(2, line.indexOf('#handleClick')),
                        new vscode.CancellationTokenSource().token
                    );
                    assert.ok(methodHover);
                    assert.match(getHoverText(methodHover), /Comment for the click handler method\./);
                    assert.match(getHoverText(methodHover), /Declared in `BaseController`\./);
                });
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should provide JavaFX CSS property completions while typing -fx prefixes', async () => {
        const provider = new JavafxCssCompletionProvider();
        const document = createMockCssDocument('.root { -fx }');

        assert.strictEqual(
            await provider.provideCompletionItems(
                createMockCssDocument('.root { -f }'),
                new vscode.Position(0, '.root { -f'.length),
                new vscode.CancellationTokenSource().token
            ),
            undefined
        );

        const completionsAfterFxResult = await provider.provideCompletionItems(
            document,
            new vscode.Position(0, document.lineAt(0).text.indexOf('-fx') + '-fx'.length),
            new vscode.CancellationTokenSource().token
        );
        const completionsAfterFx = getCompletionItems(completionsAfterFxResult);

        assert.ok(completionsAfterFxResult instanceof vscode.CompletionList);
        assert.strictEqual(completionsAfterFxResult.isIncomplete, true);
        assert.strictEqual(JAVA_FX_CSS_PROPERTY_DEFINITIONS.length, EXPECTED_JAVAFX_CSS_PROPERTY_COUNT);
        assert.strictEqual(completionsAfterFx.length, EXPECTED_JAVAFX_CSS_PROPERTY_COUNT);

        const dashDocument = createMockCssDocument('.root { -fx- }');
        const completionsAfterFxDashResult = await provider.provideCompletionItems(
            dashDocument,
            new vscode.Position(0, dashDocument.lineAt(0).text.indexOf('-fx-') + '-fx-'.length),
            new vscode.CancellationTokenSource().token
        );
        const completionsAfterFxDash = getCompletionItems(completionsAfterFxDashResult);

        assert.ok(completionsAfterFxDashResult instanceof vscode.CompletionList);
        assert.strictEqual(completionsAfterFxDash.length, EXPECTED_JAVAFX_CSS_PROPERTY_COUNT);

        const alignment = completionsAfterFxDash.find(item => item.label === '-fx-alignment');
        assert.ok(alignment);
        assert.strictEqual(alignment?.filterText, '-fx-alignment');
        assert.ok(completionsAfterFxDash.some(item => item.label === '-fx-background-color'));
        assert.ok(completionsAfterFxDash.some(item => item.label === '-fx-text-fill'));
    });

    test('Should prioritize JavaFX CSS completions in CSS files with built-in suggestions', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `javafx-css-completion-${process.pid}-`));
        const cssFile = path.join(tempDir, 'style.css');

        try {
            await fs.writeFile(cssFile, [
                '.root {',
                '  -fx-',
                '}',
            ].join('\n'));
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(cssFile));
            const line = document.lineAt(1).text;
            const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                document.uri,
                new vscode.Position(1, line.length),
                '-'
            );

            const labels = completions.items.map(item => getCompletionLabel(item));
            const javaFxIndex = labels.indexOf('-fx-alignment');
            const builtInVendorIndex = labels.findIndex(label => /^-(?:ms|webkit|moz)-/.test(label));

            assert.ok(javaFxIndex >= 0);
            if (builtInVendorIndex >= 0) {
                assert.ok(javaFxIndex < builtInVendorIndex);
            }
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should provide JavaFX CSS value completions for enum-like properties', async () => {
        const provider = new JavafxCssCompletionProvider();
        const document = createMockCssDocument([
            '.root {',
            '  -fx-alignment: c',
            '}',
        ].join('\n'));

        const completions = await provider.provideCompletionItems(
            document,
            new vscode.Position(1, document.lineAt(1).text.length),
            new vscode.CancellationTokenSource().token
        );

        assert.ok(Array.isArray(completions));

        const items = getCompletionItems(completions);
        const center = items.find(item => item.label === 'CENTER');
        const topLeft = items.find(item => item.label === 'TOP_LEFT');

        assert.ok(center);
        assert.strictEqual(center?.insertText, ' center;');
        assert.ok(center?.range instanceof vscode.Range);
        assert.strictEqual(getRangeText(document, center!.range as vscode.Range), ' c');
        assert.ok(topLeft);
        assert.strictEqual(topLeft?.insertText, ' top-left;');

        const spacedDocument = createMockCssDocument('.root { -fx-alignment:  c }');
        const spacedCompletions = await provider.provideCompletionItems(
            spacedDocument,
            new vscode.Position(0, spacedDocument.lineAt(0).text.indexOf('  c') + '  c'.length),
            new vscode.CancellationTokenSource().token
        );
        assert.ok(Array.isArray(spacedCompletions));

        const spacedCenter = getCompletionItems(spacedCompletions).find(item => item.label === 'CENTER');
        assert.ok(spacedCenter);
        assert.strictEqual(spacedCenter?.insertText, ' center;');
        assert.ok(spacedCenter?.range instanceof vscode.Range);
        assert.strictEqual(getRangeText(spacedDocument, spacedCenter!.range as vscode.Range), '  c');

        const semicolonDocument = createMockCssDocument('.root { -fx-alignment: c; }');
        const semicolonCompletions = await provider.provideCompletionItems(
            semicolonDocument,
            new vscode.Position(0, semicolonDocument.lineAt(0).text.indexOf(' c;') + ' c'.length),
            new vscode.CancellationTokenSource().token
        );
        assert.ok(Array.isArray(semicolonCompletions));

        const semicolonCenter = getCompletionItems(semicolonCompletions).find(item => item.label === 'CENTER');
        assert.ok(semicolonCenter);
        assert.strictEqual(semicolonCenter?.insertText, ' center');
        assert.ok(semicolonCenter?.range instanceof vscode.Range);
        assert.strictEqual(getRangeText(semicolonDocument, semicolonCenter!.range as vscode.Range), ' c');
    });

    test('Should provide JavaFX CSS completions inside FXML style attributes', async () => {
        const provider = new JavafxCssCompletionProvider();
        const propertyDocument = createMockFxmlDocument('<Button style="-fx"/>');
        const propertyLine = propertyDocument.lineAt(0).text;

        const propertyCompletions = await provider.provideCompletionItems(
            propertyDocument,
            new vscode.Position(0, propertyLine.indexOf('-fx') + '-fx'.length),
            new vscode.CancellationTokenSource().token
        );

        assert.ok(propertyCompletions instanceof vscode.CompletionList);
        assert.ok(getCompletionItems(propertyCompletions).some(item => item.label === '-fx-background-color'));

        const valueDocument = createMockFxmlDocument('<Button style="-fx-alignment:c"/>');
        const valueLine = valueDocument.lineAt(0).text;
        const valueCompletions = await provider.provideCompletionItems(
            valueDocument,
            new vscode.Position(0, valueLine.indexOf(':c') + ':c'.length),
            new vscode.CancellationTokenSource().token
        );

        assert.ok(Array.isArray(valueCompletions));

        const center = getCompletionItems(valueCompletions).find(item => item.label === 'CENTER');
        assert.ok(center);
        assert.strictEqual(center?.insertText, ' center;');
        assert.ok(center?.range instanceof vscode.Range);
        assert.strictEqual(getRangeText(valueDocument, center!.range as vscode.Range), 'c');
    });

    test('Should provide workspace CSS class completions inside FXML styleClass attributes', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-style-class-completion-'));
        try {
            const firstCssPath = path.join(tempDir, 'styles', 'main.css');
            const secondCssPath = path.join(tempDir, 'styles', 'dialog.css');
            await fs.mkdir(path.dirname(firstCssPath), { recursive: true });

            await fs.writeFile(firstCssPath, [
                '.toolbar { }',
                '.primary-button { }',
            ].join('\n'));
            await fs.writeFile(secondCssPath, [
                '.primary-button { }',
                '.secondary-label { }',
            ].join('\n'));

            await withMockFindFiles([firstCssPath, secondCssPath], async () => {
                const provider = new JavafxCssCompletionProvider();

                const emptyDocument = createMockFxmlDocument('<Button styleClass=""/>');
                const emptyLine = emptyDocument.lineAt(0).text;
                const emptyCompletions = await provider.provideCompletionItems(
                    emptyDocument,
                    new vscode.Position(0, emptyLine.indexOf('styleClass="') + 'styleClass="'.length),
                    new vscode.CancellationTokenSource().token
                );

                const emptyItems = getCompletionItems(emptyCompletions);
                assert.deepStrictEqual(
                    emptyItems.map(getCompletionLabel),
                    ['primary-button', 'secondary-label', 'toolbar']
                );

                const partialDocument = createMockFxmlDocument('<Button styleClass="toolbar pri"/>');
                const partialLine = partialDocument.lineAt(0).text;
                const partialCompletions = await provider.provideCompletionItems(
                    partialDocument,
                    new vscode.Position(0, partialLine.indexOf('pri') + 'pri'.length),
                    new vscode.CancellationTokenSource().token
                );

                const primaryButton = getCompletionItems(partialCompletions).find(item => getCompletionLabel(item) === 'primary-button');
                assert.ok(primaryButton);
                assert.strictEqual(primaryButton?.insertText, 'primary-button');
                assert.ok(primaryButton?.range instanceof vscode.Range);
                assert.strictEqual(getRangeText(partialDocument, primaryButton!.range as vscode.Range), 'pri');
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should provide JavaFX CSS hovers for -fx- properties', async () => {
        const provider = new JavafxCssHoverProvider();
        const document = createMockCssDocument([
            '.root {',
            '  -fx-alignment: center;',
            '}',
        ].join('\n'));
        const line = document.lineAt(1).text;

        const hover = await provider.provideHover(
            document,
            new vscode.Position(1, line.indexOf('-fx-alignment') + 2),
            new vscode.CancellationTokenSource().token
        );

        assert.ok(hover instanceof vscode.Hover);
        assert.match(getHoverText(hover), /-fx-alignment: \[/);
        assert.match(getHoverText(hover), /\*\*Default:\*\* `top-left`/);
        assert.match(getHoverText(hover), /\*\*Applies to:\*\* `FlowPane`/);
    });

});
