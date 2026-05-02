import * as vscode from 'vscode';
import { JAVA_FX_CSS_PROPERTY_DEFINITIONS, JavafxCssPropertyDefinition } from './javafxCssData';

interface CssPropertyMatch {
    readonly definition: JavafxCssPropertyDefinition;
    readonly range: vscode.Range;
}

interface ValueCompletionContext {
    readonly definition: JavafxCssPropertyDefinition;
    readonly range: vscode.Range;
}

interface JavafxCssValueOption {
    readonly value: string;
    readonly label: string;
}

const MANUAL_VALUE_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
    '-fx-legend-side': ['top', 'right', 'bottom', 'left'],
    '-fx-side': ['top', 'right', 'bottom', 'left'],
    '-fx-title-side': ['top', 'right', 'bottom', 'left'],
};

const PROPERTY_DEFINITIONS = JAVA_FX_CSS_PROPERTY_DEFINITIONS.map(definition => ({
    ...definition,
    name: definition.name.toLowerCase(),
}));
const PROPERTY_LOOKUP = new Map(PROPERTY_DEFINITIONS.map(definition => [definition.name, definition]));
const VALUE_LOOKUP = new Map(PROPERTY_DEFINITIONS.map(definition => [definition.name, extractValueOptions(definition)]));

export class JavafxCssCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const valueContext = this.getValueCompletionContext(document, position);
        if (valueContext) {
            return this.createValueCompletionItems(valueContext);
        }

        const propertyPrefix = this.getPropertyNamePrefix(document, position);
        if (!propertyPrefix) {
            return undefined;
        }

        return PROPERTY_DEFINITIONS
            .filter(definition => definition.name.startsWith(propertyPrefix.prefix))
            .map(definition => {
                const item = new vscode.CompletionItem(definition.name, vscode.CompletionItemKind.Property);
                item.detail = 'JavaFX CSS property';
                item.insertText = definition.name;
                item.range = propertyPrefix.range;
                item.documentation = createPropertyDocumentation(definition);
                return item;
            });
    }

    private createValueCompletionItems(context: ValueCompletionContext): vscode.CompletionItem[] | undefined {
        const valueOptions = VALUE_LOOKUP.get(context.definition.name) ?? [];
        if (valueOptions.length === 0) {
            return undefined;
        }

        return valueOptions.map(option => {
            const item = new vscode.CompletionItem(option.label, vscode.CompletionItemKind.EnumMember);
            item.detail = `JavaFX CSS value for ${context.definition.name}`;
            item.insertText = option.value;
            item.filterText = `${option.label} ${option.value}`;
            item.range = context.range;
            item.documentation = createValueDocumentation(context.definition, option.value);
            return item;
        });
    }

    private getPropertyNamePrefix(document: vscode.TextDocument, position: vscode.Position): { prefix: string; range: vscode.Range } | undefined {
        const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
        const declarationPrefix = getCurrentDeclarationPrefix(linePrefix);
        if (declarationPrefix.includes(':')) {
            return undefined;
        }

        const match = /(^|\s)(-fx-[a-z0-9-]*)$/i.exec(declarationPrefix);
        if (!match) {
            return undefined;
        }

        const prefix = match[2].toLowerCase();
        return {
            prefix,
            range: new vscode.Range(position.line, position.character - prefix.length, position.line, position.character),
        };
    }

    private getValueCompletionContext(document: vscode.TextDocument, position: vscode.Position): ValueCompletionContext | undefined {
        const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
        const declarationPrefix = getCurrentDeclarationPrefix(linePrefix);
        const match = /(-fx-[a-z0-9-]+)\s*:\s*([^;}]*)$/i.exec(declarationPrefix);
        if (!match) {
            return undefined;
        }

        const propertyName = match[1].toLowerCase();
        const definition = PROPERTY_LOOKUP.get(propertyName);
        if (!definition) {
            return undefined;
        }

        const rawValuePrefix = match[2];
        const currentValuePrefixMatch = /[^,\s]*$/.exec(rawValuePrefix);
        const currentValuePrefix = currentValuePrefixMatch?.[0] ?? '';

        return {
            definition,
            range: new vscode.Range(
                position.line,
                position.character - currentValuePrefix.length,
                position.line,
                position.character
            ),
        };
    }
}

