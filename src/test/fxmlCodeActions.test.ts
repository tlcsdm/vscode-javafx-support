import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { JavafxCssCompletionProvider, JavafxCssHoverProvider } from '../css/javafxCssProvider';
import { FxmlCodeActionProvider } from '../fxml/fxmlCodeActionProvider';
import { FxmlDefinitionProvider } from '../fxml/fxmlDefinitionProvider';
import { collectFxmlDiagnostics } from '../fxml/fxmlDiagnostics';
import { FxmlDocumentSymbolProvider } from '../fxml/fxmlDocumentSymbolProvider';
import { FxmlFoldingRangeProvider } from '../fxml/fxmlFoldingRangeProvider';
import { FxmlFormattingEditProvider } from '../fxml/fxmlFormatter';
import { FxmlHoverProvider } from '../fxml/fxmlHoverProvider';
import { FxmlLinkedEditingRangeProvider } from '../fxml/fxmlLinkedEditingRangeProvider';
import { FxmlReferenceProvider } from '../fxml/fxmlReferenceProvider';
import { ControllerDefinitionProvider } from '../java/controllerDefinitionProvider';
import { FxmlCodeLensProvider } from '../java/fxmlCodeLensProvider';
import { WorkspaceSymbolProvider } from '../java/workspaceSymbolProvider';
import { suiteWithResets, createMockCssDocument, createCancelledToken, withMockFindFiles, createThrowingTextDocument } from './shared';

