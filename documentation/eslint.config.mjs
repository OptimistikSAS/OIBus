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
    // docs/ and i18n/**/docusaurus-plugin-content-docs/ are excluded: every heading in this repo's
    // doc content now carries an explicit Docusaurus anchor id (e.g. "## Transformers
    // {#transformers}", added via `docusaurus write-heading-ids` so translating a heading's text
    // never changes its slug and breaks cross-references). Docusaurus's own MDX pipeline handles
    // this syntax via a dedicated remark plugin that strips it before JS-expression parsing runs;
    // eslint-plugin-mdx's bare acorn-based parser has no equivalent and always throws "Could not
    // parse expression with acorn" on the trailing `{#id}`, with no supported option found to
    // inject Docusaurus's plugin into its parser (checked eslint-mdx's ParserOptions - no
    // remarkPlugins hook exists). This is a real gap in this lint config, not specific to any one
    // file's content - excluding these directories from linting entirely is the least-bad option
    // until eslint-plugin-mdx supports the syntax or a maintained workaround exists.
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.docusaurus/',
      '**/build/',
      'docs/**/*.{md,mdx}',
      'i18n/**/docusaurus-plugin-content-docs/**/*.{md,mdx}'
    ]
  }
];
