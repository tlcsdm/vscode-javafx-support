import * as vscode from 'vscode';
import { openInSceneBuilder, setSceneBuilderPath } from './sceneBuilder';
import { FxmlDefinitionProvider } from './fxmlDefinitionProvider';
import { ControllerDefinitionProvider } from './controllerDefinitionProvider';
import { FxmlFormattingEditProvider } from './fxmlFormatter';
import { FxmlCodeLensProvider, goToFxmlCommand } from './fxmlCodeLensProvider';

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

    // Register Set Scene Builder Path command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'tlcsdm.javafxSupport.setSceneBuilderPath',
            () => {
                setSceneBuilderPath();
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

    // Register @FXML CodeLens provider for Java files
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            javaSelector,
            new FxmlCodeLensProvider()
        )
    );

    // Register Go to FXML command for CodeLens
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'tlcsdm.javafxSupport.goToFxml',
            (controllerClassName: string, memberName: string, isMethod: boolean) => {
                goToFxmlCommand(controllerClassName, memberName, isMethod);
            }
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
