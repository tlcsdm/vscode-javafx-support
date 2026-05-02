import * as vscode from 'vscode';
import { openInSceneBuilder, setSceneBuilderPath } from './sceneBuilder';
import { FxmlDefinitionProvider } from './fxmlDefinitionProvider';
import { ControllerDefinitionProvider } from './controllerDefinitionProvider';
import { FxmlFormattingEditProvider } from './fxmlFormatter';
import { FxmlCodeLensProvider, goToFxmlCommand } from './fxmlCodeLensProvider';
import { FxmlDocumentSymbolProvider } from './fxmlDocumentSymbolProvider';
import { FxmlLinkedEditingRangeProvider } from './fxmlLinkedEditingRangeProvider';
import { FxmlFoldingRangeProvider } from './fxmlFoldingRangeProvider';

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

    // Register FXML document symbol provider (Outline view)
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            fxmlSelector,
            new FxmlDocumentSymbolProvider()
        )
    );
    context.subscriptions.push(
        vscode.languages.registerLinkedEditingRangeProvider(
            fxmlSelector,
            new FxmlLinkedEditingRangeProvider()
        )
    );
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            fxmlSelector,
            new FxmlFoldingRangeProvider()
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

    // Ensure .fxml files use the fxml language (prevent XML extension override)
    const ensureFxmlLanguage = (document: vscode.TextDocument) => {
        if (document.fileName.endsWith('.fxml') && document.languageId !== 'fxml') {
            vscode.languages.setTextDocumentLanguage(document, 'fxml');
        }
    };

    // Check already open documents
    for (const document of vscode.workspace.textDocuments) {
        ensureFxmlLanguage(document);
    }

    // Watch for newly opened documents
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(ensureFxmlLanguage)
    );
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    // Clean up resources if needed
}
