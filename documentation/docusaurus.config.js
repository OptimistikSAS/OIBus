import { themes } from 'prism-react-renderer';
const { github: lightCodeTheme, dracula: darkCodeTheme } = themes;

/** @type {import('@docusaurus/types').Config} */
export default {
  title: 'OIBus',
  url: 'https://oibus.optimistik.com/',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  tagline: 'Open source industrial data collection — OPC UA, Modbus, SQL, MQTT and more',
  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn'
    }
  },

  organizationName: 'OptimistikSAS',
  projectName: 'OIBus',

  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  // JSON-LD structured data for the whole site
  headTags: [
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'OIBus',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Windows, Linux, macOS, Docker',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        description:
          'Open source industrial data collection software. Collect data from OPC UA, Modbus, SQL databases, MQTT and REST APIs. Forward it to OIAnalytics, Amazon S3, Azure Blob Storage, or any HTTP endpoint.',
        url: 'https://oibus.optimistik.com',
        downloadUrl: 'https://github.com/OptimistikSAS/OIBus/releases',
        author: {
          '@type': 'Organization',
          name: 'Optimistik',
          url: 'https://optimistik.com'
        },
        maintainer: {
          '@type': 'Organization',
          name: 'Optimistik',
          url: 'https://optimistik.com'
        },
        license: 'https://ec.europa.eu/info/european-union-public-licence_en',
        codeRepository: 'https://github.com/OptimistikSAS/OIBus',
        isAccessibleForFree: true,
        keywords: 'OPC UA, Modbus, MQTT, SQL, industrial data collection, IIoT, open source, edge computing, data historian'
      })
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'me',
        href: 'https://github.com/OptimistikSAS/OIBus'
      }
    }
  ],

  plugins: [
    function noWebpackBarPlugin() {
      return {
        name: 'no-webpackbar-plugin',
        configureWebpack(config) {
          // webpackbar 6.x is incompatible with webpack 5.106+ (ValidationError on ProgressPlugin options).
          // Remove it here until the dependency is updated.
          config.plugins = (config.plugins || []).filter(p => p.constructor?.name !== 'WebpackBarPlugin');
          return {};
        }
      };
    }
  ],

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          path: 'docs',
          routeBasePath: '/docs',
          editLocalizedFiles: true
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**']
        },
        theme: { customCss: [require.resolve('./src/css/custom.css')] }
      }
    ],
    [
      'redocusaurus',
      {
        openapi: {
          path: 'openapi',
          routeBasePath: '/api'
        }
      }
    ]
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Global meta tags added to every page
      metadata: [
        {
          name: 'keywords',
          content:
            'OIBus, OPC UA, Modbus, MQTT, SQL, industrial data collection, IIoT, open source, edge computing, data historian, OIAnalytics, Optimistik'
        },
        { name: 'author', content: 'Optimistik' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'OIBus Documentation' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:site', content: '@optimistik' }
      ],

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
            docId: 'use-cases/index',
            position: 'left',
            label: 'Use cases'
          },
          {
            type: 'doc',
            docId: 'developer/index',
            position: 'left',
            label: 'Developer'
          },
          {
            type: 'doc',
            docId: 'api/index',
            position: 'left',
            label: 'API'
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
              { label: 'User Guide', to: '/docs/guide/' },
              { label: 'Use cases', to: '/docs/use-cases/' },
              { label: 'Developer Guide', to: '/docs/developer/' },
              { label: 'API', to: '/docs/api/' }
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
              { label: 'GitHub', href: 'https://github.com/OptimistikSAS/OIBus' },
              { label: 'Releases', href: 'https://github.com/OptimistikSAS/OIBus/releases' }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Optimistik. Built with Docusaurus. All trademarks, logos and brand names are the property of their respective owners. All company, product and service names used in this website are for identification purposes only. Use of these names, trademarks and brands does not imply endorsement.`
      },
      algolia: {
        appId: 'RFGM4OD43Y',
        apiKey: '4d97db82cb5a33edb810b5798335f501',
        indexName: 'oibus-optimistik',
        contextualSearch: true,
        searchParameters: {},
        searchPagePath: 'search'
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme
      }
    })
};
