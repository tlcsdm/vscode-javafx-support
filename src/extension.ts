import * as vscode from 'vscode';
import { openInSceneBuilder, setSceneBuilderPath } from './scene-builder/sceneBuilder';
import { FxmlDefinitionProvider } from './fxml/fxmlDefinitionProvider';
import { ControllerDefinitionProvider } from './java/controllerDefinitionProvider';
import { FxmlFormattingEditProvider } from './fxml/fxmlFormatter';
import { FxmlCodeLensProvider, goToFxmlCommand } from './java/fxmlCodeLensProvider';
import { FxmlDocumentSymbolProvider } from './fxml/fxmlDocumentSymbolProvider';
import { FxmlLinkedEditingRangeProvider } from './fxml/fxmlLinkedEditingRangeProvider';
import { FxmlFoldingRangeProvider } from './fxml/fxmlFoldingRangeProvider';
import { FxmlDiagnosticProvider } from './fxml/fxmlDiagnostics';
import { registerFxmlControllerCache } from './fxml/fxmlControllerCache';
import { FxmlHoverProvider } from './fxml/fxmlHoverProvider';
import { FxmlReferenceProvider } from './fxml/fxmlReferenceProvider';
import { WorkspaceSymbolProvider } from './java/workspaceSymbolProvider';
import { JavafxCssCompletionProvider, JavafxCssHoverProvider } from './css/javafxCssProvider';
import { registerJavaClassCache } from './java/javaControllerResolver';
import { FxmlCodeActionProvider } from './fxml/fxmlCodeActionProvider';

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
    const cssSelector: vscode.DocumentSelector = { language: 'css', scheme: 'file' };
    const fxmlFoldingSelector: vscode.DocumentSelector = [
        fxmlSelector,
        { language: 'fxml', scheme: 'untitled' },
        // Keep folding available if another XML extension claims a .fxml document before this extension corrects the language.
        { language: 'xml', scheme: 'file', pattern: '**/*.fxml' },
    ];

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
    const workspaceSymbolProvider = new WorkspaceSymbolProvider();
    context.subscriptions.push(
        workspaceSymbolProvider,
        vscode.languages.registerWorkspaceSymbolProvider(
            workspaceSymbolProvider
        )
    );
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            fxmlSelector,
            new FxmlHoverProvider()
        )
    );
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(
            fxmlSelector,
            new FxmlReferenceProvider()
        ),
        vscode.languages.registerReferenceProvider(
            cssSelector,
            new FxmlReferenceProvider()
        )
    );
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            cssSelector,
            new JavafxCssCompletionProvider(),
            '-',
            'x',
            ' ',
            ':'
        ),
        vscode.languages.registerCompletionItemProvider(
            fxmlSelector,
            new JavafxCssCompletionProvider(),
            '"',
            '\'',
            '-',
            'x',
            ' ',
            ':'
        ),
        vscode.languages.registerHoverProvider(
            cssSelector,
            new JavafxCssHoverProvider()
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
            fxmlFoldingSelector,
            new FxmlFoldingRangeProvider()
        )
    );
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            fxmlSelector,
            new FxmlCodeActionProvider(),
            { providedCodeActionKinds: FxmlCodeActionProvider.providedCodeActionKinds }
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
    context.subscriptions.push(new FxmlDiagnosticProvider());
    context.subscriptions.push(registerFxmlControllerCache());
    context.subscriptions.push(registerJavaClassCache());

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
