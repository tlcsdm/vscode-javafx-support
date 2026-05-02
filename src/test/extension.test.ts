import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ControllerDefinitionProvider } from '../controllerDefinitionProvider';
import { resetFxmlControllerCacheForTests } from '../fxmlControllerCache';
import { findFxmlMemberLocation, FxmlCodeLensProvider } from '../fxmlCodeLensProvider';
import { FxmlDefinitionProvider } from '../fxmlDefinitionProvider';
import { FxmlDocumentSymbolProvider } from '../fxmlDocumentSymbolProvider';
import { collectFxmlDiagnostics } from '../fxmlDiagnostics';
import { FxmlFormattingEditProvider } from '../fxmlFormatter';
import { FxmlLinkedEditingRangeProvider } from '../fxmlLinkedEditingRangeProvider';
import { FxmlFoldingRangeProvider } from '../fxmlFoldingRangeProvider';
import { FxmlHoverProvider } from '../fxmlHoverProvider';

const FXML_CONTROLLER_DIAGNOSTICS_TEMP_PREFIX = 'fxml-controller-diagnostics-';
const FXML_CONTROLLER_REFRESH_TEMP_PREFIX = 'fxml-controller-refresh-';
const FXML_CONTROLLER_CACHE_TEMP_PREFIX = 'fxml-controller-cache-';

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
            resetFxmlControllerCacheForTests();
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

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

    test('Should provide controller field and event handler hovers including inherited members', async () => {
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
                    const line = document.lineAt(2).text;

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

    test('Should reuse and refresh the cached FXML controller index', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), FXML_CONTROLLER_CACHE_TEMP_PREFIX));
        try {
            const controllerPath = path.join(tempDir, 'src', 'com', 'example', 'MainController.java');
            const renamedControllerPath = path.join(tempDir, 'src', 'com', 'example', 'RenamedController.java');
            const fxmlPath = path.join(tempDir, 'src', 'main.fxml');

            await fs.mkdir(path.dirname(controllerPath), { recursive: true });
            await fs.writeFile(controllerPath, [
                'package com.example;',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                'public class MainController {',
                '    @FXML',
                '    private Button submitButton;',
                '}',
            ].join('\n'));
            await fs.writeFile(renamedControllerPath, [
                'package com.example;',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                'public class RenamedController {',
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

            resetFxmlControllerCacheForTests();

            let fxmlFindFilesCalls = 0;
            await withMockFindFiles([controllerPath, renamedControllerPath, fxmlPath], async () => {
                const controllerDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(controllerPath));
                const fieldLine = controllerDocument.lineAt(5).text;
                const definition = await new ControllerDefinitionProvider().provideDefinition(
                    controllerDocument,
                    new vscode.Position(5, fieldLine.indexOf('submitButton')),
                    new vscode.CancellationTokenSource().token
                );

                assert.ok(definition instanceof vscode.Location);
                assertFsPathEqual(definition.uri.fsPath, fxmlPath);
                assert.strictEqual(fxmlFindFilesCalls, 1, 'the first lookup should populate the FXML cache once');

                const cachedLocation = await findFxmlMemberLocation(
                    'com.example.MainController',
                    'submitButton',
                    false,
                    new vscode.CancellationTokenSource().token
                );

                assert.ok(cachedLocation instanceof vscode.Location);
                assertFsPathEqual(cachedLocation.uri.fsPath, fxmlPath);
                assert.strictEqual(fxmlFindFilesCalls, 1, 'subsequent lookups should reuse the cached FXML index');

                const fxmlDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));
                const edit = new vscode.WorkspaceEdit();
                edit.replace(
                    fxmlDocument.uri,
                    fxmlDocument.lineAt(1).range,
                    '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.RenamedController">'
                );
                const editApplied = await vscode.workspace.applyEdit(edit);
                assert.strictEqual(editApplied, true);
                await fxmlDocument.save();

                await waitForCondition(async () => {
                    const oldLocation = await findFxmlMemberLocation(
                        'com.example.MainController',
                        'submitButton',
                        false,
                        new vscode.CancellationTokenSource().token
                    );
                    return oldLocation === undefined;
                });

                const renamedLocation = await findFxmlMemberLocation(
                    'com.example.RenamedController',
                    'submitButton',
                    false,
                    new vscode.CancellationTokenSource().token
                );

                assert.ok(renamedLocation instanceof vscode.Location);
                assertFsPathEqual(renamedLocation.uri.fsPath, fxmlPath);
                assert.strictEqual(fxmlFindFilesCalls, 1, 'watcher updates should avoid a second full FXML scan');
            }, pattern => {
                if (pattern === '**/*.fxml') {
                    fxmlFindFilesCalls++;
                }
            });
        } finally {
            resetFxmlControllerCacheForTests();
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should report missing controllers and duplicate fx:id values', async () => {
        const document = createMockFxmlDocument([
            '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MissingController">',
            '  <Button fx:id="submitButton" />',
            '  <Label fx:id="submitButton" />',
            '</VBox>',
        ].join('\n'));

        await withMockFindFiles([], async () => {
            const diagnostics = await collectFxmlDiagnostics(document, new vscode.CancellationTokenSource().token);

            assert.strictEqual(diagnostics.length, 3);

            const missingController = diagnostics.find(diagnostic => diagnostic.code === 'missing-controller');
            assert.ok(missingController);
            assert.strictEqual(missingController!.severity, vscode.DiagnosticSeverity.Error);
            assert.strictEqual(missingController!.message, "Controller class 'com.example.MissingController' could not be found.");
            assert.strictEqual(getRangeText(document, missingController!.range), 'com.example.MissingController');

            const duplicateFxIds = diagnostics.filter(diagnostic => diagnostic.code === 'duplicate-fx-id');
            assert.strictEqual(duplicateFxIds.length, 2);
            assert.ok(duplicateFxIds.every(diagnostic => diagnostic.severity === vscode.DiagnosticSeverity.Error));
            assert.ok(duplicateFxIds.every(diagnostic => diagnostic.message === "Duplicate fx:id 'submitButton'."));
            assert.deepStrictEqual(
                duplicateFxIds.map(diagnostic => getRangeText(document, diagnostic.range)),
                ['submitButton', 'submitButton']
            );
            assert.ok(duplicateFxIds.every(diagnostic => (diagnostic.relatedInformation?.length ?? 0) === 1));
            assert.ok(duplicateFxIds.every(diagnostic => diagnostic.relatedInformation?.[0].message === "Another 'submitButton' is declared here."));
        });
    });

    test('Should report missing controller members', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), FXML_CONTROLLER_DIAGNOSTICS_TEMP_PREFIX));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });

            const baseController = path.join(javaDir, 'BaseController.java');
            const mainController = path.join(javaDir, 'MainController.java');

            await fs.writeFile(baseController, [
                'package com.example;',
                '',
                'import javafx.scene.control.Label;',
                '',
                'public class BaseController {',
                '    protected Label statusLabel;',
                '}',
            ].join('\n'));
            await fs.writeFile(mainController, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Button;',
                '',
                'public class MainController extends BaseController {',
                '    @FXML',
                '    private Button submitButton;',
                '',
                '    @FXML',
                '    private void handleSubmit() {',
                '    }',
                '}',
            ].join('\n'));
            const document = createMockFxmlDocument([
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Label fx:id="statusLabel" />',
                '  <Button fx:id="submitButton" onAction="#handleSubmit" />',
                '  <TextField fx:id="nameField" onAction="#missingHandler" />',
                '</VBox>',
            ].join('\n'));

            await withMockFindFiles([baseController, mainController], async () => {
                const diagnostics = await collectFxmlDiagnostics(document, new vscode.CancellationTokenSource().token);
                const expectedDiagnosticCodes = [
                    'non-fxml-fx-id-field',
                    'missing-fx-id-field',
                    'missing-event-handler',
                ];

                assert.strictEqual(diagnostics.length, expectedDiagnosticCodes.length);

                const unannotatedField = diagnostics.find(diagnostic => diagnostic.code === 'non-fxml-fx-id-field');
                assert.ok(unannotatedField);
                assert.strictEqual(unannotatedField!.severity, vscode.DiagnosticSeverity.Warning);
                assert.strictEqual(unannotatedField!.message, "Controller field 'statusLabel' exists but is not annotated with @FXML.");
                assert.strictEqual(getRangeText(document, unannotatedField!.range), 'statusLabel');

                const missingField = diagnostics.find(diagnostic => diagnostic.code === 'missing-fx-id-field');
                assert.ok(missingField);
                assert.strictEqual(missingField!.severity, vscode.DiagnosticSeverity.Warning);
                assert.strictEqual(missingField!.message, "Controller field 'nameField' for fx:id could not be found.");
                assert.strictEqual(getRangeText(document, missingField!.range), 'nameField');

                const missingHandler = diagnostics.find(diagnostic => diagnostic.code === 'missing-event-handler');
                assert.ok(missingHandler);
                assert.strictEqual(missingHandler!.severity, vscode.DiagnosticSeverity.Error);
                assert.strictEqual(missingHandler!.message, "Event handler 'missingHandler' could not be found in the controller.");
                assert.strictEqual(getRangeText(document, missingHandler!.range), 'missingHandler');
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should update FXML diagnostics when the document changes', async () => {
        const extension = vscode.extensions.getExtension('unknowIfGuestInDream.tlcsdm-javafx-support');
        await extension?.activate();

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fxml-diagnostics-'));
        try {
            const fxmlPath = path.join(tempDir, 'Main.fxml');
            await fs.writeFile(fxmlPath, [
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MissingController">',
                '  <Button fx:id="submitButton" />',
                '  <Label fx:id="submitButton" />',
                '</VBox>',
            ].join('\n'));

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));

            await withMockFindFiles([], async () => {
                await waitForDiagnostics(document.uri, diagnostics => diagnostics.length === 3);

                const edit = new vscode.WorkspaceEdit();
                edit.replace(
                    document.uri,
                    new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, document.lineAt(2).text.length)),
                    '  <Label fx:id="statusLabel" />'
                );
                await vscode.workspace.applyEdit(edit);

                const updatedDiagnostics = await waitForDiagnostics(
                    document.uri,
                    diagnostics => diagnostics.length === 1 && diagnostics[0].code === 'missing-controller'
                );

                assert.strictEqual(updatedDiagnostics.length, 1);
                assert.strictEqual(updatedDiagnostics[0].code, 'missing-controller');
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should refresh FXML diagnostics after controller saves', async () => {
        const extension = vscode.extensions.getExtension('unknowIfGuestInDream.tlcsdm-javafx-support');
        await extension?.activate();

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), FXML_CONTROLLER_REFRESH_TEMP_PREFIX));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const resourceDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(resourceDir, { recursive: true });

            const baseController = path.join(javaDir, 'BaseController.java');
            const mainController = path.join(javaDir, 'MainController.java');
            const mainFxml = path.join(resourceDir, 'Main.fxml');

            await fs.writeFile(baseController, [
                'package com.example;',
                '',
                'public class BaseController {',
                '}',
            ].join('\n'));
            await fs.writeFile(mainController, [
                'package com.example;',
                '',
                'public class MainController extends BaseController {',
                '}',
            ].join('\n'));
            await fs.writeFile(mainFxml, [
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="submitButton" onAction="#handleSubmit" />',
                '</VBox>',
            ].join('\n'));

            await withMockFindFiles([baseController, mainController], async () => {
                const fxmlDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(mainFxml));
                await waitForDiagnostics(
                    fxmlDocument.uri,
                    diagnostics => diagnostics.length === 2
                        && diagnostics.some(diagnostic => diagnostic.code === 'missing-fx-id-field')
                        && diagnostics.some(diagnostic => diagnostic.code === 'missing-event-handler')
                );

                const controllerDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(mainController));
                const controllerEdit = new vscode.WorkspaceEdit();
                controllerEdit.replace(
                    controllerDocument.uri,
                    new vscode.Range(new vscode.Position(0, 0), controllerDocument.lineAt(controllerDocument.lineCount - 1).range.end),
                    [
                        'package com.example;',
                        '',
                        'import javafx.fxml.FXML;',
                        'import javafx.scene.control.Button;',
                        '',
                        'public class MainController extends BaseController {',
                        '    @FXML',
                        '    private Button submitButton;',
                        '',
                        '    @FXML',
                        '    private void handleSubmit() {',
                        '    }',
                        '}',
                    ].join('\n')
                );
                await vscode.workspace.applyEdit(controllerEdit);
                await controllerDocument.save();

                const updatedDiagnostics = await waitForDiagnostics(fxmlDocument.uri, diagnostics => diagnostics.length === 0);
                assert.strictEqual(updatedDiagnostics.length, 0);
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

        const hover = await new FxmlHoverProvider().provideHover(document, position, cancelledToken);
        assert.strictEqual(hover, undefined);

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

