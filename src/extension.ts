import * as vscode from 'vscode';
import { openInSceneBuilder, setSceneBuilderPath } from './sceneBuilder';
import { FxmlDefinitionProvider } from './fxmlDefinitionProvider';
import { ControllerDefinitionProvider } from './controllerDefinitionProvider';
import { FxmlFormattingEditProvider } from './fxmlFormatter';
import { FxmlCodeLensProvider, goToFxmlCommand } from './fxmlCodeLensProvider';
import { FxmlDocumentSymbolProvider } from './fxmlDocumentSymbolProvider';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
    // Ensure .fxml files use the fxml language mode instead of xml.
    // VS Code's built-in XML extension registers .fxml as xml, so we
    // need to programmatically correct any misdetected files.
    ensureFxmlLanguage(context);

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
 * Ensures .fxml files are recognized as fxml language, not xml.
 * VS Code's built-in XML extension and Red Hat XML extension both register
 * .fxml as xml, which can override this extension's language registration.
 */
function ensureFxmlLanguage(context: vscode.ExtensionContext): void {
    const setFxmlLanguage = (doc: vscode.TextDocument) => {
        if (doc.fileName.toLowerCase().endsWith('.fxml') && doc.languageId !== 'fxml') {
            vscode.languages.setTextDocumentLanguage(doc, 'fxml');
        }
    };

    // Fix already-open .fxml files
    for (const doc of vscode.workspace.textDocuments) {
        setFxmlLanguage(doc);
    }

    // Fix newly-opened .fxml files
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(setFxmlLanguage)
    );
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    // Clean up resources if needed
}
