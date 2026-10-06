// @ts-check

// Allows us to bring in the recommended core rules from eslint itself
import eslint from '@eslint/js';

// Import defineConfig from eslint
import { defineConfig } from 'eslint/config';

// Allows us to use the typed utility for our config, and to bring in the recommended rules for TypeScript projects from typescript-eslint
import tseslint from 'typescript-eslint';

// Turns off ESLint stylistic rules that would conflict with Prettier's formatting decisions.
// Deliberately NOT eslint-plugin-prettier/recommended: that also adds a `prettier/prettier` rule
// that runs Prettier's full formatter as an ESLint rule, which is ~45x slower than running
// `prettier --check` directly (measured: ~500s vs ~11s for this repo's backend). Formatting is
// checked by a separate `prettier --check` step (see package.json's `lint` script) instead.
import eslintConfigPrettier from 'eslint-config-prettier';

// Sorts imports (statements and the names inside braces) in a fixed order, auto-fixed by `npm run lint:fix`.
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { builtinModules } from 'node:module';

// Export our config array, which is composed together thanks to the defineConfig utility function from eslint
export default [
  { ignores: ['**/node_modules/', 'dist/'] },
  ...defineConfig({
    // Everything in this config object targets our TypeScript files
    files: ['**/*.ts'],
    extends: [
      // Apply the recommended core rules
      eslint.configs.recommended,
      // Apply the recommended TypeScript rules
      ...tseslint.configs.recommended,
      // Optionally apply stylistic rules from typescript-eslint that improve code consistency
      ...tseslint.configs.stylistic
    ],
    // Override specific rules for TypeScript files (these will take priority over the extended configs above)
    rules: {
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'generic',
          readonly: 'generic'
        }
      ],
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'no-case-declarations': 'off',
      'no-console': [
        'error',
        {
          allow: ['trace', 'info', 'warn', 'error', 'table']
        }
      ],
      'no-restricted-imports': ['error'],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fdescribe']",
          message: 'Do not use focused test suites (fdescribe)'
        },
        {
          selector: "CallExpression[callee.name='fit']",
          message: 'Do not use focused tests (fit)'
        },
        {
          selector: "MemberExpression[object.name='describe'][property.name='only']",
          message: 'Do not use focused test suites (describe.only)'
        },
        {
          selector: "MemberExpression[object.name='it'][property.name='only']",
          message: 'Do not use focused tests (it.only)'
        }
      ],
      'require-await': 'error'
    }
  }),
  {
    // Import groups, separated by a blank line and sorted alphabetically within each group. Side-effect imports come
    // first and keep their relative order (src/index.ts must load ./pkg-subpath-imports before anything else).
    files: ['**/*.ts'],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // side-effect imports
            ['^\\u0000'],
            // Node.js built-ins
            ['^node:', `^(${builtinModules.join('|')})(/|$)`],
            // npm packages
            ['^@?\\w'],
            // shared model (from src/)
            ['^(\\.\\./)+shared/'],
            // relative imports
            ['^\\.']
          ]
        }
      ],
      'simple-import-sort/exports': 'error',
      // one import statement per module (plus an optional separate `import type`)
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }]
    }
  },
  eslintConfigPrettier,
  // set the parse options for typed rules
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  // ── Targeted rule relaxations ──────────────────────────────────────────────
  {
    // Test files and shared mocks use async functions extensively to satisfy
    // Promise-returning interfaces, without ever needing an await expression.
    // Generator mocks that throw before yielding are also legitimate in tests.
    // Flagging these as errors would produce hundreds of false positives.
    files: ['**/*.spec.ts', 'src/tests/**/*.ts'],
    rules: {
      'require-await': 'off',
      'require-yield': 'off'
    }
  },
  // shared/model/ is compiled into the frontend too: it must stay self-contained (never backend code from src/,
  // Node built-ins or npm packages), and its folders are layered: common <- connector <- api <- oia.
  ...[
    { folder: 'common', allowed: [] },
    { folder: 'connector', allowed: ['common'] },
    { folder: 'api', allowed: ['common', 'connector'] },
    { folder: 'oia', allowed: ['common', 'connector', 'api'] }
  ].map(({ folder, allowed }) => ({
    files: [`shared/model/${folder}/**/*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: allowed.length ? `^(?!\\./|\\.\\./(${allowed.join('|')})/)` : '^(?!\\./)',
              message: `shared/model/${folder}/ may only import from ${['itself', ...allowed.map(a => `../${a}/`)].join(', ')} (layering: common <- connector <- api <- oia; nothing outside shared/model/).`
            }
          ]
        }
      ]
    }
  })),
  {
    // Migration down() functions are intentional no-ops: OIBus migrations are
    // irreversible, so down() is kept only to satisfy knex's interface.
    files: ['src/migration/**/*.ts'],
    rules: {
      'require-await': 'off'
    }
  }
];
