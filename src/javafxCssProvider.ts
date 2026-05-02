import * as vscode from 'vscode';
import type { JavafxCssPropertyDefinition } from './javafxCssData';

interface CssPropertyMatch {
    readonly definition: JavafxCssPropertyDefinition;
    readonly range: vscode.Range;
}

interface ValueCompletionContext {
    readonly definition: JavafxCssPropertyDefinition;
    readonly range: vscode.Range;
    readonly appendSemicolon: boolean;
}

interface JavafxCssValueOption {
    readonly value: string;
    readonly label: string;
}

interface JavafxCssData {
    readonly propertyDefinitions: readonly JavafxCssPropertyDefinition[];
    readonly propertyLookup: ReadonlyMap<string, JavafxCssPropertyDefinition>;
    readonly valueLookup: ReadonlyMap<string, readonly JavafxCssValueOption[]>;
}

interface CssDocumentContext {
    readonly prefix: string;
    readonly suffix: string;
}

const MANUAL_VALUE_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
    '-fx-legend-side': ['top', 'right', 'bottom', 'left'],
    '-fx-side': ['top', 'right', 'bottom', 'left'],
    '-fx-title-side': ['top', 'right', 'bottom', 'left'],
};
const EXCLUDED_VALUE_SUGGESTIONS = new Set([
    'where',
    'phase',
    'line-join',
    'line-cap',
    'series',
    'data',
    'value',
]);
const FX_PROPERTY_TOKEN_PATTERN = '-fx-[a-z0-9]+(?:-[a-z0-9]+)*';
// Allow "-fx" during progressive typing so suggestions can appear before the final dash is entered.
const FX_PROPERTY_PREFIX_PATTERN = /(^|\s)(-fx|-fx-(?:[a-z0-9]+(?:-[a-z0-9]+)*)?)$/i;
const FX_PROPERTY_DECLARATION_PATTERN = new RegExp(`(${FX_PROPERTY_TOKEN_PATTERN})\\s*:(\\s*[^;}]*)$`, 'i');
const FX_PROPERTY_GLOBAL_PATTERN = new RegExp(FX_PROPERTY_TOKEN_PATTERN, 'gi');
// Captures a style attribute value up to the cursor, accepting escaped characters inside the quoted value.
const STYLE_ATTRIBUTE_VALUE_PREFIX_PATTERN = /\bstyle\s*=\s*(["'])((?:\\.|(?!\1).)*)$/i;
const TRAILING_SEMICOLON_PATTERN = /^\s*;/;
const CSS_VALUE_SEPARATOR = ' ';
// Sort JavaFX properties before built-in CSS vendor-prefix suggestions such as -ms-* and -webkit-*.
const JAVA_FX_CSS_PROPERTY_SORT_PREFIX = '0000-javafx-css-';

let javafxCssData: Promise<JavafxCssData> | undefined;

export class JavafxCssCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const data = await getJavafxCssData();
        if (token.isCancellationRequested) {
            return undefined;
        }

        const valueContext = this.getValueCompletionContext(document, position, data);
        if (valueContext) {
            return this.createValueCompletionItems(valueContext, data);
        }

        const propertyPrefix = this.getPropertyNamePrefix(document, position);
        if (!propertyPrefix) {
            return undefined;
        }

        const items = data.propertyDefinitions
            .filter(definition => definition.name.startsWith(propertyPrefix.prefix))
            .map(definition => {
                const item = new vscode.CompletionItem(definition.name, vscode.CompletionItemKind.Property);
                item.detail = 'JavaFX CSS property';
                item.insertText = definition.name;
                item.filterText = definition.name;
                item.range = propertyPrefix.range;
                item.sortText = `${JAVA_FX_CSS_PROPERTY_SORT_PREFIX}${definition.name}`;
                item.documentation = createPropertyDocumentation(definition, data);
                return item;
            });
        return new vscode.CompletionList(items, true);
    }

    private createValueCompletionItems(context: ValueCompletionContext, data: JavafxCssData): vscode.CompletionItem[] | undefined {
        const valueOptions = data.valueLookup.get(context.definition.name) ?? [];
        if (valueOptions.length === 0) {
            return undefined;
        }

        return valueOptions.map(option => {
            const item = new vscode.CompletionItem(option.label, vscode.CompletionItemKind.EnumMember);
            item.detail = `JavaFX CSS value for ${context.definition.name}`;
            item.insertText = createValueInsertText(option.value, context.appendSemicolon);
            item.filterText = `${option.label} ${option.value}`;
            item.range = context.range;
            item.documentation = createValueDocumentation(context.definition, option.value);
            return item;
        });
    }

    private getPropertyNamePrefix(document: vscode.TextDocument, position: vscode.Position): { prefix: string; range: vscode.Range } | undefined {
        const context = getCssDocumentContext(document, position);
        if (!context) {
            return undefined;
        }

        const declarationPrefix = getCurrentDeclarationPrefix(context.prefix);
        if (declarationPrefix.includes(':')) {
            return undefined;
        }

        const match = FX_PROPERTY_PREFIX_PATTERN.exec(declarationPrefix);
        if (!match) {
            return undefined;
        }

        const prefix = match[2].toLowerCase();
        return {
            prefix,
            range: new vscode.Range(position.line, position.character - prefix.length, position.line, position.character),
        };
    }

    private getValueCompletionContext(
        document: vscode.TextDocument,
        position: vscode.Position,
        data: JavafxCssData
    ): ValueCompletionContext | undefined {
        const context = getCssDocumentContext(document, position);
        if (!context) {
            return undefined;
        }

        const declarationPrefix = getCurrentDeclarationPrefix(context.prefix);
        const match = FX_PROPERTY_DECLARATION_PATTERN.exec(declarationPrefix);
        if (!match) {
            return undefined;
        }

        const propertyName = match[1].toLowerCase();
        const definition = data.propertyLookup.get(propertyName);
        if (!definition) {
            return undefined;
        }

        const rawValuePrefix = match[2];
        const valueReplacementLength = getCurrentValueReplacementLength(rawValuePrefix);

        return {
            definition,
            range: new vscode.Range(
                position.line,
                position.character - valueReplacementLength,
                position.line,
                position.character
            ),
            appendSemicolon: shouldAppendSemicolon(context.suffix),
        };
    }
}