async function waitForDiagnostics(
    uri: vscode.Uri,
    predicate: (diagnostics: readonly vscode.Diagnostic[]) => boolean,
    timeoutMs = 5000
): Promise<readonly vscode.Diagnostic[]> {
    const deadline = Date.now() + timeoutMs;
    let diagnostics = vscode.languages.getDiagnostics(uri);

    while (!predicate(diagnostics)) {
        if (Date.now() >= deadline) {
            assert.fail(`Timed out waiting for diagnostics. Last diagnostics: ${diagnostics.map(diagnostic => diagnostic.message).join(', ')}`);
        }

        await new Promise(resolve => setTimeout(resolve, 25));
        diagnostics = vscode.languages.getDiagnostics(uri);
    }

    return diagnostics;
}

async function waitForCondition(
    predicate: () => Promise<boolean>,
    timeoutMs = 5000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (!await predicate()) {
        if (Date.now() >= deadline) {
            assert.fail('Timed out waiting for condition.');
        }

        await new Promise(resolve => setTimeout(resolve, 25));
    }
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
        return files
            .filter(file => matchesMockGlob(file, pattern))
            .map(file => vscode.Uri.file(file));
    };

    try {
        await run();
    } finally {
        workspace.findFiles = originalFindFiles;
    }
}

