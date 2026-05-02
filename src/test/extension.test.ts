import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ControllerDefinitionProvider } from '../controllerDefinitionProvider';
import { findFxmlMemberLocation, FxmlCodeLensProvider } from '../fxmlCodeLensProvider';
import { FxmlDefinitionProvider } from '../fxmlDefinitionProvider';
import { FxmlDocumentSymbolProvider } from '../fxmlDocumentSymbolProvider';
import { FxmlFormattingEditProvider } from '../fxmlFormatter';
import { FxmlLinkedEditingRangeProvider } from '../fxmlLinkedEditingRangeProvider';
import { FxmlFoldingRangeProvider } from '../fxmlFoldingRangeProvider';

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
        assert.strictEqual(editorConfig.get('foldingImportsByDefault'), true);
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

    test('Should navigate fx:include source values relative to the current FXML file', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-include-'));
        try {
            const viewsDir = path.join(tempDir, 'views');
            const controlsDir = path.join(viewsDir, 'controls');
            await fs.mkdir(controlsDir, { recursive: true });

            const mainFxml = path.join(viewsDir, 'Main.fxml');
            const includedFxml = path.join(controlsDir, 'Toolbar.fxml');
            await fs.writeFile(includedFxml, '<ToolBar/>');
            await fs.writeFile(mainFxml, '<VBox><fx:include fx:id="toolbar" source="controls/Toolbar.fxml"/></VBox>');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(mainFxml));
            const position = new vscode.Position(0, document.lineAt(0).text.indexOf('Toolbar.fxml'));
            const provider = new FxmlDefinitionProvider();
            const location = await provider.provideDefinition(
                document,
                position,
                new vscode.CancellationTokenSource().token
            );

            assert.ok(location instanceof vscode.Location);
            assertFsPathEqual(location.uri.fsPath, includedFxml);
            assert.deepStrictEqual(location.range.start, new vscode.Position(0, 0));

            const idPosition = new vscode.Position(0, document.lineAt(0).text.indexOf('toolbar'));
            assert.strictEqual(
                await provider.provideDefinition(document, idPosition, new vscode.CancellationTokenSource().token),
                undefined
            );
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should navigate inherited @FXML controller members', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-inherited-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const fxmlDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(fxmlDir, { recursive: true });

            const baseController = path.join(javaDir, 'BaseController.java');
            const mainController = path.join(javaDir, 'MainController.java');
            const unrelatedFxml = path.join(fxmlDir, 'Unrelated.fxml');
            const mainFxml = path.join(fxmlDir, 'Main.fxml');

            await fs.writeFile(baseController, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                '',
                'public class BaseController {',
                '    @FXML',
                '    protected Button sharedButton;',
                '}',
            ].join('\n'));
            await fs.writeFile(mainController, [
                'package com.example;',
                '',
                'import javafx.scene.control.Button;',
                '',
                'public class MainController extends BaseController {',
                '    public void initialize() {',
                '        sharedButton = new Button();',
                '    }',
                '}',
            ].join('\n'));
            await fs.writeFile(mainFxml, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="sharedButton" text="Shared" />',
                '</VBox>',
            ].join('\n'));
            await fs.writeFile(unrelatedFxml, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.UnrelatedController">',
                '  <Button fx:id="otherButton" text="Other" />',
                '</VBox>',
            ].join('\n'));

            let trackCodeLensJavaLookups = false;
            let codeLensJavaLookups = 0;
            await withMockFindFiles([baseController, mainController, unrelatedFxml, mainFxml], async () => {
                const fxmlDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(mainFxml));
                const fxmlLine = fxmlDocument.lineAt(2).text;
                const fxmlToJava = await new FxmlDefinitionProvider().provideDefinition(
                    fxmlDocument,
                    new vscode.Position(2, fxmlLine.indexOf('sharedButton')),
                    new vscode.CancellationTokenSource().token
                );

                assert.ok(fxmlToJava instanceof vscode.Location);
                assertFsPathEqual(fxmlToJava.uri.fsPath, baseController);
                assert.deepStrictEqual(fxmlToJava.range.start, new vscode.Position(7, 21));

                const baseDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(baseController));
                const fieldLine = baseDocument.lineAt(7).text;
                const javaToFxml = await new ControllerDefinitionProvider().provideDefinition(
                    baseDocument,
                    new vscode.Position(7, fieldLine.indexOf('sharedButton')),
                    new vscode.CancellationTokenSource().token
                );

                assert.ok(javaToFxml instanceof vscode.Location);
                assertFsPathEqual(javaToFxml.uri.fsPath, mainFxml);
                assert.deepStrictEqual(javaToFxml.range.start, new vscode.Position(2, fxmlLine.indexOf('fx:id')));

                const codeLenses = await new FxmlCodeLensProvider().provideCodeLenses(
                    baseDocument,
                    new vscode.CancellationTokenSource().token
                );
                assert.ok(codeLenses.some(codeLens => codeLens.command?.arguments?.[1] === 'sharedButton'));

                trackCodeLensJavaLookups = true;
                const codeLensToFxml = await findFxmlMemberLocation(
                    'com.example.BaseController',
                    'sharedButton',
                    false,
                    new vscode.CancellationTokenSource().token
                );
                assert.ok(codeLensToFxml instanceof vscode.Location);
                assertFsPathEqual(codeLensToFxml.uri.fsPath, mainFxml);
                assert.deepStrictEqual(codeLensToFxml.range.start, new vscode.Position(2, fxmlLine.indexOf('fx:id')));
                assert.strictEqual(codeLensJavaLookups, 1, 'only FXML files containing the target member should trigger Java inheritance lookup');
            }, pattern => {
                if (trackCodeLensJavaLookups && pattern !== '**/*.fxml') {
                    codeLensJavaLookups++;
                }
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
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

        const result = new FxmlLinkedEditingRangeProvider().provideLinkedEditingRanges(document, position, cancelledToken);
        assert.strictEqual(result, undefined);

        const foldingRanges = new FxmlFoldingRangeProvider().provideFoldingRanges(document, {}, cancelledToken);
        assert.deepStrictEqual(foldingRanges, []);
    });

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

    test('Should provide import folding ranges before the FXML root is added', async () => {
        const document = await vscode.workspace.openTextDocument({
            language: 'fxml',
            content: [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<?import javafx.scene.layout.HBox?>',
                '<?import javafx.scene.control.Label?>',
                '<?import javafx.scene.control.Button?>',
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

    test('Should fold escaped FXML import processing instruction openers', () => {
        const provider = new FxmlFoldingRangeProvider();
        const document = createMockFxmlDocument([
            '<?xml version="1.0" encoding="UTF-8"?>',
            '&lt;?import javafx.scene.layout.HBox?>',
            '&lt;?import javafx.scene.control.Label?>',
            '&lt;?import javafx.scene.control.Button?>',
        ].join('\n'));

        const ranges = provider.provideFoldingRanges(
            document,
            {},
            new vscode.CancellationTokenSource().token
        );

        const importRange = ranges.find(range => range.kind === vscode.FoldingRangeKind.Imports);
        assert.ok(importRange);
        assert.strictEqual(importRange!.start, 1);
        assert.strictEqual(importRange!.end, 3);
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

async function withMockFindFiles(
    files: string[],
    run: () => Promise<void>,
    onFindFiles?: (pattern: string) => void
): Promise<void> {
    const workspace = vscode.workspace as unknown as { findFiles: typeof vscode.workspace.findFiles };
    const originalFindFiles = workspace.findFiles;
    workspace.findFiles = async (include: vscode.GlobPattern) => {
        const pattern = typeof include === 'string' ? include : include.pattern;
        onFindFiles?.(pattern);
        if (pattern === '**/*.fxml') {
            return files.filter(file => file.endsWith('.fxml')).map(file => vscode.Uri.file(file));
        }

        const suffix = pattern.replace(/^\*\*\//, '');
        return files.filter(file => toGlobPath(file).endsWith(suffix)).map(file => vscode.Uri.file(file));
    };

    try {
        await run();
    } finally {
        workspace.findFiles = originalFindFiles;
    }
}

function assertFsPathEqual(actual: string, expected: string): void {
    assert.strictEqual(normalizeFsPath(actual), normalizeFsPath(expected));
}

function normalizeFsPath(filePath: string): string {
    const normalized = path.normalize(filePath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function toGlobPath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

function getRangeText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText();
    return text.slice(document.offsetAt(range.start), document.offsetAt(range.end));
}

function createThrowingTextDocument(): vscode.TextDocument {
    return new Proxy({}, {
        get() {
            throw new Error('document should not be accessed after cancellation');
        },
    }) as vscode.TextDocument;
}
