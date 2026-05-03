import * as vscode from 'vscode';
import {
    findWorkspaceFxmlStyleClassReferences,
    getCssClassAtPosition,
} from '../css/fxmlCssClassSupport';
import { FxmlDefinitionProvider } from './fxmlDefinitionProvider';
import { escapeRegex } from '../core/utils';

/**
 * Provides "Find All References" from FXML fx:id declarations.
 * Supports:
 * - fx:id="submitBtn" → finds $submitBtn usages in the current FXML document
 * - fx:id="submitBtn" → includes the matching @FXML controller field declaration
 */
export class FxmlReferenceProvider implements vscode.ReferenceProvider {
    private readonly definitionProvider = new FxmlDefinitionProvider();

    async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): Promise<vscode.Location[] | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        if (document.languageId === 'css') {
            return this.provideCssClassReferences(document, position, context, token);
        }

        const line = document.lineAt(position).text;
        const fxId = this.getAttributeValueAtPosition(line, position.character, /\bfx:id\s*=\s*"([^"]+)"/g);
        if (!fxId) {
            return undefined;
        }

        const references = this.findFxIdUsagesInDocument(document, fxId, token);
        if (context.includeDeclaration) {
            const declaration = await this.definitionProvider.provideDefinition(document, position, token);
            if (declaration instanceof vscode.Location) {
                references.push(declaration);
            }
        }

        return references.length > 0 ? references : undefined;
    }

    private async provideCssClassReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): Promise<vscode.Location[] | undefined> {
        const cssClassMatch = getCssClassAtPosition(document, position);
        if (!cssClassMatch) {
            return undefined;
        }

        const references = await findWorkspaceFxmlStyleClassReferences(cssClassMatch.className, token);
        if (context.includeDeclaration) {
            references.unshift(new vscode.Location(document.uri, cssClassMatch.range));
        }

        return references.length > 0 ? references : undefined;
    }

    private getAttributeValueAtPosition(line: string, charPos: number, pattern: RegExp): string | undefined {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(line)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (charPos >= start && charPos <= end) {
                return match[1];
            }
        }
        return undefined;
    }

    private findFxIdUsagesInDocument(
        document: vscode.TextDocument,
        memberName: string,
        token: vscode.CancellationToken
    ): vscode.Location[] {
        const locations: vscode.Location[] = [];
        const pattern = new RegExp(`\\$${escapeRegex(memberName)}(?=[^\\w$]|$)`, 'g');

        for (let i = 0; i < document.lineCount; i++) {
            if (token.isCancellationRequested) {
                return [];
            }

            const lineText = document.lineAt(i).text;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(lineText)) !== null) {
                const start = new vscode.Position(i, match.index);
                const end = new vscode.Position(i, match.index + match[0].length);
                locations.push(new vscode.Location(document.uri, new vscode.Range(start, end)));
            }
        }

        return locations;
    }
}