async function withMockJavafxSupportConfiguration(
    values: Record<string, unknown>,
    run: () => Promise<void>
): Promise<void> {
    const workspace = vscode.workspace as unknown as { getConfiguration: typeof vscode.workspace.getConfiguration };
    const originalGetConfiguration = workspace.getConfiguration;
    const mockedGetConfiguration: typeof vscode.workspace.getConfiguration = (section?: string, scope?: vscode.ConfigurationScope | null) => {
        const configuration = originalGetConfiguration(section, scope);
        if (section !== 'tlcsdm.javafxSupport') {
            return configuration;
        }

        return {
            ...configuration,
            get: <T>(key: string, defaultValue?: T) => {
                if (Object.prototype.hasOwnProperty.call(values, key)) {
                    return values[key] as T;
                }

                const configuredValue = configuration.get<T>(key);
                return configuredValue === undefined ? defaultValue as T : configuredValue;
            },
        } as vscode.WorkspaceConfiguration;
    };
    workspace.getConfiguration = mockedGetConfiguration;

    try {
        await run();
    } finally {
        workspace.getConfiguration = originalGetConfiguration;
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

function matchesMockGlob(filePath: string, pattern: string): boolean {
    const escapedPattern = escapeRegex(pattern)
        .replace(/\\\*\\\*/g, '.*')
        .replace(/\\\*/g, '[^/]*');

    return new RegExp(`^${escapedPattern}$`).test(toGlobPath(filePath));
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRangeText(document: vscode.TextDocument, range: vscode.Range): string {
    const text = document.getText();
    return text.slice(document.offsetAt(range.start), document.offsetAt(range.end));
}

function getHoverText(hover: vscode.Hover): string {
    return hover.contents
        // MarkdownString.appendText encodes spaces as &nbsp; in the serialized value.
        .map(content => (typeof content === 'string' ? content : content.value).replace(/&nbsp;/g, ' '))
        .join('\n');
}

function createThrowingTextDocument(): vscode.TextDocument {
    return new Proxy({}, {
        get() {
            throw new Error('document should not be accessed after cancellation');
        },
    }) as vscode.TextDocument;
}
