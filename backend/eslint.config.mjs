// @ts-check

// Allows us to bring in the recommended core rules from eslint itself
import eslint from '@eslint/js';

// Allows us to use the typed utility for our config, and to bring in the recommended rules for TypeScript projects from typescript-eslint
import tseslint from 'typescript-eslint';

// Allows us to bring in the recommended rules for Prettier from eslint-plugin-prettier
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

// Export our config array, which is composed together thanks to the typed utility function from typescript-eslint
export default [
  ...tseslint.config({
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
          argsIgnorePattern: '^_'
        }
      ],
      'no-case-declarations': 'off',
      'no-console': [
        'error',
        {
          allow: ['info', 'warn', 'error', 'table']
        }
      ],
      'no-restricted-imports': ['error'],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fdescribe']",
          message: "'Do not use focused test suites (fdescribe)"
        },
        {
          selector: "CallExpression[callee.name='fit']",
          message: "'Do not use focused tests (fit)"
        }
      ]
    }
  }),
  eslintPluginPrettierRecommended,
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