export class JavafxCssHoverProvider implements vscode.HoverProvider {
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        if (token.isCancellationRequested) {
            return undefined;
        }

        const data = await getJavafxCssData();
        if (token.isCancellationRequested) {
            return undefined;
        }

        const propertyMatch = this.getPropertyAtPosition(document, position, data);
        if (!propertyMatch) {
            return undefined;
        }

        return new vscode.Hover(createPropertyDocumentation(propertyMatch.definition, data), propertyMatch.range);
    }

    private getPropertyAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position,
        data: JavafxCssData
    ): CssPropertyMatch | undefined {
        const lineText = document.lineAt(position.line).text;
        FX_PROPERTY_GLOBAL_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = FX_PROPERTY_GLOBAL_PATTERN.exec(lineText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (position.character < start || position.character > end) {
                continue;
            }

            const definition = data.propertyLookup.get(match[0].toLowerCase());
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

async function getJavafxCssData(): Promise<JavafxCssData> {
    // tsconfig uses Node16 module resolution, so dynamic imports must name the emitted JavaScript file.
    javafxCssData ??= import('./javafxCssData.js').then((module: typeof import('./javafxCssData.js')) => {
        const propertyDefinitions = module.JAVA_FX_CSS_PROPERTY_DEFINITIONS.map(definition => ({
            ...definition,
            name: definition.name.toLowerCase(),
        }));
        return {
            propertyDefinitions,
            propertyLookup: new Map(propertyDefinitions.map(definition => [definition.name, definition])),
            valueLookup: new Map(propertyDefinitions.map(definition => [definition.name, extractValueOptions(definition)])),
        };
    });
    return javafxCssData;
}

function createPropertyDocumentation(definition: JavafxCssPropertyDefinition, data: JavafxCssData): vscode.MarkdownString {
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

    const valueOptions = data.valueLookup.get(definition.name) ?? [];
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

function getCurrentValueReplacementLength(rawValuePrefix: string): number {
    const separatorIndex = rawValuePrefix.lastIndexOf(',');
    return separatorIndex >= 0
        ? rawValuePrefix.length - separatorIndex - 1
        : rawValuePrefix.length;
}

function getCssDocumentContext(document: vscode.TextDocument, position: vscode.Position): CssDocumentContext | undefined {
    const lineText = document.lineAt(position.line).text;
    if (document.languageId === 'fxml') {
        return getFxmlStyleAttributeContext(lineText, position.character);
    }

    return {
        prefix: lineText.slice(0, position.character),
        suffix: lineText.slice(position.character),
    };
}

function getFxmlStyleAttributeContext(lineText: string, character: number): CssDocumentContext | undefined {
    const linePrefix = lineText.slice(0, character);
    const attributeMatch = STYLE_ATTRIBUTE_VALUE_PREFIX_PATTERN.exec(linePrefix);
    if (!attributeMatch) {
        return undefined;
    }

    const quote = attributeMatch[1];
    const lineSuffix = lineText.slice(character);
    const closingQuoteIndex = lineSuffix.indexOf(quote);

    return {
        prefix: attributeMatch[2],
        suffix: closingQuoteIndex >= 0 ? lineSuffix.slice(0, closingQuoteIndex) : lineSuffix,
    };
}

function createValueInsertText(value: string, appendSemicolon: boolean): string {
    return `${CSS_VALUE_SEPARATOR}${value}${appendSemicolon ? ';' : ''}`;
}

function shouldAppendSemicolon(suffix: string): boolean {
    return !TRAILING_SEMICOLON_PATTERN.test(suffix);
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
    // Match literal keywords from the CSS grammar while skipping angle-bracketed type names
    // such as <size> and function names such as segments(...).
    const pattern = /\b[a-z][a-z0-9-]*\b(?!\s*\()/g;
    const syntax = definition.syntax.toLowerCase();
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(syntax)) !== null) {
        const value = match[0];
        const characterBeforeMatch = syntax[match.index - 1];
        const characterAfterMatch = syntax[match.index + value.length];
        if (characterBeforeMatch === '<' || characterAfterMatch === '>') {
            continue;
        }
        if (!isValueSuggestion(value) || seen.has(value)) {
            continue;
        }

        seen.add(value);
        values.push({ value, label: toDisplayValue(value) });
    }

    return values;
}

function isValueSuggestion(value: string): boolean {
    return value === 'null' || !EXCLUDED_VALUE_SUGGESTIONS.has(value);
}

function toDisplayValue(value: string): string {
    return value.replace(/-/g, '_').toUpperCase();
}

function escapeInlineCode(text: string): string {
    return text.replace(/[\\`]/g, '\\$&');
}
