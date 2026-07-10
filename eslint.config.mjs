import eslint from '@eslint/js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const TYPESCRIPT_ESLINT_MAX_SUPPORTED_TS_MAJOR = 6;
const canUseTypescriptEslint = Number.parseInt(ts.versionMajorMinor.split('.')[0], 10) <= TYPESCRIPT_ESLINT_MAX_SUPPORTED_TS_MAJOR;
const commonConfig = {
    ignores: ['out/**', 'node_modules/**', '**/*.d.ts']
};
const nodeGlobalsConfig = {
    languageOptions: {
        globals: {
            console: 'readonly',
            process: 'readonly'
        }
    }
};
let config;
if (canUseTypescriptEslint) {
    // typescript-eslint currently crashes with TypeScript 7+ at module load time.
    // Keep this import lazy so the config can fall back to base ESLint rules.
    const tseslint = (await import('typescript-eslint')).default;
    config = tseslint.config(
        eslint.configs.recommended,
        ...tseslint.configs.recommended,
        commonConfig,
        nodeGlobalsConfig,
        {
            rules: {
                '@typescript-eslint/naming-convention': [
                    'warn',
                    {
                        selector: 'import',
                        format: ['camelCase', 'PascalCase']
                    }
                ],
                '@typescript-eslint/no-unused-vars': [
                    'error',
                    {
                        argsIgnorePattern: '^_',
                        varsIgnorePattern: '^_'
                    }
                ],
                curly: 'warn',
                eqeqeq: 'warn',
                'no-throw-literal': 'warn',
                semi: 'warn'
            }
        }
    );
} else {
    config = [
        eslint.configs.recommended,
        commonConfig,
        nodeGlobalsConfig
    ];
}

export default config;
