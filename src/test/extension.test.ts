import * as assert from 'assert';
import * as vscode from 'vscode';
import { findControllerInFxmlText, findIncludeSources } from '../fxmlIncludeNavigation';

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

    test('Should parse fx:include source values', () => {
        const fxml = `
            <AnchorPane xmlns:fx="http://javafx.com/fxml">
                <children>
                    <fx:include source="child.fxml" />
                    <fx:include fx:id="formPane" source='../components/form.fxml' />
                </children>
            </AnchorPane>
        `;

        assert.deepStrictEqual(findIncludeSources(fxml), ['child.fxml', '../components/form.fxml']);
    });

    test('Should parse fx:controller value', () => {
        const fxml = `<BorderPane fx:controller="com.example.RootController" />`;
        assert.strictEqual(findControllerInFxmlText(fxml), 'com.example.RootController');
    });

    test('Should parse single-quoted fx:controller value', () => {
        const fxml = `<BorderPane fx:controller='com.example.RootController' />`;
        assert.strictEqual(findControllerInFxmlText(fxml), 'com.example.RootController');
    });
});