export class JavafxCssHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const propertyMatch = this.getPropertyAtPosition(document, position);
        if (!propertyMatch) {
            return undefined;
        }

        return new vscode.Hover(createPropertyDocumentation(propertyMatch.definition), propertyMatch.range);
    }

    private getPropertyAtPosition(document: vscode.TextDocument, position: vscode.Position): CssPropertyMatch | undefined {
        const lineText = document.lineAt(position.line).text;
        const pattern = /-fx-[a-z0-9-]+/gi;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(lineText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (position.character < start || position.character > end) {
                continue;
            }

            const definition = PROPERTY_LOOKUP.get(match[0].toLowerCase());
            if (!definition) {
                return undefined;
            }

            return {
                definition,
                range: new vscode.Range(position.line, start, position.line, end),
            };
        }

        return undefined;
    }
}

function createPropertyDocumentation(definition: JavafxCssPropertyDefinition): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    const syntax = definition.syntax || '<value>';
    markdown.appendCodeblock(`${definition.name}: ${syntax};`, 'css');
    markdown.appendText(definition.description || 'JavaFX CSS property from the OpenJFX CSS reference.');

    if (definition.defaultValue) {
        markdown.appendMarkdown(`\n\n**Default:** \`${escapeInlineCode(definition.defaultValue)}\``);
    }

    if (definition.appliesTo.length > 0) {
        markdown.appendMarkdown(`\n\n**Applies to:** ${definition.appliesTo.map(target => `\`${escapeInlineCode(target)}\``).join(', ')}`);
    }

    const valueOptions = VALUE_LOOKUP.get(definition.name) ?? [];
    if (valueOptions.length > 0) {
        markdown.appendMarkdown(`\n\n**Common values:** ${valueOptions.slice(0, 12).map(option => `\`${escapeInlineCode(option.value)}\``).join(', ')}`);
    }

    return markdown;
}

function createValueDocumentation(definition: JavafxCssPropertyDefinition, value: string): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.appendCodeblock(`${definition.name}: ${value};`, 'css');
    markdown.appendText(`JavaFX CSS value for ${definition.name}.`);
    return markdown;
}

function getCurrentDeclarationPrefix(linePrefix: string): string {
    const separatorIndex = Math.max(
        linePrefix.lastIndexOf('{'),
        linePrefix.lastIndexOf('}'),
        linePrefix.lastIndexOf(';')
    );
    return linePrefix.slice(separatorIndex + 1);
}

function extractValueOptions(definition: JavafxCssPropertyDefinition): readonly JavafxCssValueOption[] {
    const manualValues = MANUAL_VALUE_OVERRIDES[definition.name];
    if (manualValues) {
        return manualValues.map(value => ({ value, label: toDisplayValue(value) }));
    }

    if (definition.syntax === '<boolean>') {
        return ['true', 'false'].map(value => ({ value, label: toDisplayValue(value) }));
    }

    const seen = new Set<string>();
    const values: JavafxCssValueOption[] = [];
    const pattern = /(?<!<)\b[a-z][a-z0-9-]*\b(?!>)(?!\s*\()/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(definition.syntax.toLowerCase())) !== null) {
        const value = match[0];
        if (!isValueSuggestion(value) || seen.has(value)) {
            continue;
        }

        seen.add(value);
        values.push({ value, label: toDisplayValue(value) });
    }

    return values;
}

function isValueSuggestion(value: string): boolean {
    switch (value) {
    case 'where':
    case 'phase':
    case 'line-join':
    case 'line-cap':
    case 'series':
    case 'data':
    case 'value':
    case 'null':
        return value === 'null';
    default:
        return true;
    }
}

function toDisplayValue(value: string): string {
    return value.replace(/-/g, '_').toUpperCase();
}

function escapeInlineCode(text: string): string {
    return text.replace(/[\\`]/g, '\\$&');
}
