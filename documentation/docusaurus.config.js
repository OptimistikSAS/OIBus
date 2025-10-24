// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme = require('prism-react-renderer').themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'OIBus - Data collection solution',
  url: 'https://oibus.optimistik.com/',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  tagline: 'Start collecting your data now',
  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn'
    }
  },

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'OptimistikSAS', // Usually your GitHub org/username.
  projectName: 'OIBus', // Usually your repo name.

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          lastVersion: 'current',
          editLocalizedFiles: true
        },
        theme: { customCss: require.resolve('./src/css/custom.css') }
      }
    ]
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'OIBus',
        logo: {
          alt: 'OIBus Logo',
          src: 'img/logo.svg'
        },
        items: [
          {
            type: 'doc',
            docId: 'guide/index',
            position: 'left',
            label: 'Documentation'
          },
          {
            type: 'doc',
            docId: 'developer/index',
            position: 'left',
            label: 'Developer'
          },
          {
            type: 'doc',
            docId: 'use-cases/index',
            position: 'left',
            label: 'Use cases'
          },
          {
            type: 'localeDropdown',
            position: 'right'
          },
          {
            href: 'https://github.com/OptimistikSAS/OIBus',
            label: 'GitHub',
            position: 'right'
          }
        ]
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'User Guide',
                to: '/docs/guide/'
              },
              {
                label: 'Developer Guide',
                to: '/docs/developer/'
              },
              {
                label: 'Use cases',
                to: '/docs/use-cases/'
              }
            ]
          },
          {
            title: 'Community',
            items: [
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/showcase/oibus-by-optimistik'
              }
            ]
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/OptimistikSAS/OIBus'
              }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Optimistik. Built with Docusaurus.
        All trademarks, logos and brand names are the property of their respective owners. All company, product and service names used in this website are for identification purposes only. Use of these names, trademarks and brands does not imply endorsement.`
      },
      algolia: {
        // The application ID provided by Algolia
        appId: 'RFGM4OD43Y',

        // Public API key: it is safe to commit it
        apiKey: '4d97db82cb5a33edb810b5798335f501',

        indexName: 'oibus-optimistik',

        // Optional: see doc section below
        contextualSearch: true,

        // Optional: Algolia search parameters
        searchParameters: {},

        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: 'search'

        //... other Algolia params
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme
      }
    })
};

module.exports = config;