suiteWithResets('FXML Code Actions and Cancellation', () => {
    test('Should generate a missing controller field quick fix from fx:id', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fxml-code-action-field-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const resourceDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(resourceDir, { recursive: true });

            const controllerPath = path.join(javaDir, 'MainController.java');
            const fxmlPath = path.join(resourceDir, 'Main.fxml');
            await fs.writeFile(controllerPath, [
                'package com.example;',
                '',
                'public class MainController {',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, [
                '<?import javafx.scene.control.Button?>',
                '',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="loginButton" />',
                '</VBox>',
            ].join('\n'));

            await withMockFindFiles([controllerPath], async () => {
                const fxmlDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));
                const diagnostics = await collectFxmlDiagnostics(fxmlDocument, new vscode.CancellationTokenSource().token);
                const missingField = diagnostics.find(diagnostic => diagnostic.code === 'missing-fx-id-field');
                assert.ok(missingField);

                const codeActions = await new FxmlCodeActionProvider().provideCodeActions(
                    fxmlDocument,
                    missingField!.range,
                    { diagnostics: [missingField!], only: vscode.CodeActionKind.QuickFix, triggerKind: vscode.CodeActionTriggerKind.Invoke },
                    new vscode.CancellationTokenSource().token
                );

                assert.strictEqual(codeActions.length, 1);
                assert.strictEqual(codeActions[0].kind?.value, vscode.CodeActionKind.QuickFix.value);
                assert.ok(codeActions[0].edit);

                await vscode.workspace.applyEdit(codeActions[0].edit!);

                const controllerDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(controllerPath));
                assert.strictEqual(controllerDocument.getText(), [
                    'package com.example;',
                    '',
                    'import javafx.fxml.FXML;',
                    'import javafx.scene.control.Button;',
                    '',
                    'public class MainController {',
                    '    @FXML',
                    '    private Button loginButton;',
                    '}',
                ].join('\n'));
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should generate a missing controller event handler quick fix from onAction', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fxml-code-action-handler-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const resourceDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(resourceDir, { recursive: true });

            const controllerPath = path.join(javaDir, 'MainController.java');
            const fxmlPath = path.join(resourceDir, 'Main.fxml');
            await fs.writeFile(controllerPath, [
                'package com.example;',
                '',
                'public class MainController {',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, [
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button onAction="#handleLogin" />',
                '</VBox>',
            ].join('\n'));

            await withMockFindFiles([controllerPath], async () => {
                const fxmlDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));
                const diagnostics = await collectFxmlDiagnostics(fxmlDocument, new vscode.CancellationTokenSource().token);
                const missingHandler = diagnostics.find(diagnostic => diagnostic.code === 'missing-event-handler');
                assert.ok(missingHandler);

                const codeActions = await new FxmlCodeActionProvider().provideCodeActions(
                    fxmlDocument,
                    missingHandler!.range,
                    { diagnostics: [missingHandler!], only: vscode.CodeActionKind.QuickFix, triggerKind: vscode.CodeActionTriggerKind.Invoke },
                    new vscode.CancellationTokenSource().token
                );

                assert.strictEqual(codeActions.length, 1);
                assert.strictEqual(codeActions[0].kind?.value, vscode.CodeActionKind.QuickFix.value);
                assert.ok(codeActions[0].edit);

                await vscode.workspace.applyEdit(codeActions[0].edit!);

                const controllerDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(controllerPath));
                assert.strictEqual(controllerDocument.getText(), [
                    'package com.example;',
                    '',
                    'import javafx.event.ActionEvent;',
                    'import javafx.fxml.FXML;',
                    '',
                    'public class MainController {',
                    '    @FXML',
                    '    private void handleLogin(ActionEvent event) {',
                    '    }',
                    '}',
                ].join('\n'));
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should insert generated controller fields before existing methods', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fxml-code-action-field-order-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const resourceDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(resourceDir, { recursive: true });

            const controllerPath = path.join(javaDir, 'MainController.java');
            const fxmlPath = path.join(resourceDir, 'Main.fxml');
            await fs.writeFile(controllerPath, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                'import javafx.scene.control.Label;',
                '',
                'public class MainController {',
                '    @FXML',
                '    private Label statusLabel;',
                '',
                '    @FXML',
                '    private void initialize() {',
                '    }',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, [
                '<?import javafx.scene.control.Button?>',
                '',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="loginButton" />',
                '</VBox>',
            ].join('\n'));

            await withMockFindFiles([controllerPath], async () => {
                const fxmlDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));
                const diagnostics = await collectFxmlDiagnostics(fxmlDocument, new vscode.CancellationTokenSource().token);
                const missingField = diagnostics.find(diagnostic => diagnostic.code === 'missing-fx-id-field');
                assert.ok(missingField);

                const codeActions = await new FxmlCodeActionProvider().provideCodeActions(
                    fxmlDocument,
                    missingField!.range,
                    { diagnostics: [missingField!], only: vscode.CodeActionKind.QuickFix, triggerKind: vscode.CodeActionTriggerKind.Invoke },
                    new vscode.CancellationTokenSource().token
                );

                assert.strictEqual(codeActions.length, 1);
                assert.ok(codeActions[0].edit);

                await vscode.workspace.applyEdit(codeActions[0].edit!);

                const controllerDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(controllerPath));
                assert.strictEqual(controllerDocument.getText(), [
                    'package com.example;',
                    '',
                    'import javafx.fxml.FXML;',
                    'import javafx.scene.control.Label;',
                    'import javafx.scene.control.Button;',
                    '',
                    'public class MainController {',
                    '    @FXML',
                    '    private Label statusLabel;',
                    '    @FXML',
                    '    private Button loginButton;',
                    '',
                    '    @FXML',
                    '    private void initialize() {',
                    '    }',
                    '}',
                ].join('\n'));
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    test('Should insert generated controller fields before top-level nested types', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fxml-code-action-field-nested-type-'));
        try {
            const javaDir = path.join(tempDir, 'src', 'main', 'java', 'com', 'example');
            const resourceDir = path.join(tempDir, 'src', 'main', 'resources', 'com', 'example');
            await fs.mkdir(javaDir, { recursive: true });
            await fs.mkdir(resourceDir, { recursive: true });

            const controllerPath = path.join(javaDir, 'MainController.java');
            const fxmlPath = path.join(resourceDir, 'Main.fxml');
            await fs.writeFile(controllerPath, [
                'package com.example;',
                '',
                'import javafx.fxml.FXML;',
                '',
                'public class MainController {',
                '    private static final class ViewState {',
                '    }',
                '}',
            ].join('\n'));
            await fs.writeFile(fxmlPath, [
                '<?import javafx.scene.control.Button?>',
                '',
                '<VBox xmlns:fx="http://javafx.com/fxml/1" fx:controller="com.example.MainController">',
                '  <Button fx:id="loginButton" />',
                '</VBox>',
            ].join('\n'));

            await withMockFindFiles([controllerPath], async () => {
                const fxmlDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(fxmlPath));
                const diagnostics = await collectFxmlDiagnostics(fxmlDocument, new vscode.CancellationTokenSource().token);
                const missingField = diagnostics.find(diagnostic => diagnostic.code === 'missing-fx-id-field');
                assert.ok(missingField);

                const codeActions = await new FxmlCodeActionProvider().provideCodeActions(
                    fxmlDocument,
                    missingField!.range,
                    { diagnostics: [missingField!], only: vscode.CodeActionKind.QuickFix, triggerKind: vscode.CodeActionTriggerKind.Invoke },
                    new vscode.CancellationTokenSource().token
                );

                assert.strictEqual(codeActions.length, 1);
                assert.ok(codeActions[0].edit);

                await vscode.workspace.applyEdit(codeActions[0].edit!);

                const controllerDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(controllerPath));
                assert.strictEqual(controllerDocument.getText(), [
                    'package com.example;',
                    '',
                    'import javafx.fxml.FXML;',
                    'import javafx.scene.control.Button;',
                    '',
                    'public class MainController {',
                    '    @FXML',
                    '    private Button loginButton;',
                    '    private static final class ViewState {',
                    '    }',
                    '}',
                ].join('\n'));
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

        const references = await new FxmlReferenceProvider().provideReferences(
            document,
            position,
            { includeDeclaration: true },
            cancelledToken
        );
        assert.strictEqual(references, undefined);

        const hover = await new FxmlHoverProvider().provideHover(document, position, cancelledToken);
        assert.strictEqual(hover, undefined);

        const cssDocument = createMockCssDocument('.root { -fx-alignment: center; }');
        const cssCompletions = await new JavafxCssCompletionProvider().provideCompletionItems(cssDocument, position, cancelledToken);
        assert.strictEqual(cssCompletions, undefined);

        const cssHover = await new JavafxCssHoverProvider().provideHover(cssDocument, position, cancelledToken);
        assert.strictEqual(cssHover, undefined);

        const symbols = new FxmlDocumentSymbolProvider().provideDocumentSymbols(document, cancelledToken);
        assert.deepStrictEqual(symbols, []);

        const formatter = new FxmlFormattingEditProvider();
        assert.deepStrictEqual(formatter.provideDocumentFormattingEdits(document, options, cancelledToken), []);
        assert.deepStrictEqual(formatter.provideDocumentRangeFormattingEdits(document, range, options, cancelledToken), []);

        const result = new FxmlLinkedEditingRangeProvider().provideLinkedEditingRanges(document, position, cancelledToken);
        assert.strictEqual(result, undefined);

        const foldingRanges = new FxmlFoldingRangeProvider().provideFoldingRanges(document, {}, cancelledToken);
        assert.deepStrictEqual(foldingRanges, []);

        const workspaceSymbols = await new WorkspaceSymbolProvider().provideWorkspaceSymbols('submit', cancelledToken);
        assert.deepStrictEqual(workspaceSymbols, []);
    });

});
