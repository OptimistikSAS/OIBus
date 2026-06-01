import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
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
      'react-hooks': reactHooksPlugin
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
      'react/no-unknown-property': ['error', { ignore: ['tw'] }],
      'no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  // MDX / Markdown support — prettier options are read from .prettierrc automatically
  {
    files: ['**/*.{md,mdx}'],
    ...mdx.flat,
    processor: mdx.processors.remark,
    plugins: {
      react: reactPlugin
    },
    rules: {
      // Mark variables used as JSX tags (e.g. <RedocWrapper />) as "used" so that
      // no-unused-vars doesn't flag imported components that appear only in MDX JSX.
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_'
        }
      ],
      'prettier/prettier': 'error'
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
