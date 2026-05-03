import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { resetFxmlControllerCacheForTests } from '../fxml/fxmlControllerCache';
import { FxmlDefinitionProvider } from '../fxml/fxmlDefinitionProvider';
import { FxmlDocumentSymbolProvider } from '../fxml/fxmlDocumentSymbolProvider';
import { FxmlReferenceProvider } from '../fxml/fxmlReferenceProvider';
import { ControllerDefinitionProvider } from '../java/controllerDefinitionProvider';
import { findFxmlMemberLocation, FxmlCodeLensProvider } from '../java/fxmlCodeLensProvider';
import { WorkspaceSymbolProvider } from '../java/workspaceSymbolProvider';
import { suiteWithResets, createMockFxmlDocument, withMockFindFiles, withMockOpenTextDocument, assertFsPathEqual, normalizeFsPath } from './shared';

suiteWithResets('FXML Navigation and Symbols', () => {
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

    test('Should navigate @resource references relative to the current FXML file', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-resource-'));
        try {
            const viewsDir = path.join(tempDir, 'views');
            const stylesDir = path.join(viewsDir, 'styles');
            const imagesDir = path.join(viewsDir, 'images');
            await fs.mkdir(stylesDir, { recursive: true });
            await fs.mkdir(imagesDir, { recursive: true });

            const mainFxml = path.join(viewsDir, 'Main.fxml');
            const stylesheet = path.join(stylesDir, 'main.css');
            const image = path.join(imagesDir, 'logo.png');
            await fs.writeFile(stylesheet, '.root {}');
            await fs.writeFile(image, '');
            await fs.writeFile(
                mainFxml,
                [
                    '<VBox stylesheets="@styles/main.css" tooltip="@styles/missing.css">',
                    '  <ImageView image="@images/logo.png" accessibleText="logo.png"/>',
                    '</VBox>',
                ].join('\n')
            );

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(mainFxml));
            const provider = new FxmlDefinitionProvider();

            const stylesheetLocation = await provider.provideDefinition(
                document,
                new vscode.Position(0, document.lineAt(0).text.indexOf('styles/main.css')),
                new vscode.CancellationTokenSource().token
            );
            assert.ok(stylesheetLocation instanceof vscode.Location);
            assertFsPathEqual(stylesheetLocation.uri.fsPath, stylesheet);
            assert.deepStrictEqual(stylesheetLocation.range.start, new vscode.Position(0, 0));

            const imageLocation = await provider.provideDefinition(
                document,
                new vscode.Position(1, document.lineAt(1).text.indexOf('images/logo.png')),
                new vscode.CancellationTokenSource().token
            );
            assert.ok(imageLocation instanceof vscode.Location);
            assertFsPathEqual(imageLocation.uri.fsPath, image);
            assert.deepStrictEqual(imageLocation.range.start, new vscode.Position(0, 0));

            assert.strictEqual(
                await provider.provideDefinition(
                    document,
                    new vscode.Position(0, document.lineAt(0).text.indexOf('styles/missing.css')),
                    new vscode.CancellationTokenSource().token
                ),
                undefined
            );

            assert.strictEqual(
                await provider.provideDefinition(
                    document,
                    new vscode.Position(1, document.lineAt(1).text.lastIndexOf('logo.png')),
                    new vscode.CancellationTokenSource().token
                ),
                undefined
            );
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should navigate FXML styleClass values to matching CSS class selectors', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-style-class-definition-'));
        try {
            const cssPath = path.join(tempDir, 'styles', 'main.css');
            const fxmlPath = path.join(tempDir, 'views', 'Main.fxml');
            await fs.mkdir(path.dirname(cssPath), { recursive: true });
            await fs.mkdir(path.dirname(fxmlPath), { recursive: true });

            await fs.writeFile(cssPath, [
                '.toolbar {',
                '}',
                '.primary-button:hover,',
                '.secondary-button {',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, '<Button styleClass="toolbar primary-button" />');

            await withMockFindFiles([cssPath], async () => {
                const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));
                const line = document.lineAt(0).text;
                const definitions = await new FxmlDefinitionProvider().provideDefinition(
                    document,
                    new vscode.Position(0, line.indexOf('primary-button') + 2),
                    new vscode.CancellationTokenSource().token
                );

                assert.ok(Array.isArray(definitions));
                assert.strictEqual(definitions.length, 1);
                assertFsPathEqual(definitions[0].uri.fsPath, cssPath);
                assert.deepStrictEqual(definitions[0].range.start, new vscode.Position(2, 1));

                assert.strictEqual(
                    await new FxmlDefinitionProvider().provideDefinition(
                        createMockFxmlDocument('<Button styleClass="missing-class" />'),
                        new vscode.Position(0, '<Button styleClass="'.length + 2),
                        new vscode.CancellationTokenSource().token
                    ),
                    undefined
                );
            });
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
                assert.strictEqual(codeLensJavaLookups, 0, 'cached Java lookups should avoid repeated inheritance scans');
            }, pattern => {
                if (trackCodeLensJavaLookups && pattern !== '**/*.fxml') {
                    codeLensJavaLookups++;
                }
            });
        } finally {
            resetFxmlControllerCacheForTests();
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should find FXML variable references and the matching controller field from fx:id', async () => {
        const extension = vscode.extensions.getExtension('unknowIfGuestInDream.tlcsdm-javafx-support');
        await extension?.activate();

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-references-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const fxmlDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(fxmlDir, { recursive: true });

            const controllerPath = path.join(javaDir, 'MainController.java');
            const fxmlPath = path.join(fxmlDir, 'Main.fxml');

            await fs.writeFile(controllerPath, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                '',
                'public class MainController {',
                '    @FXML',
                '    private Button submitBtn;',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="submitBtn" text="Submit" />',
                '  <Label labelFor="$submitBtn" />',
                '  <VBox userData="$submitBtn.text" />',
                '</VBox>',
            ].join('\n'));

            await withMockFindFiles([controllerPath], async () => {
                const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));
                const fxIdLine = document.lineAt(2).text;
                const references = await new FxmlReferenceProvider().provideReferences(
                    document,
                    new vscode.Position(2, fxIdLine.indexOf('submitBtn')),
                    { includeDeclaration: true },
                    new vscode.CancellationTokenSource().token
                );

                assert.ok(references);
                assert.strictEqual(references.length, 3);

                const fxmlReferences = references.filter(reference =>
                    normalizeFsPath(reference.uri.fsPath) === normalizeFsPath(fxmlPath)
                );
                assert.strictEqual(fxmlReferences.length, 2);
                assert.deepStrictEqual(
                    fxmlReferences.map(reference => reference.range.start),
                    [
                        new vscode.Position(3, document.lineAt(3).text.indexOf('$submitBtn')),
                        new vscode.Position(4, document.lineAt(4).text.indexOf('$submitBtn')),
                    ]
                );

                const controllerReference = references.find(reference =>
                    normalizeFsPath(reference.uri.fsPath) === normalizeFsPath(controllerPath)
                );
                assert.ok(controllerReference);
                assert.deepStrictEqual(controllerReference!.range.start, new vscode.Position(7, 19));
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should find FXML styleClass references from CSS class selectors', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-style-class-references-'));
        try {
            const cssPath = path.join(tempDir, 'styles', 'main.css');
            const firstFxmlPath = path.join(tempDir, 'views', 'Main.fxml');
            const secondFxmlPath = path.join(tempDir, 'views', 'Dialog.fxml');
            await fs.mkdir(path.dirname(cssPath), { recursive: true });
            await fs.mkdir(path.dirname(firstFxmlPath), { recursive: true });

            await fs.writeFile(cssPath, '.primary-button { -fx-font-weight: bold; }');
            await fs.writeFile(firstFxmlPath, '<Button styleClass="toolbar primary-button" />');
            await fs.writeFile(secondFxmlPath, '<Label styleClass="primary-button secondary-label" />');

            await withMockFindFiles([firstFxmlPath, secondFxmlPath], async () => {
                const document = await vscode.workspace.openTextDocument(vscode.Uri.file(cssPath));
                const line = document.lineAt(0).text;
                const references = await new FxmlReferenceProvider().provideReferences(
                    document,
                    new vscode.Position(0, line.indexOf('primary-button') + 2),
                    { includeDeclaration: false },
                    new vscode.CancellationTokenSource().token
                );

                assert.ok(references);
                assert.strictEqual(references.length, 2);
                assert.deepStrictEqual(
                    references.map(reference => [
                        path.basename(reference.uri.fsPath),
                        reference.range.start,
                    ]),
                    [
                        ['Main.fxml', new vscode.Position(0, 28)],
                        ['Dialog.fxml', new vscode.Position(0, 19)],
                    ]
                );
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should provide case-insensitive workspace symbols for matching fx:id and @FXML fields', async () => {
        const extension = vscode.extensions.getExtension('unknowIfGuestInDream.tlcsdm-javafx-support');
        await extension?.activate();

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-workspace-symbols-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const fxmlDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(fxmlDir, { recursive: true });

            const controllerPath = path.join(javaDir, 'MainController.java');
            const fxmlPath = path.join(fxmlDir, 'Main.fxml');

            await fs.writeFile(controllerPath, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                '',
                'public class MainController {',
                '    @FXML',
                '    private Button submitButton;',
                '',
                '    private Button ignoredButton;',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button',
                '      fx:id="submitButton"',
                '      text="Submit" />',
                '</VBox>',
            ].join('\n'));

            const provider = new WorkspaceSymbolProvider();
            try {
                await withMockFindFiles([controllerPath, fxmlPath], async () => {
                    const symbols = await provider.provideWorkspaceSymbols(
                        'SUBMIT',
                        new vscode.CancellationTokenSource().token
                    );

                    assert.ok(symbols);

                    const matchingSymbols = symbols!.filter(symbol =>
                        ['Main.fxml', 'MainController.java'].includes(path.basename(symbol.location.uri.fsPath))
                    );
                    assert.strictEqual(matchingSymbols.length, 2);

                    const javaSymbol = matchingSymbols.find(symbol =>
                        normalizeFsPath(symbol.location.uri.fsPath) === normalizeFsPath(controllerPath)
                    );
                    assert.ok(javaSymbol);
                    assert.strictEqual(javaSymbol!.name, 'submitButton');
                    assert.strictEqual(javaSymbol!.kind, vscode.SymbolKind.Field);
                    assert.strictEqual(javaSymbol!.containerName, 'com.example.MainController');
                    assert.deepStrictEqual(javaSymbol!.location.range.start, new vscode.Position(7, 19));

                    const fxmlSymbol = matchingSymbols.find(symbol =>
                        normalizeFsPath(symbol.location.uri.fsPath) === normalizeFsPath(fxmlPath)
                    );
                    assert.ok(fxmlSymbol);
                    assert.strictEqual(fxmlSymbol!.name, 'submitButton');
                    assert.strictEqual(fxmlSymbol!.kind, vscode.SymbolKind.Variable);
                    assert.strictEqual(fxmlSymbol!.containerName, 'Button');
                    assert.deepStrictEqual(fxmlSymbol!.location.range.start, new vscode.Position(3, 13));
                });
            } finally {
                provider.dispose();
            }
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should ignore Java build directories when providing workspace symbols', async () => {
        const extension = vscode.extensions.getExtension('unknowIfGuestInDream.tlcsdm-javafx-support');
        await extension?.activate();

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-workspace-symbols-build-'));
        try {
            const sourceJavaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const generatedJavaDir = path.join(tempDir, 'target', 'generated-sources', 'annotations', 'com', 'example');
            const fxmlDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(sourceJavaDir, { recursive: true });
            await fs.mkdir(generatedJavaDir, { recursive: true });
            await fs.mkdir(fxmlDir, { recursive: true });

            const sourceControllerPath = path.join(sourceJavaDir, 'MainController.java');
            const generatedControllerPath = path.join(generatedJavaDir, 'MainController.java');
            const fxmlPath = path.join(fxmlDir, 'Main.fxml');

            await fs.writeFile(sourceControllerPath, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                '',
                'public class MainController {',
                '    @FXML',
                '    private Button submitButton;',
                '}',
            ].join('\n'));
            await fs.writeFile(generatedControllerPath, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                '',
                'public class MainController {',
                '    @FXML',
                '    private Button generatedButton;',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="submitButton" text="Submit" />',
                '</VBox>',
            ].join('\n'));

            const provider = new WorkspaceSymbolProvider();
            try {
                await withMockFindFiles([sourceControllerPath, generatedControllerPath, fxmlPath], async () => {
                    const symbols = await provider.provideWorkspaceSymbols(
                        'button',
                        new vscode.CancellationTokenSource().token
                    );

                    assert.ok(symbols);
                    const javaSymbols = symbols.filter(symbol =>
                        symbol.kind === vscode.SymbolKind.Field
                    );
                    const fxmlSymbols = symbols.filter(symbol =>
                        symbol.kind === vscode.SymbolKind.Variable
                    );

                    assert.strictEqual(javaSymbols.length, 1);
                    assertFsPathEqual(javaSymbols[0].location.uri.fsPath, sourceControllerPath);
                    assert.strictEqual(javaSymbols[0].name, 'submitButton');

                    assert.strictEqual(fxmlSymbols.length, 1);
                    assertFsPathEqual(fxmlSymbols[0].location.uri.fsPath, fxmlPath);
                    assert.strictEqual(fxmlSymbols[0].name, 'submitButton');
                });
            } finally {
                provider.dispose();
            }
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should ignore FXML build directories when providing workspace symbols', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-workspace-symbols-fxml-build-'));
        try {
            const sourceFxmlDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            const generatedFxmlDir = path.join(tempDir, 'target', 'classes', 'com', 'example');
            await fs.mkdir(sourceFxmlDir, { recursive: true });
            await fs.mkdir(generatedFxmlDir, { recursive: true });

            const sourceFxmlPath = path.join(sourceFxmlDir, 'Light.fxml');
            const generatedFxmlPath = path.join(generatedFxmlDir, 'Light.fxml');

            await fs.writeFile(sourceFxmlPath, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1">',
                '  <Label fx:id="lblActualLevel" text="Actual level" />',
                '</VBox>',
            ].join('\n'));
            await fs.writeFile(generatedFxmlPath, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1">',
                '  <Label fx:id="lblActualLevel" text="Generated level" />',
                '</VBox>',
            ].join('\n'));

            const provider = new WorkspaceSymbolProvider();
            const openedFiles: string[] = [];
            try {
                await withMockFindFiles([sourceFxmlPath, generatedFxmlPath], async () => {
                    await withMockOpenTextDocument(async () => {
                        const symbols = await provider.provideWorkspaceSymbols(
                            'actuallevel',
                            new vscode.CancellationTokenSource().token
                        );

                        assert.strictEqual(symbols.length, 1);
                        assertFsPathEqual(symbols[0].location.uri.fsPath, sourceFxmlPath);
                        assert.strictEqual(symbols[0].name, 'lblActualLevel');
                        assert.strictEqual(symbols[0].kind, vscode.SymbolKind.Variable);

                        assert.ok(openedFiles.includes(normalizeFsPath(sourceFxmlPath)));
                        assert.ok(!openedFiles.includes(normalizeFsPath(generatedFxmlPath)));
                    }, uri => {
                        openedFiles.push(normalizeFsPath(uri.fsPath));
                    });
                });
            } finally {
                provider.dispose();
            }
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should reuse cached workspace symbols for repeated queries', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fx-workspace-symbols-cache-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const fxmlDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(fxmlDir, { recursive: true });

            const controllerPath = path.join(javaDir, 'MainController.java');
            const fxmlPath = path.join(fxmlDir, 'Main.fxml');

            await fs.writeFile(controllerPath, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                '',
                'public class MainController {',
                '    @FXML',
                '    private Button submitButton;',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="submitButton" text="Submit" />',
                '</VBox>',
            ].join('\n'));

            const provider = new WorkspaceSymbolProvider();
            const openedFiles: string[] = [];
            let workspaceSymbolUriScans = 0;
            try {
                await withMockFindFiles([controllerPath, fxmlPath], async () => {
                    await withMockOpenTextDocument(async () => {
                        const firstQuerySymbols = await provider.provideWorkspaceSymbols(
                            'sub',
                            new vscode.CancellationTokenSource().token
                        );
                        const openCountsAfterFirstQuery = new Map<string, number>();
                        for (const filePath of openedFiles) {
                            openCountsAfterFirstQuery.set(filePath, (openCountsAfterFirstQuery.get(filePath) ?? 0) + 1);
                        }

                        const secondQuerySymbols = await provider.provideWorkspaceSymbols(
                            'submit',
                            new vscode.CancellationTokenSource().token
                        );
                        const thirdQuerySymbols = await provider.provideWorkspaceSymbols(
                            'button',
                            new vscode.CancellationTokenSource().token
                        );

                        assert.strictEqual(firstQuerySymbols.length, 2);
                        assert.strictEqual(secondQuerySymbols.length, 2);
                        assert.strictEqual(thirdQuerySymbols.length, 2);
                        assert.strictEqual(workspaceSymbolUriScans, 2, 'repeated queries should reuse cached FXML and Java URI lists');

                        const openCounts = new Map<string, number>();
                        for (const filePath of openedFiles) {
                            openCounts.set(filePath, (openCounts.get(filePath) ?? 0) + 1);
                        }

                        assert.strictEqual(
                            openCounts.get(normalizeFsPath(controllerPath)),
                            openCountsAfterFirstQuery.get(normalizeFsPath(controllerPath))
                        );
                        assert.strictEqual(
                            openCounts.get(normalizeFsPath(fxmlPath)),
                            openCountsAfterFirstQuery.get(normalizeFsPath(fxmlPath))
                        );
                    }, uri => {
                        openedFiles.push(normalizeFsPath(uri.fsPath));
                    });
                }, pattern => {
                    if (pattern === '**/*.fxml' || pattern === '**/*.java') {
                        workspaceSymbolUriScans++;
                    }
                });
            } finally {
                provider.dispose();
            }
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

});
