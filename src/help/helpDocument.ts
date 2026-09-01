import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Root folder (relative to the extension) that stores the localized help documents.
 */
export const HELP_FOLDER = 'help';

/**
 * Locale used when a translated help document is not available.
 */
export const DEFAULT_HELP_LOCALE = 'en';

/**
 * Resolve the help document that best matches the requested language.
 *
 * Resolution order:
 * 1. The exact language tag (e.g. `zh-cn`).
 * 2. The base language sub-tag (e.g. `zh`).
 * 3. The default English document.
 *
 * The function is pure and only depends on the file system so it can be unit tested.
 */
export function resolveHelpDocumentPath(helpRoot: string, language: string): string {
    const normalized = (language || DEFAULT_HELP_LOCALE).trim().toLowerCase();
    const candidates: string[] = [];

    const addCandidate = (locale: string) => {
        if (locale && !candidates.includes(locale)) {
            candidates.push(locale);
        }
    };

    addCandidate(normalized);
    addCandidate(normalized.split(/[-_]/)[0]);
    addCandidate(DEFAULT_HELP_LOCALE);

    for (const candidate of candidates) {
        const filePath = path.join(helpRoot, `help.${candidate}.md`);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }

    return path.join(helpRoot, `help.${DEFAULT_HELP_LOCALE}.md`);
}

/**
 * Open the localized help document in the built-in Markdown preview.
 */
export async function showHelp(context: vscode.ExtensionContext): Promise<void> {
    const helpRoot = context.asAbsolutePath(HELP_FOLDER);
    const helpFile = resolveHelpDocumentPath(helpRoot, vscode.env.language);
    const helpUri = vscode.Uri.file(helpFile);

    try {
        await vscode.commands.executeCommand('markdown.showPreview', helpUri);
    } catch {
        // Markdown preview may be unavailable (e.g. the built-in Markdown extension is disabled);
        // fall back to opening the document directly.
        try {
            const document = await vscode.workspace.openTextDocument(helpUri);
            await vscode.window.showTextDocument(document, { preview: true });
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(
                vscode.l10n.t('Failed to open the JavaFX help document: {0}', detail)
            );
        }
    }
}
