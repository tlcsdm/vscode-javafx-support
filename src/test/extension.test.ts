import * as assert from 'assert';
import * as vscode from 'vscode';

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
});
