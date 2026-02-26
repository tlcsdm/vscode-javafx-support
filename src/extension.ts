import * as vscode from 'vscode';
import { openInSceneBuilder } from './sceneBuilder';
import { FxmlDefinitionProvider } from './fxmlDefinitionProvider';
import { ControllerDefinitionProvider } from './controllerDefinitionProvider';
import { FxmlFormattingEditProvider } from './fxmlFormatter';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
    // Register Open in Scene Builder command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'tlcsdm.javafxSupport.openInSceneBuilder',
            (uri?: vscode.Uri) => {
                openInSceneBuilder(uri);
            }
        )
    );

    const fxmlSelector: vscode.DocumentSelector = { language: 'fxml', scheme: 'file' };

    // Register FXML → Controller definition provider
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            fxmlSelector,
            new FxmlDefinitionProvider()
        )
    );

    // Register Controller → FXML definition provider
    const javaSelector: vscode.DocumentSelector = { language: 'java', scheme: 'file' };
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            javaSelector,
            new ControllerDefinitionProvider()
        )
    );

    // Register FXML formatter
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            fxmlSelector,
            new FxmlFormattingEditProvider()
        )
    );
    context.subscriptions.push(
        vscode.languages.registerDocumentRangeFormattingEditProvider(
            fxmlSelector,
            new FxmlFormattingEditProvider()
        )
    );
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    // Clean up resources if needed
}
