import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { DEFAULT_HELP_LOCALE, HELP_FOLDER, resolveHelpDocumentPath } from '../help/helpDocument';
import { suiteWithResets } from './shared';

const helpRoot = path.join(__dirname, '..', '..', HELP_FOLDER);

suiteWithResets('Help Document', () => {
    test('Should register Show Help command', () => {
        return vscode.commands.getCommands(true).then(commands => {
            assert.ok(commands.includes('tlcsdm.javafxSupport.showHelp'));
        });
    });

    test('Should resolve the exact locale document when available', () => {
        assert.strictEqual(
            resolveHelpDocumentPath(helpRoot, 'zh-cn'),
            path.join(helpRoot, 'help.zh-cn.md')
        );
        assert.strictEqual(
            resolveHelpDocumentPath(helpRoot, 'ja'),
            path.join(helpRoot, 'help.ja.md')
        );
    });

    test('Should be case insensitive when resolving locales', () => {
        assert.strictEqual(
            resolveHelpDocumentPath(helpRoot, 'ZH-CN'),
            path.join(helpRoot, 'help.zh-cn.md')
        );
    });

    test('Should fall back to English for unknown or empty locales', () => {
        const englishDocument = path.join(helpRoot, `help.${DEFAULT_HELP_LOCALE}.md`);
        assert.strictEqual(resolveHelpDocumentPath(helpRoot, 'fr'), englishDocument);
        assert.strictEqual(resolveHelpDocumentPath(helpRoot, ''), englishDocument);
    });
});
