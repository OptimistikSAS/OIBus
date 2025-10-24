import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import * as mdx from 'eslint-plugin-mdx';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // Base ESLint recommended config
  js.configs.recommended,
  // React specific rules
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react-refresh/only-export-components': 'warn',
      'react/no-unknown-property': ['error', { ignore: ['tw'] }],
      'no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^React$' // Ignore unused 'React' variables
        }
      ]
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  // MDX support
  {
    files: ['**/*.{md,mdx}'],
    ...mdx.flat,
    processor: mdx.processors.remark,
    plugins: {
      prettier: prettierPlugin // Add Prettier plugin for MDX files
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z]'
        }
      ],
      'prettier/prettier': [
        'error',
        {
          proseWrap: 'preserve',
          printWidth: 140
        }
      ]
    }
  },
  // Prettier integration
  {
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error'
    }
  },
  // Ignore patterns
  {
    ignores: ['**/node_modules/', '**/dist/', '**/.docusaurus/', '**/build/']
  }
];
