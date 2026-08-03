// @ts-check

// Allows us to bring in the recommended core rules from eslint itself
import eslint from '@eslint/js';

// Import defineConfig from eslint
import { defineConfig } from 'eslint/config';

// Allows us to use the typed utility for our config, and to bring in the recommended rules for TypeScript projects from typescript-eslint
import tseslint from 'typescript-eslint';

// Turns off ESLint stylistic rules that would conflict with Prettier's formatting decisions.
// Deliberately NOT eslint-plugin-prettier/recommended: that also adds a `prettier/prettier` rule
// that runs Prettier's full formatter as an ESLint rule, which is far slower than running
// `prettier --check` directly. Formatting is checked by a separate step (see package.json's
// `lint` script) instead.
import eslintConfigPrettier from 'eslint-config-prettier';

// Export our config array, which is composed together thanks to the defineConfig utility function from eslint
export default [
  { ignores: ['**/node_modules/', 'dist/'] },
  ...defineConfig({
    // Everything in this config object targets our TypeScript files (Components, Directives, Pipes etc)
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
          allow: ['trace', 'info', 'warn', 'error']
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
  eslintConfigPrettier,
  // set the parse options for typed rules
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
];
