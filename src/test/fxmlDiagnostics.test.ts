import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { resetFxmlControllerCacheForTests } from '../fxml/fxmlControllerCache';
import { collectFxmlDiagnostics } from '../fxml/fxmlDiagnostics';
import { ControllerDefinitionProvider } from '../java/controllerDefinitionProvider';
import { findFxmlMemberLocation } from '../java/fxmlCodeLensProvider';
import { suiteWithResets, FXML_CONTROLLER_DIAGNOSTICS_TEMP_PREFIX, FXML_CONTROLLER_REFRESH_TEMP_PREFIX, FXML_CONTROLLER_CACHE_TEMP_PREFIX, createMockFxmlDocument, waitForDiagnostics, waitForCondition, withMockFindFiles, assertFsPathEqual, getRangeText } from './shared';

suiteWithResets('FXML Diagnostics and Controller Cache', () => {
    test('Should cache missing Java class lookups during diagnostics', async () => {
        const document = createMockFxmlDocument([
            '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MissingController">',
            '</VBox>',
        ].join('\n'));
        let javaFindFilesCalls = 0;

        await withMockFindFiles([], async () => {
            const firstDiagnostics = await collectFxmlDiagnostics(document, new vscode.CancellationTokenSource().token);
            const secondDiagnostics = await collectFxmlDiagnostics(document, new vscode.CancellationTokenSource().token);

            assert.strictEqual(firstDiagnostics.length, 1);
            assert.strictEqual(secondDiagnostics.length, 1);
            assert.strictEqual(javaFindFilesCalls, 1);
        }, pattern => {
            if (pattern === '**/com/example/MissingController.java') {
                javaFindFilesCalls++;
            }
        });
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

    test('Should refresh FXML diagnostics after controller saves', async function () {
        // This exercises real document saves plus diagnostics refreshes in the extension host.
        this.timeout(5000);

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

});
